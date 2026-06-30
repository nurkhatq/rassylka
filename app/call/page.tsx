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

type CallStatus = 'called' | 'interest' | 'unavailable' | 'refused';

const SEGMENTS = ['Топ', 'Хорошие', 'Средние', 'Малые', 'Нет данных'];

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

function renderStars(rating: number) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

const STATUS_STORAGE_KEY = 'kaspi_call_statuses';

function loadStatuses(): Record<string, CallStatus> {
  try {
    const raw = localStorage.getItem(STATUS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStatuses(s: Record<string, CallStatus>) {
  try {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export default function CallPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [scripts, setScripts] = useState<Scripts>({ kz: '', ru: '' });
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [scriptTab, setScriptTab] = useState<'ru' | 'kz'>('ru');
  const [statuses, setStatuses] = useState<Record<string, CallStatus>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStatuses(loadStatuses());

    Promise.all([
      fetch('/api/merchants').then((r) => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        return r.json();
      }),
      fetch('/api/scripts').then((r) => r.json()),
    ])
      .then(([merchantData, scriptData]) => {
        if (merchantData && merchantData.merchants) {
          setMerchants(merchantData.merchants);
        }
        if (scriptData) {
          setScripts(scriptData);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? merchants.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.phone.includes(q)
        )
      : merchants;

    const groups: Record<string, Merchant[]> = {};
    for (const seg of SEGMENTS) groups[seg] = [];

    for (const m of filtered) {
      const seg = SEGMENTS.includes(m.segment) ? m.segment : 'Нет данных';
      groups[seg].push(m);
    }

    return groups;
  }, [merchants, search]);

  function setStatus(merchantId: string, status: CallStatus) {
    setStatuses((prev) => {
      const next = { ...prev };
      if (next[merchantId] === status) {
        delete next[merchantId];
      } else {
        next[merchantId] = status;
      }
      saveStatuses(next);
      return next;
    });
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  const currentStatus = selected ? statuses[selected.merchant_id] : undefined;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ color: 'var(--text-muted)' }}>Загрузка списка...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>
          Мои мерчанты{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}>
            ({merchants.length})
          </span>
        </h1>
        <button className="btn-ghost" onClick={handleLogout}>
          Выйти
        </button>
      </div>

      <div className="call-layout">
        {/* Left: merchant list */}
        <div className="merchant-list">
          <div className="search-box">
            <input
              type="text"
              placeholder="Поиск по имени или телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {SEGMENTS.map((seg) => {
            const items = grouped[seg];
            if (!items || items.length === 0) return null;

            return (
              <div key={seg}>
                <div className="segment-header">
                  {seg} ({items.length})
                </div>
                {items.map((m) => {
                  const st = statuses[m.merchant_id];
                  return (
                    <div
                      key={m.merchant_id}
                      className={`merchant-list-item ${selected?.merchant_id === m.merchant_id ? 'active' : ''}`}
                      onClick={() => setSelected(m)}
                    >
                      <div className="merchant-name">{m.name}</div>
                      <div className="merchant-meta">
                        <span>{m.phone}</span>
                        <span className={getSegmentBadge(m.segment)}>{m.segment}</span>
                        {st && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background:
                                st === 'called'
                                  ? '#1a6e3c'
                                  : st === 'interest'
                                  ? '#7a5c00'
                                  : st === 'refused'
                                  ? '#7a1a1a'
                                  : '#333',
                              color: st === 'interest' ? '#fff' : '#fff',
                            }}
                          >
                            {st === 'called'
                              ? '✓ Позвонил'
                              : st === 'interest'
                              ? '★ Интерес'
                              : st === 'unavailable'
                              ? '— Недоступен'
                              : '✗ Отказ'}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto' }}>{m.sales_count?.toLocaleString()} прод.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {merchants.length === 0 && (
            <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>
              Нет назначенных мерчантов
            </div>
          )}
        </div>

        {/* Right: merchant detail */}
        <div className="merchant-detail">
          {!selected ? (
            <div className="empty-state">Выберите мерчанта из списка</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <div>
                  <div className="merchant-card-title">{selected.name}</div>
                  <a href={`tel:${selected.phone}`} className="phone-link">
                    {selected.phone}
                  </a>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <span className={getSegmentBadge(selected.segment)}>{selected.segment}</span>
                  <span className={getStateBadge(selected.state)}>{stateLabel(selected.state)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className="rating-stars">{renderStars(selected.rating)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {selected.rating} ({selected.reviews_count} отзывов)
                </span>
              </div>

              {selected.city && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
                  {selected.city}
                </div>
              )}

              <div className="merchant-stats-grid">
                <div className="stat-box">
                  <div className="stat-value">{selected.sales_count?.toLocaleString()}</div>
                  <div className="stat-label">Продажи</div>
                </div>
                <div className="stat-box">
                  <div
                    className="stat-value"
                    style={{ color: selected.cancelled_pct > 10 ? 'var(--danger)' : 'var(--green)' }}
                  >
                    {selected.cancelled_pct?.toFixed(1)}%
                  </div>
                  <div className="stat-label">Отменено</div>
                </div>
                <div className="stat-box">
                  <div
                    className="stat-value"
                    style={{ color: selected.returned_pct > 5 ? 'var(--danger)' : 'var(--green)' }}
                  >
                    {selected.returned_pct?.toFixed(1)}%
                  </div>
                  <div className="stat-label">Возвращено</div>
                </div>
                <div className="stat-box">
                  <div
                    className="stat-value"
                    style={{ color: selected.late_delivery_pct > 15 ? 'var(--danger)' : 'var(--green)' }}
                  >
                    {selected.late_delivery_pct?.toFixed(1)}%
                  </div>
                  <div className="stat-label">Опоздание</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ fontSize: 16 }}>
                    {selected.orders_segment}
                  </div>
                  <div className="stat-label">Заказы (сегм.)</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value" style={{ fontSize: 16 }}>
                    {selected.created ? selected.created.slice(0, 7) : '—'}
                  </div>
                  <div className="stat-label">Регистрация</div>
                </div>
              </div>

              {/* Price */}
              {(() => {
                const price = calculatePrice(selected);
                return (
                  <div style={{
                    background: 'rgba(37,211,102,0.08)',
                    border: '1px solid rgba(37,211,102,0.3)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Рекомендуемая цена</span>
                    <span style={{ color: '#25D366', fontWeight: 700, fontSize: 22 }}>
                      {formatPrice(price)}
                    </span>
                  </div>
                );
              })()}

              {/* Script */}
              <div style={{ marginBottom: 20 }}>
                <div className="script-tabs">
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
                <div className="script-box" style={{ whiteSpace: 'pre-wrap' }}>
                  {(scriptTab === 'ru' ? scripts.ru : scripts.kz || 'Скрипт не задан')
                    .replace(/\[ЦЕНА\]/g, formatPrice(calculatePrice(selected)))}
                </div>
              </div>

              {/* Status buttons */}
              <div className="status-buttons">
                <button
                  className={`status-btn called ${currentStatus === 'called' ? 'active' : ''}`}
                  onClick={() => setStatus(selected.merchant_id, 'called')}
                >
                  ✓ Позвонил
                </button>
                <button
                  className={`status-btn interest ${currentStatus === 'interest' ? 'active' : ''}`}
                  onClick={() => setStatus(selected.merchant_id, 'interest')}
                >
                  ★ Интерес
                </button>
                <button
                  className={`status-btn unavailable ${currentStatus === 'unavailable' ? 'active' : ''}`}
                  onClick={() => setStatus(selected.merchant_id, 'unavailable')}
                >
                  — Недоступен
                </button>
                <button
                  className={`status-btn refused ${currentStatus === 'refused' ? 'active' : ''}`}
                  onClick={() => setStatus(selected.merchant_id, 'refused')}
                >
                  ✗ Отказ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
