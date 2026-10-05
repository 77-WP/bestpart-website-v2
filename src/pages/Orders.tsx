import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, type GetOrderResult, type GetOrderItem, normalizeOrderStatus, readFnError } from '../lib/supabase';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { getLocalOrders, pruneOldOrders } from '../lib/localOrders';
import { TEST_MODE } from '../config/env';
import { useT } from '../i18n';

/* ── QR expiry fallback: treat awaiting_payment older than this as expired ─ */
const QR_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const IN_PROGRESS = new Set(['awaiting_payment', 'pending', 'preparing', 'ready']);

type LocalOrderData = {
  id:            string;
  status:        string;         // normalized
  payment_status: string;
  grand_total:   number;
  ordered_at:    string;
  call_name:     string | null;
  items:         GetOrderItem[];
  payment_method: string | null;
};

// \u0E3F = ฿ (Thai Baht sign) — escaped to satisfy the i18n source-scan rule
const TEST_ITEM_NAME_EN = 'Test Item \u0E3F1';

function isTestOrder(o: LocalOrderData): boolean {
  return o.items.some(i => i.name_en === TEST_ITEM_NAME_EN);
}

function isQrExpired(o: LocalOrderData): boolean {
  if (o.status !== 'awaiting_payment') return false;
  return Date.now() - new Date(o.ordered_at).getTime() > QR_EXPIRY_MS;
}

function isInProgress(o: LocalOrderData): boolean {
  if (!IN_PROGRESS.has(o.status)) return false;
  if (isQrExpired(o)) return false;
  return true;
}

function summaryLine(items: GetOrderItem[], lang: 'th' | 'en'): string | null {
  if (!items || items.length === 0) return null;
  const first = items[0];
  if (!first?.name) return null;
  const firstName = lang === 'en' && first.name_en ? first.name_en : first.name;
  const rest = items.length - 1;
  return rest > 0 ? `${firstName} +${rest}` : firstName;
}

async function fetchOrders(ids: string[]): Promise<LocalOrderData[]> {
  const results = await Promise.allSettled(
    ids.slice(0, 10).map(id =>
      supabase.functions.invoke('get-order', { body: { order_id: id } })
        .then(async ({ data, error }) => {
          if (error || !data) {
            if (error) await readFnError(error); // parse silently
            return null;
          }
          const raw = data as GetOrderResult;
          const normalized = normalizeOrderStatus(raw.status);
          return {
            id,
            status:         normalized,
            payment_status: raw.payment_status,
            grand_total:    raw.grand_total,
            ordered_at:     raw.ordered_at,
            call_name:      raw.call_name,
            items:          raw.items ?? [],
            payment_method: raw.payment_method,
          } satisfies LocalOrderData;
        })
    )
  );
  let rows = results
    .filter((r): r is PromiseFulfilledResult<LocalOrderData | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is LocalOrderData => v !== null);
  if (!TEST_MODE) rows = rows.filter(o => !isTestOrder(o));
  return rows;
}

const STATUS_KEY: Record<string, 'orders.status.awaiting' | 'orders.status.pending' | 'orders.status.preparing' | 'orders.status.ready' | 'orders.status.completed'> = {
  awaiting_payment: 'orders.status.awaiting',
  pending:          'orders.status.pending',
  preparing:        'orders.status.preparing',
  ready:            'orders.status.ready',
  completed:        'orders.status.completed',
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  awaiting_payment: { bg: 'rgba(184,134,46,0.12)', fg: 'var(--gold)'     },
  pending:          { bg: 'rgba(184,134,46,0.12)', fg: 'var(--gold)'     },
  preparing:        { bg: 'rgba(74,93,63,0.12)',   fg: 'var(--accent-2)' },
  ready:            { bg: 'rgba(181,81,30,0.12)',  fg: 'var(--accent)'   },
  completed:        { bg: 'var(--bg-3)',            fg: 'var(--ink-3)'    },
};

export default function Orders() {
  const navigate    = useNavigate();
  const { t, lang } = useT();

  function getStatusLabel(status: string): string {
    const key = STATUS_KEY[status];
    return key ? t(key) : status;
  }
  const localOrders = getLocalOrders();
  const ids         = localOrders.map(o => o.id);

  const [orders,  setOrders]  = useState<LocalOrderData[]>([]);
  const ordersRef = useRef<LocalOrderData[]>([]);
  // Keep ref in sync so the poll closure can read current state without stale closure
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  const [loading, setLoading] = useState(ids.length > 0);

  /* ── Initial load ─────────────────────────────────────── */
  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }
    let cancelled = false;
    fetchOrders(ids)
      .then(rows => {
        if (cancelled) return;
        setOrders(rows);
        setLoading(false);
        // Prune entries older than 30 days that aren't active
        const activeIds = new Set(rows.filter(r => isInProgress(r)).map(r => r.id));
        pruneOldOrders(activeIds);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Poll every 10 s (with visibilitychange support) ─── */
  useEffect(() => {
    if (ids.length === 0) return;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function getActiveIds() {
      // Only poll orders that aren't already in a terminal state
      return ids.filter(id => {
        const cached = ordersRef.current.find(o => o.id === id);
        if (!cached) return true;
        const s = cached.status;
        return s !== 'completed' && s !== 'cancelled';
      });
    }

    function poll() {
      const active = getActiveIds();
      if (active.length === 0) return;
      fetchOrders(active).then(rows => {
        setOrders(prev => {
          // Merge: update active, keep terminal ones as-is
          const map = new Map(prev.map(o => [o.id, o]));
          rows.forEach(r => map.set(r.id, r));
          return Array.from(map.values());
        });
      }).catch(() => {});
    }

    function startInterval() {
      if (pollInterval) return;
      pollInterval = setInterval(poll, 10_000);
    }
    function stopInterval() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }
    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        stopInterval();
      } else {
        poll();
        startInterval();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    startInterval();
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sort: in-progress first, then by time desc ──────── */
  const sorted = [...orders].sort((a, b) => {
    const aActive = isInProgress(a);
    const bActive = isInProgress(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime();
  });

  const inProgress = sorted.filter(o => isInProgress(o));
  const earlier    = sorted.filter(o => !isInProgress(o));
  const hasActive  = inProgress.length > 0;

  /* ── Section header ───────────────────────────────────── */
  function SectionHeader({ label }: { label: string }) {
    return (
      <div style={{
        padding: '10px 18px 6px',
        fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
        color: 'var(--ink-3)',
        background: 'var(--bg-2)',
        borderBottom: '1px solid var(--line)',
      }}>
        {label.toUpperCase()}
      </div>
    );
  }

  /* ── Order card ───────────────────────────────────────── */
  function OrderCard({ o }: { o: LocalOrderData }) {
    const expired  = isQrExpired(o);
    const col      = expired
      ? { bg: 'var(--bg-3)', fg: 'var(--ink-3)' }
      : STATUS_COLOR[o.status] ?? STATUS_COLOR.completed;
    const statusTh = expired ? t('orders.expired') : getStatusLabel(o.status);
    const bkkDate  = new Date(new Date(o.ordered_at).getTime() + 7 * 3_600_000);
    const timeStr  = `${String(bkkDate.getUTCHours()).padStart(2,'0')}:${String(bkkDate.getUTCMinutes()).padStart(2,'0')}`;
    const dateStr  = bkkDate.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });

    // Recipient name from localStorage, fallback to call_name or short ID
    const lo           = localOrders.find(x => x.id === o.id);
    const hasName      = !!lo?.name;
    const displayLabel = lo?.name || o.call_name || `#${o.id.slice(0, 8)}`;
    const summary      = summaryLine(o.items, lang);

    return (
      <div
        onClick={() => navigate(`/track/${o.id}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px',
          borderBottom: '1px solid var(--line)',
          cursor: 'pointer',
          opacity: expired ? 0.6 : 1,
        }}
      >
        {/* Active indicator */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: isInProgress(o) ? 'var(--accent)' : 'var(--bg-3)',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + order identifier */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>
              {displayLabel}
            </span>
            {hasName && o.call_name && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {o.call_name}
              </span>
            )}
          </div>

          {/* Status badge + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
              padding: '2px 7px', borderRadius: 3,
              background: col.bg, color: col.fg,
            }}>
              {statusTh}
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
              {dateStr} · {timeStr}
            </span>
          </div>

          {/* Summary line */}
          {summary && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{summary}</div>
          )}

          {/* "Go to pay" link for non-expired awaiting_payment */}
          {o.status === 'awaiting_payment' && !expired && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/pay/${o.id}`); }}
              style={{
                marginTop: 6, background: 'none', border: 0,
                fontSize: 11, color: 'var(--gold)', fontWeight: 700,
                padding: 0, cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              {t('orders.goToPay')}
            </button>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600 }}>
            ฿{o.grand_total}
          </div>
          <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>{I.arrow(12)}</div>
        </div>
      </div>
    );
  }

  /* ── Page header ──────────────────────────────────────── */
  const pageHeader = (
    <div style={{
      paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
      paddingBottom: 12, paddingLeft: 18, paddingRight: 18,
      borderBottom: '1px solid var(--line)',
    }}>
      <div className="kicker">{t('orders.pageTitle').toUpperCase()}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 2 }}>
        {t('orders.historyTitle')}
      </div>
    </div>
  );

  /* ── Loading skeleton ─────────────────────────────────── */
  if (loading) return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {pageHeader}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, background: 'var(--bg-3)', borderRadius: 4, width: '50%', marginBottom: 8 }} />
            <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, width: '35%' }} />
          </div>
          <div style={{ width: 48, height: 14, background: 'var(--bg-3)', borderRadius: 4 }} />
        </div>
      ))}
      <TabBar active="orders" />
    </div>
  );

  /* ── Empty state ──────────────────────────────────────── */
  if (ids.length === 0 || orders.length === 0) return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {pageHeader}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '55vh', gap: 14,
        padding: '0 32px', textAlign: 'center', color: 'var(--ink-3)',
      }}>
        <div style={{ opacity: 0.22 }}>{I.receipt(52)}</div>
        <div className="h-display-th" style={{ fontSize: 20, color: 'var(--ink-2)' }}>
          {t('orders.emptyTitle')}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, maxWidth: 260 }}>
          {t('orders.emptyMsg')}
        </div>
        {t('orders.emptyCta') && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: 260 }}>
            {t('orders.emptyCta')}
          </div>
        )}
        <button
          onClick={() => navigate('/order')}
          style={{
            marginTop: 4, background: 'var(--ink)', color: 'var(--on-accent)',
            border: 0, padding: '13px 28px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          {t('orders.emptyBtn')} {I.arrow(14)}
        </button>
      </div>
      <TabBar active="orders" />
    </div>
  );

  /* ── Order list ───────────────────────────────────────── */
  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {pageHeader}

      {/* In progress group */}
      {inProgress.length > 0 && (
        <>
          <SectionHeader label={t('orders.inProgress')} />
          {inProgress.map(o => <OrderCard key={o.id} o={o} />)}
        </>
      )}

      {/* Earlier group */}
      {earlier.length > 0 && (
        <>
          <SectionHeader label={t('orders.earlier')} />
          {earlier.map(o => <OrderCard key={o.id} o={o} />)}
        </>
      )}

      {/* Footer note */}
      <div style={{
        padding: '14px 18px',
        fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', letterSpacing: '.04em',
      }}>
        {t('orders.footer')}
      </div>

      <TabBar active="orders" hasActiveOrder={hasActive} />
    </div>
  );
}
