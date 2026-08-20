import { useNavigate } from 'react-router-dom';
import { useCart, cartTotal } from '../store/cart';
import { I } from './icons';

export function CartBar() {
  const { items } = useCart();
  const navigate = useNavigate();
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = cartTotal(items);

  if (count === 0) return null;

  return (
    <div className="cart-bar" onClick={() => navigate('/cart')} style={{ cursor: 'pointer' }}>
      <span style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--accent)', color: 'var(--on-accent)',
        display: 'grid', placeItems: 'center',
        fontWeight: 700, fontSize: 14, fontFamily: 'var(--mono)',
        flexShrink: 0,
      }}>{count}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
          ตะกร้าของคุณ · {count} รายการ
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 17 }}>฿{total}</div>
      </div>
      <button style={{
        background: 'var(--accent)', color: 'var(--on-accent)',
        border: 0, padding: '10px 18px', borderRadius: 'var(--r-pill)',
        fontWeight: 600, fontSize: 13, letterSpacing: '0.04em',
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        ดูตะกร้า {I.arrow(12)}
      </button>
    </div>
  );
}
