import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { LINKS } from '../config/links';

/* ── Greeting by time-of-day ────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

/* ── Bottom-sheet IDs ───────────────────────────────────── */
type Sheet = 'delivery' | 'about' | 'social' | null;

/* ── Reusable bottom-sheet wrapper ─────────────────────── */
function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(43,33,24,0.52)',
          zIndex: 50,
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--bg-2)',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
        zIndex: 51,
        boxShadow: '0 -8px 40px -8px rgba(43,33,24,0.22)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-2)' }} />
        </div>
        {children}
      </div>
    </>
  );
}

/* ── Service button (floating circle) ──────────────────── */
function ServiceBtn({
  icon, label, sublabel, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        background: 'none', border: 0, cursor: 'pointer', padding: '4px 0',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        display: 'grid', placeItems: 'center',
        color: 'var(--accent)',
        boxShadow: '0 2px 12px -4px rgba(43,33,24,0.14)',
      }}>
        {icon}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.2 }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{sublabel}</div>
      </div>
    </button>
  );
}

/* ── Icon row button (small) ────────────────────────────── */
function InfoBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'none', border: 0, cursor: 'pointer', padding: '4px 0',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: 'var(--bg-3)',
        display: 'grid', placeItems: 'center',
        color: 'var(--ink-2)',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate();

  const [sheet, setSheet] = useState<Sheet>(null);
  // hero: null = probing, true = visible, false = hidden
  const [heroVisible, setHeroVisible] = useState<boolean | null>(null);

  const deliveryLinks = (
    [
      { name: 'Grab Food',   href: LINKS.grab,       dot: '#00B14F' },
      { name: 'LINE MAN',    href: LINKS.lineman,    dot: '#06C755' },
      { name: 'Shopee Food', href: LINKS.shopeeFood, dot: '#EE4D2D' },
    ] as { name: string; href: string | null; dot: string }[]
  ).filter((p): p is { name: string; href: string; dot: string } => p.href !== null);

  const socialLinks = (
    [
      { name: 'LINE Official', href: LINKS.line,     dot: '#06C755' },
      { name: 'Facebook Page', href: LINKS.facebook, dot: '#1877F2' },
    ] as { name: string; href: string | null; dot: string }[]
  ).filter((s): s is { name: string; href: string; dot: string } => s.href !== null);

  return (
    <div className="page" style={{ paddingBottom: 100 }}>

      {/* ── a) Header ────────────────────────────────────── */}
      <div style={{
        padding: '16px 18px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brand size={34} />
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, lineHeight: 1.1 }}>
              Best Part
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Bowls
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Greeting */}
          <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--serif)' }}>
            {getGreeting()}
          </span>
          {/* TH / EN toggle */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', padding: 3,
            background: 'var(--bg-3)', borderRadius: 'var(--r-pill)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          }}>
            <span style={{
              padding: '3px 9px', borderRadius: 'var(--r-pill)',
              background: 'var(--ink)', color: 'var(--on-accent)',
            }}>TH</span>
            <span style={{ padding: '3px 9px', color: 'var(--ink-3)' }}>EN</span>
          </div>
        </div>
      </div>

      {/* ── b) Service Selection ─────────────────────────── */}
      <div style={{ padding: '8px 18px 28px' }}>
        <div style={{ marginBottom: 18 }}>
          <div className="h-display-th" style={{ fontSize: 22 }}>สั่งอาหาร</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>เลือกวิธีรับที่ต้องการ</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          <ServiceBtn
            icon={I.dinein(26)}
            label="ทานที่ร้าน"
            sublabel="Dine-in"
            onClick={() => navigate('/order?method=dine-in')}
          />
          <ServiceBtn
            icon={I.bag(26)}
            label="รับกลับบ้าน"
            sublabel="Takeaway"
            onClick={() => navigate('/order?method=takeaway')}
          />
          <ServiceBtn
            icon={I.car(26)}
            label="เสิร์ฟถึงรถ"
            sublabel="Curbside"
            onClick={() => navigate('/order?method=curbside')}
          />
          {deliveryLinks.length > 0 && (
            <ServiceBtn
              icon={I.scooter(26)}
              label="เดลิเวอรี่"
              sublabel="Delivery"
              onClick={() => setSheet('delivery')}
            />
          )}
        </div>
      </div>

      {/* ── c) Hero banner ───────────────────────────────── */}
      {/* Silent probe — only renders the section when image actually loads */}
      <img
        src="/hero.jpg"
        alt=""
        style={{ display: 'none', position: 'absolute' }}
        onLoad={() => setHeroVisible(true)}
        onError={() => setHeroVisible(false)}
      />
      {heroVisible === true && (
        <div style={{ marginBottom: 28, overflow: 'hidden' }}>
          <img
            src="/hero.jpg"
            alt="Best Part Bowls"
            style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }}
          />
        </div>
      )}

      {/* ── d) Icon row ──────────────────────────────────── */}
      <div style={{
        margin: '0 18px 28px',
        padding: '16px 4px',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
      }}>
        <InfoBtn icon={I.info(20)} label="เกี่ยวกับเรา" onClick={() => setSheet('about')} />
        {LINKS.googleMaps && (
          <InfoBtn icon={I.pin(20)} label="สาขา" onClick={() => window.open(LINKS.googleMaps!, '_blank')} />
        )}
        {socialLinks.length > 0 && (
          <InfoBtn icon={I.share(20)} label="Social" onClick={() => setSheet('social')} />
        )}
        {LINKS.googleReview && (
          <InfoBtn icon={I.star(20)} label="รีวิว" onClick={() => window.open(LINKS.googleReview!, '_blank')} />
        )}
      </div>

      {/* ── e) "กำลังพัฒนา" card ────────────────────────── */}
      <div style={{
        margin: '0 18px 28px',
        padding: '16px 18px',
        borderRadius: 'var(--r-md)',
        border: '1.5px dashed var(--line-2)',
        background: 'var(--bg-2)',
      }}>
        <div className="kicker" style={{ marginBottom: 10 }}>กำลังพัฒนา · COMING SOON</div>
        <ul style={{
          margin: '0 0 10px',
          padding: '0 0 0 16px',
          listStyle: 'disc',
          color: 'var(--ink-2)',
          fontSize: 13,
          lineHeight: 1.8,
          fontFamily: 'var(--serif)',
        }}>
          <li>จำเมนูโปรดและ note ของคุณ</li>
          <li>สั่งซ้ำแตะเดียว</li>
          <li>สิทธิพิเศษลูกค้าประจำ</li>
        </ul>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.65 }}>
          เราเก็บเบอร์โทรและประวัติการสั่งเพื่อพัฒนาบริการนี้
        </div>
      </div>

      {/* ── f) Footer ────────────────────────────────────── */}
      <div style={{ padding: '4px 18px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
          BEST PART BOWLS · สาขาทองหล่อ
        </span>
      </div>

      <TabBar active="home" />

      {/* ══ Bottom sheets ══════════════════════════════════ */}

      {sheet === 'delivery' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <div style={{ padding: '8px 18px 0' }}>
            <div className="kicker" style={{ marginBottom: 4 }}>เดลิเวอรี่ · DELIVERY</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 20 }}>เลือกแพลตฟอร์ม</div>
            {deliveryLinks.map(p => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSheet(null)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', marginBottom: 8,
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  textDecoration: 'none', color: 'var(--ink)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{p.name}</span>
                </div>
                {I.arrow(14)}
              </a>
            ))}
          </div>
        </BottomSheet>
      )}

      {sheet === 'about' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <div style={{ padding: '8px 18px 0' }}>
            <div className="kicker" style={{ marginBottom: 4 }}>เกี่ยวกับเรา · ABOUT</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 14 }}>Best Part Bowls</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              เราคือร้านอาหารไทยสไตล์โบลว์ เสิร์ฟเมนูจานเดี่ยวรสจัดจ้าน
              ที่ปรุงสดทุกออเดอร์ ส่วนผสมคัดเองทุกวัน
              สาขาทองหล่อ ซอย 13 เปิดทุกวัน 11:00–22:00
            </div>
          </div>
        </BottomSheet>
      )}

      {sheet === 'social' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <div style={{ padding: '8px 18px 0' }}>
            <div className="kicker" style={{ marginBottom: 4 }}>ติดตามเรา · FOLLOW US</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 20 }}>Social Media</div>
            {socialLinks.map(s => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSheet(null)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', marginBottom: 8,
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  textDecoration: 'none', color: 'var(--ink)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{s.name}</span>
                </div>
                {I.arrow(14)}
              </a>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
