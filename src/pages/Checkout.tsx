import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, cartTotal, itemTotal } from '../store/cart';
import { supabase } from '../lib/supabase';
import { I } from '../components/icons';
import { SHOP, shopCloseLabel, computeSlots, type ShopInfo } from '../config/shop';
import { TEST_MODE, ENABLE_BEAM } from '../config/env';

const METHODS = [
  { id: 'dine',     label: 'ทานที่ร้าน', labelEn: 'Dine-in' },
  { id: 'takeaway', label: 'รับกลับ',    labelEn: 'Takeaway' },
  { id: 'curbside', label: 'ถึงรถ',      labelEn: 'Curbside' },
];

const PAYMENT_OPTS = [
  { id: 'promptpay', label: 'PromptPay QR', sub: 'ผ่าน Beam · สแกนจ่ายทันที', icon: I.qr(16) },
  { id: 'cash',      label: 'เงินสดที่ร้าน', sub: 'Pay at counter',             icon: I.cash(16) },
];

const FULFILLMENT_MAP: Record<string, string> = {
  dine:     'dine-in',
  takeaway: 'takeaway',
  curbside: 'curbside',
};

/* ── input shared style ──────────────────────────────────── */
const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)',
  padding: '12px 14px',
  fontFamily: 'var(--sans)',
  fontSize: 14,
  color: 'var(--ink)',
  outline: 'none',
};

/* ── phone helpers ───────────────────────────────────────── */
function digitsOnly(v: string) { return v.replace(/\D/g, ''); }
function isPhoneOk(v: string)  { return /^\d{10}$/.test(digitsOnly(v)); }

export default function Checkout() {
  const navigate = useNavigate();
  const { items, clear } = useCart();

  /* compute once at mount — slots depend on current Bangkok time */
  const [shopInfo] = useState<ShopInfo>(() => {
    const base = computeSlots();
    if (!TEST_MODE) return base;
    // TEST_MODE: shop is always open; ensure at least the ASAP slot exists
    const slots = base.slots.length > 0
      ? base.slots
      : [{ label: 'พร้อมเร็วสุด', sub: `~${SHOP.prepMinutes} นาที`, value: 'โดยเร็วที่สุด', isAsap: true as const }];
    return { isOpen: true, slots, nextOpenMsg: '' };
  });

  const [method,    setMethod]  = useState('takeaway');
  const [timeSlot,  setTime]    = useState(0);
  const [payment,   setPayment] = useState(ENABLE_BEAM ? 'promptpay' : 'cash');

  const [name,      setName]    = useState('');
  const [phone,     setPhone]   = useState('');
  const [nameTouched,  setNameTouched]  = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const subtotal = cartTotal(items);
  const total    = subtotal; // no packaging, no discount

  const nameOk  = name.trim().length > 0;
  const phoneOk = isPhoneOk(phone);
  const canSubmit = shopInfo.isOpen && nameOk && phoneOk && !loading;

  async function handleConfirm() {
    /* ensure all fields touched so errors become visible */
    setNameTouched(true);
    setPhoneTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const orderItems = items.map(it => ({
      name:       it.name,
      name_en:    it.nameEn,
      item_id:    it.itemId,
      qty:        it.qty,
      unit_price: itemTotal(it) / it.qty,
      total:      itemTotal(it),
      size:       it.sizeLabel,
      spice:      it.spice,
      addons:     it.addons,
    }));

    const selectedSlot = shopInfo.slots[timeSlot];
    const isBeam = payment === 'promptpay';

    const { data, error: dbError } = await supabase
      .from('orders')
      .insert({
        items:                   orderItems,
        subtotal:                subtotal,
        discount_amount:         0,
        delivery_fee:            0,
        grand_total:             total,
        status:                  isBeam ? 'awaiting_payment' : 'pending',
        payment_status:          'pending',
        fulfillment_type:        FULFILLMENT_MAP[method] ?? 'takeaway',
        checkout_payment_method: isBeam ? 'promptpay' : 'cash',
        internal_notes:          isBeam ? null : 'จ่ายที่ร้าน',
        pickup_time:             selectedSlot?.value ?? null,
        source:                  'web',
      })
      .select('id')
      .single();

    if (dbError || !data) {
      console.error('[INSERT orders] failed:', {
        message: dbError?.message,
        code:    dbError?.code,
        details: dbError?.details,
        hint:    dbError?.hint,
      });
      setLoading(false);
      setError(
        TEST_MODE && dbError
          ? `[INSERT orders] ${dbError.message}${dbError.code ? ` / ${dbError.code}` : ''}`
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
      );
      return;
    }

    const orderId = data.id;

    /* INSERT order_contacts — fail silently */
    supabase
      .from('order_contacts')
      .insert({ order_id: orderId, name: name.trim(), phone: digitsOnly(phone) })
      .then(({ error: contactErr }) => {
        if (contactErr) console.error('[INSERT order_contacts] failed:', {
          message: contactErr.message,
          code:    contactErr.code,
          details: contactErr.details,
          hint:    contactErr.hint,
        });
      });

    clear();

    if (isBeam) {
      /* Beam path — navigate to /pay first; Pay page calls create-beam-charge */
      navigate(`/pay/${orderId}`);
    } else {
      navigate(`/track/${orderId}`);
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 110 }}>
      {/* TEST MODE banner — only visible when VITE_TEST_MODE=true in .env.local */}
      {TEST_MODE && (
        <div style={{
          background: '#b45309',
          color: '#fffdf8',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textAlign: 'center',
          padding: '5px 0',
        }}>
          ⚠ TEST MODE — ห้ามใช้บัตรจริง
        </div>
      )}
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
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{SHOP.branchName}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>
              เปิดถึง {shopCloseLabel()} · 1.2 กม.
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>เปลี่ยน</span>
        </div>
      </div>

      {/* Time */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>เวลารับ · PICKUP TIME</div>

        {shopInfo.isOpen ? (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginRight: -18, paddingRight: 18 }}>
            {shopInfo.slots.map((s, i) => (
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
                  {s.isAsap && <span style={{ color: 'var(--accent)' }}>{I.flame(12)}</span>}
                  {s.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{s.sub}</div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(43,33,24,0.06)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-2)',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>ร้านปิดอยู่</span>
            {' · เปิดครั้งถัดไป '}
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{shopInfo.nextOpenMsg}</span>
          </div>
        )}
      </div>

      {/* Contact */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div className="kicker muted">ผู้รับ · CONTACT</div>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--accent-2)',
            background: 'rgba(74,93,63,0.14)', padding: '3px 8px', borderRadius: 'var(--r-pill)',
          }}>สั่งแบบไม่ต้องสมัคร</span>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>ชื่อ</div>
          <input
            type="text"
            placeholder="ชื่อผู้รับ"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            style={{
              ...inputBase,
              border: nameTouched && !nameOk ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            }}
          />
          {nameTouched && !nameOk && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>กรุณากรอกชื่อ</div>
          )}
        </div>

        {/* Phone */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>เบอร์โทร</div>
          <input
            type="tel"
            placeholder="0812345678"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            style={{
              ...inputBase,
              fontFamily: 'var(--mono)',
              border: phoneTouched && !phoneOk ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            }}
          />
          {phoneTouched && !phoneOk && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
              {phone.trim() === '' ? 'กรุณากรอกเบอร์โทร' : 'เบอร์ต้องเป็นตัวเลข 10 หลัก'}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ color: 'var(--accent-2)', flexShrink: 0, marginTop: 1 }}>{I.check(12)}</span>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            เก็บเบอร์และประวัติการสั่งเพื่อพัฒนาบริการ ใช้เพื่อ Best Part เท่านั้น
          </span>
        </div>
      </div>

      {/* Payment */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 8 }}>ชำระเงิน · PAYMENT</div>
        {PAYMENT_OPTS.filter(p => ENABLE_BEAM || p.id !== 'promptpay').map(p => (
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
      </div>

      {/* Sticky pay button */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '14px 18px 26px', background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
      }}>
        {error && (
          <div style={{
            marginBottom: 10, padding: '10px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(178,58,31,0.10)', color: 'var(--accent)',
            fontSize: 12, textAlign: 'center',
          }}>{error}</div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!canSubmit}
          style={{
            width: '100%',
            background: canSubmit ? 'var(--accent)' : 'var(--ink-3)',
            color: 'var(--on-accent)',
            border: 0, padding: '16px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          <span>
            {loading
              ? 'กำลังสร้างออเดอร์…'
              : !shopInfo.isOpen
                ? 'ร้านปิดอยู่'
                : payment === 'promptpay'
                  ? 'ชำระเงิน'
                  : 'ยืนยันออเดอร์'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{total}</span>
            {I.arrow(14)}
          </span>
        </button>
      </div>
    </div>
  );
}
