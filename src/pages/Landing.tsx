/* Landing.tsx — Starbucks-structure redesign with Best Part branding
   Sections (top → bottom):
   1. Header: logo + lang toggle + shop-status chip
   2. Greeting + guest banner / returning name
   3. Active Order Banner  [MOCK]
   4. Hero placeholder  [MOCK 1200×500]
   5. Service Selection — 4 floating icon buttons  [REAL routing]
   6. Info row — 4 floating icon buttons  [MOCK links]
   7. Speed Order  [MOCK – Phase D]
   8. Best Sellers  [REAL Supabase]
   9. Bowl Circle  [static]
  10. News & Promo horizontal scroll  [MOCK – promo_banners table ready]
*/

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { supabase } from '../lib/supabase';

/* ── Dev flags — toggle to preview both states ────────────── */
const MOCK_RETURNING        = false;   // true → show returning-user UI
const MOCK_HAS_ACTIVE_ORDER = true;    // only shown when MOCK_RETURNING=true
const MOCK_ORDER_MINUTES    = 6;

/* ── Mock data ────────────────────────────────────────────── */
const FREQUENT_ITEM = {
  name_th: 'ข้าวหมูแดง ไข่ดาว',
  name_en: 'BBQ Pork Rice + Egg',
  price: 85,
  count: 8,
  notes: ['ข้าวน้อย', 'ไข่สุก'],
};
const COMBO_ITEM = {
  items: ['ข้าวหมูแดง ไข่ดาว', 'ไก่ทอดกระเทียม'],
  price: 175,
  count: 5,
};
const MOCK_PROMOS = [
  { id: 1, title: 'ลด 20%', sub: 'เมนูไข่ดาว · ถึง 31 ส.ค.', bg: 'linear-gradient(135deg,#B5511E,#82390f)' },
  { id: 2, title: 'Free Delivery', sub: 'ทุกวันศุกร์ สั่งครบ 150฿', bg: 'linear-gradient(135deg,#4A5D3F,#2e3a27)' },
  { id: 3, title: 'เมนูใหม่', sub: 'กระเพราหมูกรอบทองคำ', bg: 'linear-gradient(135deg,#B8862E,#7a5718)' },
];

/* ── Helpers ──────────────────────────────────────────────── */
function greetingPeriod() {
  const h = new Date().getHours();
  if (h < 12) return 'เช้า';
  if (h < 17) return 'บ่าย';
  return 'เย็น';
}

type MenuItem = {
  id: string; name_th: string; name_en: string;
  base_price: number; image_url: string | null; is_best_seller: boolean;
};

/* ── Hairline ─────────────────────────────────────────────── */
function HR({ mx = 18, my = 20 }: { mx?: number; my?: number }) {
  return <div style={{ height: 1, background: 'var(--line)', margin: `${my}px ${mx}px` }} />;
}

/* ══ SHOP STATUS CHIP (REAL — shop_status table) ════════════ */
function ShopStatusChip() {
  const [s, setS] = useState<{ is_busy: boolean; busy_minutes: number } | null>(null);

  useEffect(() => {
    supabase.from('shop_status').select('is_busy,busy_minutes').single()
      .then(({ data }) => { if (data) setS(data); });
  }, []);

  if (!s) return null;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px 3px 7px', borderRadius: 'var(--r-pill)',
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      fontSize: 11, color: 'var(--ink-2)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: s.is_busy ? '#D4834A' : '#5A9A6F',
      }} />
      {s.is_busy
        ? 'คิวค่อนข้างยาวตอนนี้'
        : `เปิดอยู่ · พร้อมรับใน ~${s.busy_minutes} นาที`}
    </div>
  );
}

/* ══ LANG TOGGLE ════════════════════════════════════════════ */
function LangToggle() {
  const [lang, setLang] = useState<'TH' | 'EN'>('TH');
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--bg-3)', borderRadius: 'var(--r-pill)',
    }}>
      {(['TH', 'EN'] as const).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding: '4px 10px', borderRadius: 'var(--r-pill)', border: 0,
          background: lang === l ? 'var(--ink)' : 'transparent',
          color: lang === l ? 'var(--on-accent)' : 'var(--ink-3)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
          fontFamily: 'inherit', cursor: 'pointer',
        }}>{l}</button>
      ))}
    </div>
  );
}

/* ══ GUEST BANNER (MOCK — Phase D will wire real submit) ════ */
function GuestBanner({ onOpen }: { onOpen: () => void }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '10px 18px 0', padding: '10px 12px',
      borderRadius: 'var(--r-md)', background: 'var(--gold-soft)',
    }}>
      <span style={{ color: 'var(--gold)', flexShrink: 0 }}>{I.phone(15)}</span>
      <div style={{ flex: 1, fontSize: 12.5, fontFamily: 'var(--serif)', lineHeight: 1.35, color: 'var(--ink)' }}>
        กรอกเบอร์เพื่อสั่งซ้ำได้เร็วขึ้น
      </div>
      <button onClick={onOpen} style={{
        background: 'var(--gold)', color: '#fff', border: 0,
        padding: '6px 12px', borderRadius: 'var(--r-pill)',
        fontSize: 11, fontWeight: 700, flexShrink: 0, cursor: 'pointer',
      }}>กรอกเบอร์</button>
      <button onClick={() => setGone(true)} style={{
        background: 'none', border: 0, color: 'var(--ink-3)', flexShrink: 0, cursor: 'pointer', padding: 2,
      }}>{I.close(13)}</button>
    </div>
  );
}

/* ══ PHONE MODAL (MOCK — no real submit yet) ════════════════ */
function PhoneModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(43,33,24,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: 'var(--bg)', borderRadius: '22px 22px 0 0',
          padding: '28px 22px 40px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginBottom: 6 }}>
          กรอกเบอร์มือถือ
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 22 }}>
          ระบบจะจำเมนูโปรดและประวัติการสั่งซื้อของคุณ
        </div>
        <input
          type="tel" placeholder="08X-XXX-XXXX" autoFocus
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 'var(--r-pill)',
            border: '1.5px solid var(--line-2)', background: 'var(--bg-2)',
            fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none',
          }}
        />
        <button style={{
          width: '100%', marginTop: 12,
          background: 'var(--ink)', color: 'var(--on-accent)', border: 0,
          padding: '15px 18px', borderRadius: 'var(--r-pill)',
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>ยืนยัน</button>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
          Phase D — will wire OTP submit
        </div>
      </div>
    </div>
  );
}

/* ══ ACTIVE ORDER BANNER (MOCK — Phase C session) ═══════════ */
function ActiveOrderBanner({ minutes }: { minutes: number }) {
  const navigate = useNavigate();
  return (
    <div style={{ margin: '10px 18px 0' }}>
      <button
        onClick={() => navigate('/track')}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--ink)', color: 'var(--on-accent)', border: 0,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--gold)', flexShrink: 0 }}>{I.clock(16)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>คุณมีออเดอร์กำลังทำอยู่</div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 2 }}>เหลือประมาณ {minutes} นาที</div>
        </div>
        <span style={{ opacity: 0.45, flexShrink: 0 }}>{I.arrow(16)}</span>
      </button>
    </div>
  );
}

/* ══ HERO BANNER PLACEHOLDER ════════════════════════════════ */
function HeroBanner() {
  return (
    <div style={{ padding: '18px 18px 0' }}>
      <div
        className="ph"
        data-label="แบนเนอร์หลัก 1200×500 · เนื้อหาโปรโมชั่นจะมาเร็วๆ นี้"
        style={{
          width: '100%', aspectRatio: '1200/500',
          borderRadius: 'var(--r-lg)', overflow: 'hidden', minHeight: 130,
        }}
      />
    </div>
  );
}

/* ══ FLOATING ICON BUTTON (Starbucks transparent style) ═════ */
function FloatBtn({
  icon, label, badge, onClick,
}: {
  icon: React.ReactNode; label: string; badge?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: 'none', border: 0,
      padding: '8px 2px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      cursor: 'pointer', position: 'relative',
    }}>
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        background: 'var(--gold-soft)',
        display: 'grid', placeItems: 'center',
        color: 'var(--gold)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      {badge && (
        <span style={{
          position: 'absolute', top: 4, right: 'calc(50% - 36px)',
          background: 'var(--accent)', color: '#fff',
          fontSize: 9, fontWeight: 700, padding: '2px 5px',
          borderRadius: 'var(--r-pill)', letterSpacing: '.04em',
        }}>{badge}</span>
      )}
      <span style={{
        fontSize: 11.5, fontFamily: 'var(--serif)', color: 'var(--ink)',
        lineHeight: 1.25, textAlign: 'center', whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
}

/* ══ SERVICE SELECTION (REAL — routes to /order?method=…) ══ */
function ServiceGrid() {
  const navigate = useNavigate();
  const methods = [
    { icon: I.dinein(24),  label: 'ทานที่ร้าน',   method: 'dinein',   badge: 'QR' },
    { icon: I.bag(24),     label: 'รับกลับบ้าน',  method: 'takeaway'  },
    { icon: I.car(24),     label: 'เสิร์ฟถึงรถ',  method: 'curbside'  },
    { icon: I.scooter(24), label: 'เดลิเวอรี่',   method: 'delivery'  },
  ];
  return (
    <div style={{ padding: '20px 14px 8px' }}>
      <div className="kicker muted" style={{ marginBottom: 16, paddingLeft: 4 }}>สั่งอาหาร · ORDER</div>
      <div style={{ display: 'flex' }}>
        {methods.map(m => (
          <FloatBtn
            key={m.method}
            icon={m.icon}
            label={m.label}
            badge={m.badge}
            onClick={() => navigate(`/order?method=${m.method}`)}
          />
        ))}
      </div>
    </div>
  );
}

/* ══ INFO ROW (MOCK — placeholder links) ════════════════════ */
function InfoRow() {
  const navigate = useNavigate();
  const items = [
    { icon: I.info(22),  label: 'เกี่ยวกับเรา', to: '/about'  },
    { icon: I.pin(22),   label: 'สาขา',         to: '/branch' },
    { icon: I.share(22), label: 'Social',        to: '/social' },
    { icon: I.star(22),  label: 'รีวิว',        to: '/review' },
  ];
  return (
    <div style={{ padding: '4px 14px 8px' }}>
      <div style={{ display: 'flex' }}>
        {items.map(it => (
          <FloatBtn
            key={it.to}
            icon={it.icon}
            label={it.label}
            onClick={() => navigate(it.to)}
          />
        ))}
      </div>
    </div>
  );
}

/* ══ SPEED ORDER (MOCK — Phase D) ═══════════════════════════ */
function SpeedOrder() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{ marginBottom: 14 }}>
        <div className="kicker muted" style={{ marginBottom: 2 }}>สั่งได้เลย</div>
        <div className="h-display-th" style={{ fontSize: 20 }}>มื้อประจำของคุณ</div>
      </div>

      {/* Frequent item */}
      <div style={{
        padding: 16, borderRadius: 'var(--r-md)',
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Bowl tone="clay" topping="egg" size={66} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.2 }}>
              {FREQUENT_ITEM.name_th}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {FREQUENT_ITEM.name_en}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
              {FREQUENT_ITEM.notes.map(n => (
                <span key={n} style={{
                  padding: '3px 8px', borderRadius: 'var(--r-pill)',
                  background: 'var(--gold-soft)', color: 'var(--gold)',
                  fontSize: 10.5, fontWeight: 600,
                }}>{n}</span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4,
            }}>สั่ง {FREQUENT_ITEM.count} ครั้ง</div>
            <span className="price thb" style={{ fontSize: 16 }}>{FREQUENT_ITEM.price}</span>
          </div>
        </div>
        <button
          onClick={() => navigate('/order')}
          style={{
            width: '100%', marginTop: 12,
            background: 'var(--ink)', color: 'var(--on-accent)', border: 0,
            padding: '11px', borderRadius: 'var(--r-pill)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          {I.repeat(15)} สั่งซ้ำทันที
        </button>
      </div>

      {/* Combo card */}
      <div style={{
        padding: '14px 16px', borderRadius: 'var(--r-md)',
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'var(--gold-soft)', display: 'grid', placeItems: 'center',
          color: 'var(--gold)', flexShrink: 0,
        }}>{I.users(18)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>
            สั่งคู่กันบ่อย · {COMBO_ITEM.count} ครั้ง
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.3 }}>
            {COMBO_ITEM.items.join(' + ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span className="price thb" style={{ fontSize: 15 }}>{COMBO_ITEM.price}</span>
          <button
            onClick={() => navigate('/order')}
            style={{
              display: 'block', marginTop: 5,
              background: 'var(--bg-3)', color: 'var(--ink)', border: 0,
              padding: '5px 10px', borderRadius: 'var(--r-pill)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >สั่งเลย</button>
        </div>
      </div>
    </div>
  );
}

/* ══ BEST SELLERS STRIP (REAL — Supabase query) ═════════════ */
function BestSellersStrip() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    supabase
      .from('menu_items')
      .select('id,name_th,name_en,base_price,image_url,is_best_seller')
      .eq('is_active', true)
      .eq('is_best_seller', true)
      .order('display_order', { ascending: true })
      .limit(4)
      .then(({ data }) => { if (data) setItems(data as MenuItem[]); });
  }, []);

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '0 18px', marginBottom: 12,
      }}>
        <div>
          <div className="kicker muted" style={{ marginBottom: 2 }}>ขายดีสัปดาห์นี้</div>
          <div className="h-display-th" style={{ fontSize: 20 }}>เมนูขายดี</div>
        </div>
        <button
          onClick={() => navigate('/order')}
          style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer' }}
        >ดูทั้งหมด →</button>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 18px 6px', scrollbarWidth: 'none' }}>
        {/* Skeletons */}
        {items.length === 0 && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            minWidth: 142, padding: 12, borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0,
          }}>
            <div style={{ width: 86, height: 86, borderRadius: 'var(--r-md)', background: 'var(--bg-3)', margin: '6px auto 8px' }} />
            <div style={{ height: 10, borderRadius: 4, background: 'var(--bg-3)', marginBottom: 6 }} />
            <div style={{ height: 14, borderRadius: 4, background: 'var(--bg-3)', marginBottom: 4 }} />
            <div style={{ height: 10, width: '60%', borderRadius: 4, background: 'var(--bg-3)' }} />
          </div>
        ))}

        {items.map((it, i) => (
          <div key={it.id} style={{
            minWidth: 142, padding: 12, borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 8px' }}>
              {it.image_url
                ? <img src={it.image_url} alt={it.name_th} style={{ width: 86, height: 86, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
                : <Bowl tone="clay" topping="egg" size={86} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)' }}>
              {(i === 0 || i === 2) && I.flame(11)}
              <span style={{ fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                #{i + 1} · {(i === 0 || i === 2) ? 'hot' : 'top'}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, marginTop: 4, lineHeight: 1.2 }}>{it.name_th}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{it.name_en}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span className="price thb" style={{ fontSize: 16 }}>{it.base_price}</span>
              <button
                onClick={() => navigate('/order')}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--ink)', color: 'var(--on-accent)', border: 0,
                  display: 'grid', placeItems: 'center', cursor: 'pointer',
                }}
              >{I.plus(14)}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ BOWL CIRCLE — static "coming soon" ════════════════════ */
function BowlCircleCard() {
  return (
    <div style={{ margin: '0 18px' }}>
      <div style={{
        padding: '20px 20px 22px', borderRadius: 'var(--r-lg)',
        background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))',
        border: '1px solid var(--line)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -24, top: -24, opacity: 0.09 }}>
          <Bowl tone="gold" topping="" size={130} />
        </div>
        <div className="kicker" style={{ marginBottom: 6 }}>BOWL CIRCLE</div>
        <div className="h-display-th" style={{ fontSize: 19, marginBottom: 6 }}>
          กำลังเตรียมพร้อม
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          สะสมคะแนนและรับสิทธิพิเศษ<br />สำหรับสมาชิก · Coming soon
        </div>
      </div>
    </div>
  );
}

/* ══ NEWS & PROMO — horizontal scroll ══════════════════════
   Table: promo_banners (id, image_url, link_url, display_order, is_active)
   MOCK for now — replace setPromos with real Supabase query when ready    */
function NewsPromo() {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '0 18px', marginBottom: 12,
      }}>
        <div>
          <div className="kicker muted" style={{ marginBottom: 2 }}>อัปเดตล่าสุด</div>
          <div className="h-display-th" style={{ fontSize: 20 }}>ข่าวสาร & โปรโมชั่น</div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>ดูทั้งหมด →</span>
      </div>
      <div style={{
        display: 'flex', gap: 10,
        overflowX: 'auto', padding: '4px 18px 8px',
        scrollbarWidth: 'none',
      }}>
        {MOCK_PROMOS.map(p => (
          <div key={p.id} style={{
            minWidth: 210, height: 116, borderRadius: 'var(--r-md)',
            background: p.bg, flexShrink: 0,
            padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: '#fff', lineHeight: 1.15 }}>
              {p.title}
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
              {p.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ LANDING PAGE ═══════════════════════════════════════════ */
export default function Landing() {
  const [showPhone, setShowPhone] = useState(false);

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* ─── 1. Header ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 8px',
      }}>
        <Brand />
        <LangToggle />
      </div>
      <div style={{ padding: '0 18px 12px' }}>
        <ShopStatusChip />
      </div>

      {/* ─── 2. Greeting ────────────────────────────────── */}
      <div style={{ padding: '0 18px' }}>
        <div className="h-display-th" style={{ fontSize: 27, lineHeight: 1.1 }}>
          {MOCK_RETURNING
            ? `สวัสดีตอน${greetingPeriod()}, ภพ`
            : `สวัสดีตอน${greetingPeriod()}`}
        </div>
      </div>

      {/* Guest banner */}
      {!MOCK_RETURNING && <GuestBanner onOpen={() => setShowPhone(true)} />}

      {/* ─── 3. Active Order Banner ─────────────────────── */}
      {MOCK_RETURNING && MOCK_HAS_ACTIVE_ORDER && (
        <ActiveOrderBanner minutes={MOCK_ORDER_MINUTES} />
      )}

      {/* ─── 4. Hero banner ─────────────────────────────── */}
      <HeroBanner />

      <HR />

      {/* ─── 5. Service Selection ───────────────────────── */}
      <ServiceGrid />

      <HR mx={36} my={4} />

      {/* ─── 6. Info row ────────────────────────────────── */}
      <InfoRow />

      <HR />

      {/* ─── 7. Speed Order (returning only) ────────────── */}
      {MOCK_RETURNING && (
        <>
          <SpeedOrder />
          <HR />
        </>
      )}

      {/* ─── 8. Best sellers ────────────────────────────── */}
      <BestSellersStrip />

      <HR />

      {/* ─── 9. Bowl Circle ─────────────────────────────── */}
      <BowlCircleCard />

      <HR />

      {/* ─── 10. News & Promo ───────────────────────────── */}
      <NewsPromo />

      <div style={{ height: 16 }} />

      <TabBar active="home" />

      {showPhone && <PhoneModal onClose={() => setShowPhone(false)} />}
    </div>
  );
}
