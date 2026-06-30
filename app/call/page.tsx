'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePrice, formatPrice } from '@/lib/pricing';

interface Merchant {
  merchant_id: string;
  name: string;
  phone: string;
  rating: number;
  reviews_count: number;
  sales_count: number;
  orders_segment: string;
  cancelled_pct: number;
  returned_pct: number;
  late_delivery_pct: number;
  state: string;
  city: string;
  created: string;
  segment: string;
}

interface Scripts {
  kz: string;
  ru: string;
}

type CallStatus = 'called' | 'interest' | 'callback' | 'unavailable' | 'refused';

const SEGMENTS = ['Топ', 'Хорошие', 'Средние', 'Малые', 'Нет данных'];

const STATUS_COLORS: Record<CallStatus, string> = {
  called: '#22c55e',
  interest: '#f59e0b',
  callback: '#3b82f6',
  unavailable: '#6b7280',
  refused: '#ef4444',
};

const STATUS_LABELS: Record<CallStatus, string> = {
  called: '✓ Позвонил',
  interest: '★ Интерес',
  callback: '📅 Перезвонить',
  unavailable: '— Недоступен',
  refused: '✗ Отказ',
};

const FILTER_OPTIONS: Array<{ key: CallStatus | 'all' | 'none'; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'none', label: 'Не звонили' },
  { key: 'interest', label: 'Интерес' },
  { key: 'callback', label: 'Перезвонить' },
  { key: 'unavailable', label: 'Недоступен' },
  { key: 'refused', label: 'Отказ' },
];

function getSegmentBadge(seg: string) {
  if (seg === 'Топ') return 'badge badge-top';
  if (seg === 'Хорошие') return 'badge badge-good';
  if (seg === 'Средние') return 'badge badge-mid';
  if (seg === 'Малые') return 'badge badge-small';
  return 'badge badge-nodata';
}

function getStateBadge(state: string) {
  if (state === 'GOOD') return 'badge badge-state-ok';
  if (state === 'BAD') return 'badge badge-state-bad';
  return 'badge badge-state-neutral';
}

function stateLabel(state: string) {
  if (state === 'GOOD') return 'Хорошее';
  if (state === 'BAD') return 'Плохое';
  return state || 'Неизвестно';
}

export default function CallPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [scripts, setScripts] = useState<Scripts>({ kz: '', ru: '' });
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [scriptTab, setScriptTab] = useState<'ru' | 'kz'>('ru');
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CallStatus | 'all' | 'none'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/merchants').then((r) => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        return r.json();
      }),
      fetch('/api/scripts').then((r) => r.json()),
      fetch('/api/statuses').then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([merchantData, scriptData, statusData]) => {
        if (merchantData && merchantData.merchants) {
          setMerchants(merchantData.merchants);
        }
        if (scriptData) setScripts(scriptData);
        if (statusData) setStatuses(statusData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = merchants;

    if (q) {
      filtered = filtered.filter(
        (m) => m.name.toLowerCase().includes(q) || m.phone.includes(q)
      );
    }

    if (filter === 'none') {
      filtered = filtered.filter((m) => !statuses[m.merchant_id]);
    } else if (filter !== 'all') {
      filtered = filtered.filter((m) => statuses[m.merchant_id] === filter);
    }

    const groups: Record<string, Merchant[]> = {};
    for (const seg of SEGMENTS) groups[seg] = [];

    for (const m of filtered) {
      const seg = SEGMENTS.includes(m.segment) ? m.segment : 'Нет данных';
      groups[seg].push(m);
    }

    return groups;
  }, [merchants, search, filter, statuses]);

  const filteredTotal = useMemo(
    () => SEGMENTS.reduce((s, seg) => s + (grouped[seg]?.length ?? 0), 0),
    [grouped]
  );

  async function handleSetStatus(merchantId: string, status: CallStatus) {
    const current = statuses[merchantId];
    const newStatus = current === status ? null : status;

    setStatuses((prev) => {
      const next = { ...prev };
      if (newStatus === null) {
        delete next[merchantId];
      } else {
        next[merchantId] = newStatus;
      }
      return next;
    });

    await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: merchantId, status: newStatus }),
    }).catch(() => {});

    // Close overlay so manager can move to next merchant
    setSelected(null);
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Загрузка...</span>
      </div>
    );
  }

  const currentStatus = selected ? (statuses[selected.merchant_id] as CallStatus | undefined) : undefined;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <h1>
          Мерчанты{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}>
            ({filteredTotal}/{merchants.length})
          </span>
        </h1>
        <button className="btn-ghost" onClick={handleLogout}>
          Выйти
        </button>
      </div>

      {/* Search */}
      <div className="search-box">
        <input
          type="text"
          placeholder="Поиск по имени или телефону..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div className="filter-chips">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`chip ${filter === opt.key ? 'active' : ''}`}
            onClick={() => setFilter(opt.key as CallStatus | 'all' | 'none')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Merchant list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {SEGMENTS.map((seg) => {
          const items = grouped[seg];
          if (!items || items.length === 0) return null;
          return (
            <div key={seg}>
              <div className="segment-header">
                {seg} ({items.length})
              </div>
              {items.map((m) => {
                const st = statuses[m.merchant_id] as CallStatus | undefined;
                return (
                  <div
                    key={m.merchant_id}
                    className="merchant-item"
                    onClick={() => {
                      setSelected(m);
                      setScriptTab('ru');
                    }}
                  >
                    {st ? (
                      <span
                        className="status-dot"
                        style={{ background: STATUS_COLORS[st] }}
                      />
                    ) : (
                      <span
                        className="status-dot"
                        style={{ background: '#333' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mi-name">{m.name}</div>
                      <div className="mi-phone">
                        {m.phone}
                        {' · '}
                        <span className={getSegmentBadge(m.segment)}>{m.segment}</span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>›</span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {filteredTotal === 0 && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            Нет мерчантов по этому фильтру
          </div>
        )}
      </div>

      {/* Overlay backdrop */}
      {selected && (
        <div
          className="overlay-backdrop"
          onClick={() => setSelected(null)}
        />
      )}

      {/* Overlay / right panel */}
      {selected && (
        <div className="overlay">
          <div className="overlay-handle" />
          <div className="overlay-content">
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 22,
                  lineHeight: 1,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            {/* Name + badges */}
            <div style={{ marginBottom: 8 }}>
              <div
                style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}
              >
                {selected.name}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={getSegmentBadge(selected.segment)}>{selected.segment}</span>
                <span className={getStateBadge(selected.state)}>{stateLabel(selected.state)}</span>
                {currentStatus && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: STATUS_COLORS[currentStatus],
                      color: '#000',
                    }}
                  >
                    {STATUS_LABELS[currentStatus]}
                  </span>
                )}
              </div>
            </div>

            {/* Big phone link */}
            <a href={`tel:${selected.phone}`} className="big-phone">
              📞 {selected.phone}
            </a>

            {/* Price */}
            <div className="price-tag">
              {formatPrice(calculatePrice(selected))}
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
                рекомендуемая цена
              </div>
            </div>

            {/* Stats row */}
            <div className="stats-row">
              <div className="stat-cell">
                <div className="sv">{selected.rating?.toFixed(1) ?? '—'}</div>
                <div className="sl">Рейтинг</div>
              </div>
              <div className="stat-cell">
                <div className="sv">{selected.sales_count?.toLocaleString() ?? '—'}</div>
                <div className="sl">Продажи</div>
              </div>
              <div className="stat-cell">
                <div
                  className="sv"
                  style={{ color: selected.cancelled_pct > 10 ? '#ef4444' : '#22c55e' }}
                >
                  {selected.cancelled_pct?.toFixed(1) ?? '—'}%
                </div>
                <div className="sl">Отмены%</div>
              </div>
              <div className="stat-cell">
                <div
                  className="sv"
                  style={{ color: selected.returned_pct > 5 ? '#ef4444' : '#22c55e' }}
                >
                  {selected.returned_pct?.toFixed(1) ?? '—'}%
                </div>
                <div className="sl">Возвраты%</div>
              </div>
              <div className="stat-cell">
                <div
                  className="sv"
                  style={{ color: selected.late_delivery_pct > 15 ? '#ef4444' : '#22c55e' }}
                >
                  {selected.late_delivery_pct?.toFixed(1) ?? '—'}%
                </div>
                <div className="sl">Опозд%</div>
              </div>
            </div>

            {/* Script tabs */}
            <div className="script-tabs" style={{ marginTop: 12 }}>
              <button
                className={`script-tab ${scriptTab === 'ru' ? 'active' : ''}`}
                onClick={() => setScriptTab('ru')}
              >
                РУС
              </button>
              <button
                className={`script-tab ${scriptTab === 'kz' ? 'active' : ''}`}
                onClick={() => setScriptTab('kz')}
              >
                КАЗ
              </button>
            </div>
            <div
              className="script-box"
              style={{ maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 13 }}
            >
              {(scriptTab === 'ru' ? scripts.ru : scripts.kz || 'Скрипт не задан').replace(
                /\[ЦЕНА\]/g,
                formatPrice(calculatePrice(selected))
              )}
            </div>

            {/* Status buttons */}
            <div style={{ marginTop: 16 }}>
              {(Object.keys(STATUS_LABELS) as CallStatus[]).map((st) => {
                const isActive = currentStatus === st;
                return (
                  <button
                    key={st}
                    className={`status-btn-mobile ${isActive ? 'active' : ''}`}
                    style={
                      isActive
                        ? { background: STATUS_COLORS[st], color: '#000' }
                        : {}
                    }
                    onClick={() => handleSetStatus(selected.merchant_id, st)}
                  >
                    {STATUS_LABELS[st]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
