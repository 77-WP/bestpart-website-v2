import { TabBar } from '../components/TabBar';
import { Brand } from '../components/Brand';
import { I } from '../components/icons';

export default function Me() {
  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{
        padding: '16px 18px 22px',
        background: 'linear-gradient(180deg, var(--bg-3) 0%, var(--bg) 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="kicker muted">บัญชีของคุณ</div>
          <button style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
          }}>{I.user(15)}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <Brand size={56} />
          <div>
            <div className="kicker muted">สมาชิก</div>
            <div className="h-display-th" style={{ fontSize: 22, marginTop: 1 }}>Best Part</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '40vh', gap: 12,
        color: 'var(--ink-3)', textAlign: 'center', padding: '0 32px',
      }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>{I.user(40)}</div>
        <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>Account Shell</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          หน้าบัญชีและประวัติการสั่ง<br />จะ build ใน step ถัดไป
        </div>
      </div>

      <TabBar active="me" />
    </div>
  );
}
