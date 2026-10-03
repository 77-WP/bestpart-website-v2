import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { getLocalOrderIds } from '../lib/localOrders';
import { TEST_MODE } from '../config/env';

const ACTIVE_STATUSES = ['awaiting_payment', 'pending', 'preparing'];

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'รอชำระเงิน',
  pending:          'รับออเดอร์แล้ว',
  preparing:        'ครัวกำลังทำ',
  ready:            'พร้อมรับแล้ว',
  completed:        'เสร็จสิ้น',
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  awaiting_payment: { bg: 'rgba(184,134,46,0.12)',  fg: 'var(--gold)'     },
  pending:          { bg: 'rgba(184,134,46,0.12)',  fg: 'var(--gold)'     },
  preparing:        { bg: 'rgba(74,93,63,0.12)',    fg: 'var(--accent-2)' },
  ready:            { bg: 'rgba(181,81,30,0.12)',   fg: 'var(--accent)'   },
  completed:        { bg: 'var(--bg-3)',             fg: 'var(--ink-3)'    },
};

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  grand_total: number;
  created_at: string;
  items: unknown;
};

function isTestOrder(order: OrderRow): boolean {
  const items = Array.isArray(order.items) ? (order.items as { item_id?: string }[]) : [];
  return items.some(i => i.item_id === 'test-1baht');
}

function sortOrders(rows: OrderRow[]): OrderRow[] {
  return [...rows].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.includes(a.status);
    const bActive = ACTIVE_STATUSES.includes(b.status);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

async function fetchOrders(ids: string[]): Promise<OrderRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, grand_total, created_at, items')
    .in('id', ids);
  if (!data) return [];
  let rows = data as OrderRow[];
  if (!TEST_MODE) rows = rows.filter(o => !isTestOrder(o));
  return sortOrders(rows);
}

export default function Orders() {
  const navigate  = useNavigate();
  const ids       = getLocalOrderIds();
  const [orders,  setOrders]  = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);

  /* Initial load */
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    fetchOrders(ids)
      .then(rows => { if (!cancelled) setOrders(rows); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Polling every 10 s to refresh statuses */
  useEffect(() => {
    if (ids.length === 0) return;
    const t = setInterval(() => {
      fetchOrders(ids).then(rows => setOrders(rows)).catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActive = orders.some(o => ACTIVE_STATUSES.includes(o.status));

  const header = (
    <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--line)' }}>
      <div className="kicker">ออเดอร์ · MY ORDERS</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 2 }}>ประวัติการสั่ง</div>
    </div>
  );

  /* Loading skeleton */
  if (loading) return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {header}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, background: 'var(--bg-3)', borderRadius: 4, width: '55%', marginBottom: 8 }} />
            <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, width: '35%' }} />
          </div>
          <div style={{ width: 56, height: 32, background: 'var(--bg-3)', borderRadius: 'var(--r-sm)' }} />
        </div>
      ))}
      <TabBar active="orders" />
    </div>
  );

  /* Empty state */
  if (ids.length === 0 || orders.length === 0) return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {header}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 14,
        padding: '0 32px', textAlign: 'center', color: 'var(--ink-3)',
      }}>
        <div style={{ opacity: 0.25 }}>{I.receipt(52)}</div>
        <div className="h-display-th" style={{ fontSize: 20, color: 'var(--ink-2)' }}>ยังไม่มีออเดอร์</div>
        <div style={{ fontSize: 13, lineHeight: 1.65, maxWidth: 260 }}>
          ออเดอร์ที่คุณสั่งจะปรากฏที่นี่<br />เริ่มสั่งได้เลย!
        </div>
        <button
          onClick={() => navigate('/order')}
          style={{
            marginTop: 4, background: 'var(--ink)', color: 'var(--on-accent)',
            border: 0, padding: '13px 28px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          ดูเมนู {I.arrow(14)}
        </button>
      </div>
      <TabBar active="orders" />
    </div>
  );

  /* Order list */
  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {header}

      <div style={{ padding: '6px 0' }}>
        {orders.map(order => {
          const isActive = ACTIVE_STATUSES.includes(order.status);
          const col      = STATUS_COLOR[order.status] ?? STATUS_COLOR.completed;
          const timeStr  = new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
          const dateStr  = new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
          const dest     = order.status === 'awaiting_payment' ? `/pay/${order.id}` : `/track/${order.id}`;

          return (
            <div
              key={order.id}
              onClick={() => navigate(dest)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px', borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
              }}
            >
              {/* Active dot */}
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--accent)' : 'var(--bg-3)',
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>#{order.order_number}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{dateStr} · {timeStr}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                  padding: '2px 7px', borderRadius: 3,
                  background: col.bg, color: col.fg,
                }}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600 }}>
                  {order.grand_total}
                </div>
                <div style={{ color: 'var(--ink-3)', marginTop: 3 }}>{I.arrow(12)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <TabBar active="orders" hasActiveOrder={hasActive} />
    </div>
  );
}
