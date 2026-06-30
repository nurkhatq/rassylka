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
type ContentTab = 'info' | 'script';

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
  callback: '📅 Перезвон',
  unavailable: '— Недоступ',
  refused: '✗ Отказ',
};

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: 'none', label: 'Не звонили' },
  { key: 'all', label: 'Все' },
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

function ScriptView({ text, price }: { text: string; price: string }) {
  const filled = text.replace(/\[ЦЕНА\]/g, price);
  const sections = filled.split(/(?=\n\d+\.\s)/);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)' }}>
      {sections.map((section, i) => {
        const match = section.match(/^(\n?)(\d+\.\s[^\n]+)\n?([\s\S]*)$/);
        if (!match) {
          return <p key={i} style={{ marginBottom: 8, color: 'var(--text-muted)' }}>{section.trim()}</p>;
        }
        const [, , heading, body] = match;
        const lines = body.trim().split('\n');
        return (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#25D366', marginBottom: 6 }}>
              {heading}
            </div>
            {lines.map((line, j) => {
              const t = line.trim();
              if (!t) return null;
              const isQuote = t.startsWith('«') || t.startsWith('"') || t.startsWith('«');
              const isArrow = t.includes('→');
              const isIf = t.startsWith('Если') || t.startsWith('Егер');
              return (
                <div key={j} style={{
                  marginBottom: 5,
                  paddingLeft: isQuote ? 10 : isArrow || isIf ? 14 : 0,
                  borderLeft: isQuote ? '2px solid rgba(37,211,102,0.35)' : undefined,
                  color: isQuote ? '#ddd' : isArrow ? '#777' : isIf ? '#999' : '#aaa',
                  fontStyle: isIf ? 'italic' : undefined,
                  fontSize: isQuote ? 14 : 13,
                }}>
                  {t}
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
  const [scriptLang, setScriptLang] = useState<'ru' | 'kz'>('ru');
  const [contentTab, setContentTab] = useState<ContentTab>('info');
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
        if (r.status === 401) { router.push('/login'); return null; }
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
    const done = Object.keys(statuses).length;
    const interest = Object.values(statuses).filter((s) => s === 'interest').length;
    const callback = Object.values(statuses).filter((s) => s === 'callback').length;
    return { total: merchants.length, done, remaining: merchants.length - done, interest, callback };
  }, [merchants, statuses]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, filtered.length - 1)), [filtered.length]);

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
    }).catch(() => {}).finally(() => setSaving(false));

    if (newStatus !== null) {
      setTimeout(() => setIndex((i) => (i < filtered.length - 1 ? i + 1 : i)), 250);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #25D366', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#666', fontSize: 13 }}>Загрузка...</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const currentStatus = merchant ? (statuses[merchant.merchant_id] as CallStatus | undefined) : undefined;
  const price = merchant ? formatPrice(calculatePrice(merchant)) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0c0c0c' }}>

      {/* ── Top bar ── */}
      <div style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '8px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Counter */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#25D366', minWidth: 0 }}>
            {safeIndex + 1}<span style={{ color: '#333', fontWeight: 400 }}>/{filtered.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#555', flex: 1 }}>
            {counts.interest > 0 && <span style={{ color: '#f59e0b' }}>★{counts.interest}</span>}
            {counts.callback > 0 && <span style={{ color: '#3b82f6' }}>📅{counts.callback}</span>}
            <span>·{counts.remaining} осталось</span>
          </div>
          <button
            onClick={() => setShowSearch((v) => !v)}
            style={{ background: 'transparent', border: '1px solid #252525', color: '#555', width: 30, height: 30, borderRadius: 8, fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {showSearch ? '✕' : '🔍'}
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: '1px solid #252525', color: '#555', padding: '5px 10px', borderRadius: 8, fontSize: 12 }}
          >
            Выйти
          </button>
        </div>

        {/* Progress */}
        <div style={{ height: 2, background: '#1e1e1e', borderRadius: 1, overflow: 'hidden', marginTop: 7 }}>
          <div style={{ height: '100%', width: filtered.length > 0 ? `${(safeIndex / filtered.length) * 100}%` : '0%', background: '#25D366', transition: 'width 0.3s' }} />
        </div>

        {showSearch && (
          <input
            autoFocus
            type="text"
            placeholder="Поиск по имени или телефону..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIndex(0); }}
            style={{ marginTop: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '7px 12px', color: '#e0e0e0', fontSize: 14, width: '100%', outline: 'none' }}
          />
        )}
      </div>

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', gap: 6, padding: '7px 14px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { setFilter(opt.key); setIndex(0); }}
            style={{
              border: `1px solid ${filter === opt.key ? '#25D366' : '#252525'}`,
              background: filter === opt.key ? 'rgba(37,211,102,0.1)' : 'transparent',
              color: filter === opt.key ? '#25D366' : '#666',
              padding: '4px 12px',
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

      {/* ── Content tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', flexShrink: 0, background: '#0f0f0f' }}>
        {([['info', '📋 Инфо'], ['script', '📝 Скрипт']] as [ContentTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setContentTab(key)}
            style={{
              flex: 1,
              padding: '10px',
              background: contentTab === key ? '#1a1a1a' : 'transparent',
              color: contentTab === key ? '#fff' : '#555',
              fontWeight: contentTab === key ? 600 : 400,
              border: 'none',
              borderBottom: contentTab === key ? '2px solid #25D366' : '2px solid transparent',
              borderRadius: 0,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Main scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 8px' }}>
        {!merchant ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 36 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0' }}>
              {filter === 'none' ? 'Все обзвонены!' : 'Нет мерчантов'}
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              {filter === 'none' ? `Обработано ${counts.done} из ${counts.total}` : 'Измените фильтр'}
            </div>
            <button onClick={() => setFilter('all')} style={{ marginTop: 8, background: '#25D366', color: '#000', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              Показать всех
            </button>
          </div>
        ) : contentTab === 'info' ? (
          /* ── INFO TAB ── */
          <>
            {/* Nav + name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <button onClick={goPrev} disabled={safeIndex === 0}
                style={{ background: '#1a1a1a', border: '1px solid #252525', color: safeIndex === 0 ? '#2a2a2a' : '#777', width: 32, height: 32, borderRadius: 8, fontSize: 18, padding: 0, flexShrink: 0, marginTop: 2 }}>
                ‹
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25, color: '#fff', marginBottom: 6 }}>
                  {merchant.name}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={getSegmentBadge(merchant.segment)}>{merchant.segment}</span>
                  <span className={getStateBadge(merchant.state)}>{stateLabel(merchant.state)}</span>
                  {merchant.city ? <span style={{ fontSize: 11, color: '#555' }}>{merchant.city}</span> : null}
                  {currentStatus && (
                    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[currentStatus], color: '#000' }}>
                      {STATUS_LABELS[currentStatus]}
                    </span>
                  )}
                  {saving && <span style={{ fontSize: 11, color: '#444' }}>·сохр…</span>}
                </div>
              </div>
              <button onClick={goNext} disabled={safeIndex >= filtered.length - 1}
                style={{ background: '#1a1a1a', border: '1px solid #252525', color: safeIndex >= filtered.length - 1 ? '#2a2a2a' : '#777', width: 32, height: 32, borderRadius: 8, fontSize: 18, padding: 0, flexShrink: 0, marginTop: 2 }}>
                ›
              </button>
            </div>

            {/* Phone + price row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <a href={`tel:${merchant.phone}`}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 12, padding: '13px 10px' }}>
                <span style={{ fontSize: 17 }}>📞</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#25D366', letterSpacing: '0.3px' }}>{merchant.phone}</span>
              </a>
              <div style={{ flex: 1, background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.12)', borderRadius: 12, padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#25D366' }}>{price}</div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>цена</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {[
                { label: 'Рейтинг', value: merchant.rating?.toFixed(1) ?? '—', warn: false },
                { label: 'Продажи', value: (merchant.sales_count ?? 0) >= 1000 ? `${((merchant.sales_count ?? 0)/1000).toFixed(0)}k` : String(merchant.sales_count ?? '—'), warn: false },
                { label: 'Отмены', value: `${merchant.cancelled_pct?.toFixed(0) ?? '—'}%`, warn: (merchant.cancelled_pct ?? 0) > 10 },
                { label: 'Возвраты', value: `${merchant.returned_pct?.toFixed(0) ?? '—'}%`, warn: (merchant.returned_pct ?? 0) > 5 },
                { label: 'Опозд', value: `${merchant.late_delivery_pct?.toFixed(0) ?? '—'}%`, warn: (merchant.late_delivery_pct ?? 0) > 15 },
              ].map((s) => (
                <div key={s.label} style={{ background: '#111', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.warn ? '#ef4444' : '#22c55e' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#555', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── SCRIPT TAB ── */
          <>
            {/* Lang selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['ru', 'kz'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setScriptLang(lang)}
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: scriptLang === lang ? '#25D366' : '#1a1a1a',
                    color: scriptLang === lang ? '#000' : '#666',
                    fontWeight: scriptLang === lang ? 700 : 400,
                    border: `1px solid ${scriptLang === lang ? '#25D366' : '#252525'}`,
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'ru' ? '🇷🇺 Русский' : '🇰🇿 Казахский'}
                </button>
              ))}
            </div>
            {/* Price reminder */}
            <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#555' }}>Цена для скрипта</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#25D366' }}>{price}</span>
            </div>
            <ScriptView
              text={scriptLang === 'ru' ? scripts.ru : (scripts.kz || 'Скрипт не задан')}
              price={price}
            />
          </>
        )}
      </div>

      {/* ── Status buttons ── */}
      {merchant && (
        <div style={{ flexShrink: 0, background: '#0a0a0a', borderTop: '1px solid #1a1a1a', padding: '8px 10px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {(Object.entries(STATUS_LABELS) as [CallStatus, string][]).map(([st, label]) => {
              const isActive = currentStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => handleSetStatus(merchant.merchant_id, st)}
                  style={{
                    padding: '10px 4px',
                    borderRadius: 9,
                    border: isActive ? `2px solid ${STATUS_COLORS[st]}` : '2px solid #1e1e1e',
                    background: isActive ? STATUS_COLORS[st] : '#151515',
                    color: isActive ? '#000' : '#666',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    lineHeight: 1.3,
                    transition: 'all 0.15s',
                    boxShadow: isActive ? `0 0 8px ${STATUS_COLORS[st]}44` : 'none',
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
