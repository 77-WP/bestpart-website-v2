import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { getLocalOrders, pruneOldOrders } from '../lib/localOrders';
import { TEST_MODE } from '../config/env';
import { useLang } from '../store/lang';
import { LANG_MAP } from '../config/lang';

/* ── QR expiry fallback: treat awaiting_payment older than this as expired ─ */
const QR_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const IN_PROGRESS = new Set(['awaiting_payment', 'pending', 'preparing', 'ready']);

type OrderRow = {
  id:                      string;
  order_number:            number;
  status:                  string;
  payment_status:          string;
  grand_total:             number;
  created_at:              string;
  items:                   unknown;
  checkout_payment_method: string | null;
};

function isTestOrder(o: OrderRow): boolean {
  const items = Array.isArray(o.items) ? (o.items as { item_id?: string }[]) : [];
  return items.some(i => i.item_id === 'test-1baht');
}

function isQrExpired(o: OrderRow): boolean {
  if (o.status !== 'awaiting_payment') return false;
  return Date.now() - new Date(o.created_at).getTime() > QR_EXPIRY_MS;
}

function isInProgress(o: OrderRow): boolean {
  if (!IN_PROGRESS.has(o.status)) return false;
  if (isQrExpired(o)) return false;
  return true;
}

type OrderItem = { name: string; name_en?: string; qty: number };

function summaryLine(items: unknown, lang: 'th' | 'en'): string | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const arr = items as OrderItem[];
  const first = arr[0];
  if (!first?.name) return null;
  const firstName = lang === 'en' && first.name_en ? first.name_en : first.name;
  const rest = arr.length - 1;
  return rest > 0 ? `${firstName} +${rest}` : firstName;
}

async function fetchOrders(ids: string[]): Promise<OrderRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, grand_total, created_at, items, checkout_payment_method')
    .in('id', ids);
  if (!data) return [];
  let rows = data as OrderRow[];
  if (!TEST_MODE) rows = rows.filter(o => !isTestOrder(o));
  return rows;
}

const STATUS_LABEL: Record<string, { th: string; en: string }> = {
  awaiting_payment: { th: 'รอชำระเงิน',    en: 'Awaiting payment' },
  pending:          { th: 'รับออเดอร์แล้ว', en: 'Order received'   },
  preparing:        { th: 'ครัวกำลังทำ',    en: 'In the kitchen'   },
  ready:            { th: 'พร้อมรับแล้ว',   en: 'Ready'            },
  completed:        { th: 'รับแล้ว',        en: 'Collected'        },
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
  const { lang }    = useLang();
  const L           = LANG_MAP[lang];
  const localOrders = getLocalOrders();
  const ids         = localOrders.map(o => o.id);

  const [orders,  setOrders]  = useState<OrderRow[]>([]);
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

  /* ── Poll every 10 s ──────────────────────────────────── */
  useEffect(() => {
    if (ids.length === 0) return;
    const t = setInterval(() => {
      fetchOrders(ids).then(rows => setOrders(rows)).catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sort: in-progress first, then by time desc ──────── */
  const sorted = [...orders].sort((a, b) => {
    const aActive = isInProgress(a);
    const bActive = isInProgress(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
  function OrderCard({ o }: { o: OrderRow }) {
    const expired  = isQrExpired(o);
    const col      = expired
      ? { bg: 'var(--bg-3)', fg: 'var(--ink-3)' }
      : STATUS_COLOR[o.status] ?? STATUS_COLOR.completed;
    const statusTh = expired ? L.ordersExpired : (STATUS_LABEL[o.status]?.[lang] ?? o.status);
    const bkkDate  = new Date(new Date(o.created_at).getTime() + 7 * 3_600_000);
    const timeStr  = `${String(bkkDate.getUTCHours()).padStart(2,'0')}:${String(bkkDate.getUTCMinutes()).padStart(2,'0')}`;
    const dateStr  = bkkDate.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });

    // Recipient name from localStorage
    const lo         = localOrders.find(x => x.id === o.id);
    const hasName    = !!lo?.name;
    const displayLabel = lo?.name || `#${o.order_number}`;
    const summary    = summaryLine(o.items, lang);

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
          {/* Name + order# */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>
              {displayLabel}
            </span>
            {hasName && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                #{o.order_number}
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
              {L.ordersGoToPay}
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
      <div className="kicker">{L.ordersPageTitle.toUpperCase()}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 2 }}>
        {lang === 'th' ? 'ประวัติการสั่ง' : 'Order history'}
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
          {L.ordersEmptyTitle}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, maxWidth: 260 }}>
          {L.ordersEmptyMsg}
        </div>
        <button
          onClick={() => navigate('/order')}
          style={{
            marginTop: 4, background: 'var(--ink)', color: 'var(--on-accent)',
            border: 0, padding: '13px 28px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          {L.ordersEmptyBtn} {I.arrow(14)}
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
          <SectionHeader label={L.ordersInProgress} />
          {inProgress.map(o => <OrderCard key={o.id} o={o} />)}
        </>
      )}

      {/* Earlier group */}
      {earlier.length > 0 && (
        <>
          <SectionHeader label={L.ordersEarlier} />
          {earlier.map(o => <OrderCard key={o.id} o={o} />)}
        </>
      )}

      {/* Footer note */}
      <div style={{
        padding: '14px 18px',
        fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', letterSpacing: '.04em',
      }}>
        {L.ordersFooter}
      </div>

      <TabBar active="orders" hasActiveOrder={hasActive} />
    </div>
  );
}
