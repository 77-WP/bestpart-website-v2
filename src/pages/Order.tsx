import { TabBar } from '../components/TabBar';
import { Brand } from '../components/Brand';
import { I } from '../components/icons';

export default function Order() {
  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 6px', borderBottom: '1px solid var(--line)',
      }}>
        <Brand />
        <div style={{
          padding: '6px 14px', background: 'var(--bg-3)',
          borderRadius: 'var(--r-pill)', fontSize: 12, color: 'var(--ink-2)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {I.search(14)} ค้นหาเมนู...
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 12,
        color: 'var(--ink-3)', textAlign: 'center', padding: '0 32px',
      }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>{I.search(40)}</div>
        <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>เมนูกำลังมา</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          หน้า Menu / Cart / Checkout<br />จะ build ใน step ถัดไป
        </div>
      </div>

      <TabBar active="menu" />
    </div>
  );
}
