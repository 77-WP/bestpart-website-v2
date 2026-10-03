import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  description: string | null;
};

const TEST_ITEM: MenuItem = {
  id: 'test-1baht', name_th: 'ทดสอบ ฿1', name_en: 'Test Item ฿1',
  base_price: 1, image_url: null, is_best_seller: false,
  category_id: '', description: null,
};

const METHODS = [
  { id: 'dine-in',  label: 'ทานที่ร้าน' },
  { id: 'takeaway', label: 'รับกลับบ้าน' },
  { id: 'curbside', label: 'เสิร์ฟถึงรถ' },
];

/* ══════════════════════════════════════════════════════════
   ORDER PAGE
══════════════════════════════════════════════════════════ */
export default function Order() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const method = searchParams.get('method') ?? 'dine-in';
  const itemId = searchParams.get('item');

  /* Shop status — computed once per mount */
  const [shopInfo] = useState(() => computeSlots());

  /* ── Data ───────────────────────────────────────────── */
  const [cats,        setCats]        = useState<Category[]>([]);
  const [itemsByCat,  setItemsByCat]  = useState<Map<string, MenuItem[]>>(new Map());
  const [activeCat,   setActiveCat]   = useState('');
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingItems,setLoadingItems]= useState(false);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [retryKey,    setRetryKey]    = useState(0);

  /* ── Scroll-spy refs ─────────────────────────────────── */
  const headerRef    = useRef<HTMLDivElement>(null);
  const railRef      = useRef<HTMLDivElement>(null);
  const sectionRefs  = useRef<Map<string, HTMLDivElement>>(new Map());
  const railBtnRefs  = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollLocked = useRef(false);
  const [headerH, setHeaderH] = useState(62);

  /* Measure header height reactively */
  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setHeaderH(entries[0].contentRect.height);
    });
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

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
          setFetchError('โหลดเมนูไม่สำเร็จ');
          setLoadingCats(false);
          return;
        }
        const cats = catData as Category[];
        setCats(cats);
        setActiveCat(cats[0].id);
        setLoadingCats(false);
        setLoadingItems(true);

        supabase
          .from('menu_items')
          .select('id, name_th, name_en, base_price, image_url, is_best_seller, category_id, description')
          .in('category_id', cats.map(c => c.id))
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .then(({ data: itemData, error: itemErr }) => {
            if (itemErr || !itemData) {
              setFetchError('โหลดเมนูไม่สำเร็จ');
              setLoadingItems(false);
              return;
            }
            const map = new Map<string, MenuItem[]>();
            cats.forEach(c => map.set(c.id, []));
            (itemData as MenuItem[]).forEach(it => {
              map.get(it.category_id)?.push(it);
            });
            if (TEST_MODE) {
              // Append TEST_ITEM to first category
              const firstCat = cats[0].id;
              map.get(firstCat)?.push({ ...TEST_ITEM, category_id: firstCat });
            }
            setItemsByCat(map);
            setLoadingItems(false);
          });
      });
  }, [retryKey]);

  /* ── Scroll-spy with IntersectionObserver ─────────────── */
  useEffect(() => {
    if (cats.length === 0 || loadingItems) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLocked.current) return;
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length === 0) return;
        // Pick entry whose top is closest to the header bottom
        const top = visible.reduce((best, e) =>
          Math.abs(e.boundingClientRect.top - headerH) < Math.abs(best.boundingClientRect.top - headerH)
            ? e : best
        );
        const catId = (top.target as HTMLElement).dataset.catId;
        if (catId) setActiveCat(catId);
      },
      { rootMargin: `-${headerH + 4}px 0px -62% 0px`, threshold: 0 },
    );
    sectionRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [cats, loadingItems, headerH]);

  /* Auto-scroll rail when activeCat changes */
  useEffect(() => {
    railBtnRefs.current.get(activeCat)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeCat]);

  /* ── Handlers ────────────────────────────────────────── */
  function handleCatClick(catId: string) {
    setActiveCat(catId);
    scrollLocked.current = true;
    const el = sectionRefs.current.get(catId);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({ top, behavior: 'smooth' });
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
    <div className="page" style={{ minHeight: '100dvh' }}>

      {/* ── Sticky header ───────────────────────────────── */}
      <div
        ref={headerRef}
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--line)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
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
          padding: '10px 18px 10px',
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
                background: shopInfo.isOpen
                  ? 'rgba(74,93,63,0.12)' : 'rgba(43,33,24,0.08)',
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

              {/* Method chip — tap to cycle */}
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

          {/* Search button (placeholder) */}
          <button style={{
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            width: 36, height: 36, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            color: 'var(--ink-2)', flexShrink: 0,
          }}>{I.search(16)}</button>
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────── */}
      {fetchError && (
        <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
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
      )}

      {/* ── Rail + Content ──────────────────────────────── */}
      {!fetchError && (
        <div style={{ display: 'flex' }}>

          {/* Left category rail — sticky */}
          <div
            ref={railRef}
            style={{
              width: 84, flexShrink: 0,
              background: 'var(--bg-3)',
              position: 'sticky',
              top: headerH,
              height: `calc(100dvh - ${headerH}px)`,
              overflowY: 'auto',
              paddingTop: 8,
              alignSelf: 'flex-start',
            }}
          >
            {/* Rail skeleton */}
            {loadingCats && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '14px 12px' }}>
                <div style={{ height: 12, borderRadius: 3, background: 'var(--bg)', width: '72%', marginBottom: 4 }} />
                <div style={{ height: 9, borderRadius: 3, background: 'var(--bg)', width: '55%' }} />
              </div>
            ))}

            {/* Category buttons */}
            {cats.map(c => (
              <button
                key={c.id}
                ref={el => { el ? railBtnRefs.current.set(c.id, el) : railBtnRefs.current.delete(c.id); }}
                onClick={() => handleCatClick(c.id)}
                data-item-id={c.id}
                style={{
                  width: '100%', padding: '13px 0 13px 14px',
                  position: 'relative', textAlign: 'left',
                  background: c.id === activeCat ? 'var(--bg)' : 'transparent',
                  border: 0, display: 'block',
                }}
              >
                {/* Active indicator — separate element for round B */}
                {c.id === activeCat && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 20, background: 'var(--accent)',
                    borderRadius: '0 2px 2px 0',
                  }} />
                )}
                <div style={{
                  fontSize: c.id === activeCat ? 13 : 12,
                  fontFamily: c.id === activeCat ? 'var(--serif)' : 'var(--sans)',
                  fontWeight: c.id === activeCat ? 500 : 600,
                  color: c.id === activeCat ? 'var(--ink)' : 'var(--ink-2)',
                  lineHeight: 1.2,
                }}>{c.name_th}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.03em' }}>{c.name_en}</div>
              </button>
            ))}
          </div>

          {/* Right content — continuous scroll */}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 170 }}>

            {/* Items loading skeleton */}
            {loadingItems && (
              <div style={{ padding: '14px 14px 0' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, padding: '14px 0',
                    borderBottom: '1px solid var(--line)',
                  }}>
                    <div style={{ width: 92, height: 92, borderRadius: 'var(--r-sm)', background: 'var(--bg-3)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 14, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 7, width: '62%' }} />
                      <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 7, width: '38%' }} />
                      <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, width: '78%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Category sections */}
            {!loadingItems && cats.map(cat => {
              const catItems = itemsByCat.get(cat.id) ?? [];
              return (
                <div key={cat.id}>
                  {/* Section header — sentinel for IntersectionObserver + sticky */}
                  <div
                    ref={el => { el ? sectionRefs.current.set(cat.id, el) : sectionRefs.current.delete(cat.id); }}
                    data-cat-id={cat.id}
                    style={{
                      position: 'sticky', top: headerH, zIndex: 5,
                      background: 'var(--bg-2)',
                      padding: '8px 14px 7px',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span className="h-display-th" style={{ fontSize: 17 }}>{cat.name_th}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.05em' }}>
                        {cat.name_en.toUpperCase()} · {catItems.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>
                      เสิร์ฟภายใน {SHOP.prepMinutes} นาที
                    </div>
                  </div>

                  {/* Empty category */}
                  {catItems.length === 0 && (
                    <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                      ยังไม่มีเมนูในหมวดนี้
                    </div>
                  )}

                  {/* Menu rows */}
                  {catItems.map(it => (
                    <div
                      key={it.id}
                      data-item-id={it.id}
                      onClick={() => openItem(it.id)}
                      style={{
                        display: 'flex', gap: 12, padding: '14px 14px',
                        borderBottom: '1px solid var(--line)',
                        cursor: 'pointer', alignItems: 'flex-start',
                      }}
                    >
                      {/* Thumbnail — separate element tagged for round B transition */}
                      <div
                        data-item-img={it.id}
                        style={{
                          width: 92, height: 92, borderRadius: 'var(--r-sm)',
                          background: 'var(--bg-3)', flexShrink: 0,
                          overflow: 'hidden', display: 'grid', placeItems: 'center',
                        }}
                      >
                        {it.image_url ? (
                          <img
                            src={it.image_url} alt={it.name_th}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Bowl tone="clay" topping="egg" size={80} />
                        )}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {it.is_best_seller && (
                          <span style={{
                            display: 'inline-block', marginBottom: 4,
                            fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                            padding: '2px 6px', borderRadius: 3,
                            background: 'var(--accent)', color: '#fff',
                          }}>BEST</span>
                        )}
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.25 }}>{it.name_th}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{it.name_en}</div>
                        {it.description && (
                          <div style={{
                            fontSize: 11, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.55,
                            display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden',
                          }}>{it.description}</div>
                        )}
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', marginTop: 8,
                        }}>
                          <span className="price thb" style={{ fontSize: 16, fontFamily: 'var(--mono)' }}>
                            {it.base_price}
                          </span>
                          {/* "+" button — min 36px circle, greyed when closed */}
                          <button
                            onClick={e => { e.stopPropagation(); openItem(it.id); }}
                            style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: shopInfo.isOpen ? 'var(--ink)' : 'var(--bg-3)',
                              color: shopInfo.isOpen ? 'var(--on-accent)' : 'var(--ink-3)',
                              border: 0, display: 'grid', placeItems: 'center',
                              cursor: 'pointer',
                            }}
                          >{I.plus(16)}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cart bar + tab bar */}
      <CartBar />
      <TabBar active="menu" />

      {/* Product sheet — URL-driven: /order?item=<id> */}
      {itemId && (
        <ProductSheet isShopOpen={shopInfo.isOpen} categories={catForSheet} />
      )}
    </div>
  );
}
