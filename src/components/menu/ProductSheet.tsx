import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Bowl } from '../Bowl';
import { I } from '../icons';
import { useCart, type CartItem } from '../../store/cart';
import { TEST_MODE } from '../../config/env';

/* ── DB types ─────────────────────────────────────────────── */
type MenuItemRow = {
  id: string; name_th: string; name_en: string;
  base_price: number; image_url: string | null;
  is_best_seller: boolean; is_active: boolean;
  category_id: string; description_th: string | null;
};

type DbOption = {
  id: string; option_name_th: string; option_name_en: string;
  price_adjustment: number; display_order: number;
};

type OptionGroup = {
  id: string; group_name_th: string; group_name_en: string;
  selection_type: 'SINGLE_SELECT' | 'MULTI_SELECT';
  is_upsell_item: boolean;
  sort_order: number;
  options: DbOption[];
};

const TEST_ITEM_ROW: MenuItemRow = {
  id: 'test-1baht', name_th: 'ทดสอบ ฿1', name_en: 'Test Item ฿1',
  base_price: 1, image_url: null, is_best_seller: false,
  is_active: true, category_id: '', description_th: null,
};

/* ── Props ───────────────────────────────────────────────── */
type Props = {
  isShopOpen: boolean;
  shopNextOpen: string;
  categories?: { id: string; name_en: string }[]; // kept for compat, unused
};

/* ══════════════════════════════════════════════════════════
   PRODUCT SHEET
══════════════════════════════════════════════════════════ */
export function ProductSheet({ isShopOpen, shopNextOpen }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { add } = useCart();

  const itemId = searchParams.get('item');

  const [item,       setItem]       = useState<MenuItemRow | null>(null);
  const [phase,      setPhase]      = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [groups,     setGroups]     = useState<OptionGroup[]>([]);
  // selections: groupId → [optionId, ...]
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [qty,        setQty]        = useState(1);

  /* Close: remove ?item= but preserve ?method= */
  const close = useCallback(() => {
    const method = searchParams.get('method');
    setSearchParams(method ? { method } : {});
  }, [searchParams, setSearchParams]);

  /* Body scroll lock + back button support */
  useEffect(() => {
    if (!itemId) return;
    document.body.style.overflow = 'hidden';
    const handler = () => close();
    window.addEventListener('popstate', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handler);
    };
  }, [itemId, close]);

  /* Fetch item + option groups when itemId changes */
  useEffect(() => {
    if (!itemId) return;
    setPhase('loading');
    setItem(null);
    setGroups([]);
    setSelections({});
    setQty(1);

    if (TEST_MODE && itemId === 'test-1baht') {
      setItem(TEST_ITEM_ROW);
      setGroups([]);
      setSelections({});
      setPhase('ready');
      return;
    }

    supabase
      .from('menu_items')
      .select('id, name_th, name_en, base_price, image_url, is_best_seller, is_active, category_id, description_th')
      .eq('id', itemId)
      .single()
      .then(({ data, error }) => {
        if (!data || error) {
          console.error('menu_items single query failed', error);
          setPhase('not_found');
          return;
        }
        setItem(data as MenuItemRow);

        supabase
          .from('menu_item_option_groups')
          .select(`
            sort_order,
            option_group_id,
            option_groups (
              id, group_name_th, group_name_en, selection_type, is_upsell_item,
              options (
                id, option_name_th, option_name_en, price_adjustment, display_order
              )
            )
          `)
          .eq('menu_item_id', itemId)
          .order('sort_order')
          .then(({ data: groupData }) => {
            const loaded: OptionGroup[] = (groupData ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((row: any) => {
                const g = row.option_groups;
                if (!g) return null;
                return {
                  ...g,
                  sort_order: row.sort_order,
                  options: [...(g.options ?? [])].sort(
                    (a: DbOption, b: DbOption) =>
                      a.display_order !== b.display_order
                        ? a.display_order - b.display_order
                        : a.id.localeCompare(b.id),
                  ),
                } as OptionGroup;
              })
              .filter(Boolean) as OptionGroup[];

            setGroups(loaded);

            const sel: Record<string, string[]> = {};
            for (const g of loaded) {
              if (g.selection_type === 'SINGLE_SELECT') {
                // Default: first option by display_order (must not add price per spec)
                const first = g.options[0];
                sel[g.id] = first ? [first.id] : [];
              } else {
                sel[g.id] = [];
              }
            }
            setSelections(sel);
            setPhase('ready');
          });
      });
  }, [itemId]);

  /* ── Price calculation ────────────────────────────────── */
  const unitPrice = useMemo(() => {
    if (!item) return 0;
    return item.base_price + groups.reduce((total, g) => {
      const selectedIds = selections[g.id] ?? [];
      return total + selectedIds.reduce((s, optId) => {
        const opt = g.options.find(o => o.id === optId);
        return s + (opt?.price_adjustment ?? 0);
      }, 0);
    }, 0);
  }, [item, groups, selections]);

  const total = unitPrice * qty;

  /* ── Price breakdown line ─────────────────────────────── */
  const priceBreakdown = useMemo(() => {
    if (!item) return '';
    const parts: string[] = [`฿${item.base_price}`];
    for (const g of groups) {
      const selectedIds = selections[g.id] ?? [];
      for (const optId of selectedIds) {
        const opt = g.options.find(o => o.id === optId);
        if (opt && opt.price_adjustment > 0) {
          parts.push(`${opt.option_name_th} +฿${opt.price_adjustment}`);
        }
      }
    }
    return parts.join(' · ');
  }, [item, groups, selections]);

  /* ── Toggle selection ─────────────────────────────────── */
  function handleSelect(groupId: string, optionId: string, selType: 'SINGLE_SELECT' | 'MULTI_SELECT') {
    setSelections(prev => {
      const next = { ...prev };
      if (selType === 'SINGLE_SELECT') {
        next[groupId] = [optionId];
      } else {
        const cur = new Set(prev[groupId] ?? []);
        cur.has(optionId) ? cur.delete(optionId) : cur.add(optionId);
        next[groupId] = [...cur];
      }
      return next;
    });
  }

  /* ── Build cart item ─────────────────────────────────── */
  function buildCartItem(): CartItem {
    const sizeGroup  = groups.find(g => g.group_name_th.includes('ขนาด'));
    const spiceGroup = groups.find(g => g.group_name_th.includes('เผ็ด'));

    const sizeOptId = sizeGroup ? (selections[sizeGroup.id]?.[0] ?? '') : '';
    const sizeOpt   = sizeGroup?.options.find(o => o.id === sizeOptId);
    const sizeLabel = sizeOpt?.option_name_th ?? '';
    const sizePrice = sizeOpt?.price_adjustment ?? 0;

    const spiceOptId = spiceGroup ? (selections[spiceGroup.id]?.[0] ?? '') : '';
    const spiceOpt   = spiceGroup?.options.find(o => o.id === spiceOptId);
    const spice      = spiceOpt?.option_name_th ?? '';

    const addons: { label: string; price: number }[] = [];
    for (const g of groups) {
      if (g.id === sizeGroup?.id || g.id === spiceGroup?.id) continue;
      const selectedIds = selections[g.id] ?? [];
      for (const optId of selectedIds) {
        const opt = g.options.find(o => o.id === optId);
        if (opt) addons.push({ label: opt.option_name_th, price: opt.price_adjustment });
      }
    }

    return {
      cartId:    `${item!.id}-${Date.now()}`,
      itemId:    item!.id,
      name:      item!.name_th,
      nameEn:    item!.name_en,
      tone:      'clay',
      topping:   'egg',
      imageUrl:  item!.image_url ?? undefined,
      basePrice: item!.base_price,
      sizeLabel,
      sizePrice,
      spice,
      addons,
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

  const isSpiceGroup = (g: OptionGroup) => g.group_name_th.includes('เผ็ด');

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

        {/* Drag handle — fixed at top center, outside scroll */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(43,33,24,0.20)',
          zIndex: 4, pointerEvents: 'none',
        }} />

        {/* Close button — 44px white circle, always visible */}
        <button
          onClick={close}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 44, height: 44, borderRadius: '50%',
            background: '#fff',
            border: 'none',
            display: 'grid', placeItems: 'center',
            zIndex: 5,
            boxShadow: '0 2px 10px rgba(43,33,24,0.20)',
          }}
        >{I.close(18)}</button>

        {/* ── Scrollable body ───────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        }}>

          {/* Hero — 4:3 capped at 38dvh, object-fit: contain on cream bg */}
          <div style={{
            position: 'relative', width: '100%',
            paddingTop: 'min(75%, 38dvh)',
            background: 'var(--bg)',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              {phase === 'ready' && item?.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name_th}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'grid', placeItems: 'center',
                  background: 'radial-gradient(circle at center, var(--bg-3) 0%, var(--bg) 100%)',
                }}>
                  {phase === 'ready' && <Bowl tone="clay" topping="egg" size={160} />}
                </div>
              )}
            </div>
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

                {/* Description — only if non-empty */}
                {item.description_th && (
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                    {item.description_th}
                  </div>
                )}

                {/* ── Option groups from DB ─────────────── */}
                {groups.map(g => {
                  const isSingle  = g.selection_type === 'SINGLE_SELECT';
                  const isSpice   = isSpiceGroup(g);
                  const selectedIds = selections[g.id] ?? [];

                  return (
                    <div key={g.id} style={{ marginTop: 22 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span className="kicker muted">{g.group_name_th}</span>
                          {g.group_name_en && (
                            <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>
                              · {g.group_name_en.toLowerCase()}
                            </span>
                          )}
                        </div>
                        {isSingle && (
                          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>จำเป็น</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {g.options.map((opt, idx) => {
                          const isSelected = selectedIds.includes(opt.id);
                          const flames     = isSpice ? idx : 0;

                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleSelect(g.id, opt.id, g.selection_type)}
                              style={{
                                padding: '8px 12px', borderRadius: 'var(--r-pill)',
                                border: isSelected
                                  ? (isSingle ? '1.5px solid var(--ink)' : '1.5px solid var(--accent)')
                                  : '1px solid var(--line)',
                                background: isSelected
                                  ? (isSingle ? 'var(--bg-2)' : 'rgba(181,81,30,0.08)')
                                  : 'var(--bg)',
                                color: isSelected
                                  ? (isSingle ? 'var(--ink)' : 'var(--accent)')
                                  : 'var(--ink-2)',
                                fontSize: 12, fontFamily: 'var(--serif)',
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                minHeight: 36,
                              }}
                            >
                              {/* Checkbox indicator for multi-select */}
                              {!isSingle && (
                                <span style={{
                                  width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                                  border: isSelected ? '0' : '1.5px solid var(--line-2)',
                                  background: isSelected ? 'var(--accent)' : 'transparent',
                                  color: '#fff', display: 'grid', placeItems: 'center',
                                }}>
                                  {isSelected && I.check(10)}
                                </span>
                              )}
                              <span>{opt.option_name_th}</span>
                              {/* Flame icons for spice groups */}
                              {isSpice && flames > 0 && Array.from({ length: flames }).map((_, j) => (
                                <span key={j} style={{ color: 'var(--accent)', lineHeight: 1 }}>{I.flame(8)}</span>
                              ))}
                              {/* Price adjustment — only if > 0 */}
                              {opt.price_adjustment > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>
                                  +฿{opt.price_adjustment}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div style={{ height: 24 }} />
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

              {isShopOpen ? (
                <>
                  <button
                    onClick={handleAdd}
                    style={{
                      flex: 1, height: 44, borderRadius: 'var(--r-pill)',
                      background: 'var(--bg-2)',
                      border: '1.5px solid var(--line)',
                      color: 'var(--ink)',
                      fontSize: 13, fontWeight: 600,
                    }}
                  >เพิ่มลงตะกร้า</button>

                  <button
                    onClick={handleOrderNow}
                    style={{
                      flex: 1, height: 44, borderRadius: 'var(--r-pill)',
                      background: 'var(--accent)',
                      border: 0, color: '#fff',
                      fontSize: 13, fontWeight: 600,
                    }}
                  >สั่งเลย</button>
                </>
              ) : (
                /* Shop closed — single disabled button */
                <button
                  disabled
                  style={{
                    flex: 1, height: 44, borderRadius: 'var(--r-pill)',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink-3)',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'not-allowed',
                  }}
                >ร้านปิดอยู่ · เปิด {shopNextOpen}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
