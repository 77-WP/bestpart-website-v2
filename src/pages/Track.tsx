import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';

/* ── Mock order data ─────────────────────────────────────
   In a real impl these come from Supabase Realtime.
   Status: 0=placed 1=kitchen(current) 2=ready 3=pickedup
──────────────────────────────────────────────────────── */
const MOCK_STATUS: number = 1; // "ครัวกำลังทำ"
const MOCK_ETA_MIN = 7;

const STEPS = [
  { label: 'รับออเดอร์',  labelEn: 'Order placed',    time: '19:08' },
  { label: 'ครัวกำลังทำ', labelEn: 'In the kitchen',  time: '19:11' },
  { label: 'พร้อมให้รับ', labelEn: 'Ready for pickup', time: '~19:18' },
  { label: 'รับเรียบร้อย', labelEn: 'Picked up',       time: '' },
];

const STATUS_LABEL: Record<number, { th: string; en: string }> = {
  0: { th: 'รับออเดอร์แล้ว', en: 'ORDER RECEIVED' },
  1: { th: 'กำลังเตรียม',    en: 'IN THE KITCHEN' },
  2: { th: 'พร้อมให้รับแล้ว', en: 'READY FOR PICKUP' },
  3: { th: 'รับเรียบร้อย',   en: 'PICKED UP' },
};

const MOCK_ITEMS = [
  { name: 'กระเพราหมูสับ ไข่ดาว',  tone: 'clay', topping: 'egg',     qty: 1, price: 134 },
  { name: 'ข้าวไก่กรอบกระเทียม',   tone: 'sage', topping: 'chicken', qty: 1, price: 115 },
];
const MOCK_TOTAL = 234;

/* ── Pulse dot ───────────────────────────────────────── */
function PulseDot({ color = 'var(--accent-2)' }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: color,
      opacity: on ? 1 : 0.3, transition: 'opacity 0.4s',
      display: 'inline-block',
    }} />
  );
}

/* ── Countdown ───────────────────────────────────────── */
function useCountdown(initialMin: number) {
  const [secs, setSecs] = useState(initialMin * 60);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return { mins: m, secs: s, total: secs };
}

/* ── Tracking page ───────────────────────────────────── */
export default function Track() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { mins, secs, total } = useCountdown(MOCK_ETA_MIN);
  const status = MOCK_STATUS;
  const statusInfo = STATUS_LABEL[status];

  // Ring progress
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const progress = total / (MOCK_ETA_MIN * 60); // 1 → 0
  const dashOffset = circ * (1 - progress);

  return (
    <div className="page" style={{ paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}
        >{I.back(22)}</button>
        <div style={{ flex: 1 }}>
          <div className="kicker">ออเดอร์ · ORDER</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>
            #{orderId ?? '8204'}
          </div>
        </div>
        {/* Auto-reopen badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
          color: 'var(--accent-2)',
          background: 'rgba(74,93,63,0.14)',
          padding: '4px 8px', borderRadius: 'var(--r-pill)',
          maxWidth: 120, textAlign: 'center', lineHeight: 1.3,
        }}>
          หน้านี้จะเปิดขึ้น<br />อัตโนมัติเมื่อคุณกลับมา
        </span>
      </div>

      {/* ── Big status hero ── */}
      <div style={{ padding: '28px 18px 0', textAlign: 'center' }}>
        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 'var(--r-pill)',
          background: 'rgba(74,93,63,0.12)',
          color: 'var(--accent-2)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
        }}>
          <PulseDot />
          {statusInfo.th} · {statusInfo.en}
        </div>

        {/* Ring + countdown */}
        {(status === 1 || status === 0) && total > 0 && (
          <div style={{ marginTop: 24, position: 'relative', display: 'inline-block' }}>
            <svg width={132} height={132} style={{ transform: 'rotate(-90deg)' }}>
              {/* Track */}
              <circle cx={66} cy={66} r={radius} fill="none" stroke="var(--line)" strokeWidth={6} />
              {/* Progress */}
              <circle
                cx={66} cy={66} r={radius} fill="none"
                stroke="var(--accent)" strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            {/* Center text */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '.08em' }}>
                พร้อมรับใน
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 38, lineHeight: 1, marginTop: 2, color: 'var(--ink)' }}>
                {mins}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>
                นาที {String(secs).padStart(2, '0')} วิ
              </div>
            </div>
          </div>
        )}

        {/* Ready state */}
        {status === 2 && (
          <div style={{ marginTop: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
              background: 'rgba(74,93,63,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-2)',
            }}>
              {I.check(48)}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 14, letterSpacing: '.06em' }}>
          ประมาณ 19:18 · ที่สาขาทองหล่อ ซอย 13
        </div>

        {/* Branch info strip */}
        <div style={{
          margin: '16px 0 0', padding: '12px 16px',
          background: 'var(--bg-2)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}>
          <span style={{ color: 'var(--accent-2)' }}>{I.pin(18)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>สาขาทองหล่อ ซอย 13</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>เปิดถึง 22:00 · 1.2 กม.</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>นำทาง</span>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div style={{ padding: '32px 24px 0' }}>
        {STEPS.map((step, i) => {
          const done    = i <= status;
          const current = i === status;
          const isLast  = i === STEPS.length - 1;
          const nextDone = i + 1 <= status;

          return (
            <div
              key={i}
              style={{
                display: 'flex', gap: 14, position: 'relative',
                paddingBottom: isLast ? 0 : 22,
              }}
            >
              {/* Connector line */}
              {!isLast && (
                <span style={{
                  position: 'absolute', left: 11, top: 24, bottom: -2, width: 2,
                  background: nextDone ? 'var(--accent)' : 'var(--line)',
                  borderRadius: 2,
                }} />
              )}

              {/* Step dot */}
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: done ? 'var(--accent)' : 'var(--bg-3)',
                border: done ? '0' : '1.5px solid var(--line-2)',
                display: 'grid', placeItems: 'center',
                color: '#fff',
                boxShadow: current
                  ? '0 0 0 6px rgba(181,81,30,0.18)'
                  : 'none',
                zIndex: 1,
                transition: 'all 0.3s',
              }}>
                {done && I.check(13)}
              </span>

              {/* Step label */}
              <div style={{ flex: 1, paddingTop: 1 }}>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 14,
                  color: done || current ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: current ? 600 : 400,
                }}>{step.label}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{step.labelEn}</div>
              </div>

              {/* Time */}
              {step.time && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', paddingTop: 2 }}>
                  {step.time}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Order summary ── */}
      <div style={{ padding: '28px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>รายการ · ITEMS</div>
        <div style={{
          padding: 14, borderRadius: 'var(--r-md)',
          background: 'var(--bg-2)', border: '1px solid var(--line)',
        }}>
          {MOCK_ITEMS.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < MOCK_ITEMS.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)', width: 20, flexShrink: 0 }}>
                ×{it.qty}
              </span>
              <Bowl tone={it.tone} topping={it.topping} size={36} />
              <div style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.2 }}>
                {it.name}
              </div>
              <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{it.price}</span>
            </div>
          ))}

          {/* Total row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
            alignItems: 'baseline',
          }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>ยอดรวม · TOTAL</span>
            <span className="thb price" style={{ fontSize: 18 }}>{MOCK_TOTAL}</span>
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
