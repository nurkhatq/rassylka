'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
type FilterKey = CallStatus | 'all' | 'none';

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

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'none', label: 'Не звонили' },
  { key: 'interest', label: 'Интерес' },
  { key: 'callback', label: 'Перезвонить' },
  { key: 'called', label: 'Звонил' },
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
  return state || '—';
}

function ScriptBlock({ text, price }: { text: string; price: string }) {
  const filled = text.replace(/\[ЦЕНА\]/g, price);
  // Split into numbered sections
  const sections = filled.split(/(?=\n\d+\.\s)/);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text)' }}>
      {sections.map((section, i) => {
        const match = section.match(/^(\n?)(\d+\.\s[^\n]+)\n?([\s\S]*)$/);
        if (!match) {
          return (
            <p key={i} style={{ marginBottom: 8, color: 'var(--text-muted)' }}>
              {section.trim()}
            </p>
          );
        }
        const [, , heading, body] = match;
        const lines = body.trim().split('\n');
        return (
          <div key={i} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#25D366',
                marginBottom: 4,
              }}
            >
              {heading}
            </div>
            {lines.map((line, j) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              const isQuote = trimmed.startsWith('«') || trimmed.startsWith('"');
              const isArrow = trimmed.startsWith('→') || trimmed.includes('→');
              const isIf = trimmed.startsWith('Если') || trimmed.startsWith('Егер');
              return (
                <div
                  key={j}
                  style={{
                    marginBottom: 4,
                    paddingLeft: isQuote ? 8 : isArrow || isIf ? 12 : 0,
                    borderLeft: isQuote
                      ? '2px solid rgba(37,211,102,0.3)'
                      : undefined,
                    color: isQuote
                      ? '#e0e0e0'
                      : isArrow
                      ? '#888'
                      : isIf
                      ? '#aaa'
                      : 'var(--text-muted)',
                    fontStyle: isIf ? 'italic' : undefined,
                  }}
                >
                  {trimmed}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function CallPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [scripts, setScripts] = useState<Scripts>({ kz: '', ru: '' });
  const [scriptTab, setScriptTab] = useState<'ru' | 'kz'>('ru');
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('none');
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);

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
        if (merchantData?.merchants) setMerchants(merchantData.merchants);
        if (scriptData) setScripts(scriptData);
        if (statusData) setStatuses(statusData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return merchants.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.phone.includes(q)) return false;
      if (filter === 'none') return !statuses[m.merchant_id];
      if (filter !== 'all') return statuses[m.merchant_id] === filter;
      return true;
    });
  }, [merchants, search, filter, statuses]);

  const safeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const merchant = filtered[safeIndex] ?? null;

  const counts = useMemo(() => {
    const total = merchants.length;
    const done = Object.keys(statuses).length;
    const interest = Object.values(statuses).filter((s) => s === 'interest').length;
    const callback = Object.values(statuses).filter((s) => s === 'callback').length;
    return { total, done, remaining: total - done, interest, callback };
  }, [merchants, statuses]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, filtered.length - 1));
  }, [filtered.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  async function handleSetStatus(merchantId: string, status: CallStatus) {
    const current = statuses[merchantId];
    const newStatus = current === status ? null : status;

    setStatuses((prev) => {
      const next = { ...prev };
      if (newStatus === null) delete next[merchantId];
      else next[merchantId] = newStatus;
      return next;
    });

    setSaving(true);
    await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: merchantId, status: newStatus }),
    })
      .catch(() => {})
      .finally(() => setSaving(false));

    // Auto-advance to next merchant after marking
    if (newStatus !== null) {
      setTimeout(() => {
        setIndex((i) => {
          if (i < filtered.length - 1) return i + 1;
          return i;
        });
      }, 300);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #25D366', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)' }}>Загрузка...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const currentStatus = merchant ? (statuses[merchant.merchant_id] as CallStatus | undefined) : undefined;
  const price = merchant ? formatPrice(calculatePrice(merchant)) : '';
  const progress = filtered.length > 0 ? ((safeIndex) / filtered.length) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* ── Top bar ── */}
      <div style={{ background: '#111', borderBottom: '1px solid #1f1f1f', padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>
              <span style={{ color: '#25D366', fontWeight: 700, fontSize: 14 }}>{safeIndex + 1}</span>
              <span style={{ color: '#555' }}>/{filtered.length}</span>
            </span>
            <span>★ {counts.interest}</span>
            <span>📅 {counts.callback}</span>
            <span style={{ color: '#555' }}>осталось {counts.remaining}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowSearch((v) => !v)}
              style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '5px 10px', borderRadius: 6, fontSize: 12 }}
            >
              {showSearch ? '✕' : '🔍'}
            </button>
            <button
              onClick={handleLogout}
              style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '5px 10px', borderRadius: 6, fontSize: 12 }}
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: '#1f1f1f', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#25D366', transition: 'width 0.3s' }} />
        </div>

        {/* Search (collapsible) */}
        {showSearch && (
          <div style={{ marginTop: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder="Поиск по имени или телефону..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setIndex(0); }}
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 14, width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0, background: '#0f0f0f' }}>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { setFilter(opt.key); setIndex(0); }}
            style={{
              border: `1px solid ${filter === opt.key ? '#25D366' : '#2a2a2a'}`,
              background: filter === opt.key ? 'rgba(37,211,102,0.1)' : '#1a1a1a',
              color: filter === opt.key ? '#25D366' : '#888',
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              fontWeight: filter === opt.key ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Main card area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 0' }}>
        {!merchant ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {filter === 'none' ? 'Все обзвонены!' : 'Нет мерчантов'}
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              {filter === 'none' ? `Обработано ${counts.done} из ${counts.total}` : 'Измените фильтр'}
            </div>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                style={{ marginTop: 8, background: '#25D366', color: '#000', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
              >
                Показать всех
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Navigation row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button
                onClick={goPrev}
                disabled={safeIndex === 0}
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: safeIndex === 0 ? '#333' : '#888', width: 36, height: 36, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                ‹
              </button>
              <span style={{ fontSize: 12, color: '#555' }}>
                {merchant.city || '—'}
              </span>
              <button
                onClick={goNext}
                disabled={safeIndex >= filtered.length - 1}
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: safeIndex >= filtered.length - 1 ? '#333' : '#888', width: 36, height: 36, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                ›
              </button>
            </div>

            {/* Merchant name + badges */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, marginBottom: 8, color: '#fff' }}>
                {merchant.name}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={getSegmentBadge(merchant.segment)}>{merchant.segment}</span>
                <span className={getStateBadge(merchant.state)}>{stateLabel(merchant.state)}</span>
                {currentStatus && (
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[currentStatus], color: '#000' }}>
                    {STATUS_LABELS[currentStatus]}
                  </span>
                )}
                {saving && <span style={{ fontSize: 11, color: '#555' }}>сохраняем...</span>}
              </div>
            </div>

            {/* Phone */}
            <a
              href={`tel:${merchant.phone}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}
            >
              <span style={{ fontSize: 20 }}>📞</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#25D366', letterSpacing: '0.5px' }}>{merchant.phone}</span>
            </a>

            {/* Price */}
            <div style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#25D366' }}>{price}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>рекомендуемая цена</div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
              {[
                { label: 'Рейтинг', value: merchant.rating?.toFixed(1) ?? '—', color: undefined },
                { label: 'Продажи', value: merchant.sales_count?.toLocaleString() ?? '—', color: undefined },
                { label: 'Отмены', value: `${merchant.cancelled_pct?.toFixed(1) ?? '—'}%`, color: merchant.cancelled_pct > 10 ? '#ef4444' : '#22c55e' },
                { label: 'Возвраты', value: `${merchant.returned_pct?.toFixed(1) ?? '—'}%`, color: merchant.returned_pct > 5 ? '#ef4444' : '#22c55e' },
                { label: 'Опоздания', value: `${merchant.late_delivery_pct?.toFixed(1) ?? '—'}%`, color: merchant.late_delivery_pct > 15 ? '#ef4444' : '#22c55e' },
              ].map((s) => (
                <div key={s.label} style={{ background: '#111', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color ?? '#e0e0e0' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#555', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Script */}
            <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #1f1f1f' }}>
                {(['ru', 'kz'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setScriptTab(lang)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: scriptTab === lang ? '#25D366' : 'transparent',
                      color: scriptTab === lang ? '#000' : '#666',
                      fontWeight: scriptTab === lang ? 700 : 400,
                      border: 'none',
                      borderRadius: 0,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {lang === 'ru' ? '🇷🇺 Русский' : '🇰🇿 Казахский'}
                  </button>
                ))}
              </div>
              <div style={{ padding: '14px 16px', maxHeight: 320, overflowY: 'auto' }}>
                <ScriptBlock
                  text={scriptTab === 'ru' ? scripts.ru : (scripts.kz || 'Скрипт не задан')}
                  price={price}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Status buttons (fixed bottom) ── */}
      {merchant && (
        <div style={{ flexShrink: 0, background: '#0a0a0a', borderTop: '1px solid #1a1a1a', padding: '10px 12px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.entries(STATUS_LABELS) as [CallStatus, string][]).map(([st, label]) => {
              const isActive = currentStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => handleSetStatus(merchant.merchant_id, st)}
                  style={{
                    padding: '13px 8px',
                    borderRadius: 10,
                    border: isActive ? `2px solid ${STATUS_COLORS[st]}` : '2px solid transparent',
                    background: isActive ? STATUS_COLORS[st] : '#1a1a1a',
                    color: isActive ? '#000' : '#888',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? `0 0 12px ${STATUS_COLORS[st]}55` : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
