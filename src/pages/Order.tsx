import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Bowl } from '../components/Bowl';
import { CartBar } from '../components/CartBar';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { SHOP, computeSlots, shopCloseLabel } from '../config/shop';
import { TEST_MODE } from '../config/env';
import { ProductSheet } from '../components/menu/ProductSheet';

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
  { id: 'dine-in',  label: 'ทานที่ร้าน' },
  { id: 'takeaway', label: 'รับกลับบ้าน' },
  { id: 'curbside', label: 'เสิร์ฟถึงรถ' },
];

const BEST_CAT_ID = '__best__';

/* ══════════════════════════════════════════════════════════
   ORDER PAGE — Chagee-style layout
══════════════════════════════════════════════════════════ */
export default function Order() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReduced = useReducedMotion();

  const method = searchParams.get('method') ?? 'dine-in';
  const itemId = searchParams.get('item');

  const [shopInfo] = useState(() => computeSlots());

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

  /* ── Fetch all categories + all items ─────────────────── */
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
          setFetchError('โหลดเมนูไม่สำเร็จ');
          setLoadingCats(false);
          return;
        }
        const fetchedCats = catData as Category[];
        setCats(fetchedCats);
        setActiveCat(fetchedCats[0].id);
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
              setFetchError('โหลดเมนูไม่สำเร็จ');
              setLoadingItems(false);
              return;
            }
            const map = new Map<string, MenuItem[]>();
            fetchedCats.forEach(c => map.set(c.id, []));
            (itemData as MenuItem[]).forEach(it => {
              map.get(it.category_id)?.push(it);
            });

            /* Synthetic "best seller" category */
            const bestItems = (itemData as MenuItem[]).filter(it => it.is_best_seller);
            if (bestItems.length > 0) map.set(BEST_CAT_ID, bestItems);

            if (TEST_MODE) {
              const firstCat = fetchedCats[0].id;
              map.get(firstCat)?.push({ ...TEST_ITEM, category_id: firstCat });
            }
            setItemsByCat(map);
            setLoadingItems(false);
          });
      });
  }, [retryKey]);

  /* ── Display categories (best first) ─────────────────── */
  const displayCats = useMemo<Category[]>(() => [
    ...(itemsByCat.has(BEST_CAT_ID)
      ? [{ id: BEST_CAT_ID, name_th: 'สินค้าขายดี', name_en: 'Best Sellers', display_order: -1 }]
      : []),
    ...cats,
  ], [cats, itemsByCat]);

  /* ── Scroll-spy: IntersectionObserver on right container ─ */
  useEffect(() => {
    if (displayCats.length === 0 || loadingItems || !rightScrollRef.current) return;
    const container = rightScrollRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLocked.current) return;
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        const containerTop = container.getBoundingClientRect().top;
        const top = visible.reduce((best, e) =>
          Math.abs(e.boundingClientRect.top - containerTop) <
          Math.abs(best.boundingClientRect.top - containerTop) ? e : best
        );
        const catId = (top.target as HTMLElement).dataset.catId;
        if (catId) setActiveCat(catId);
      },
      { root: container, rootMargin: '-36px 0px -55% 0px', threshold: 0 },
    );
    sectionRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [displayCats, loadingItems]);

  /* Auto-scroll rail to active category */
  useEffect(() => {
    railBtnRefs.current.get(activeCat)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeCat]);

  /* ── Handlers ────────────────────────────────────────── */
  function handleCatClick(catId: string) {
    setActiveCat(catId);
    scrollLocked.current = true;
    const el = sectionRefs.current.get(catId);
    const container = rightScrollRef.current;
    if (el && container) {
      const elTop    = el.getBoundingClientRect().top;
      const cTop     = container.getBoundingClientRect().top;
      const offset   = container.scrollTop + elTop - cTop;
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
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>

      {/* ── Header (flex-shrink:0, never scrolls) ───────── */}
      <div style={{
        flexShrink: 0,
        zIndex: 20,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
      }}>
        {/* Closed banner */}
        {!shopInfo.isOpen && (
          <div style={{
            padding: '7px 18px',
            background: 'rgba(43,33,24,0.07)',
            fontSize: 12, color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>ร้านปิดอยู่</span>
            <span>· เปิด {shopInfo.nextOpenMsg} · ดูเมนูได้</span>
          </div>
        )}

        <div style={{
          padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)', flexShrink: 0 }}
          >{I.back(22)}</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>
              {SHOP.branchName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {/* Open/close status chip */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                padding: '2px 8px', borderRadius: 'var(--r-pill)',
                background: shopInfo.isOpen ? 'rgba(74,93,63,0.12)' : 'rgba(43,33,24,0.08)',
                color: shopInfo.isOpen ? 'var(--accent-2)' : 'var(--ink-3)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: shopInfo.isOpen ? 'var(--accent-2)' : 'var(--ink-3)',
                }} />
                {shopInfo.isOpen
                  ? `เปิด · ถึง ${shopCloseLabel()}`
                  : `ปิด · เปิด ${shopInfo.nextOpenMsg}`}
              </span>

              {/* Method chip */}
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
                {METHODS.find(m => m.id === method)?.label ?? 'ทานที่ร้าน'}
                {I.arrow(9)}
              </button>
            </div>
          </div>
          {/* search icon removed */}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────── */}
      {fetchError && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ marginBottom: 14, fontSize: 14 }}>{fetchError}</div>
            <button
              onClick={() => setRetryKey(k => k + 1)}
              style={{
                background: 'var(--ink)', color: 'var(--on-accent)',
                border: 0, padding: '13px 28px', borderRadius: 'var(--r-pill)',
                fontSize: 13, fontWeight: 600,
              }}
            >ลองใหม่</button>
          </div>
        </div>
      )}

      {/* ── Rail + Right scroll (the only scroll container) ─ */}
      {!fetchError && (
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          background: `linear-gradient(to right, var(--bg-3) 80px, transparent 80px)`,
        }}>

          {/* Left category rail */}
          <div
            ref={railRef}
            style={{
              width: 80, flexShrink: 0,
              background: 'var(--bg-3)',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingTop: 8,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Skeleton */}
            {loadingCats && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '14px 12px' }}>
                <div style={{ height: 12, borderRadius: 3, background: 'var(--bg)', width: '72%', marginBottom: 4 }} />
                <div style={{ height: 9,  borderRadius: 3, background: 'var(--bg)', width: '55%' }} />
              </div>
            ))}

            {/* Category buttons */}
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
                {/* Active indicator — animated height for slide feel */}
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
                }}>{c.name_th}</div>
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
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Loading skeleton */}
            {loadingItems && (
              <div style={{ padding: '10px 10px 0' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: 10,
                    marginBottom: 8, borderRadius: 12,
                    background: 'var(--bg-2)',
                  }}>
                    <div style={{ width: 88, height: 88, borderRadius: 10, background: 'var(--bg-3)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 13, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 7, width: '60%' }} />
                      <div style={{ height: 9,  background: 'var(--bg-3)', borderRadius: 4, marginBottom: 7, width: '38%' }} />
                      <div style={{ height: 15, background: 'var(--bg-3)', borderRadius: 4, width: '30%', marginTop: 18 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category sections */}
            {!loadingItems && displayCats.map((cat, catIdx) => {
              const catItems = itemsByCat.get(cat.id) ?? [];
              if (catItems.length === 0) return null;

              return (
                <div key={cat.id}>
                  {/* Section sentinel + minimal sticky header */}
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
                      fontSize: 12,
                      fontFamily: 'var(--sans)',
                      fontWeight: 400,
                      color: 'var(--ink-3)',
                      lineHeight: 1.4,
                    }}>{cat.name_th}</span>
                  </div>

                  {/* Cards — content-visibility for off-screen perf */}
                  <div style={{
                    padding: '2px 10px 6px',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    contentVisibility: 'auto' as any,
                    containIntrinsicSize: 'auto 400px',
                  }}>
                    {catItems.map((it, itemIdx) => (
                      <motion.div
                        key={it.id}
                        initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: Math.min((catIdx * 8 + itemIdx) * 0.035, 0.35),
                          duration: 0.22, ease: 'easeOut',
                        }}
                        whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                        onClick={() => openItem(it.id)}
                        style={{
                          display: 'flex', gap: 10, padding: 10,
                          marginBottom: 8, borderRadius: 12,
                          background: 'var(--bg-2)',
                          cursor: 'pointer',
                          alignItems: 'flex-start',
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          data-item-img={it.id}
                          style={{
                            width: 88, height: 88,
                            borderRadius: 10,
                            background: 'var(--bg-3)',
                            flexShrink: 0,
                            overflow: 'hidden',
                            display: 'grid', placeItems: 'center',
                          }}
                        >
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt={it.name_th}
                              width={88}
                              height={88}
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                opacity: 0,
                                transition: prefersReduced ? 'none' : 'opacity 0.3s ease',
                              }}
                              onLoad={e => {
                                (e.currentTarget as HTMLImageElement).style.opacity = '1';
                              }}
                            />
                          ) : (
                            <Bowl tone="clay" topping="egg" size={76} />
                          )}
                        </div>

                        {/* Text */}
                        <div style={{
                          flex: 1, minWidth: 0,
                          display: 'flex', flexDirection: 'column',
                          height: 88,
                        }}>
                          {it.is_best_seller && (
                            <span style={{
                              display: 'inline-block', marginBottom: 3, alignSelf: 'flex-start',
                              fontSize: 8, fontWeight: 700, letterSpacing: '.06em',
                              padding: '1px 5px', borderRadius: 3,
                              background: 'var(--accent)', color: '#fff',
                            }}>BEST</span>
                          )}
                          <div style={{
                            fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.25,
                            color: 'var(--ink)',
                          }}>{it.name_th}</div>
                          <div style={{
                            fontSize: 10, color: 'var(--ink-3)', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{it.name_en}</div>

                          {/* Price + add button — pushed to bottom */}
                          <div style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 'auto',
                          }}>
                            <span className="price thb" style={{ fontSize: 15, fontFamily: 'var(--mono)' }}>
                              {it.base_price}
                            </span>
                            <motion.button
                              whileTap={prefersReduced ? undefined : { scale: 0.90 }}
                              onClick={e => { e.stopPropagation(); openItem(it.id); }}
                              style={{
                                width: 30, height: 30, borderRadius: '50%',
                                background: shopInfo.isOpen ? 'var(--ink)' : 'var(--bg-3)',
                                color: shopInfo.isOpen ? 'var(--on-accent)' : 'var(--ink-3)',
                                border: 0, display: 'grid', placeItems: 'center',
                                cursor: 'pointer', flexShrink: 0,
                              }}
                            >{I.plus(14)}</motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cart bar + tab bar */}
      <CartBar />
      <TabBar active="menu" />

      {/* Product sheet — URL-driven */}
      {itemId && (
        <ProductSheet
          isShopOpen={shopInfo.isOpen}
          shopNextOpen={shopInfo.nextOpenMsg}
          categories={catForSheet}
        />
      )}
    </div>
  );
}
