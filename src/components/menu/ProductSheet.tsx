import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Bowl } from '../Bowl';
import { I } from '../icons';
import { useCart, type CartItem } from '../../store/cart';
import { TEST_MODE } from '../../config/env';

/* ── Types ───────────────────────────────────────────────── */
type MenuItemRow = {
  id: string;
  name_th: string;
  name_en: string;
  base_price: number;
  image_url: string | null;
  is_best_seller: boolean;
  is_active: boolean;
  category_id: string;
  description: string | null;
};

const TEST_ITEM_ROW: MenuItemRow = {
  id: 'test-1baht', name_th: 'ทดสอบ ฿1', name_en: 'Test Item ฿1',
  base_price: 1, image_url: null, is_best_seller: false,
  is_active: true, category_id: '', description: null,
};

/* ── Options (hardcode — TODO: move to DB menu_item_option_groups table) ── */
const SIZES = [
  { label: 'ปกติ',   labelEn: 'Regular', price: 0 },
  { label: 'พิเศษ',  labelEn: 'Large',   price: 20 },
  { label: 'จัมโบ้', labelEn: 'Jumbo',   price: 50 },
];

const SPICE_LEVELS = [
  { label: 'ไม่เผ็ด',  flames: 0 },
  { label: 'เผ็ดน้อย', flames: 1 },
  { label: 'เผ็ดกลาง', flames: 2 },
  { label: 'เผ็ดมาก',  flames: 3 },
  { label: 'เผ็ดสุด',  flames: 4 },
];

const ADDONS = [
  { id: 'egg',   label: 'ไข่ดาวเพิ่ม',  labelEn: 'Extra fried egg',   price: 15 },
  { id: 'pork',  label: 'หมูกรอบเพิ่ม', labelEn: 'Extra crispy pork', price: 30 },
  { id: 'sauce', label: 'พริกน้ำปลา',    labelEn: 'Chili fish sauce',  price: 0 },
];

// TODO: Move option group visibility rules to DB.
// Proposed schema: menu_item_option_groups(item_id, group_type enum('size','spice','addons'), is_visible boolean)
// Detection method used here: category.name_en keyword match (case-insensitive).
// Keywords checked: drink | beverage | tea | coffee | juice
function isDrinkCategory(catNameEn: string): boolean {
  return /drink|beverage|tea|coffee|juice/i.test(catNameEn);
}

/* ── Props ───────────────────────────────────────────────── */
type Props = {
  isShopOpen: boolean;
  categories: { id: string; name_en: string }[];
};

/* ══════════════════════════════════════════════════════════
   PRODUCT SHEET
══════════════════════════════════════════════════════════ */
export function ProductSheet({ isShopOpen, categories }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { add } = useCart();

  const itemId = searchParams.get('item');

  const [item,         setItem]         = useState<MenuItemRow | null>(null);
  const [phase,        setPhase]        = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [sizeIdx,      setSizeIdx]      = useState(1);
  const [spiceIdx,     setSpiceIdx]     = useState(2);
  const [addons,       setAddons]       = useState<Set<string>>(new Set(['sauce']));
  const [qty,          setQty]          = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);

  /* Category context — used to detect drink category */
  const catNameEn = categories.find(c => c.id === item?.category_id)?.name_en ?? '';
  const hideSpice = isDrinkCategory(catNameEn);

  /* Body scroll lock while sheet is open */
  useEffect(() => {
    if (!itemId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [itemId]);

  /* Fetch item whenever itemId changes */
  useEffect(() => {
    if (!itemId) return;
    setPhase('loading');
    setItem(null);
    setQty(1);
    setAddons(new Set(['sauce']));
    setSizeIdx(TEST_MODE && itemId === 'test-1baht' ? 0 : 1);
    setSpiceIdx(2);
    setDescExpanded(false);

    if (TEST_MODE && itemId === 'test-1baht') {
      setItem(TEST_ITEM_ROW);
      setPhase('ready');
      return;
    }

    supabase
      .from('menu_items')
      .select('id, name_th, name_en, base_price, image_url, is_best_seller, is_active, category_id, description')
      .eq('id', itemId)
      .single()
      .then(({ data }) => {
        if (!data) { setPhase('not_found'); return; }
        setItem(data as MenuItemRow);
        setPhase('ready');
      });
  }, [itemId]);

  /* Close: remove ?item= but preserve ?method= */
  const close = useCallback(() => {
    const method = searchParams.get('method');
    setSearchParams(method ? { method } : {});
  }, [searchParams, setSearchParams]);

  function toggleAddon(id: string) {
    setAddons(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const size         = SIZES[sizeIdx];
  const spice        = SPICE_LEVELS[spiceIdx];
  const activeAddons = ADDONS.filter(a => addons.has(a.id));
  const addonsPrice  = activeAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice    = item ? item.base_price + size.price + addonsPrice : 0;
  const total        = unitPrice * qty;

  /* Price breakdown line e.g. "฿109 · พิเศษ +฿20 · ไข่ดาว +฿15" */
  const priceParts: string[] = item ? [`฿${item.base_price}`] : [];
  if (size.price > 0) priceParts.push(`${size.label} +฿${size.price}`);
  activeAddons.filter(a => a.price > 0).forEach(a => priceParts.push(`${a.label} +฿${a.price}`));
  const priceBreakdown = priceParts.join(' · ');

  function buildCartItem(): CartItem {
    return {
      cartId:    `${item!.id}-${Date.now()}`,
      itemId:    item!.id,
      name:      item!.name_th,
      nameEn:    item!.name_en,
      tone:      'clay',
      topping:   'egg',
      basePrice: item!.base_price,
      sizeLabel: size.label,
      sizePrice: size.price,
      spice:     spice.label,
      addons:    activeAddons.map(a => ({ label: a.label, price: a.price })),
      qty,
    };
  }

  const canOrder = item !== null &&
    (item.is_active || (TEST_MODE && item.id === 'test-1baht'));

  function handleAdd() {
    if (!canOrder || !isShopOpen) return;
    add(buildCartItem());
    close();
  }

  function handleOrderNow() {
    if (!canOrder || !isShopOpen) return;
    add(buildCartItem());
    navigate('/cart');
  }

  if (!itemId) return null;

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(43,33,24,0.52)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        height: '92dvh',
        zIndex: 61,
        background: 'var(--bg)',
        borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 -8px 40px -8px rgba(43,33,24,0.22)',
      }}>

        {/* ── Scrollable body ───────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* Hero 4:3 */}
          <div style={{
            position: 'relative', width: '100%',
            paddingTop: '75%', /* 4:3 */
            background: 'var(--bg-3)', overflow: 'hidden', flexShrink: 0,
          }}>
            {phase === 'ready' && item?.image_url ? (
              <img
                src={item.image_url}
                alt={item.name_th}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                background: 'radial-gradient(circle at center, var(--bg-3) 0%, var(--bg) 100%)',
              }}>
                {phase === 'ready' && <Bowl tone="clay" topping="egg" size={160} />}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={close}
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--bg)', border: '1px solid var(--line)',
                display: 'grid', placeItems: 'center', zIndex: 2,
              }}
            >{I.close(18)}</button>
          </div>

          {/* ── Content ─────────────────────────────────── */}
          <div style={{ padding: '20px 20px 8px' }}>

            {/* Loading skeleton */}
            {phase === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ height: 28, borderRadius: 4, background: 'var(--bg-3)', width: '65%' }} />
                <div style={{ height: 16, borderRadius: 4, background: 'var(--bg-3)', width: '45%' }} />
                <div style={{ height: 11, borderRadius: 4, background: 'var(--bg-3)', width: '80%', marginTop: 8 }} />
                <div style={{ height: 11, borderRadius: 4, background: 'var(--bg-3)', width: '70%' }} />
              </div>
            )}

            {/* Not found / inactive */}
            {(phase === 'not_found' ||
              (phase === 'ready' && item && !item.is_active && !(TEST_MODE && item.id === 'test-1baht'))) && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>
                <div style={{ opacity: 0.3, marginBottom: 12 }}>{I.close(40)}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 10 }}>
                  เมนูนี้ไม่มีขายตอนนี้
                </div>
                <button
                  onClick={close}
                  style={{
                    background: 'var(--bg-3)', border: '1px solid var(--line)',
                    padding: '11px 22px', borderRadius: 'var(--r-pill)',
                    fontSize: 13, color: 'var(--ink-2)',
                  }}
                >กลับไปเมนู</button>
              </div>
            )}

            {/* Active item content */}
            {phase === 'ready' && item && canOrder && (
              <>
                {/* Badges */}
                {item.is_best_seller && (
                  <span style={{
                    display: 'inline-block', marginBottom: 8,
                    fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                    padding: '3px 7px', borderRadius: 3,
                    background: 'var(--accent)', color: '#fff',
                  }}>BEST SELLER</span>
                )}

                <div className="h-display-th" style={{ fontSize: 24, lineHeight: 1.2 }}>{item.name_th}</div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 13, marginTop: 3 }}>
                  {item.name_en}
                </div>

                {/* Description */}
                {item.description && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7,
                      ...(descExpanded ? {} : {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }),
                    }}>
                      {item.description}
                    </div>
                    {item.description.length > 70 && (
                      <button
                        onClick={() => setDescExpanded(e => !e)}
                        style={{
                          background: 'none', border: 0,
                          color: 'var(--accent)', fontSize: 12, padding: '2px 0', marginTop: 2,
                        }}
                      >{descExpanded ? 'ย่อ' : 'แสดงเพิ่มเติม'}</button>
                    )}
                  </div>
                )}

                {/* ── Size ──────────────────────────────── */}
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div className="kicker muted">ขนาด · SIZE</div>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>จำเป็น</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                    {SIZES.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setSizeIdx(i)}
                        style={{
                          padding: '12px 10px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                          border: i === sizeIdx ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                          background: i === sizeIdx ? 'var(--bg-2)' : 'var(--bg)',
                          position: 'relative',
                        }}
                      >
                        {/* "แนะนำ" badge on Large (index 1) */}
                        {i === 1 && (
                          <span style={{
                            position: 'absolute', top: 5, left: 5,
                            fontSize: 8, fontWeight: 700, letterSpacing: '.05em',
                            padding: '1px 5px', borderRadius: 2,
                            background: 'var(--accent-2)', color: '#fff',
                          }}>แนะนำ</span>
                        )}
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 13, marginTop: i === 1 ? 10 : 0 }}>{s.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 1 }}>{s.labelEn}</div>
                        <div className="thb" style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>
                          {s.price === 0 ? item.base_price : item.base_price + s.price}
                        </div>
                        {i === sizeIdx && (
                          <span style={{
                            position: 'absolute', top: 6, right: 6,
                            width: 14, height: 14, borderRadius: '50%', background: 'var(--ink)',
                            display: 'grid', placeItems: 'center', color: 'var(--bg)',
                          }}>{I.check(10)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Spice — hidden for drink categories ── */}
                {!hideSpice && (
                  <div style={{ marginTop: 20 }}>
                    <div className="kicker muted">ระดับความเผ็ด · SPICE</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {SPICE_LEVELS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setSpiceIdx(i)}
                          style={{
                            padding: '8px 12px', borderRadius: 'var(--r-pill)',
                            border: i === spiceIdx ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                            background: i === spiceIdx ? 'rgba(181,81,30,0.08)' : 'var(--bg)',
                            color: i === spiceIdx ? 'var(--accent)' : 'var(--ink-2)',
                            fontSize: 12, fontFamily: 'var(--serif)',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {s.label}
                          {Array.from({ length: s.flames }).map((_, j) => (
                            <span key={j} style={{ color: 'var(--accent)' }}>{I.flame(9)}</span>
                          ))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Add-ons ───────────────────────────── */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div className="kicker muted">เพิ่มเติม · ADD-ONS</div>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>เลือกได้</span>
                  </div>
                  {ADDONS.map(a => (
                    <div
                      key={a.id}
                      onClick={() => toggleAddon(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                        borderBottom: '1px solid var(--line)', cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: addons.has(a.id) ? '0' : '1.5px solid var(--line-2)',
                        background: addons.has(a.id) ? 'var(--ink)' : 'transparent',
                        color: 'var(--bg)', display: 'grid', placeItems: 'center',
                      }}>
                        {addons.has(a.id) && I.check(12)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>{a.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{a.labelEn}</div>
                      </div>
                      <span className="thb" style={{ fontSize: 13, color: a.price === 0 ? 'var(--accent-2)' : 'var(--ink)' }}>
                        {a.price === 0 ? 'ฟรี' : `+${a.price}`}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ height: 20 }} />
              </>
            )}
          </div>
        </div>

        {/* ── Sticky bottom bar ────────────────────────── */}
        {phase === 'ready' && canOrder && (
          <div style={{
            flexShrink: 0,
            padding: `14px 18px calc(env(safe-area-inset-bottom, 0px) + 14px)`,
            borderTop: '1px solid var(--line)',
            background: 'var(--bg)',
          }}>
            {/* Price + breakdown */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700 }}>฿{total}</span>
              <span style={{
                fontSize: 11, color: 'var(--ink-3)',
                textAlign: 'right', maxWidth: '58%', lineHeight: 1.5,
              }}>{priceBreakdown}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Qty stepper — min 44px tap targets */}
              <div style={{
                display: 'flex', alignItems: 'center',
                border: '1px solid var(--line)', borderRadius: 'var(--r-pill)',
                background: 'var(--bg-2)', flexShrink: 0,
              }}>
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ width: 44, height: 44, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}
                >{I.minus(16)}</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 16 }}>{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  style={{ width: 44, height: 44, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
                >{I.plus(16)}</button>
              </div>

              {/* Add to cart */}
              <button
                onClick={handleAdd}
                disabled={!isShopOpen}
                style={{
                  flex: 1, height: 44, borderRadius: 'var(--r-pill)',
                  background: isShopOpen ? 'var(--bg-2)' : 'var(--bg-3)',
                  border: '1.5px solid var(--line)',
                  color: isShopOpen ? 'var(--ink)' : 'var(--ink-3)',
                  fontSize: 13, fontWeight: 600,
                  cursor: isShopOpen ? 'pointer' : 'not-allowed',
                }}
              >เพิ่มลงตะกร้า</button>

              {/* Order now */}
              <button
                onClick={handleOrderNow}
                disabled={!isShopOpen}
                style={{
                  flex: 1, height: 44, borderRadius: 'var(--r-pill)',
                  background: isShopOpen ? 'var(--accent)' : 'var(--ink-3)',
                  border: 0, color: '#fff',
                  fontSize: 13, fontWeight: 600,
                  cursor: isShopOpen ? 'pointer' : 'not-allowed',
                }}
              >สั่งเลย</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
