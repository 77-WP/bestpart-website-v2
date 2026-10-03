import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Bowl } from '../Bowl';
import { I } from '../icons';
import { useCart, type CartItem } from '../../store/cart';
import { useLang } from '../../store/lang';
import { LANG_MAP } from '../../config/lang';
import { PERSONALIZATION } from '../../config/personalization';
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
  is_upsell_item: boolean; sort_order: number;
  options: DbOption[];
};

/* Enriched option with its parent group id, used in Step 2 */
type RichOption = DbOption & { groupId: string };

const TEST_ITEM_ROW: MenuItemRow = {
  id: 'test-1baht', name_th: 'ทดสอบ ฿1', name_en: 'Test Item ฿1',
  base_price: 1, image_url: null, is_best_seller: false,
  is_active: true, category_id: '', description_th: null,
};

/* ── Helpers ─────────────────────────────────────────────── */
function cleanLabel(s: string) {
  return s.replace(/\s*\([a-zA-Z /]+\)\s*/g, '').trim();
}

function isSizeGroup(g: OptionGroup)           { return g.group_name_th.includes('ขนาด'); }
function isSpiceGroup(g: OptionGroup)          { return g.group_name_th.includes('เผ็ด'); }
function isPersonalizationGroup(g: OptionGroup){ return g.group_name_th.includes('ตามใจคุณ'); }

/* ── Props ───────────────────────────────────────────────── */
type Props = {
  isShopOpen: boolean;
  shopNextOpen: string;
  categories?: { id: string; name_en: string }[];
};

/* ══════════════════════════════════════════════════════════
   PRODUCT SHEET — two-step flow
══════════════════════════════════════════════════════════ */
export function ProductSheet({ isShopOpen, shopNextOpen }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { add }           = useCart();
  const { lang }          = useLang();
  const T                 = LANG_MAP[lang];
  const prefersReduced    = useReducedMotion();

  const itemId = searchParams.get('item');

  const [item,          setItem]         = useState<MenuItemRow | null>(null);
  const [phase,         setPhase]        = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [groups,        setGroups]       = useState<OptionGroup[]>([]);
  const [selections,    setSelections]   = useState<Record<string, string[]>>({});
  const [qty,           setQty]          = useState(1);
  const [step,          setStep]         = useState<'essentials' | 'make-it-yours'>('essentials');
  const [closedTapMsg,  setClosedTapMsg] = useState(false);

  /* Close — preserve ?method= */
  const close = useCallback(() => {
    const method = searchParams.get('method');
    setSearchParams(method ? { method } : {});
  }, [searchParams, setSearchParams]);

  /* Body scroll lock */
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

  /* Fetch item + option groups */
  useEffect(() => {
    if (!itemId) return;
    setPhase('loading');
    setItem(null);
    setGroups([]);
    setSelections({});
    setQty(1);
    setStep('essentials');

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
        if (!data || error) { setPhase('not_found'); return; }
        setItem(data as MenuItemRow);

        supabase
          .from('menu_item_option_groups')
          .select(`
            sort_order, option_group_id,
            option_groups (
              id, group_name_th, group_name_en, selection_type, is_upsell_item,
              options ( id, option_name_th, option_name_en, price_adjustment, display_order )
            )
          `)
          .eq('menu_item_id', itemId)
          .order('sort_order')
          .then(({ data: gd }) => {
            const loaded: OptionGroup[] = (gd ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((row: any) => {
                const g = row.option_groups;
                if (!g) return null;
                return {
                  ...g, sort_order: row.sort_order,
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

            /* Default selections */
            const sel: Record<string, string[]> = {};
            for (const g of loaded) {
              if (g.selection_type === 'SINGLE_SELECT') {
                if (isSpiceGroup(g)) {
                  /* Default spice = ปกติ */
                  const def = g.options.find(o => o.option_name_th.includes('ปกติ')) ?? g.options[0];
                  sel[g.id] = def ? [def.id] : [];
                } else {
                  /* Other single: first option (price_adjustment = 0) */
                  sel[g.id] = g.options[0] ? [g.options[0].id] : [];
                }
              } else {
                sel[g.id] = [];
              }
            }
            setSelections(sel);
            setPhase('ready');
          });
      });
  }, [itemId]);

  /* ── Derived group lists ─────────────────────────────────── */
  const step1Groups = useMemo(
    () => groups.filter(g => g.selection_type === 'SINGLE_SELECT' && !isPersonalizationGroup(g) && !g.is_upsell_item),
    [groups],
  );
  const personGroups = useMemo(() => groups.filter(isPersonalizationGroup), [groups]);
  const extrasGroups = useMemo(() => {
    const classified = new Set([
      ...step1Groups.map(g => g.id),
      ...personGroups.map(g => g.id),
    ]);
    return groups.filter(g => g.is_upsell_item || !classified.has(g.id));
  }, [groups, step1Groups, personGroups]);

  /* ── Egg and taste options from personalization groups ────── */
  const allPersonOptions = useMemo<RichOption[]>(
    () => personGroups.flatMap(g => g.options.map(o => ({ ...o, groupId: g.id }))),
    [personGroups],
  );
  const eggOptions   = useMemo(() => allPersonOptions.filter(o => (PERSONALIZATION[o.option_name_th.trim()]?.category ?? 'taste') === 'egg'),   [allPersonOptions]);
  const tasteOptions = useMemo(() => allPersonOptions.filter(o => (PERSONALIZATION[o.option_name_th.trim()]?.category ?? 'taste') === 'taste'), [allPersonOptions]);

  /* ── Price calculation ────────────────────────────────────── */
  const unitPrice = useMemo(() => {
    if (!item) return 0;
    return item.base_price + groups.reduce((t, g) => {
      return t + (selections[g.id] ?? []).reduce((s, optId) => {
        return s + (g.options.find(o => o.id === optId)?.price_adjustment ?? 0);
      }, 0);
    }, 0);
  }, [item, groups, selections]);

  const total = unitPrice * qty;

  /* ── Selection helpers ────────────────────────────────────── */
  function isSelected(groupId: string, optionId: string) {
    return (selections[groupId] ?? []).includes(optionId);
  }

  function handleSelect(groupId: string, optionId: string, type: 'SINGLE_SELECT' | 'MULTI_SELECT') {
    setSelections(prev => {
      const next = { ...prev };
      if (type === 'SINGLE_SELECT') {
        next[groupId] = [optionId];
      } else {
        const cur = new Set(prev[groupId] ?? []);
        cur.has(optionId) ? cur.delete(optionId) : cur.add(optionId);
        next[groupId] = [...cur];
      }
      return next;
    });
  }

  /* Egg chips — handle doneness exclusivity + "Best Part's way" reset */
  function handleEggChip(opt: RichOption | null) {
    if (opt === null) {
      setSelections(prev => {
        const next = { ...prev };
        for (const eo of eggOptions) {
          next[eo.groupId] = (next[eo.groupId] ?? []).filter(id => id !== eo.id);
        }
        return next;
      });
      return;
    }
    const po = PERSONALIZATION[opt.option_name_th.trim()];
    const isDoneness = po?.exclusiveGroup === 'doneness';
    setSelections(prev => {
      const next = { ...prev };
      const cur = new Set(next[opt.groupId] ?? []);
      if (isDoneness) {
        for (const eo of eggOptions) {
          if (eo.groupId === opt.groupId && PERSONALIZATION[eo.option_name_th.trim()]?.exclusiveGroup === 'doneness') {
            cur.delete(eo.id);
          }
        }
      }
      cur.has(opt.id) ? cur.delete(opt.id) : cur.add(opt.id);
      next[opt.groupId] = [...cur];
      return next;
    });
  }

  /* ── Build cart item (structure unchanged) ────────────────── */
  function buildCartItem(): CartItem {
    const sizeGroup  = step1Groups.find(isSizeGroup);
    const spiceGroup = step1Groups.find(isSpiceGroup);

    const sizeOpt   = sizeGroup ? sizeGroup.options.find(o => isSelected(sizeGroup.id, o.id)) : undefined;
    const spiceOpt  = spiceGroup ? spiceGroup.options.find(o => isSelected(spiceGroup.id, o.id)) : undefined;

    const addons: { label: string; price: number }[] = [];
    for (const g of groups) {
      if (g.id === sizeGroup?.id || g.id === spiceGroup?.id) continue;
      for (const optId of selections[g.id] ?? []) {
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
      sizeLabel: sizeOpt?.option_name_th ?? '',
      sizePrice: sizeOpt?.price_adjustment ?? 0,
      spice:     spiceOpt?.option_name_th ?? '',
      addons,
      qty,
    };
  }

  const canOrder = item !== null && (item.is_active || (TEST_MODE && item.id === 'test-1baht'));

  function handleAdd() {
    if (!canOrder) return;
    if (!isShopOpen) {
      setClosedTapMsg(true);
      setTimeout(() => setClosedTapMsg(false), 3000);
      return;
    }
    add(buildCartItem());
    close();
  }

  /* ── Personalization status ───────────────────────────────── */
  const hasAnyPersonSelection = allPersonOptions.some(o => isSelected(o.groupId, o.id));
  const isBestPartWay = !hasAnyPersonSelection;

  /* ── Summary strings ─────────────────────────────────────── */
  const sizeGroup  = step1Groups.find(isSizeGroup);
  const spiceGroup = step1Groups.find(isSpiceGroup);
  const selSizeLabel  = sizeGroup  ? sizeGroup.options.find(o => isSelected(sizeGroup.id, o.id))?.[lang === 'en' ? 'option_name_en' : 'option_name_th'] ?? '' : '';
  const selSpiceLabel = spiceGroup ? spiceGroup.options.find(o => isSelected(spiceGroup.id, o.id))?.[lang === 'en' ? 'option_name_en' : 'option_name_th'] ?? '' : '';

  const selectedPersonLabels = allPersonOptions
    .filter(o => isSelected(o.groupId, o.id))
    .map(o => {
      const po = PERSONALIZATION[o.option_name_th.trim()];
      return lang === 'en' ? (po?.labelEn ?? cleanLabel(o.option_name_en || o.option_name_th)) : (po?.labelTh ?? cleanLabel(o.option_name_th));
    });

  /* Egg/taste sections: show "no extra charge" if all options are free */
  const eggAllFree   = eggOptions.every(o => o.price_adjustment === 0);
  const tasteAllFree = tasteOptions.every(o => o.price_adjustment === 0);

  /* ── Spice flame count ────────────────────────────────────── */
  function spiceFlames(idx: number) { return idx; }

  if (!itemId) return null;

  /* ──────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(43,33,24,0.52)' }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, height: '92dvh', zIndex: 61,
        background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 -8px 40px -8px rgba(43,33,24,0.22)',
      }}>

        {/* Drag handle */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(43,33,24,0.20)', zIndex: 4, pointerEvents: 'none',
        }} />

        {/* Close button */}
        <button
          onClick={close}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 44, height: 44, borderRadius: '50%',
            background: '#fff', border: 'none',
            display: 'grid', placeItems: 'center', zIndex: 5,
            boxShadow: '0 2px 10px rgba(43,33,24,0.20)',
          }}
        >{I.close(18)}</button>

        {/* ── Sliding panels ──────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            display: 'flex', width: '200%', height: '100%',
            transform: step === 'essentials' ? 'translateX(0)' : 'translateX(-50%)',
            transition: prefersReduced ? 'none' : 'transform 0.30s cubic-bezier(0.4,0,0.2,1)',
            willChange: 'transform',
          }}>

            {/* ══ PANEL 1: ESSENTIALS ══════════════════════ */}
            <div style={{
              width: '50%', flexShrink: 0, height: '100%',
              overflowY: 'auto',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              WebkitOverflowScrolling: 'touch' as any,
            }}>
              {/* Shop closed banner */}
              {!isShopOpen && (
                <div style={{
                  padding: '10px 18px', fontSize: 12,
                  background: 'rgba(43,33,24,0.06)',
                  color: 'var(--ink-2)',
                  borderBottom: '1px solid var(--line)',
                }}>
                  <strong style={{ color: 'var(--ink)' }}>{T.closedBanner(shopNextOpen)}</strong>
                </div>
              )}

              {/* Image area — max 35% sheet height, contain */}
              <div style={{
                position: 'relative', width: '100%',
                paddingTop: 'min(75%, 35dvh)',
                background: 'var(--bg)', overflow: 'hidden', flexShrink: 0,
              }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {phase === 'ready' && item?.image_url ? (
                    <img
                      src={item.image_url} alt={item.name_th}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'grid', placeItems: 'center',
                      background: 'radial-gradient(circle at center, var(--bg-3) 0%, var(--bg) 100%)',
                    }}>
                      {phase === 'ready' && <Bowl tone="clay" topping="egg" size={160} />}
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '20px 20px 12px' }}>

                {/* Loading skeleton */}
                {phase === 'loading' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[65, 45, 80, 70].map((w, i) => (
                      <div key={i} style={{ height: i === 0 ? 28 : 11, borderRadius: 4, background: 'var(--bg-3)', width: `${w}%` }} />
                    ))}
                  </div>
                )}

                {/* Not found / inactive */}
                {(phase === 'not_found' || (phase === 'ready' && item && !item.is_active && !(TEST_MODE && item.id === 'test-1baht'))) && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>
                    <div style={{ opacity: 0.3, marginBottom: 12 }}>{I.close(40)}</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 10 }}>
                      {T.notAvailable}
                    </div>
                    <button
                      onClick={close}
                      style={{
                        background: 'var(--bg-3)', border: '1px solid var(--line)',
                        padding: '11px 22px', borderRadius: 'var(--r-pill)',
                        fontSize: 13, color: 'var(--ink-2)',
                      }}
                    >{T.backToMenu}</button>
                  </div>
                )}

                {/* Active item */}
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
                    <div className="h-display-th" style={{ fontSize: 24, lineHeight: 1.2 }}>
                      {lang === 'en' ? item.name_en : item.name_th}
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 13, marginTop: 3 }}>
                      {lang === 'en' ? item.name_th : item.name_en}
                    </div>
                    {item.description_th && (
                      <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                        {item.description_th}
                      </div>
                    )}

                    {/* Step 1 option groups (size, spice, other mandatory single) */}
                    {step1Groups.map(g => {
                      const isSpice   = isSpiceGroup(g);
                      const selectedIds = selections[g.id] ?? [];
                      const labelTh   = isSizeGroup(g) ? T.size : isSpice ? T.spiceLevel : cleanLabel(g.group_name_th);
                      const labelEn   = isSizeGroup(g) ? T.size : isSpice ? T.spiceLevel : (g.group_name_en || labelTh);

                      return (
                        <div key={g.id} style={{ marginTop: 22 }}>
                          {/* Group header — no uppercase/letter-spacing for Thai */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
                            }}>{lang === 'en' ? labelEn : labelTh}</span>
                            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{T.required}</span>
                          </div>

                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {g.options.map((opt, idx) => {
                              const sel = selectedIds.includes(opt.id);
                              const flames = isSpice ? spiceFlames(idx) : 0;
                              const label = lang === 'en' ? (cleanLabel(opt.option_name_en) || cleanLabel(opt.option_name_th)) : cleanLabel(opt.option_name_th);

                              return (
                                <motion.button
                                  key={opt.id}
                                  whileTap={prefersReduced ? undefined : { scale: 0.94 }}
                                  onClick={() => handleSelect(g.id, opt.id, 'SINGLE_SELECT')}
                                  style={{
                                    padding: '9px 14px', borderRadius: 'var(--r-pill)',
                                    border: sel ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                                    background: sel ? 'var(--bg-2)' : 'var(--bg)',
                                    color: sel ? 'var(--ink)' : 'var(--ink-2)',
                                    fontSize: 13, fontFamily: 'var(--serif)',
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    minHeight: 44,
                                  }}
                                >
                                  {sel && <span style={{ color: 'var(--accent)', fontSize: 10 }}>{I.check(10)}</span>}
                                  <span>{label}</span>
                                  {isSpice && flames > 0 && Array.from({ length: flames }).map((_, j) => (
                                    <span key={j} style={{ color: 'var(--accent)', lineHeight: 1 }}>{I.flame(9)}</span>
                                  ))}
                                  {opt.price_adjustment > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>+฿{opt.price_adjustment}</span>
                                  )}
                                </motion.button>
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

            {/* ══ PANEL 2: MAKE IT YOURS ═══════════════════ */}
            <div style={{
              width: '50%', flexShrink: 0, height: '100%',
              overflowY: 'auto',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              WebkitOverflowScrolling: 'touch' as any,
            }}>
              <div style={{ padding: '28px 20px 12px' }}>

                {/* ── Philosophy header ─────────────────── */}
                <span style={{
                  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.12em',
                  color: 'var(--gold)', marginBottom: 8,
                }}>{T.kicker}</span>

                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, lineHeight: 1.2,
                  color: 'var(--ink)', marginBottom: 16,
                }}>{T.headline}</div>

                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 24 }}>
                  {T.philoP1.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  <div style={{ height: 12 }} />
                  {T.philoP2.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  <div style={{ height: 12 }} />
                  <em>{T.philoClose}</em>
                </div>

                {/* ── Status indicator ──────────────────── */}
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--r-md)',
                  background: isBestPartWay ? 'rgba(184,134,46,0.08)' : 'rgba(181,81,30,0.07)',
                  border: `1px solid ${isBestPartWay ? 'rgba(184,134,46,0.20)' : 'rgba(181,81,30,0.18)'}`,
                  marginBottom: 28,
                  transition: prefersReduced ? 'none' : 'background 0.2s, border-color 0.2s',
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.10em',
                    color: isBestPartWay ? 'var(--gold)' : 'var(--accent)',
                  }}>
                    {isBestPartWay ? T.statusDefault : T.statusCustom}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                    {isBestPartWay ? T.statusDefaultSub : T.statusCustomSub}
                  </div>
                </div>

                {/* ── A: Egg chips ──────────────────────── */}
                {eggOptions.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{T.eggTitle}</span>
                      {eggAllFree && (
                        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{T.noExtraCharge}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* "Best Part's way" — synthetic reset chip */}
                      <motion.button
                        whileTap={prefersReduced ? undefined : { scale: 0.94 }}
                        onClick={() => handleEggChip(null)}
                        style={{
                          minHeight: 44, padding: '10px 16px', borderRadius: 'var(--r-pill)',
                          border: isBestPartWay ? '1.5px solid var(--gold)' : '1px solid var(--line)',
                          background: isBestPartWay ? 'rgba(184,134,46,0.10)' : 'var(--bg)',
                          color: isBestPartWay ? 'var(--gold)' : 'var(--ink-3)',
                          fontSize: 13, fontFamily: 'var(--serif)',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        {isBestPartWay && <span style={{ fontSize: 10 }}>{I.check(10)}</span>}
                        {T.eggDefault}
                      </motion.button>

                      {eggOptions.map(opt => {
                        const sel  = isSelected(opt.groupId, opt.id);
                        const po   = PERSONALIZATION[opt.option_name_th.trim()];
                        const label = lang === 'en' ? (po?.labelEn ?? cleanLabel(opt.option_name_en || opt.option_name_th)) : (po?.labelTh ?? cleanLabel(opt.option_name_th));
                        return (
                          <motion.button
                            key={opt.id}
                            whileTap={prefersReduced ? undefined : { scale: 0.94 }}
                            onClick={() => handleEggChip(opt)}
                            style={{
                              minHeight: 44, padding: '10px 16px', borderRadius: 'var(--r-pill)',
                              border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                              background: sel ? 'rgba(181,81,30,0.08)' : 'var(--bg)',
                              color: sel ? 'var(--accent)' : 'var(--ink-2)',
                              fontSize: 13, fontFamily: 'var(--serif)',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            {sel && (
                              <motion.span
                                initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ fontSize: 10 }}
                              >{I.check(10)}</motion.span>
                            )}
                            {label}
                            {opt.price_adjustment > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>+฿{opt.price_adjustment}</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── B: Taste chips ────────────────────── */}
                {tasteOptions.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{T.tasteTitle}</span>
                      {tasteAllFree && (
                        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{T.noExtraCharge}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {tasteOptions.map(opt => {
                        const sel   = isSelected(opt.groupId, opt.id);
                        const po    = PERSONALIZATION[opt.option_name_th.trim()];
                        const label = lang === 'en' ? (po?.labelEn ?? cleanLabel(opt.option_name_en || opt.option_name_th)) : (po?.labelTh ?? cleanLabel(opt.option_name_th));
                        return (
                          <motion.button
                            key={opt.id}
                            whileTap={prefersReduced ? undefined : { scale: 0.94 }}
                            onClick={() => handleSelect(opt.groupId, opt.id, 'MULTI_SELECT')}
                            style={{
                              minHeight: 44, padding: '10px 16px', borderRadius: 'var(--r-pill)',
                              border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                              background: sel ? 'rgba(181,81,30,0.08)' : 'var(--bg)',
                              color: sel ? 'var(--accent)' : 'var(--ink-2)',
                              fontSize: 13, fontFamily: 'var(--serif)',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            {sel && (
                              <motion.span
                                initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ fontSize: 10 }}
                              >{I.check(10)}</motion.span>
                            )}
                            {label}
                            {opt.price_adjustment > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>+฿{opt.price_adjustment}</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Extras ────────────────────────────── */}
                {extrasGroups.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{
                      height: 1, background: 'var(--line)',
                      marginBottom: 20,
                    }} />
                    <div style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
                      color: 'var(--ink-3)', marginBottom: 16,
                    }}>{T.extrasTitle}</div>

                    {extrasGroups.map(g => {
                      const selectedIds = selections[g.id] ?? [];
                      const groupLabel  = lang === 'en' ? (cleanLabel(g.group_name_en) || cleanLabel(g.group_name_th)) : cleanLabel(g.group_name_th);
                      return (
                        <div key={g.id} style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8 }}>
                            {groupLabel}
                          </div>
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {g.options.map(opt => {
                              const sel   = selectedIds.includes(opt.id);
                              const label = lang === 'en' ? (cleanLabel(opt.option_name_en) || cleanLabel(opt.option_name_th)) : cleanLabel(opt.option_name_th);
                              return (
                                <motion.button
                                  key={opt.id}
                                  whileTap={prefersReduced ? undefined : { scale: 0.94 }}
                                  onClick={() => handleSelect(g.id, opt.id, g.selection_type)}
                                  style={{
                                    minHeight: 44, padding: '9px 14px', borderRadius: 'var(--r-pill)',
                                    border: sel ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                                    background: sel ? 'var(--bg-2)' : 'var(--bg)',
                                    color: sel ? 'var(--ink)' : 'var(--ink-2)',
                                    fontSize: 12, fontFamily: 'var(--serif)',
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                  }}
                                >
                                  {sel && <span style={{ fontSize: 10 }}>{I.check(10)}</span>}
                                  {label}
                                  {opt.price_adjustment > 0 && (
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, opacity: 0.75 }}>
                                      +฿{opt.price_adjustment}
                                    </span>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── YOUR BEST PART summary ────────────── */}
                {phase === 'ready' && item && canOrder && (
                  <div style={{
                    marginTop: 28, padding: '16px 16px',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--line)',
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '.12em',
                      color: 'var(--ink-3)', marginBottom: 8,
                    }}>{T.summaryTitle}</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
                      {lang === 'en' ? item.name_en : item.name_th}
                    </div>
                    {(selSizeLabel || selSpiceLabel) && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}>
                        {[selSizeLabel, selSpiceLabel].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>
                      {selectedPersonLabels.length > 0
                        ? selectedPersonLabels.join(' · ')
                        : T.summaryDefault}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic',
                    }}>{T.summaryTagline}</div>
                  </div>
                )}
                <div style={{ height: 24 }} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        {phase === 'ready' && canOrder && (
          <div style={{
            flexShrink: 0,
            padding: `12px 18px calc(env(safe-area-inset-bottom, 0px) + 12px)`,
            borderTop: '1px solid var(--line)',
            background: 'var(--bg)',
          }}>

            {step === 'essentials' ? (
              /* Step 1 footer: price + Next button */
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                  ฿{unitPrice}
                </span>
                <motion.button
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  onClick={() => setStep('make-it-yours')}
                  style={{
                    flex: 1, height: 50, borderRadius: 'var(--r-pill)',
                    background: 'var(--ink)', color: 'var(--on-accent)',
                    border: 0, fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <span>{T.nextBtn}</span>
                  {I.arrow(14)}
                </motion.button>
              </div>
            ) : (
              /* Step 2 footer: back + qty + add to cart */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Back to Step 1 */}
                  <button
                    onClick={() => setStep('essentials')}
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'var(--bg-3)', border: '1px solid var(--line)',
                      display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
                      flexShrink: 0,
                    }}
                  >{I.back(18)}</button>

                  {/* Qty stepper */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-pill)',
                    background: 'var(--bg-2)', flexShrink: 0,
                  }}>
                    <button
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      style={{ width: 40, height: 44, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}
                    >{I.minus(15)}</button>
                    <span style={{ minWidth: 26, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 15 }}>{qty}</span>
                    <button
                      onClick={() => setQty(q => q + 1)}
                      style={{ width: 40, height: 44, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
                    >{I.plus(15)}</button>
                  </div>

                  {/* Add to cart */}
                  <motion.button
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    onClick={handleAdd}
                    style={{
                      flex: 1, height: 50, borderRadius: 'var(--r-pill)',
                      background: 'var(--accent)', color: '#fff',
                      border: 0, fontSize: 13, fontWeight: 600,
                    }}
                  >{T.addToCart(total)}</motion.button>
                </div>

                {/* Closed message on tap */}
                {closedTapMsg && (
                  <div style={{
                    marginTop: 8, textAlign: 'center',
                    fontSize: 12, color: 'var(--ink-3)',
                  }}>
                    {T.closedAddMsg(shopNextOpen)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
