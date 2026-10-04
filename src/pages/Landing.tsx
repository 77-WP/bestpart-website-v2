import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { Brand } from '../components/Brand';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { LINKS } from '../config/links';
import { SHOP } from '../config/shop';

/* ── Greeting by time-of-day ────────────────────────────── */
function getGreetingKey(): 'home.greeting.morning' | 'home.greeting.afternoon' | 'home.greeting.evening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greeting.morning';
  if (h < 17) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

type Sheet = 'delivery' | 'about' | 'social' | null;

function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(43,33,24,0.52)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: 'var(--bg-2)',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
        zIndex: 51, boxShadow: '0 -8px 40px -8px rgba(43,33,24,0.22)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-2)' }} />
        </div>
        {children}
      </div>
    </>
  );
}

function ServiceBtn({ icon, label, sublabel, onClick }: {
  icon: React.ReactNode; label: string; sublabel?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'none', border: 0, cursor: 'pointer', padding: '4px 0',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        display: 'grid', placeItems: 'center', color: 'var(--accent)',
        boxShadow: '0 2px 12px -4px rgba(43,33,24,0.14)',
      }}>{icon}</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.2 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{sublabel}</div>}
      </div>
    </button>
  );
}

function InfoBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'none', border: 0, cursor: 'pointer', padding: '4px 0',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: 'var(--bg-3)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
      }}>{icon}</div>
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();

  const [sheet, setSheet] = useState<Sheet>(null);
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
      { name: 'TikTok',        href: LINKS.tiktok,   dot: '#010101' },
    ] as { name: string; href: string | null; dot: string }[]
  ).filter((s): s is { name: string; href: string; dot: string } => s.href !== null);

  return (
    <div className="page" style={{ paddingBottom: 100 }}>

      {/* ── a) Header ────────────────────────────────────── */}
      <div style={{
        padding: '16px 18px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
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
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--serif)', display: 'block' }}>
              {t(getGreetingKey())}
            </span>
            <span style={{ fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'block', marginTop: 1 }}>
              MADE FOR THE WAY YOU EAT.
            </span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', padding: 3,
            background: 'var(--bg-3)', borderRadius: 'var(--r-pill)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          }}>
            <button
              onClick={() => setLang('th')}
              style={{
                padding: '3px 9px', borderRadius: 'var(--r-pill)',
                background: lang === 'th' ? 'var(--ink)' : 'transparent',
                color: lang === 'th' ? 'var(--on-accent)' : 'var(--ink-3)',
                border: 0, fontWeight: 700, fontSize: 11, letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >TH</button>
            <button
              onClick={() => setLang('en')}
              style={{
                padding: '3px 9px', borderRadius: 'var(--r-pill)',
                background: lang === 'en' ? 'var(--ink)' : 'transparent',
                color: lang === 'en' ? 'var(--on-accent)' : 'var(--ink-3)',
                border: 0, fontWeight: 700, fontSize: 11, letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >EN</button>
          </div>
        </div>
      </div>

      {/* ── b) Service Selection ─────────────────────────── */}
      <div style={{ padding: '8px 18px 28px' }}>
        <div style={{ marginBottom: 18 }}>
          <div className="h-display-th" style={{ fontSize: 22 }}>{t('home.order.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{t('home.order.subtitle')}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          <ServiceBtn
            icon={I.dinein(26)}
            label={t('home.method.dine')}
            onClick={() => {
              sessionStorage.setItem('bp_method', 'dine');
              sessionStorage.setItem('bp_method_chosen', 'true');
              navigate('/order?method=dine-in');
            }}
          />
          <ServiceBtn
            icon={I.bag(26)}
            label={t('home.method.takeaway')}
            onClick={() => {
              sessionStorage.setItem('bp_method', 'takeaway');
              sessionStorage.setItem('bp_method_chosen', 'true');
              navigate('/order?method=takeaway');
            }}
          />
          <ServiceBtn
            icon={I.car(26)}
            label={t('home.method.curbside')}
            onClick={() => {
              sessionStorage.setItem('bp_method', 'curbside');
              sessionStorage.setItem('bp_method_chosen', 'true');
              navigate('/order?method=curbside');
            }}
          />
          {deliveryLinks.length > 0 && (
            <ServiceBtn
              icon={I.scooter(26)}
              label={t('home.method.delivery')}
              onClick={() => setSheet('delivery')}
            />
          )}
        </div>
      </div>

      {/* ── c) Hero banner ───────────────────────────────── */}
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
        <InfoBtn icon={I.info(20)} label={t('home.info.about')} onClick={() => setSheet('about')} />
        {LINKS.googleMaps && (
          <InfoBtn icon={I.pin(20)} label={t('home.info.branch')} onClick={() => window.open(LINKS.googleMaps!, '_blank')} />
        )}
        {socialLinks.length > 0 && (
          <InfoBtn icon={I.share(20)} label={t('home.info.social')} onClick={() => setSheet('social')} />
        )}
        {LINKS.googleReview && (
          <InfoBtn icon={I.star(20)} label={t('home.info.reviews')} onClick={() => window.open(LINKS.googleReview!, '_blank')} />
        )}
      </div>

      {/* ── e) Footer ────────────────────────────────────── */}
      <div style={{ padding: '4px 18px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
          BEST PART BOWLS · {SHOP.branchName}
        </span>
      </div>

      <TabBar active="home" />

      {/* ══ Bottom sheets ══════════════════════════════════ */}

      {sheet === 'delivery' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <div style={{ padding: '8px 18px 0' }}>
            <div className="kicker" style={{ marginBottom: 4 }}>{t('home.sheet.delivery.kicker')}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 20 }}>{t('home.sheet.delivery.title')}</div>
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
                  borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                  background: 'var(--bg)', textDecoration: 'none', color: 'var(--ink)',
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
            <div className="kicker" style={{ marginBottom: 4 }}>{t('home.sheet.about.kicker')}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 14 }}>{t('home.sheet.about.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              {t('home.sheet.about.body', SHOP.branchName)}
            </div>
          </div>
        </BottomSheet>
      )}

      {sheet === 'social' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <div style={{ padding: '8px 18px 0' }}>
            <div className="kicker" style={{ marginBottom: 4 }}>{t('home.sheet.social.kicker')}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 20 }}>{t('home.sheet.social.title')}</div>
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
                  borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                  background: 'var(--bg)', textDecoration: 'none', color: 'var(--ink)',
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
