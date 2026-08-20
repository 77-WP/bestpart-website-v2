import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';

/* ── Mock data ─────────────────────────────────────────── */
const MOCK_USER = {
  name: 'คุณภพ',
  phone: '089 •••• 4471',
  favorites: 7,
};

const MOCK_HISTORY = [
  { name: 'กระเพราหมูสับ ไข่ดาว',              date: 'เมื่อวาน · 17:42', price: 134, tone: 'clay', topping: 'egg' },
  { name: 'ข้าวไก่กรอบกระเทียม + กระเพราหมูสับ', date: '25 ก.ค. · 19:03', price: 249, tone: 'sage', topping: 'chicken' },
  { name: 'คั่วพริกเกลือหมูกรอบ',                date: '22 ก.ค. · 12:14', price: 129, tone: 'wood', topping: 'chili' },
];

const ACCOUNT_MENU = [
  { th: 'ที่อยู่และสาขาที่บันทึก', en: 'Saved addresses' },
  { th: 'วิธีการชำระเงิน',         en: 'Payment methods' },
  { th: 'การแจ้งเตือน',            en: 'Notifications' },
  { th: 'ความช่วยเหลือ',           en: 'Help & FAQ' },
];

/* ── Gear icon (inline — not in icon set yet) ─────────── */
function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.03 4.24l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>
    </svg>
  );
}

/* ── Me page ─────────────────────────────────────────────  */
export default function Me() {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ paddingBottom: 80 }}>

      {/* ── Profile header ── */}
      <div style={{
        padding: '16px 18px 22px',
        background: 'linear-gradient(180deg, var(--bg-3) 0%, var(--bg) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', padding: 4,
            background: 'var(--bg-3)', borderRadius: 'var(--r-pill)',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
          }}>
            <span style={{ padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'var(--ink)', color: 'var(--on-accent)' }}>TH</span>
            <span style={{ padding: '4px 10px', borderRadius: 'var(--r-pill)', color: 'var(--ink-3)' }}>EN</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--bg-2)', border: '1px solid var(--line)',
              display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
            }}>{I.bell(15)}</button>
            <button style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--bg-2)', border: '1px solid var(--line)',
              display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
            }}><GearIcon size={15} /></button>
          </div>
        </div>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <Brand size={56} />
          <div style={{ flex: 1 }}>
            <div className="kicker muted">สมาชิก</div>
            <div className="h-display-th" style={{ fontSize: 22, marginTop: 1 }}>{MOCK_USER.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, fontFamily: 'var(--mono)' }}>
              {MOCK_USER.phone}
            </div>
          </div>
        </div>

        {/* Phone-recognition note */}
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 'var(--r-md)',
          background: 'rgba(74,93,63,0.10)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-2)', flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'var(--accent-2)', fontWeight: 600 }}>
            จำเบอร์ {MOCK_USER.phone} ได้แล้ว · ครั้งหน้าสั่งซ้ำได้เร็วขึ้น
          </span>
        </div>
      </div>

      {/* ── Bowl Circle — coming soon ── */}
      <div style={{ padding: '0 18px' }}>
        <div style={{
          marginTop: -16,
          padding: '18px 18px 16px',
          borderRadius: 'var(--r-lg)',
          background: 'var(--ink)', color: 'var(--bg)',
          position: 'relative', overflow: 'hidden',
          boxShadow: 'var(--sh-card)',
        }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', right: -30, top: -30,
            width: 140, height: 140, borderRadius: '50%',
            background: 'rgba(181,81,30,0.30)',
          }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ fontSize: 26, flexShrink: 0 }}>🎁</div>
            <div>
              <div className="kicker" style={{ color: 'var(--gold)' }}>BOWL CIRCLE · กำลังเตรียมพร้อม</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.6 }}>
                เราเก็บประวัติการสั่งของคุณไว้แล้ว<br />
                เร็วๆ นี้คุณจะได้รับสิทธิพิเศษจากการเป็นลูกค้าประจำ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Favorites shortcut ── */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{
          padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)',
          border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: 'var(--accent)' }}>{I.heart(18)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>รายการโปรด</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{MOCK_USER.favorites} เมนูที่คุณบันทึกไว้</div>
          </div>
          <span style={{ color: 'var(--ink-3)' }}>{I.arrow(14)}</span>
        </div>
      </div>

      {/* ── Order history ── */}
      <div style={{ padding: '20px 18px 0' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', marginBottom: 8,
        }}>
          <div className="kicker muted">ประวัติการสั่ง · ORDER HISTORY</div>
          <button style={{
            fontSize: 11, color: 'var(--accent)', fontWeight: 600,
            background: 'none', border: 0, padding: 0,
          }}>ดูทั้งหมด →</button>
        </div>

        {MOCK_HISTORY.map((o, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: i < MOCK_HISTORY.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            {/* Bowl thumbnail */}
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--r-sm)',
              background: 'var(--bg-3)', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Bowl tone={o.tone} topping={o.topping} size={38} />
            </div>

            {/* Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{o.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{o.date}</div>
            </div>

            {/* Price */}
            <span className="thb price" style={{ fontSize: 14 }}>{o.price}</span>

            {/* Reorder */}
            <button
              onClick={() => navigate('/order')}
              style={{ color: 'var(--accent)', background: 'none', border: 0, padding: 4 }}
            >{I.repeat(15)}</button>
          </div>
        ))}
      </div>

      {/* ── Account menu ── */}
      <div style={{ padding: '20px 18px 0' }}>
        <div className="kicker muted" style={{ marginBottom: 6 }}>บัญชี · ACCOUNT</div>
        {ACCOUNT_MENU.map(({ th, en }, i) => (
          <button
            key={i}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              padding: '14px 0', background: 'none', border: 0, textAlign: 'left',
              borderBottom: i < ACCOUNT_MENU.length - 1 ? '1px solid var(--line)' : 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)' }}>{th}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{en}</div>
            </div>
            <span style={{ color: 'var(--ink-3)' }}>{I.arrow(14)}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '24px 18px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
          BESTPARTBOWLS · v2.0
        </span>
      </div>

      <TabBar active="me" />
    </div>
  );
}
