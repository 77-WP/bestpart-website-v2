import { useNavigate } from 'react-router-dom';
import { useCart, cartTotal, itemTotal } from '../store/cart';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { SUGGESTIONS } from '../data/menu';

export default function Cart() {
  const { items, remove, setQty, clear } = useCart();
  const navigate = useNavigate();

  const subtotal = cartTotal(items);
  const discount = subtotal >= 200 ? 20 : 0;
  const packaging = items.length > 0 ? 5 : 0;
  const total = subtotal - discount + packaging;

  if (items.length === 0) {
    return (
      <div className="page" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
          <button onClick={() => navigate('/order')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
            {I.back(22)}
          </button>
          <div style={{ flex: 1 }}>
            <div className="kicker">ตะกร้า · YOUR BAG</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>ว่างอยู่</div>
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', gap: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '0 32px',
        }}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>{I.bag(40)}</div>
          <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>ตะกร้าว่าง</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>เพิ่มเมนูที่ชอบจากหน้า Menu ก่อนนะ</div>
          <button
            onClick={() => navigate('/order')}
            style={{
              marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
              border: 0, padding: '12px 24px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13,
            }}
          >ดูเมนู {I.arrow(14)}</button>
        </div>
        <TabBar active="menu" />
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
        <button onClick={() => navigate('/order')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
          {I.back(22)}
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">ตะกร้า · YOUR BAG</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>
            {items.reduce((s, i) => s + i.qty, 0)} รายการ
          </div>
        </div>
        <button
          onClick={clear}
          style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 0, padding: 0 }}
        >ล้างทั้งหมด</button>
      </div>

      {/* Method strip */}
      <div style={{
        margin: '14px 18px 0', padding: '12px 14px', borderRadius: 'var(--r-md)',
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ color: 'var(--accent)' }}>{I.bag(20)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>วิธีรับ</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>รับกลับบ้าน · พร้อมใน 12 นาที</div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>เปลี่ยน</span>
      </div>

      {/* Cart lines */}
      <div style={{ padding: '6px 18px 0' }}>
        {items.map((it, i) => (
          <div key={it.cartId} style={{
            display: 'flex', gap: 12, padding: '16px 0',
            borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--r-sm)',
              background: 'var(--bg-2)', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Bowl tone={it.tone} topping={it.topping} size={56} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.2 }}>{it.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{it.nameEn}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>
                {[it.sizeLabel, it.spice, ...it.addons.map(a => `+${a.label}`)].join(' · ')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', background: 'var(--bg-2)',
                }}>
                  <button
                    onClick={() => it.qty <= 1 ? remove(it.cartId) : setQty(it.cartId, it.qty - 1)}
                    style={{ width: 28, height: 28, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}
                  >{I.minus(14)}</button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 14 }}>{it.qty}</span>
                  <button
                    onClick={() => setQty(it.cartId, it.qty + 1)}
                    style={{ width: 28, height: 28, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
                  >{I.plus(14)}</button>
                </div>
                <span className="price thb" style={{ fontSize: 16 }}>{itemTotal(it)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div style={{ padding: '20px 18px 0' }}>
        <div className="kicker muted">เพิ่มได้อีก · YOU MIGHT LIKE</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, marginRight: -18, paddingRight: 18 }}>
          {SUGGESTIONS.map(s => (
            <div key={s.id} style={{
              minWidth: 120, padding: 10, borderRadius: 'var(--r-sm)',
              background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
                <Bowl tone={s.tone} topping={s.topping} size={56} />
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 12, marginTop: 4, lineHeight: 1.2 }}>{s.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span className="price thb" style={{ fontSize: 13 }}>{s.price}</span>
                <button style={{
                  width: 24, height: 24, borderRadius: '50%', border: 0,
                  background: 'var(--ink)', color: 'var(--on-accent)',
                  display: 'grid', placeItems: 'center',
                }}>{I.plus(12)}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promo */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--bg-3)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: 'var(--accent-2)' }}>{I.leaf(18)}</span>
          <span style={{ flex: 1, fontSize: 12 }}>
            ใช้โค้ด <b style={{ fontFamily: 'var(--mono)' }}>NEWBOWL</b> ลด ฿20
          </span>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>ใช้</span>
        </div>
      </div>

      {/* Totals */}
      <div style={{ padding: '18px 18px 0', fontSize: 12 }}>
        {[
          { label: 'รวม', value: subtotal },
          ...(discount > 0 ? [{ label: 'ส่วนลด NEWBOWL', value: -discount }] : []),
          { label: 'ค่าบรรจุภัณฑ์', value: packaging },
        ].map(({ label, value }, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: 'var(--ink-2)' }}>
            <span>{label}</span>
            <span className="thb" style={{ fontFamily: 'var(--mono)' }}>
              {value < 0 ? `-${Math.abs(value)}` : value}
            </span>
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>ยอดรวม · TOTAL</span>
          <span className="thb price" style={{ fontSize: 24 }}>{total}</span>
        </div>
      </div>

      {/* Sticky checkout button */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '14px 18px 26px', background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
      }}>
        <button
          onClick={() => navigate('/checkout')}
          style={{
            width: '100%', background: 'var(--ink)', color: 'var(--on-accent)',
            border: 0, padding: '16px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>ดำเนินการชำระเงิน</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{total}</span>
            {I.arrow(14)}
          </span>
        </button>
      </div>
    </div>
  );
}
