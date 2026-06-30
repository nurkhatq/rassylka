'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Manager {
  id: string;
  name: string;
  password: string;
}

interface Scripts {
  kz: string;
  ru: string;
}

interface SegmentCounts {
  [segment: string]: number;
}

interface MerchantsResponse {
  managers: Manager[];
  managerIds: string[];
  merchants: Array<{ segment: string; merchant_id: string }>;
}

const SEGMENTS = ['Топ', 'Хорошие', 'Средние', 'Малые', 'Нет данных'];

function getSegmentClass(seg: string) {
  if (seg === 'Топ') return 'badge-top';
  if (seg === 'Хорошие') return 'badge-good';
  if (seg === 'Средние') return 'badge-mid';
  if (seg === 'Малые') return 'badge-small';
  return 'badge-nodata';
}

export default function AdminPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [scripts, setScripts] = useState<Scripts>({ kz: '', ru: '' });
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addError, setAddError] = useState('');
  const [scriptMsg, setScriptMsg] = useState('');
  const [segmentStats, setSegmentStats] = useState<Record<string, SegmentCounts>>({});
  const [totalCounts, setTotalCounts] = useState<SegmentCounts>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [mgrsRes, scriptsRes, merchantsRes] = await Promise.all([
        fetch('/api/managers'),
        fetch('/api/scripts'),
        fetch('/api/merchants'),
      ]);

      if (mgrsRes.status === 401) {
        router.push('/login');
        return;
      }

      const mgrs: Manager[] = await mgrsRes.json();
      const scr: Scripts = await scriptsRes.json();
      setManagers(Array.isArray(mgrs) ? mgrs : []);
      setScripts(scr);

      if (merchantsRes.ok) {
        const data: MerchantsResponse = await merchantsRes.json();
        computeStats(data.merchants, mgrs, data.managerIds || mgrs.map((m) => m.id));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  function computeStats(
    merchants: Array<{ segment: string; merchant_id: string }>,
    mgrs: Manager[],
    managerIds: string[]
  ) {
    const N = mgrs.length;
    if (N === 0) return;

    // Group merchants by segment
    const bySegment: Record<string, Array<{ segment: string; merchant_id: string }>> = {};
    for (const seg of SEGMENTS) bySegment[seg] = [];

    for (const m of merchants) {
      const seg = SEGMENTS.includes(m.segment) ? m.segment : 'Нет данных';
      bySegment[seg].push(m);
    }

    const stats: Record<string, SegmentCounts> = {};
    const totals: SegmentCounts = {};
    for (const seg of SEGMENTS) totals[seg] = bySegment[seg].length;
    setTotalCounts(totals);

    for (let mi = 0; mi < mgrs.length; mi++) {
      const mgr = mgrs[mi];
      const counts: SegmentCounts = {};
      for (const seg of SEGMENTS) {
        const segList = bySegment[seg];
        let count = 0;
        for (let i = 0; i < segList.length; i++) {
          if (i % N === mi) count++;
        }
        counts[seg] = count;
      }
      stats[mgr.id] = counts;
    }
    setSegmentStats(stats);
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddManager(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!newName.trim() || !newPassword.trim()) {
      setAddError('Введите имя и пароль');
      return;
    }

    const res = await fetch('/api/managers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), password: newPassword.trim() }),
    });

    if (!res.ok) {
      const d = await res.json();
      setAddError(d.error || 'Ошибка');
      return;
    }

    setNewName('');
    setNewPassword('');
    loadData();
  }

  async function handleDeleteManager(id: string, name: string) {
    if (!confirm(`Удалить менеджера ${name}?`)) return;

    await fetch(`/api/managers/${id}`, { method: 'DELETE' });
    loadData();
  }

  async function handleSaveScripts(e: React.FormEvent) {
    e.preventDefault();
    setScriptMsg('');

    const res = await fetch('/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scripts),
    });

    setScriptMsg(res.ok ? 'Сохранено!' : 'Ошибка сохранения');
    setTimeout(() => setScriptMsg(''), 3000);
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ color: 'var(--text-muted)' }}>Загрузка...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Панель администратора</h1>
        <button className="btn-ghost" onClick={handleLogout}>
          Выйти
        </button>
      </div>

      <div className="container">
        {/* Managers table */}
        <div className="section">
          <div className="section-title">Менеджеры</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Имя</th>
                  {SEGMENTS.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                  <th>Всего</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {managers.length === 0 && (
                  <tr>
                    <td colSpan={SEGMENTS.length + 3} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                      Нет менеджеров
                    </td>
                  </tr>
                )}
                {managers.map((mgr) => {
                  const counts = segmentStats[mgr.id] || {};
                  const total = SEGMENTS.reduce((sum, s) => sum + (counts[s] || 0), 0);
                  return (
                    <tr key={mgr.id}>
                      <td style={{ fontWeight: 500 }}>{mgr.name}</td>
                      {SEGMENTS.map((s) => (
                        <td key={s}>{counts[s] ?? 0}</td>
                      ))}
                      <td style={{ fontWeight: 600, color: 'var(--green)' }}>{total}</td>
                      <td>
                        <button
                          className="btn-danger"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleDeleteManager(mgr.id, mgr.name)}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {managers.length > 0 && (
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>Итого</td>
                    {SEGMENTS.map((s) => (
                      <td key={s} style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {totalCounts[s] ?? 0}
                      </td>
                    ))}
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {SEGMENTS.reduce((sum, s) => sum + (totalCounts[s] || 0), 0)}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div style={{ fontWeight: 500, marginBottom: 12 }}>Добавить менеджера</div>
            <form onSubmit={handleAddManager}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Имя менеджера"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Пароль"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button type="submit" className="btn-green">
                  Добавить
                </button>
              </div>
              {addError && <div className="error-msg">{addError}</div>}
            </form>
          </div>
        </div>

        {/* Scripts */}
        <div className="section">
          <div className="section-title">Скрипты звонков</div>
          <form onSubmit={handleSaveScripts}>
            <div className="grid-2">
              <div className="card">
                <div style={{ fontWeight: 500, marginBottom: 10 }}>Казахский скрипт (КАЗ)</div>
                <textarea
                  value={scripts.kz}
                  onChange={(e) => setScripts((s) => ({ ...s, kz: e.target.value }))}
                  rows={6}
                  placeholder="Казахский скрипт..."
                />
              </div>
              <div className="card">
                <div style={{ fontWeight: 500, marginBottom: 10 }}>Русский скрипт (РУС)</div>
                <textarea
                  value={scripts.ru}
                  onChange={(e) => setScripts((s) => ({ ...s, ru: e.target.value }))}
                  rows={6}
                  placeholder="Русский скрипт..."
                />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" className="btn-green">
                Сохранить скрипты
              </button>
              {scriptMsg && (
                <span className={scriptMsg.includes('!') ? 'success-msg' : 'error-msg'}>
                  {scriptMsg}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
