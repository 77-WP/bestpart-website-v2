import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, cartTotal } from '../store/cart';
import { I } from '../components/icons';

const METHODS = [
  { id: 'dine',     label: 'ทานที่ร้าน', labelEn: 'Dine-in' },
  { id: 'takeaway', label: 'รับกลับ',    labelEn: 'Takeaway' },
  { id: 'curbside', label: 'ถึงรถ',      labelEn: 'Curbside' },
];

const TIME_SLOTS = [
  { label: 'พร้อมเร็วสุด', sub: '~12 นาที', hot: true },
  { label: '19:00', sub: 'ใน 25 นาที' },
  { label: '19:15', sub: 'ใน 40 นาที' },
  { label: '19:30', sub: 'ใน 55 นาที' },
];

const PAYMENT_OPTS = [
  { id: 'promptpay', label: 'PromptPay QR', sub: 'ผ่าน Beam · สแกนจ่ายทันที', icon: I.qr(16) },
  { id: 'cash',      label: 'เงินสดที่ร้าน', sub: 'Pay at counter',             icon: I.cash(16) },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { items, clear } = useCart();

  const [method,    setMethod]  = useState('takeaway');
  const [timeSlot,  setTime]    = useState(0);
  const [payment,   setPayment] = useState('promptpay');

  const subtotal  = cartTotal(items);
  const discount  = subtotal >= 200 ? 20 : 0;
  const packaging = 5;
  const total     = subtotal - discount + packaging;

  function handleConfirm() {
    clear();
    navigate('/track/8204');
  }

  return (
    <div className="page" style={{ paddingBottom: 110 }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 8px', display: 'flex', alignItems: 'center',
        gap: 12, borderBottom: '1px solid var(--line)',
      }}>
        <button onClick={() => navigate('/cart')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
          {I.back(22)}
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">ขั้นตอนสุดท้าย · CHECKOUT</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>ยืนยันออเดอร์</div>
        </div>
      </div>

      {/* Method tabs */}
      <div style={{ padding: '16px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>วิธีรับ · METHOD</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
          padding: 4, borderRadius: 'var(--r-md)', background: 'var(--bg-3)',
        }}>
          {METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              style={{
                padding: '10px 6px', borderRadius: 'var(--r-sm)',
                background: method === m.id ? 'var(--bg)' : 'transparent',
                border: 0, boxShadow: method === m.id ? 'var(--sh-card)' : 'none',
              }}
            >
              <div style={{ fontFamily: 'var(--serif)', fontSize: 12, color: method === m.id ? 'var(--ink)' : 'var(--ink-2)' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>{m.labelEn}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Branch */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{
          padding: '14px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)',
          border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-2)',
            color: '#fff', display: 'grid', placeItems: 'center',
          }}>{I.pin(18)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>รับที่</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>สาขาทองหล่อ ซอย 13</div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>เปิดถึง 22:00 · 1.2 กม.</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>เปลี่ยน</span>
        </div>
      </div>

      {/* Time */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>เวลารับ · PICKUP TIME</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginRight: -18, paddingRight: 18 }}>
          {TIME_SLOTS.map((s, i) => (
            <button
              key={i}
              onClick={() => setTime(i)}
              style={{
                padding: '10px 14px', borderRadius: 'var(--r-md)',
                border: i === timeSlot ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                background: i === timeSlot ? 'var(--bg-2)' : 'var(--bg)',
                minWidth: 108, textAlign: 'left', flexShrink: 0,
              }}
            >
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 13,
                color: i === timeSlot ? 'var(--ink)' : 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {s.hot && <span style={{ color: 'var(--accent)' }}>{I.flame(12)}</span>}
                {s.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{s.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div className="kicker muted">ผู้รับ · CONTACT</div>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--accent-2)',
            background: 'rgba(74,93,63,0.14)', padding: '3px 8px', borderRadius: 'var(--r-pill)',
          }}>สั่งแบบไม่ต้องสมัคร</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--line)', background: 'var(--bg-2)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>ชื่อ</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13, marginTop: 2 }}>คุณภพ</div>
          </div>
          <div style={{
            flex: 1.2, padding: '12px 14px', borderRadius: 'var(--r-sm)',
            border: '1.5px solid var(--ink)', background: 'var(--bg-2)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>เบอร์โทร</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, marginTop: 2 }}>089 •••• 4471</div>
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent-2)' }}>{I.check(13)}</span>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>เราจะจำเบอร์นี้ไว้เพื่อให้สั่งซ้ำได้เร็วขึ้นครั้งหน้า</span>
        </div>
      </div>

      {/* Payment */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>ชำระเงิน · PAYMENT</div>
        {PAYMENT_OPTS.map(p => (
          <label
            key={p.id}
            onClick={() => setPayment(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 'var(--r-sm)', marginBottom: 6, cursor: 'pointer',
              border: payment === p.id ? '1.5px solid var(--ink)' : '1px solid var(--line)',
              background: payment === p.id ? 'var(--bg-2)' : 'var(--bg)',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              border: payment === p.id ? '6px solid var(--ink)' : '1.5px solid var(--line-2)',
              background: 'var(--bg)',
            }} />
            <span style={{ color: 'var(--ink-2)' }}>{p.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.sub}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Totals mini */}
      <div style={{ padding: '18px 18px 0', fontSize: 12, color: 'var(--ink-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{items.reduce((s, i) => s + i.qty, 0)} รายการ</span>
          <span className="thb" style={{ fontFamily: 'var(--mono)' }}>{subtotal}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-2)' }}>
            <span>ส่วนลด</span>
            <span className="thb" style={{ fontFamily: 'var(--mono)' }}>-{discount}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>ค่าบรรจุภัณฑ์</span>
          <span className="thb" style={{ fontFamily: 'var(--mono)' }}>{packaging}</span>
        </div>
      </div>

      {/* Sticky pay button */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '14px 18px 26px', background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
      }}>
        <button
          onClick={handleConfirm}
          style={{
            width: '100%', background: 'var(--accent)', color: 'var(--on-accent)',
            border: 0, padding: '16px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>ไปหน้าชำระเงิน</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{total}</span>
            {I.arrow(14)}
          </span>
        </button>
      </div>
    </div>
  );
}
