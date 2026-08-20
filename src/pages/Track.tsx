import { useParams } from 'react-router-dom';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';

export default function Track() {
  const { orderId } = useParams();
  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{
        padding: '16px 18px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div className="kicker">ออเดอร์ · ORDER</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>
            {orderId ? `#${orderId}` : 'ติดตามออเดอร์'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 12,
        color: 'var(--ink-3)', textAlign: 'center', padding: '0 32px',
      }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>{I.clock(40)}</div>
        <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>Tracking Shell</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          หน้า Tracking<br />จะ build ใน step ถัดไป
        </div>
      </div>

      <TabBar active="orders" />
    </div>
  );
}
