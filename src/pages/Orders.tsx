import { useNavigate } from 'react-router-dom';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';

export default function Orders() {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ paddingBottom: 100 }}>

      {/* Header */}
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: '1px solid var(--line)',
      }}>
        <div className="kicker">ออเดอร์ · MY ORDERS</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 2 }}>ประวัติการสั่ง</div>
      </div>

      {/* Empty state */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 14,
        padding: '0 32px',
        textAlign: 'center',
        color: 'var(--ink-3)',
      }}>
        <div style={{ opacity: 0.25 }}>{I.receipt(52)}</div>
        <div className="h-display-th" style={{ fontSize: 20, color: 'var(--ink-2)' }}>
          ยังไม่มีออเดอร์
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, maxWidth: 260 }}>
          ออเดอร์ที่คุณสั่งจะปรากฏที่นี่<br />เริ่มสั่งได้เลย!
        </div>
        <button
          onClick={() => navigate('/order')}
          style={{
            marginTop: 4,
            background: 'var(--ink)',
            color: 'var(--on-accent)',
            border: 0,
            padding: '13px 28px',
            borderRadius: 'var(--r-pill)',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          ดูเมนู {I.arrow(14)}
        </button>
      </div>

      <TabBar active="orders" />
    </div>
  );
}
