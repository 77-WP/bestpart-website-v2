import { useNavigate } from 'react-router-dom';
import { useCart, cartTotal, itemTotal } from '../store/cart';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { SHOP } from '../config/shop';

// NOTE (item 7): CartItem stores tone='clay' and topping='egg' hardcoded in ProductSheet/Product —
// there is no actual product image in CartItem. The Bowl SVG placeholder is used for every cart line.

export default function Cart() {
  const { items, remove, setQty, clear } = useCart();
  const navigate = useNavigate();

  const total = cartTotal(items);

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
          <div style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>รับกลับบ้าน · พร้อมใน {SHOP.prepMinutes} นาที</div>
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

      {/* Total */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ height: 1, background: 'var(--line)', marginBottom: 10 }} />
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
