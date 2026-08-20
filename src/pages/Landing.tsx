import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';

/* ── Language toggle ────────────────────────────────────── */
function LangToggle({ lang = 'TH' }: { lang?: 'TH' | 'EN' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', padding: 4,
      background: 'var(--bg-3)', borderRadius: 'var(--r-pill)',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    }}>
      {(['TH', 'EN'] as const).map(l => (
        <span key={l} style={{
          padding: '4px 10px', borderRadius: 'var(--r-pill)',
          background: lang === l ? 'var(--ink)' : 'transparent',
          color: lang === l ? 'var(--on-accent)' : 'var(--ink-3)',
        }}>{l}</span>
      ))}
    </div>
  );
}

/* ── Phone prompt ───────────────────────────────────────── */
function PhonePrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 'var(--r-md)',
      border: '1px solid var(--line-2)', background: 'var(--bg-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{I.phone(16)}</span>
        <div style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 12.5, lineHeight: 1.35 }}>
          กรอกเบอร์เพื่อสั่งซ้ำได้เร็วขึ้น (ไม่บังคับ)
        </div>
        <button
          onClick={onDismiss}
          style={{ color: 'var(--ink-3)', background: 'none', border: 0, padding: 2, flexShrink: 0 }}
        >
          {I.close(14)}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{
          flex: 1, padding: '9px 12px', borderRadius: 'var(--r-pill)',
          border: '1px solid var(--line)', background: 'var(--bg)',
          fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)',
        }}>08X-XXX-XXXX</div>
        <button style={{
          background: 'var(--ink)', color: 'var(--on-accent)', border: 0,
          padding: '9px 16px', borderRadius: 'var(--r-pill)',
          fontSize: 12, fontWeight: 600,
        }}>ยืนยัน</button>
      </div>
    </div>
  );
}

/* ── Hero banner ────────────────────────────────────────── */
function HeroBanner({ onCTA }: { onCTA: () => void }) {
  return (
    <div style={{ padding: '4px 18px 0' }}>
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, var(--accent) 0%, #82390f 100%)',
        color: 'var(--on-accent)',
        borderRadius: 'var(--r-lg)',
        padding: '22px 22px 26px',
        overflow: 'hidden',
        minHeight: 190,
      }}>
        {/* radial glow */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.15,
          background: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 40%)',
        }} />
        {/* bowl illustration */}
        <div style={{ position: 'absolute', right: -18, bottom: -12, transform: 'rotate(-8deg)' }}>
          <Bowl tone="clay" topping="egg" size={160} />
        </div>
        <div className="kicker" style={{ color: 'var(--gold)' }}>เมนูใหม่ · NEW</div>
        <div className="h-display-th" style={{ fontSize: 28, marginTop: 8, maxWidth: 200 }}>
          กระเพราหมูกรอบทองคำ
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 10, maxWidth: 180, lineHeight: 1.5 }}>
          หมูกรอบ ไข่ดาว พริกแกะคั่วเกลือ เสิร์ฟร้อนใน 8 นาที
        </div>
        <button
          onClick={onCTA}
          style={{
            marginTop: 16, background: 'var(--bg)', color: 'var(--ink)', border: 0,
            padding: '11px 20px', borderRadius: 'var(--r-pill)',
            fontWeight: 700, fontSize: 13, letterSpacing: '0.04em',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            position: 'relative',
          }}
        >
          เริ่มสั่ง Best Part {I.arrow(14)}
        </button>
      </div>
    </div>
  );
}

/* ── Order method row ───────────────────────────────────── */
function OrderMethodRow({ onSelect }: { onSelect: () => void }) {
  const methods = [
    { ic: I.dinein(20), th: 'ทานที่ร้าน', en: 'Dine-in', tag: 'QR โต๊ะ', primary: true },
    { ic: I.bag(20),    th: 'รับกลับบ้าน', en: 'Takeaway' },
    { ic: I.scooter(20), th: 'เดลิเวอรี่', en: 'Delivery' },
  ];
  return (
    <div style={{ padding: '18px 18px 0' }}>
      <div className="kicker muted" style={{ marginBottom: 10 }}>เลือกวิธีรับ · ORDER METHOD</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8 }}>
        {methods.map((m, i) => (
          <button
            key={i}
            onClick={onSelect}
            style={{
              background: m.primary ? 'var(--ink)' : 'var(--bg-2)',
              color: m.primary ? 'var(--on-accent)' : 'var(--ink)',
              border: m.primary ? '0' : '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '14px 12px',
              textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 92,
            }}
          >
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: m.primary ? 'var(--gold)' : 'var(--accent)' }}>{m.ic}</span>
              {m.tag && (
                <span style={{
                  fontSize: 10, padding: '2px 7px', background: 'var(--accent)',
                  color: '#fff', borderRadius: 'var(--r-pill)', fontWeight: 700, letterSpacing: '.05em',
                }}>{m.tag}</span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: m.primary ? 17 : 14, lineHeight: 1.1 }}>{m.th}</span>
            <span style={{ fontSize: 10, opacity: 0.6, marginTop: 'auto' }}>{m.en}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Best sellers strip ─────────────────────────────────── */
const BESTSELLERS = [
  { n: 'กระเพราหมูสับ', en: 'Pad Krapow',       p: 99,  tone: 'clay', topping: 'egg',     flame: true },
  { n: 'ข้าวไก่กรอบ',   en: 'Crispy Chicken',   p: 115, tone: 'sage', topping: 'chicken'            },
  { n: 'คั่วพริกเกลือ', en: 'Salt-Pepper Pork', p: 129, tone: 'wood', topping: 'chili',   flame: true },
  { n: 'ข้าวคลุกกะปิ',  en: 'Shrimp Paste Rice',p: 99,  tone: 'gold', topping: 'rice'               },
];

function BestSellersStrip({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: '24px 0 0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '0 18px', marginBottom: 10,
      }}>
        <div>
          <div className="kicker muted">ขายดีสัปดาห์นี้</div>
          <div className="h-display-th" style={{ fontSize: 20, marginTop: 2 }}>เมนูขายดี</div>
        </div>
        <button
          onClick={onAdd}
          style={{
            fontSize: 11, color: 'var(--accent)', fontWeight: 600,
            letterSpacing: '.06em', background: 'none', border: 0, padding: 0,
          }}
        >ดูทั้งหมด →</button>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 18px 6px' }}>
        {BESTSELLERS.map((it, i) => (
          <div key={i} style={{
            minWidth: 142, padding: 12, borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 8px' }}>
              <Bowl tone={it.tone} topping={it.topping} size={86} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)' }}>
              {it.flame && I.flame(11)}
              <span style={{ fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                #{i + 1} · {it.flame ? 'hot' : 'top'}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, marginTop: 4, lineHeight: 1.2 }}>{it.n}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{it.en}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span className="price thb" style={{ fontSize: 16 }}>{it.p}</span>
              <button
                onClick={onAdd}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--ink)', color: 'var(--on-accent)', border: 0,
                  display: 'grid', placeItems: 'center',
                }}
              >{I.plus(14)}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Landing page ───────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [showPrompt, setShowPrompt] = useState(true);

  const goOrder = () => navigate('/order');

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* App bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 6px',
      }}>
        <Brand />
        <LangToggle lang="TH" />
      </div>

      {/* Phone prompt */}
      {showPrompt && (
        <div style={{ padding: '2px 18px 0' }}>
          <PhonePrompt onDismiss={() => setShowPrompt(false)} />
        </div>
      )}

      {/* Hero */}
      <div style={{ marginTop: 14 }}>
        <HeroBanner onCTA={goOrder} />
      </div>

      {/* Order method */}
      <OrderMethodRow onSelect={goOrder} />

      {/* Best sellers */}
      <BestSellersStrip onAdd={goOrder} />

      {/* Secondary CTA */}
      <div style={{ padding: '22px 18px 16px' }}>
        <button
          onClick={goOrder}
          style={{
            width: '100%', background: 'var(--bg-2)', color: 'var(--ink)',
            border: '1px solid var(--line-2)', borderRadius: 'var(--r-pill)',
            padding: '13px 18px', fontWeight: 600, fontSize: 13, letterSpacing: '.03em',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          }}
        >ดูเมนูทั้งหมด {I.arrow(14)}</button>
      </div>

      <TabBar active="home" />
    </div>
  );
}
