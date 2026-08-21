import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, STATUS_STEP, type OrderRow } from '../lib/supabase';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';

/* ── Status → UI config ─────────────────────────────────── */
const STATUS_UI: Record<string, { th: string; en: string; color: string; bg: string }> = {
  pending:   { th: 'รับออเดอร์แล้ว',  en: 'ORDER RECEIVED',   color: 'var(--gold)',     bg: 'rgba(184,134,46,0.12)' },
  preparing: { th: 'กำลังเตรียม',     en: 'IN THE KITCHEN',   color: 'var(--accent-2)', bg: 'rgba(74,93,63,0.12)'   },
  ready:     { th: 'พร้อมให้รับแล้ว', en: 'READY FOR PICKUP', color: 'var(--accent)',   bg: 'rgba(181,81,30,0.12)'  },
  completed: { th: 'รับเรียบร้อย',    en: 'PICKED UP',        color: 'var(--accent-2)', bg: 'rgba(74,93,63,0.12)'   },
};

const STEPS = [
  { label: 'รับออเดอร์',   labelEn: 'Order placed',    status: 'pending'   },
  { label: 'ครัวกำลังทำ',  labelEn: 'In the kitchen',  status: 'preparing' },
  { label: 'พร้อมให้รับ',  labelEn: 'Ready for pickup', status: 'ready'     },
  { label: 'รับเรียบร้อย', labelEn: 'Picked up',        status: 'completed' },
];

const ETA_BY_STATUS: Record<string, number> = {
  pending:   12,
  preparing: 7,
  ready:     0,
  completed: 0,
};

/* ── Pulse dot ───────────────────────────────────────────── */
function PulseDot({ color }: { color: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: color,
      opacity: on ? 1 : 0.3, transition: 'opacity 0.4s', display: 'inline-block',
    }} />
  );
}

/* ── Countdown ring ──────────────────────────────────────── */
function CountdownRing({ initialMin }: { initialMin: number }) {
  const [secs, setSecs] = useState(initialMin * 60);
  const initial = useRef(initialMin * 60);

  useEffect(() => {
    initial.current = initialMin * 60;
    setSecs(initialMin * 60);
  }, [initialMin]);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secs]);

  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const progress = initial.current > 0 ? secs / initial.current : 0;
  const dashOffset = circ * (1 - progress);
  const mins = Math.floor(secs / 60);
  const sec  = secs % 60;

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginTop: 24 }}>
      <svg width={132} height={132} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={66} cy={66} r={radius} fill="none" stroke="var(--line)" strokeWidth={6} />
        <circle
          cx={66} cy={66} r={radius} fill="none"
          stroke="var(--accent)" strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '.08em' }}>พร้อมรับใน</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 38, lineHeight: 1, marginTop: 2 }}>{mins}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>
          นาที {String(sec).padStart(2, '0')} วิ
        </div>
      </div>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg-3)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 80, height: 10, borderRadius: 4, background: 'var(--bg-3)', marginBottom: 6 }} />
          <div style={{ width: 120, height: 16, borderRadius: 4, background: 'var(--bg-3)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 18px 0', gap: 12 }}>
        <div style={{ width: 132, height: 132, borderRadius: '50%', background: 'var(--bg-3)' }} />
        <div style={{ width: 160, height: 12, borderRadius: 4, background: 'var(--bg-3)' }} />
      </div>
    </div>
  );
}

/* ── Error state ─────────────────────────────────────────── */
function OrderNotFound({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  return (
    <div className="page" style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 12, textAlign: 'center', padding: '0 32px' }}>
      <div style={{ fontSize: 40, opacity: 0.3 }}>{I.receipt(40)}</div>
      <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>ไม่พบออเดอร์</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>#{orderId.slice(0, 8)}</div>
      <button
        onClick={() => navigate('/')}
        style={{ marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)', border: 0, padding: '12px 24px', borderRadius: 'var(--r-pill)', fontWeight: 600, fontSize: 13 }}
      >กลับหน้าแรก</button>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function Track() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder]     = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /* initial fetch */
  useEffect(() => {
    if (!orderId) { setLoading(false); setNotFound(true); return; }

    supabase
      .from('orders')
      .select('id, status, items, grand_total, subtotal, discount_amount, fulfillment_type, checkout_payment_method, order_number, created_at')
      .eq('id', orderId)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error || !data) { setNotFound(true); return; }
        setOrder(data as OrderRow);
      });
  }, [orderId]);

  /* Realtime subscription */
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<OrderRow>) } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  if (loading)            return <Skeleton />;
  if (notFound || !order) return <OrderNotFound orderId={orderId ?? ''} />;

  const status    = order.status ?? 'pending';
  const stepIdx   = STATUS_STEP[status] ?? 0;
  const ui        = STATUS_UI[status] ?? STATUS_UI.pending;
  const etaMin    = ETA_BY_STATUS[status] ?? 0;
  const showRing  = status === 'pending' || status === 'preparing';

  /* Parse items from jsonb */
  const orderItems = Array.isArray(order.items)
    ? (order.items as { name: string; qty: number; total: number; tone?: string; topping?: string }[])
    : [];

  /* Timestamp label */
  const createdAt = new Date(order.created_at);
  const timeStr   = createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page" style={{ paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
          {I.back(22)}
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">ออเดอร์ · ORDER</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>
            #{order.order_number}
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
          color: 'var(--accent-2)', background: 'rgba(74,93,63,0.14)',
          padding: '4px 8px', borderRadius: 'var(--r-pill)',
          maxWidth: 120, textAlign: 'center', lineHeight: 1.3,
        }}>
          หน้านี้จะเปิดขึ้น<br />อัตโนมัติเมื่อคุณกลับมา
        </span>
      </div>

      {/* ── Status hero ── */}
      <div style={{ padding: '28px 18px 0', textAlign: 'center' }}>
        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 'var(--r-pill)',
          background: ui.bg, color: ui.color,
          fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
        }}>
          {status !== 'completed' && <PulseDot color={ui.color} />}
          {ui.th} · {ui.en}
        </div>

        {/* Countdown ring (pending / preparing) */}
        {showRing && etaMin > 0 && <CountdownRing initialMin={etaMin} />}

        {/* Ready checkmark */}
        {status === 'ready' && (
          <div style={{ marginTop: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
              background: ui.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ui.color,
            }}>
              {I.check(48)}
            </div>
          </div>
        )}

        {/* Completed */}
        {status === 'completed' && (
          <div style={{ marginTop: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
              background: 'rgba(74,93,63,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-2)',
            }}>
              {I.receipt(40)}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, marginTop: 16 }}>ขอบคุณมากครับ 🙏</div>
          </div>
        )}

        {/* Subtitle */}
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 14, letterSpacing: '.06em' }}>
          {status === 'ready' ? 'รับได้แล้ว · สาขาทองหล่อ ซอย 13' : `สั่งเวลา ${timeStr} · สาขาทองหล่อ`}
        </div>

        {/* Branch strip */}
        {status !== 'completed' && (
          <div style={{
            margin: '16px 0 0', padding: '12px 16px',
            background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          }}>
            <span style={{ color: 'var(--accent-2)' }}>{I.pin(18)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>สาขาทองหล่อ ซอย 13</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>เปิดถึง 22:00 · 1.2 กม.</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>นำทาง</span>
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      <div style={{ padding: '32px 24px 0' }}>
        {STEPS.map((step, i) => {
          const done    = i <= stepIdx;
          const current = i === stepIdx;
          const isLast  = i === STEPS.length - 1;

          return (
            <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: isLast ? 0 : 22 }}>
              {/* Connector */}
              {!isLast && (
                <span style={{
                  position: 'absolute', left: 11, top: 24, bottom: -2, width: 2,
                  background: i + 1 <= stepIdx ? 'var(--accent)' : 'var(--line)',
                  borderRadius: 2,
                }} />
              )}

              {/* Dot */}
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: done ? 'var(--accent)' : 'var(--bg-3)',
                border: done ? '0' : '1.5px solid var(--line-2)',
                display: 'grid', placeItems: 'center', color: '#fff',
                boxShadow: current ? '0 0 0 6px rgba(181,81,30,0.18)' : 'none',
                zIndex: 1, transition: 'all 0.4s',
              }}>
                {done && I.check(13)}
              </span>

              {/* Label */}
              <div style={{ flex: 1, paddingTop: 1 }}>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 14,
                  color: done || current ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: current ? 600 : 400,
                }}>{step.label}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{step.labelEn}</div>
              </div>

              {/* Time stamp for done steps */}
              {i === 0 && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', paddingTop: 2 }}>
                  {timeStr}
                </span>
              )}
              {i === stepIdx && i > 0 && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', paddingTop: 2 }}>
                  ตอนนี้
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Order items ── */}
      <div style={{ padding: '28px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>รายการ · ITEMS</div>
        <div style={{ padding: 14, borderRadius: 'var(--r-md)', background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
          {orderItems.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>ไม่มีข้อมูลรายการ</div>
          ) : (
            orderItems.map((it, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0',
                borderBottom: i < orderItems.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)', width: 20, flexShrink: 0 }}>
                  ×{it.qty}
                </span>
                <Bowl tone={it.tone ?? 'clay'} topping={it.topping ?? 'egg'} size={36} />
                <div style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.2 }}>{it.name}</div>
                <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{it.total}</span>
              </div>
            ))
          )}

          {/* Total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', alignItems: 'baseline',
          }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>ยอดรวม · TOTAL</span>
            <span className="thb price" style={{ fontSize: 18 }}>{order.grand_total}</span>
          </div>
        </div>
      </div>

      {/* ── Reorder CTA ── */}
      <div style={{ padding: '18px 18px 0' }}>
        <button
          onClick={() => navigate('/order')}
          style={{
            width: '100%', background: 'var(--bg-2)', color: 'var(--ink)',
            border: '1px solid var(--line-2)', borderRadius: 'var(--r-pill)',
            padding: '13px 18px', fontWeight: 600, fontSize: 13, letterSpacing: '.03em',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          }}
        >
          {I.repeat(14)} สั่งซ้ำทันที
        </button>
      </div>

      <div style={{ height: 24 }} />
      <TabBar active="orders" />
    </div>
  );
}
