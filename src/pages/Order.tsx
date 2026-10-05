import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Bowl } from '../components/Bowl';
import { CartBar } from '../components/CartBar';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { SHOP, shopCloseLabel } from '../config/shop';
import { TEST_MODE } from '../config/env';
import { ProductSheet } from '../components/menu/ProductSheet';
import { FEATURED_KEYWORD } from '../config/featured';
import { useT } from '../i18n';
import { useMenuState, useShopStatusServer } from '../lib/menuState';

/* ── Types ───────────────────────────────────────────────── */
type Category = {
  id: string; name_th: string; name_en: string; display_order: number;
};
type MenuItem = {
  id: string; name_th: string; name_en: string;
  base_price: number; image_url: string | null;
  is_best_seller: boolean; category_id: string;
  description_th: string | null;
};

const TEST_ITEM: MenuItem = {
  id: 'test-1baht', name_th: 'ทดสอบ ฿1', name_en: 'Test Item ฿1',
  base_price: 1, image_url: null, is_best_seller: false,
  category_id: '', description_th: null,
};

const METHODS = [
  { id: 'dine-in',  labelKey: 'menu.method.dine' as const },
  { id: 'takeaway', labelKey: 'menu.method.takeaway' as const },
  { id: 'curbside', labelKey: 'menu.method.curbside' as const },
];

const BEST_CAT_ID = '__best__';

/* ── Helpers ─────────────────────────────────────────────── */

/** Remove emoji/symbols, keep Thai + ASCII printable */
function stripEmoji(s: string): string {
  return s.replace(/[^\u0020-\u007E\u0E00-\u0E7F\s]+/g, '').trim();
}

/** Split trailing parenthetical: "ชื่อ (หมายเหตุ)" → { main, note } */
function splitParens(name: string): { main: string; note: string | null } {
  const m = name.match(/^(.*?)\s*(\([^)]+\))\s*$/);
  return m ? { main: m[1].trim(), note: m[2] } : { main: name, note: null };
}

/**
 * If restore_at is the same calendar day as serverTime (Asia/Bangkok, UTC+7),
 * returns "HH:MM" in BKK time; otherwise returns null.
 */
function backAtTime(restoreAt: string | null, serverTime: string | null): string | null {
  if (!restoreAt || !serverTime) return null;
  const BKK = 7 * 3_600_000;
  const rMs = new Date(restoreAt).getTime();
  const sMs = new Date(serverTime).getTime();
  if (new Date(rMs + BKK).toISOString().slice(0, 10) !== new Date(sMs + BKK).toISOString().slice(0, 10)) return null;
  const r = new Date(rMs + BKK);
  return `${String(r.getUTCHours()).padStart(2, '0')}:${String(r.getUTCMinutes()).padStart(2, '0')}`;
}

/** Pick hero item for a category — keyword match → best_seller → first */
function pickHero(catNameTh: string, items: MenuItem[]): MenuItem {
  const keyword = FEATURED_KEYWORD[catNameTh];
  if (keyword) {
    const found = items.find(it => it.name_th.includes(keyword));
    if (found) return found;
  }
  return items.find(it => it.is_best_seller) ?? items[0];
}

/* ── Card style tokens (no backdrop-filter anywhere) ─────── */
const CARD_BG     = 'linear-gradient(155deg, rgba(255,255,255,0.26) 0%, rgba(255,253,248,0.68) 60%)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.56)';
const CARD_SHADOW = '0 2px 12px -4px rgba(120,86,32,0.14), 0 8px 28px -10px rgba(120,86,32,0.10), inset 0 1px 0 rgba(255,255,255,0.60)';
const GLOW_BG     = 'radial-gradient(circle at 50% 46%, rgba(255,215,120,0.36) 0%, rgba(251,243,227,0) 66%)';

/* ══════════════════════════════════════════════════════════
   ORDER PAGE — Chagee layout · hero+grid cards
══════════════════════════════════════════════════════════ */
export default function Order() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReduced = useReducedMotion();
  const { t, lang } = useT();

  const menuSt = useMenuState();

  const method = searchParams.get('method') ?? 'dine-in';
  const itemId = searchParams.get('item');
  const shopInfo = useShopStatusServer();

  function shopClosedMsg(): string {
    if (shopInfo.forcedClosed && shopInfo.reopenAt) {
      const bkk  = new Date(shopInfo.reopenAt.getTime() + 7 * 3_600_000);
      const date = bkk.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });
      const time = `${String(bkk.getUTCHours()).padStart(2,'0')}:${String(bkk.getUTCMinutes()).padStart(2,'0')}`;
      return t('shop.forcedClosed', date, time);
    }
    return t('menu.status.closed', shopInfo.nextOpenMsg);
  }

  /* ── Data ───────────────────────────────────────────── */
  const [cats,         setCats]         = useState<Category[]>([]);
  const [itemsByCat,   setItemsByCat]   = useState<Map<string, MenuItem[]>>(new Map());
  const [activeCat,    setActiveCat]    = useState('');
  const [loadingCats,  setLoadingCats]  = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [retryKey,     setRetryKey]     = useState(0);

  /* ── Refs ────────────────────────────────────────────── */
  const railRef        = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs    = useRef<Map<string, HTMLDivElement>>(new Map());
  const railBtnRefs    = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollLocked   = useRef(false);

  /* ── Fetch ───────────────────────────────────────────── */
  useEffect(() => {
    setLoadingCats(true);
    setFetchError(null);
    setCats([]);
    setItemsByCat(new Map());

    supabase
      .from('categories')
      .select('id, name_th, name_en, display_order')
      .order('display_order', { ascending: true })
      .then(({ data: catData, error: catErr }) => {
        if (catErr || !catData || catData.length === 0) {
          console.error('categories query failed', {
            message: catErr?.message, code: catErr?.code,
            details: catErr?.details, hint: catErr?.hint,
          });
          setFetchError(t('menu.error.load'));
          setLoadingCats(false);
          return;
        }
        const fetchedCats = catData as Category[];
        setCats(fetchedCats);
        setActiveCat(fetchedCats[0].id); // preliminary — may update after items load
        setLoadingCats(false);
        setLoadingItems(true);

        supabase
          .from('menu_items')
          .select('id, name_th, name_en, base_price, image_url, is_best_seller, category_id, description_th')
          .in('category_id', fetchedCats.map(c => c.id))
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .then(({ data: itemData, error: itemErr }) => {
            if (itemErr || !itemData) {
              console.error('menu_items query failed', {
                message: itemErr?.message, code: itemErr?.code,
                details: itemErr?.details, hint: itemErr?.hint,
              });
              setFetchError(t('menu.error.load'));
              setLoadingItems(false);
              return;
            }
            const map = new Map<string, MenuItem[]>();
            fetchedCats.forEach(c => map.set(c.id, []));
            (itemData as MenuItem[]).forEach(it => {
              map.get(it.category_id)?.push(it);
            });

            /* Synthetic best-seller category */
            const bestItems = (itemData as MenuItem[]).filter(it => it.is_best_seller);
            if (bestItems.length > 0) {
              map.set(BEST_CAT_ID, bestItems);
              setActiveCat(BEST_CAT_ID); // best is now first
            }

            if (TEST_MODE) {
              const firstCat = fetchedCats[0].id;
              map.get(firstCat)?.push({ ...TEST_ITEM, category_id: firstCat });
            }
            setItemsByCat(map);
            setLoadingItems(false);
          });
      });
  }, [retryKey]);

  /* Log which DB categories are hidden as duplicates */
  useEffect(() => {
    if (cats.length === 0) return;
    const hidden = cats.filter(c => {
      const clean = stripEmoji(c.name_th);
      return clean === 'สินค้าขายดี' || c.name_en.toLowerCase().includes('best');
    });
    if (hidden.length > 0) {
      console.log(
        '[Order] ซ่อนหมวดซ้ำจาก DB:',
        hidden.map(c => `"${c.name_th}" (${c.name_en})`).join(', '),
      );
    }
  }, [cats]);

  /* ── Display categories: dedup DB best, prepend synthetic ─ */
  const displayCats = useMemo<Category[]>(() => {
    const filtered = cats.filter(c => {
      const clean = stripEmoji(c.name_th);
      return !(clean === 'สินค้าขายดี' || c.name_en.toLowerCase().includes('best'));
    });
    return [
      ...(itemsByCat.has(BEST_CAT_ID)
        ? [{ id: BEST_CAT_ID, name_th: 'สินค้าขายดี', name_en: 'Best Sellers', display_order: -1 }]
        : []),
      ...filtered,
    ];
  }, [cats, itemsByCat]);

  /* ── Scroll-spy (root = right scroll container) ──────── */
  useEffect(() => {
    if (displayCats.length === 0 || loadingItems || !rightScrollRef.current) return;
    const container = rightScrollRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLocked.current) return;
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const cTop = container.getBoundingClientRect().top;
        const top = visible.reduce((best, e) =>
          Math.abs(e.boundingClientRect.top - cTop) <
          Math.abs(best.boundingClientRect.top - cTop) ? e : best
        );
        const catId = (top.target as HTMLElement).dataset.catId;
        if (catId) setActiveCat(catId);
      },
      { root: container, rootMargin: '-36px 0px -55% 0px', threshold: 0 },
    );
    sectionRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [displayCats, loadingItems]);

  /* Auto-scroll rail to active button */
  useEffect(() => {
    railBtnRefs.current.get(activeCat)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeCat]);

  /* ── Handlers ────────────────────────────────────────── */
  function handleCatClick(catId: string) {
    setActiveCat(catId);
    scrollLocked.current = true;
    const el        = sectionRefs.current.get(catId);
    const container = rightScrollRef.current;
    if (el && container) {
      const offset = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
    setTimeout(() => { scrollLocked.current = false; }, 900);
  }

  function openItem(id: string) {
    const params: Record<string, string> = { item: id };
    if (method !== 'dine-in') params.method = method;
    setSearchParams(params);
  }

  function cycleMethod() {
    const idx = METHODS.findIndex(m => m.id === method);
    const next = METHODS[(idx + 1) % METHODS.length].id;
    const params: Record<string, string> = { method: next };
    if (itemId) params.item = itemId;
    setSearchParams(params);
  }

  const catForSheet = cats.map(c => ({ id: c.id, name_en: c.name_en }));

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div style={{
      height: '100dvh',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, zIndex: 20,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
      }}>
        {shopInfo.serverShopStatus === 'closed' && (
          <div style={{
            padding: '7px 18px',
            background: 'rgba(43,33,24,0.07)',
            fontSize: 12, color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{shopClosedMsg()}</span>
            <span>{t('menu.header.closed.browse')}</span>
          </div>
        )}
        {shopInfo.serverShopStatus === 'preorder' && shopInfo.preorderOpensAtHHMM != null && (
          <div style={{
            padding: '7px 18px',
            background: 'rgba(43,33,24,0.07)',
            fontSize: 12, color: 'var(--ink-2)',
          }}>
            {t('menu.preorderBanner', shopInfo.preorderOpensAtHHMM)}
          </div>
        )}
        <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)', flexShrink: 0 }}
          >{I.back(22)}</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>
              {lang === 'en' ? SHOP.branchNameEn : SHOP.branchName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                padding: '2px 8px', borderRadius: 'var(--r-pill)',
                background: shopInfo.isOpen ? 'rgba(74,93,63,0.12)' : 'rgba(43,33,24,0.08)',
                color: shopInfo.isOpen ? 'var(--accent-2)' : 'var(--ink-3)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: shopInfo.isOpen ? 'var(--accent-2)' : 'var(--ink-3)' }} />
                {shopInfo.isOpen ? t('menu.status.open', shopCloseLabel()) : shopClosedMsg()}
              </span>
              <button
                onClick={cycleMethod}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                  padding: '2px 8px', borderRadius: 'var(--r-pill)',
                  background: 'rgba(181,81,30,0.10)',
                  border: '1px solid rgba(181,81,30,0.25)',
                  color: 'var(--accent)',
                }}
              >
                {t(METHODS.find(m => m.id === method)?.labelKey ?? 'menu.method.dine')}
                {I.arrow(9)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────── */}
      {fetchError && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ marginBottom: 14, fontSize: 14 }}>{fetchError}</div>
            <button
              onClick={() => setRetryKey(k => k + 1)}
              style={{
                background: 'var(--ink)', color: 'var(--on-accent)',
                border: 0, padding: '13px 28px', borderRadius: 'var(--r-pill)',
                fontSize: 13, fontWeight: 600,
              }}
            >{t('menu.error.retry')}</button>
          </div>
        </div>
      )}

      {/* ── Rail + Right scroll ──────────────────────────── */}
      {!fetchError && (
        <div style={{
          flex: 1, display: 'flex', overflow: 'hidden',
          background: `linear-gradient(to right, var(--bg-3) 80px, transparent 80px)`,
        }}>

          {/* Left rail */}
          <div
            ref={railRef}
            style={{
              width: 80, flexShrink: 0,
              background: 'var(--bg-3)',
              overflowY: 'auto', overflowX: 'hidden',
              paddingTop: 8,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {loadingCats && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '14px 12px' }}>
                <div style={{ height: 12, borderRadius: 3, background: 'var(--bg)', width: '72%', marginBottom: 4 }} />
                <div style={{ height: 9,  borderRadius: 3, background: 'var(--bg)', width: '55%' }} />
              </div>
            ))}

            {displayCats.map(c => (
              <button
                key={c.id}
                ref={el => { el ? railBtnRefs.current.set(c.id, el) : railBtnRefs.current.delete(c.id); }}
                onClick={() => handleCatClick(c.id)}
                style={{
                  width: '100%', padding: '13px 0 13px 12px',
                  position: 'relative', textAlign: 'left',
                  background: c.id === activeCat ? 'var(--bg)' : 'transparent',
                  border: 0, display: 'block',
                }}
              >
                {/* Animated indicator bar */}
                <motion.span
                  animate={prefersReduced
                    ? {}
                    : { height: c.id === activeCat ? 20 : 0, opacity: c.id === activeCat ? 1 : 0 }}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  style={{
                    position: 'absolute', left: 0, top: '50%', translateY: '-50%',
                    width: 3, background: 'var(--accent)',
                    borderRadius: '0 2px 2px 0',
                    height: c.id === activeCat ? 20 : 0,
                    opacity: c.id === activeCat ? 1 : 0,
                  }}
                />
                <div style={{
                  fontSize: c.id === activeCat ? 13 : 12,
                  fontFamily: c.id === activeCat ? 'var(--serif)' : 'var(--sans)',
                  fontWeight: c.id === activeCat ? 500 : 600,
                  color: c.id === activeCat ? 'var(--ink)' : 'var(--ink-2)',
                  lineHeight: 1.2,
                }}>{stripEmoji(c.name_th)}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.03em' }}>
                  {c.name_en}
                </div>
              </button>
            ))}
          </div>

          {/* ── Right scroll container — ONLY scrollable area ── */}
          <div
            ref={rightScrollRef}
            style={{
              flex: 1, minWidth: 0,
              overflowY: 'auto', overflowX: 'hidden',
              paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Loading skeleton */}
            {loadingItems && (
              <div style={{ padding: '10px 10px 0' }}>
                {/* Hero skeleton */}
                <div style={{
                  display: 'flex', gap: 0, marginBottom: 8,
                  borderRadius: 18, background: 'rgba(241,227,196,0.55)',
                  border: CARD_BORDER, height: 140, overflow: 'hidden',
                }}>
                  <div style={{ width: 136, background: 'var(--bg-3)' }} />
                  <div style={{ flex: 1, padding: 14 }}>
                    <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, width: '40%', marginBottom: 10 }} />
                    <div style={{ height: 16, background: 'var(--bg-3)', borderRadius: 4, width: '70%', marginBottom: 6 }} />
                    <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, width: '55%' }} />
                  </div>
                </div>
                {/* Grid skeleton */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{
                      borderRadius: 16, background: 'rgba(241,227,196,0.55)',
                      border: CARD_BORDER, overflow: 'hidden',
                    }}>
                      <div style={{ aspectRatio: '1', background: 'var(--bg-3)' }} />
                      <div style={{ padding: '8px 10px 10px' }}>
                        <div style={{ height: 12, background: 'var(--bg-3)', borderRadius: 4, width: '80%', marginBottom: 6 }} />
                        <div style={{ height: 12, background: 'var(--bg-3)', borderRadius: 4, width: '55%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category sections */}
            {!loadingItems && displayCats.map((cat, catIdx) => {
              const catItems = itemsByCat.get(cat.id) ?? [];
              if (catItems.length === 0) return null;

              const catDelay  = Math.min(catIdx * 0.06, 0.20);
              const hasHero   = catItems.length >= 3;
              const heroItem  = hasHero ? pickHero(cat.name_th, catItems) : null;
              const gridItems = hasHero ? catItems.filter(it => it.id !== heroItem!.id) : catItems;
              const heroMain    = heroItem ? splitParens(heroItem.name_th).main : '';
              const heroNote   = heroItem ? splitParens(heroItem.name_th).note : null;
              const heroUnavail  = heroItem ? menuSt.isItemUnavailable(heroItem.id) : false;
              const heroBackTime = heroItem ? backAtTime(menuSt.itemRestoreAt(heroItem.id), menuSt.getServerTime()) : null;

              return (
                <div key={cat.id}>
                  {/* ── Sentinel + sticky section label ─────── */}
                  <div
                    ref={el => { el ? sectionRefs.current.set(cat.id, el) : sectionRefs.current.delete(cat.id); }}
                    data-cat-id={cat.id}
                    style={{
                      position: 'sticky', top: 0, zIndex: 5,
                      background: 'var(--bg)',
                      padding: '10px 14px 6px',
                    }}
                  >
                    <span style={{
                      fontSize: 12, fontFamily: 'var(--sans)',
                      fontWeight: 400, color: 'var(--ink-3)', lineHeight: 1.4,
                    }}>{stripEmoji(cat.name_th)}</span>
                  </div>

                  {/* ── Cards (content-visibility for off-screen perf) ── */}
                  <div style={{
                    padding: '4px 10px 10px',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    contentVisibility: 'auto' as any,
                    containIntrinsicSize: 'auto 500px',
                  }}>

                    {/* ── Hero card ───────────────────────── */}
                    {heroItem && (
                      <motion.div
                        initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: heroUnavail ? 0.45 : 1, y: 0 }}
                        transition={{ delay: catDelay, duration: 0.24, ease: 'easeOut' }}
                        whileTap={prefersReduced || heroUnavail ? undefined : { scale: 0.98 }}
                        onClick={heroUnavail ? undefined : () => openItem(heroItem.id)}
                        style={{
                          marginBottom: 8,
                          borderRadius: 18,
                          background: CARD_BG,
                          border: CARD_BORDER,
                          boxShadow: CARD_SHADOW,
                          display: 'flex', alignItems: 'stretch',
                          minHeight: 210,
                          overflow: 'hidden',
                          cursor: heroUnavail ? 'default' : 'pointer',
                        }}
                      >
                        {/* Left: image on warm glow — ~57% of card width */}
                        <div style={{
                          width: '58%', flexShrink: 0,
                          position: 'relative',
                          background: GLOW_BG,
                        }}>
                          {heroItem.image_url ? (
                            <img
                              src={heroItem.image_url}
                              alt={heroItem.name_th}
                              width={200}
                              height={230}
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              {...{ fetchPriority: 'high' } as any}
                              loading="eager"
                              decoding="async"
                              style={{
                                width: '100%', height: '118%',
                                objectFit: 'contain',
                                marginTop: '-9%',
                                opacity: 0,
                                transition: prefersReduced ? 'none' : 'opacity 0.28s ease',
                              }}
                              onLoad={e => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
                            />
                          ) : (
                            <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                              <Bowl tone="clay" topping="egg" size={150} />
                            </div>
                          )}
                        </div>

                        {/* Right: text content */}
                        <div style={{
                          flex: 1, minWidth: 0,
                          padding: '16px 14px 14px 12px',
                          display: 'flex', flexDirection: 'column',
                        }}>
                          {/* Badge: unavailable or แนะนำ */}
                          <span style={{
                            alignSelf: 'flex-start', marginBottom: 4,
                            fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
                            padding: '2px 8px', borderRadius: 'var(--r-pill)',
                            background: heroUnavail ? 'rgba(43,33,24,0.10)' : 'rgba(184,134,46,0.14)',
                            color: heroUnavail ? 'var(--ink-3)' : 'var(--gold)',
                          }}>{heroUnavail ? t('menu.unavailable') : t('menu.badge.best')}</span>
                          {heroUnavail && heroBackTime && (
                            <div style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>
                              {t('menu.backAt', heroBackTime)}
                            </div>
                          )}

                          <div style={{
                            fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500,
                            lineHeight: 1.2, color: 'var(--ink)',
                          }}>{heroMain}</div>
                          {heroNote && (
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{heroNote}</div>
                          )}
                          <div style={{
                            fontSize: 10, color: 'var(--ink-3)', marginTop: 4,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{heroItem.name_en}</div>

                          {/* Price + add button */}
                          <div style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', marginTop: 'auto',
                          }}>
                            <span className="price thb" style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)' }}>
                              {heroItem.base_price}
                            </span>
                            <motion.button
                              whileTap={prefersReduced || heroUnavail ? undefined : { scale: 0.88 }}
                              onClick={e => { e.stopPropagation(); if (!heroUnavail) openItem(heroItem.id); }}
                              disabled={heroUnavail}
                              aria-disabled={heroUnavail}
                              style={{
                                width: 38, height: 38, borderRadius: '50%',
                                background: heroUnavail ? 'var(--bg-3)' : 'var(--ink)',
                                color: heroUnavail ? 'var(--ink-3)' : 'var(--on-accent)',
                                border: 0, display: 'grid', placeItems: 'center',
                                cursor: heroUnavail ? 'default' : 'pointer', flexShrink: 0,
                              }}
                            >{I.plus(17)}</motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ── Grid 2-column ───────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {gridItems.map((it, gridIdx) => {
                        const { main, note } = splitParens(it.name_th);
                        const delay    = Math.min(catDelay + (hasHero ? 0.08 : 0) + Math.floor(gridIdx / 2) * 0.06, 0.42);
                        const itUnavail  = menuSt.isItemUnavailable(it.id);
                        const itBackTime = backAtTime(menuSt.itemRestoreAt(it.id), menuSt.getServerTime());

                        return (
                          <motion.div
                            key={it.id}
                            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: itUnavail ? 0.45 : 1, y: 0 }}
                            transition={{ delay, duration: 0.22, ease: 'easeOut' }}
                            whileTap={prefersReduced || itUnavail ? undefined : { scale: 0.96 }}
                            onClick={itUnavail ? undefined : () => openItem(it.id)}
                            style={{
                              borderRadius: 14,
                              background: CARD_BG,
                              border: CARD_BORDER,
                              boxShadow: CARD_SHADOW,
                              display: 'flex', flexDirection: 'column',
                              overflow: 'hidden',
                              cursor: itUnavail ? 'default' : 'pointer',
                            }}
                          >
                            {/* Image on glow — 25% smaller area */}
                            <div style={{
                              position: 'relative',
                              width: '100%', aspectRatio: '1',
                              background: GLOW_BG,
                            }}>
                              {it.is_best_seller && !itUnavail && (
                                <span style={{
                                  position: 'absolute', top: 5, left: 5, zIndex: 2,
                                  fontSize: 7, fontWeight: 700, letterSpacing: '.05em',
                                  padding: '1px 4px', borderRadius: 3,
                                  background: 'var(--accent)', color: '#fff',
                                }}>BEST</span>
                              )}
                              {itUnavail && (
                                <div style={{
                                  position: 'absolute', top: 5, left: 5, zIndex: 2,
                                  display: 'flex', flexDirection: 'column', gap: 2,
                                }}>
                                  <span style={{
                                    fontSize: 7, fontWeight: 700, letterSpacing: '.03em',
                                    padding: '2px 5px', borderRadius: 3,
                                    background: 'rgba(43,33,24,0.62)', color: 'rgba(255,255,255,0.88)',
                                  }}>{t('menu.unavailable')}</span>
                                  {itBackTime && (
                                    <span style={{
                                      fontSize: 7, fontWeight: 600,
                                      padding: '2px 5px', borderRadius: 3,
                                      background: 'rgba(43,33,24,0.45)', color: 'rgba(255,255,255,0.80)',
                                    }}>{t('menu.backAt', itBackTime)}</span>
                                  )}
                                </div>
                              )}
                              {it.image_url ? (
                                <img
                                  src={it.image_url}
                                  alt={it.name_th}
                                  width={120}
                                  height={120}
                                  loading="lazy"
                                  decoding="async"
                                  style={{
                                    width: '64%', height: '64%',
                                    objectFit: 'contain',
                                    margin: '18%',
                                    display: 'block',
                                    opacity: 0,
                                    transition: prefersReduced ? 'none' : 'opacity 0.3s ease',
                                  }}
                                  onLoad={e => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
                                />
                              ) : (
                                <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                                  <Bowl tone="clay" topping="egg" size={64} />
                                </div>
                              )}
                            </div>

                            {/* Text content */}
                            <div style={{
                              padding: '6px 7px 8px',
                              flex: 1, display: 'flex', flexDirection: 'column',
                            }}>
                              <div style={{
                                fontFamily: 'var(--serif)', fontSize: 11.5, lineHeight: 1.3,
                                color: 'var(--ink)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden',
                              }}>{main}</div>
                              {note && (
                                <div style={{
                                  fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{note}</div>
                              )}

                              <div style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6,
                              }}>
                                <span className="price thb" style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>
                                  {it.base_price}
                                </span>
                                <motion.button
                                  whileTap={prefersReduced || itUnavail ? undefined : { scale: 0.88 }}
                                  onClick={e => { e.stopPropagation(); if (!itUnavail) openItem(it.id); }}
                                  disabled={itUnavail}
                                  aria-disabled={itUnavail}
                                  style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: itUnavail ? 'var(--bg-3)' : 'var(--ink)',
                                    color: itUnavail ? 'var(--ink-3)' : 'var(--on-accent)',
                                    border: 0, display: 'grid', placeItems: 'center',
                                    cursor: itUnavail ? 'default' : 'pointer', flexShrink: 0,
                                  }}
                                >{I.plus(11)}</motion.button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CartBar />
      <TabBar active="menu" />

      {itemId && (
        <ProductSheet
          isShopOpen={true}
          shopClosedMsg={shopClosedMsg()}
          categories={catForSheet}
        />
      )}
    </div>
  );
}
