import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Bowl } from '../Bowl';
import { I } from '../icons';
import { useCart, type CartItem } from '../../store/cart';
import { useT } from '../../i18n';
import { PERSONALIZATION } from '../../config/personalization';
import { TEST_MODE } from '../../config/env';
import { useMenuState, getOptionRules } from '../../lib/menuState';
import { isOptionRuleHidden } from '../../lib/optionRules';
import { track } from '../../lib/analytics';

/* ── DB types ─────────────────────────────────────────────── */
type MenuItemRow = {
  id: string; name_th: string; name_en: string;
  base_price: number; image_url: string | null;
  is_best_seller: boolean; is_active: boolean;
  category_id: string; description_th: string | null; description_en?: string | null;
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

type RichOption = DbOption & { groupId: string };

const TEST_ITEM_ROW: MenuItemRow = {
  id: 'test-1baht', name_th: 'ทดสอบ ฿1', name_en: 'Test Item ฿1',
  base_price: 1, image_url: null, is_best_seller: false,
  is_active: true, category_id: '', description_th: null,
};

/* ── Spice name tables ───────────────────────────────────── */
const SPICE_TH = ['ไม่ใส่พริก', 'เผ็ดน้อย', 'เผ็ดปกติ', 'เผ็ดมาก', 'เผ็ดมากที่สุด'];
const SPICE_EN = ['No chili', 'Mild', 'Regular', 'Hot', 'Extra hot'];

/* ── Helpers ─────────────────────────────────────────────── */
function cleanLabel(s: string) {
  return s.replace(/\s*\([a-zA-Z /]+\)\s*/g, '').trim();
}

function isSizeGroup(g: OptionGroup)            { return g.group_name_th.includes('ขนาด'); }
function isSpiceGroup(g: OptionGroup)           { return g.group_name_th.includes('เผ็ด'); }
function isPersonalizationGroup(g: OptionGroup) { return g.group_name_th.includes('ตามใจคุณ'); }
function isHiddenGroup(g: OptionGroup) {
  const n = g.group_name_th;
  return n.includes('เครื่องดื่ม') || n.includes('ช้อนส้อม') ||
         n.includes('เครื่องปรุง') || n.includes('พริกน้ำปลา');
}

function spiceIndex(optNameTh: string) {
  return SPICE_TH.indexOf(cleanLabel(optNameTh));
}

/* ── Props ───────────────────────────────────────────────── */
type Props = {
  isShopOpen: boolean;
  shopClosedMsg: string;
  categories?: { id: string; name_en: string }[];
};

/* ══════════════════════════════════════════════════════════
   PRODUCT SHEET — two-step flow
══════════════════════════════════════════════════════════ */
export function ProductSheet({ isShopOpen, shopClosedMsg }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { add, replace, items } = useCart();
  const { t, lang }    = useT();
  const prefersReduced = useReducedMotion();

  const { isItemUnavailable: isItemUnavailState, isOptionUnavailable, tick: menuTick } = useMenuState();

  const itemId    = searchParams.get('item');
  const editCartId = searchParams.get('editCartId');

  const [item,         setItem]        = useState<MenuItemRow | null>(null);
  const [phase,        setPhase]       = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [groups,       setGroups]      = useState<OptionGroup[]>([]);
  const [selections,   setSelections]  = useState<Record<string, string[]>>({});
  const [qty,          setQty]         = useState(1);
  const [step,         setStep]        = useState<'essentials' | 'make-it-yours'>('essentials');
  const [closedTapMsg, setClosedTapMsg]= useState(false);

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
      .select('id, name_th, name_en, base_price, image_url, is_best_seller, is_active, category_id, description_th, description_en')
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
              if (isHiddenGroup(g)) continue;
              if (g.selection_type === 'SINGLE_SELECT') {
                if (isSpiceGroup(g)) {
                  /* Default = เผ็ดปกติ (index 2) */
                  const def = g.options.find(o => cleanLabel(o.option_name_th) === 'เผ็ดปกติ') ?? g.options[0];
                  sel[g.id] = def ? [def.id] : [];
                } else {
                  /* Default = first option with price_adjustment = 0, by display_order */
                  const zeroPriceOpt = g.options.find(o => o.price_adjustment === 0) ?? g.options[0];
                  sel[g.id] = zeroPriceOpt ? [zeroPriceOpt.id] : [];
                }
              } else {
                sel[g.id] = [];
              }
            }
            /* Edit mode: override defaults with values from the cart item being edited */
            const editTarget = editCartId ? items.find(i => i.cartId === editCartId) : undefined;
            if (editTarget) {
              setQty(editTarget.qty);
              for (const g of loaded) {
                if (isHiddenGroup(g)) continue;
                if (isSizeGroup(g) && editTarget.sizeLabel) {
                  const match = g.options.find(o => o.option_name_th === editTarget.sizeLabel);
                  if (match) sel[g.id] = [match.id];
                } else if (isSpiceGroup(g) && editTarget.spice) {
                  const match = g.options.find(o => o.option_name_th === editTarget.spice);
                  if (match) sel[g.id] = [match.id];
                } else if (!isSizeGroup(g) && !isSpiceGroup(g)) {
                  const matchedIds = editTarget.addons
                    .map(a => g.options.find(o => o.option_name_th === a.label)?.id)
                    .filter((id): id is string => id !== undefined);
                  if (matchedIds.length > 0) sel[g.id] = matchedIds;
                }
              }
            }

            setSelections(sel);
            setPhase('ready');
          });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, editCartId]);

  /* item_viewed */
  useEffect(() => {
    if (phase === 'ready' && item) {
      track('item_viewed', { item_id: item.id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, item?.id]);

  /* ── Derived group lists ─────────────────────────────────── */
  const visibleGroups = useMemo(() => groups.filter(g => !isHiddenGroup(g)), [groups]);

  const step1Groups = useMemo(
    () => visibleGroups.filter(g =>
      g.selection_type === 'SINGLE_SELECT' && !isPersonalizationGroup(g) && !g.is_upsell_item,
    ),
    [visibleGroups],
  );

  const personGroups = useMemo(() => visibleGroups.filter(isPersonalizationGroup), [visibleGroups]);

  const extrasGroups = useMemo(() => {
    const classified = new Set([
      ...step1Groups.map(g => g.id),
      ...personGroups.map(g => g.id),
    ]);
    return visibleGroups.filter(g => g.is_upsell_item || !classified.has(g.id));
  }, [visibleGroups, step1Groups, personGroups]);

  /* ── Egg and taste options from personalization groups ────── */
  const allPersonOptions = useMemo<RichOption[]>(
    () => personGroups.flatMap(g => g.options.map(o => ({ ...o, groupId: g.id }))),
    [personGroups],
  );

  const eggDoneness = useMemo(
    () => allPersonOptions.filter(o =>
      PERSONALIZATION[o.option_name_th.trim()]?.exclusiveGroup === 'doneness',
    ),
    [allPersonOptions],
  );

  const eggAdditive = useMemo(
    () => allPersonOptions.filter(o => {
      const po = PERSONALIZATION[o.option_name_th.trim()];
      return po?.category === 'egg' && po?.exclusiveGroup !== 'doneness';
    }),
    [allPersonOptions],
  );

  const eggOptions = useMemo(
    () => allPersonOptions.filter(o =>
      (PERSONALIZATION[o.option_name_th.trim()]?.category ?? 'taste') === 'egg',
    ),
    [allPersonOptions],
  );

  const tasteOptions = useMemo(
    () => allPersonOptions.filter(o =>
      (PERSONALIZATION[o.option_name_th.trim()]?.category ?? 'taste') === 'taste',
    ),
    [allPersonOptions],
  );

  /* ── Option rules (server-driven conditional visibility) ───── */
  const optionRules = useMemo(() => {
    if (!item) return [];
    return getOptionRules().filter(r => r.category_id === item.category_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, menuTick]);

  const selectedOptionIds = useMemo(
    () => Object.values(selections).flat(),
    [selections],
  );

  const ruleHiddenIds = useMemo<Set<string>>(() => {
    if (!item) return new Set();
    const hidden = new Set<string>();
    for (const rule of optionRules) {
      if (isOptionRuleHidden(rule.option_id, selectedOptionIds, optionRules, item.category_id)) {
        hidden.add(rule.option_id);
      }
    }
    return hidden;
  }, [item, optionRules, selectedOptionIds]);

  /* Auto-deselect options that become hidden by rules */
  useEffect(() => {
    if (ruleHiddenIds.size === 0) return;
    setSelections(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [gId, optIds] of Object.entries(prev)) {
        const filtered = optIds.filter(id => !ruleHiddenIds.has(id));
        if (filtered.length !== optIds.length) {
          next[gId] = filtered;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleHiddenIds]);

  const visibleEggDoneness = useMemo(
    () => eggDoneness.filter(o => !ruleHiddenIds.has(o.id)),
    [eggDoneness, ruleHiddenIds],
  );
  const visibleEggAdditive = useMemo(
    () => eggAdditive.filter(o => !ruleHiddenIds.has(o.id)),
    [eggAdditive, ruleHiddenIds],
  );
  const visibleEggOptions = useMemo(
    () => eggOptions.filter(o => !ruleHiddenIds.has(o.id)),
    [eggOptions, ruleHiddenIds],
  );

  const visibleTasteOptions = useMemo(
    () => tasteOptions.filter(o => !ruleHiddenIds.has(o.id)),
    [tasteOptions, ruleHiddenIds],
  );

  /* ── Price calculation ────────────────────────────────────── */
  const unitPrice = useMemo(() => {
    if (!item) return 0;
    return item.base_price + groups.reduce((t, g) => {
      return t + (selections[g.id] ?? []).reduce((s, optId) => {
        if (ruleHiddenIds.has(optId)) return s;
        return s + (g.options.find(o => o.id === optId)?.price_adjustment ?? 0);
      }, 0);
    }, 0);
  }, [item, groups, selections, ruleHiddenIds]);

  const total = unitPrice * qty;

  /* ── Selection helpers ────────────────────────────────────── */
  function isSelected(groupId: string, optionId: string) {
    return (selections[groupId] ?? []).includes(optionId);
  }

  function handleSelect(groupId: string, optionId: string, type: 'SINGLE_SELECT' | 'MULTI_SELECT') {
    if (item) track('item_customized', { item_id: item.id, option_id: optionId });
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

  /* Egg doneness — exclusive within group, tap same to deselect */
  function handleEggDoneness(opt: RichOption) {
    if (item) track('item_customized', { item_id: item.id, option_id: opt.id });
    setSelections(prev => {
      const next = { ...prev };
      const cur  = next[opt.groupId] ?? [];
      if (cur.includes(opt.id)) {
        next[opt.groupId] = cur.filter(id => id !== opt.id);
      } else {
        const donenessIds = new Set(
          eggDoneness.filter(o => o.groupId === opt.groupId).map(o => o.id),
        );
        next[opt.groupId] = [...cur.filter(id => !donenessIds.has(id)), opt.id];
      }
      return next;
    });
  }

  /* ── Build cart item ─────────────────────────────────────── */
  function buildCartItem(): CartItem {
    const sizeGroup  = step1Groups.find(isSizeGroup);
    const spiceGroup = step1Groups.find(isSpiceGroup);

    const sizeOpt  = sizeGroup  ? sizeGroup.options.find(o => isSelected(sizeGroup.id, o.id))  : undefined;
    const spiceOpt = spiceGroup ? spiceGroup.options.find(o => isSelected(spiceGroup.id, o.id)) : undefined;

    const addons: { label: string; price: number }[] = [];
    const optionIds: string[] = [];

    // Size and spice go into optionIds (display stays in sizeLabel/spice)
    if (sizeOpt)  optionIds.push(sizeOpt.id);
    if (spiceOpt) optionIds.push(spiceOpt.id);

    for (const g of groups) {
      if (isHiddenGroup(g)) continue;
      if (g.id === sizeGroup?.id || g.id === spiceGroup?.id) continue;
      for (const optId of selections[g.id] ?? []) {
        if (ruleHiddenIds.has(optId)) continue;
        const opt = g.options.find(o => o.id === optId);
        if (opt) {
          addons.push({ label: opt.option_name_th, price: opt.price_adjustment });
          optionIds.push(optId);
        }
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
      optionIds,
      qty,
    };
  }

  const canOrder = item !== null && (item.is_active || (TEST_MODE && item.id === 'test-1baht'));

  /* ── Server-state unavailability ────────────────────────── */
  const isCurrentlyUnavailable = phase === 'ready' && item
    ? (
        isItemUnavailState(item.id) ||
        step1Groups.some(g =>
          g.selection_type === 'SINGLE_SELECT' &&
          g.options.every(o => isOptionUnavailable(o.id))
        )
      )
    : false;

  /* Auto-fix: if a SINGLE_SELECT selection becomes unavailable, pick first available */
  useEffect(() => {
    if (phase !== 'ready') return;
    setSelections(prev => {
      const next = { ...prev };
      let changed = false;
      for (const g of groups) {
        if (isHiddenGroup(g) || g.selection_type !== 'SINGLE_SELECT') continue;
        const cur = prev[g.id] ?? [];
        if (cur.length === 0 || !isOptionUnavailable(cur[0])) continue;
        const firstAvail = g.options.find(o => !isOptionUnavailable(o.id));
        next[g.id] = firstAvail ? [firstAvail.id] : [];
        changed = true;
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuTick, phase]);

  function handleAdd() {
    if (!canOrder || isCurrentlyUnavailable) return;
    if (!isShopOpen) {
      setClosedTapMsg(true);
      setTimeout(() => setClosedTapMsg(false), 3000);
      return;
    }
    const cartItem = buildCartItem();
    if (editCartId) {
      replace(editCartId, cartItem);
    } else {
      add(cartItem);
    }
    track('item_added_to_cart', {
      item_id:    cartItem.itemId,
      qty:        cartItem.qty,
      option_ids: cartItem.optionIds,
      unit_price: unitPrice,
      source:     editCartId ? 'edit' : 'sheet',
    });
    close();
  }

  /* ── Summary strings ─────────────────────────────────────── */
  const sizeGroup  = step1Groups.find(isSizeGroup);
  const spiceGroup = step1Groups.find(isSpiceGroup);

  const selSizeOpt  = sizeGroup  ? sizeGroup.options.find(o => isSelected(sizeGroup.id, o.id))  : undefined;
  const selSpiceOpt = spiceGroup ? spiceGroup.options.find(o => isSelected(spiceGroup.id, o.id)) : undefined;
  const hasSizes    = !!sizeGroup && sizeGroup.options.length > 1;

  const selSizeLabel = selSizeOpt
    ? (lang === 'en' ? cleanLabel(selSizeOpt.option_name_en || selSizeOpt.option_name_th) : cleanLabel(selSizeOpt.option_name_th))
    : '';

  const selSpiceLabel = selSpiceOpt
    ? (lang === 'en' ? cleanLabel(selSpiceOpt.option_name_en || selSpiceOpt.option_name_th) : cleanLabel(selSpiceOpt.option_name_th))
    : '';

  /* Spice label for inline header display */
  const selSpiceDisplay = selSpiceOpt
    ? (() => {
        const idx = spiceIndex(selSpiceOpt.option_name_th);
        if (lang === 'en') return idx >= 0 ? SPICE_EN[idx] : cleanLabel(selSpiceOpt.option_name_en || selSpiceOpt.option_name_th);
        return idx >= 0 ? SPICE_TH[idx] : cleanLabel(selSpiceOpt.option_name_th);
      })()
    : '';

  const selectedPersonLabels = allPersonOptions
    .filter(o => isSelected(o.groupId, o.id) && !ruleHiddenIds.has(o.id))
    .map(o => {
      const po = PERSONALIZATION[o.option_name_th.trim()];
      return lang === 'en'
        ? (po?.labelEn ?? cleanLabel(o.option_name_en || o.option_name_th))
        : (po?.labelTh ?? cleanLabel(o.option_name_th));
    });

  const hasAnyPersonSelection = selectedPersonLabels.length > 0;
  const eggAllFree   = visibleEggOptions.every(o => o.price_adjustment === 0);
  const tasteAllFree = visibleTasteOptions.every(o => o.price_adjustment === 0);

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

        {/* Header strip — drag handle + close, not part of scroll area */}
        <div style={{
          flexShrink: 0, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          borderBottom: '1px solid var(--line)',
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(43,33,24,0.20)',
          }} />
          <button
            onClick={close}
            style={{
              position: 'absolute', right: 6,
              width: 44, height: 44, borderRadius: '50%',
              background: 'transparent', border: 'none',
              display: 'grid', placeItems: 'center', color: 'var(--ink-3)',
            }}
          >{I.close(18)}</button>
        </div>

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
                  <strong style={{ color: 'var(--ink)' }}>{shopClosedMsg}</strong>
                </div>
              )}

              {/* Image area — max ~35% sheet height, object-contain */}
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
                      {t('detail.notAvailable')}
                    </div>
                    <button
                      onClick={close}
                      style={{
                        background: 'var(--bg-3)', border: '1px solid var(--line)',
                        padding: '11px 22px', borderRadius: 'var(--r-pill)',
                        fontSize: 13, color: 'var(--ink-2)',
                      }}
                    >{t('detail.backToMenu')}</button>
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
                    {(lang === 'en' ? (item.description_en || item.description_th) : item.description_th) && (
                      <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                        {lang === 'en' ? (item.description_en || item.description_th) : item.description_th}
                      </div>
                    )}

                    {/* Step 1 option groups */}
                    {step1Groups.map(g => {
                      const isSpice = isSpiceGroup(g);
                      const isSize  = isSizeGroup(g);
                      const selectedIds = selections[g.id] ?? [];

                      const labelTh = isSize ? t('detail.size') : isSpice ? t('detail.spiceLevel') : cleanLabel(g.group_name_th);
                      const labelEn = isSize ? t('detail.size') : isSpice ? t('detail.spiceLevel') : (cleanLabel(g.group_name_en) || labelTh);
                      const groupLabel = lang === 'en' ? labelEn : labelTh;

                      /* Size: sort price=0 first, then ascending */
                      const displayOpts = isSize
                        ? [...g.options].sort((a, b) => a.price_adjustment - b.price_adjustment || a.display_order - b.display_order)
                        : isSpice
                          ? [...g.options].sort((a, b) => {
                              const ia = spiceIndex(a.option_name_th);
                              const ib = spiceIndex(b.option_name_th);
                              if (ia >= 0 && ib >= 0) return ia - ib;
                              if (ia >= 0) return -1;
                              if (ib >= 0) return 1;
                              return a.display_order - b.display_order;
                            })
                          : g.options;

                      return (
                        <div key={g.id} style={{ marginTop: 22 }}>
                          {/* Group header */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                              {groupLabel}
                            </span>
                            {isSpice && selSpiceDisplay ? (
                              <span style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--serif)' }}>
                                {selSpiceDisplay}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('detail.required')}</span>
                            )}
                          </div>

                          {/* Spice: 5-column grid, equal cells, no wrap */}
                          {isSpice ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                              {displayOpts.filter(opt => !ruleHiddenIds.has(opt.id)).map(opt => {
                                const sel    = selectedIds.includes(opt.id);
                                const optOut = isOptionUnavailable(opt.id);
                                const idx    = spiceIndex(opt.option_name_th);
                                const label  = lang === 'en'
                                  ? (idx >= 0 ? SPICE_EN[idx] : cleanLabel(opt.option_name_en || opt.option_name_th))
                                  : (idx >= 0 ? SPICE_TH[idx] : cleanLabel(opt.option_name_th));
                                const chiliCount = idx >= 0 ? idx : 0;

                                return (
                                  <motion.button
                                    key={opt.id}
                                    whileTap={prefersReduced || optOut ? undefined : { scale: 0.93 }}
                                    onClick={optOut ? undefined : () => handleSelect(g.id, opt.id, 'SINGLE_SELECT')}
                                    aria-disabled={optOut}
                                    style={{
                                      display: 'flex', flexDirection: 'column',
                                      alignItems: 'center', justifyContent: 'center',
                                      padding: '8px 2px', minHeight: 54,
                                      borderRadius: 'var(--r-md)',
                                      border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                                      background: sel ? 'rgba(181,81,30,0.07)' : 'var(--bg)',
                                      color: sel ? 'var(--accent)' : 'var(--ink-3)',
                                      gap: 4,
                                      opacity: optOut ? 0.35 : 1,
                                      cursor: optOut ? 'default' : undefined,
                                    }}
                                  >
                                    <div style={{
                                      display: 'flex', gap: 1, minHeight: 10,
                                      color: sel ? 'var(--accent)' : 'var(--ink-3)',
                                    }}>
                                      {chiliCount === 0
                                        ? <span style={{ fontSize: 9, opacity: 0.35 }}>—</span>
                                        : Array.from({ length: chiliCount }).map((_, j) => (
                                            <span key={j}>{I.chili(9)}</span>
                                          ))
                                      }
                                    </div>
                                    <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}>
                                      {optOut ? t('menu.optionUnavailable') : label}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          ) : (
                            /* Size / other mandatory single: pill row */
                            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                              {displayOpts.filter(opt => !ruleHiddenIds.has(opt.id)).map(opt => {
                                const sel    = selectedIds.includes(opt.id);
                                const optOut = isOptionUnavailable(opt.id);
                                const label  = lang === 'en'
                                  ? (cleanLabel(opt.option_name_en) || cleanLabel(opt.option_name_th))
                                  : cleanLabel(opt.option_name_th);
                                const isLarge = isSize && opt.price_adjustment > 0;
                                return (
                                  <motion.button
                                    key={opt.id}
                                    whileTap={prefersReduced || optOut ? undefined : { scale: 0.94 }}
                                    onClick={optOut ? undefined : () => handleSelect(g.id, opt.id, 'SINGLE_SELECT')}
                                    aria-disabled={optOut}
                                    style={{
                                      padding: '9px 14px', borderRadius: 'var(--r-pill)',
                                      border: sel ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                                      background: sel ? 'var(--bg-2)' : 'var(--bg)',
                                      color: sel ? 'var(--ink)' : 'var(--ink-2)',
                                      fontSize: 13, fontFamily: 'var(--serif)',
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      minHeight: 44,
                                      opacity: optOut ? 0.35 : 1,
                                      cursor: optOut ? 'default' : undefined,
                                    }}
                                  >
                                    {isSize && (
                                      <span style={{ opacity: sel ? 0.9 : 0.45, flexShrink: 0 }}>
                                        {isLarge ? I.bowlLg(16) : I.bowlMd(13)}
                                      </span>
                                    )}
                                    {sel && !optOut && <span style={{ color: 'var(--accent)', fontSize: 10 }}>{I.check(10)}</span>}
                                    <span>{label}</span>
                                    {optOut
                                      ? <span style={{ fontSize: 11, opacity: 0.8 }}>{t('menu.optionUnavailable')}</span>
                                      : opt.price_adjustment > 0 && (
                                          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>+฿{opt.price_adjustment}</span>
                                        )
                                    }
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ height: 24 }} />
                  </>
                )}
              </div>
            </div>

            {/* ══ PANEL 2: PERSONALIZATION + SUMMARY ══════ */}
            <div style={{
              width: '50%', flexShrink: 0, height: '100%',
              overflowY: 'auto',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              WebkitOverflowScrolling: 'touch' as any,
            }}>
              <div style={{ padding: '28px 20px 12px' }}>

                {/* 1) Brand moment */}
                <div style={{ marginBottom: 28 }}>
                  <span style={{
                    display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.12em',
                    color: 'var(--gold)', marginBottom: 8,
                  }}>{t('detail.kicker')}</span>

                  <div style={{
                    fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, lineHeight: 1.2,
                    color: 'var(--ink)', marginBottom: 12,
                  }}>{t('detail.headline')}</div>

                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.75 }}>
                    {t('detail.philoP1')}
                  </div>
                  <div style={{ height: 10 }} />
                  <em style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>
                    {t('detail.philoClose')}
                  </em>
                </div>

                {/* 2) Group A — ไข่ดาวที่คุณชอบ (hidden until egg add-on selected) */}
                <AnimatePresence>
                {visibleEggOptions.length > 0 && (
                  <motion.div
                    key="egg-group"
                    initial={prefersReduced ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={prefersReduced ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{ overflow: 'hidden', marginBottom: 28 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t('detail.eggTitle')}</span>
                      {eggAllFree && (
                        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('detail.noExtraCharge')}</span>
                      )}
                    </div>

                    {/* Doneness — exclusive, tap same to deselect */}
                    {visibleEggDoneness.length > 0 && (
                      <div style={{
                        display: 'flex', gap: 6, flexWrap: 'wrap',
                        marginBottom: visibleEggAdditive.length > 0 ? 8 : 0,
                      }}>
                        {visibleEggDoneness.map(opt => {
                          const sel    = isSelected(opt.groupId, opt.id);
                          const optOut = isOptionUnavailable(opt.id);
                          const po     = PERSONALIZATION[opt.option_name_th.trim()];
                          const label  = lang === 'en'
                            ? (po?.labelEn ?? cleanLabel(opt.option_name_en || opt.option_name_th))
                            : (po?.labelTh ?? cleanLabel(opt.option_name_th));
                          return (
                            <motion.button
                              key={opt.id}
                              whileTap={prefersReduced || optOut ? undefined : { scale: 0.94 }}
                              onClick={optOut ? undefined : () => handleEggDoneness(opt)}
                              aria-disabled={optOut}
                              style={{
                                minHeight: 38, padding: '7px 12px', borderRadius: 'var(--r-pill)',
                                border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                                background: sel ? 'rgba(181,81,30,0.08)' : 'var(--bg)',
                                color: sel ? 'var(--accent)' : 'var(--ink-2)',
                                fontSize: 13, fontFamily: 'var(--serif)',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                opacity: optOut ? 0.35 : 1,
                                cursor: optOut ? 'default' : undefined,
                              }}
                            >
                              {sel && !optOut && (
                                <motion.span
                                  initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  style={{ fontSize: 10 }}
                                >{I.check(10)}</motion.span>
                              )}
                              {label}
                              {optOut && <span style={{ fontSize: 10, opacity: 0.8 }}>{t('menu.optionUnavailable')}</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Additive egg chips — multi-select */}
                    {visibleEggAdditive.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {visibleEggAdditive.map(opt => {
                          const sel    = isSelected(opt.groupId, opt.id);
                          const optOut = isOptionUnavailable(opt.id);
                          const po     = PERSONALIZATION[opt.option_name_th.trim()];
                          const label  = lang === 'en'
                            ? (po?.labelEn ?? cleanLabel(opt.option_name_en || opt.option_name_th))
                            : (po?.labelTh ?? cleanLabel(opt.option_name_th));
                          return (
                            <motion.button
                              key={opt.id}
                              whileTap={prefersReduced || optOut ? undefined : { scale: 0.94 }}
                              onClick={optOut ? undefined : () => handleSelect(opt.groupId, opt.id, 'MULTI_SELECT')}
                              aria-disabled={optOut}
                              style={{
                                minHeight: 38, padding: '7px 12px', borderRadius: 'var(--r-pill)',
                                border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                                background: sel ? 'rgba(181,81,30,0.08)' : 'var(--bg)',
                                color: sel ? 'var(--accent)' : 'var(--ink-2)',
                                fontSize: 13, fontFamily: 'var(--serif)',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                opacity: optOut ? 0.35 : 1,
                                cursor: optOut ? 'default' : undefined,
                              }}
                            >
                              {sel && !optOut && (
                                <motion.span
                                  initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  style={{ fontSize: 10 }}
                                >{I.check(10)}</motion.span>
                              )}
                              {label}
                              {optOut && <span style={{ fontSize: 10, opacity: 0.8 }}>{t('menu.optionUnavailable')}</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>

                {/* 3) Group B — รสชาติในแบบคุณ */}
                <AnimatePresence>
                {visibleTasteOptions.length > 0 && (
                  <motion.div
                    key="taste-group"
                    initial={prefersReduced ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={prefersReduced ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{ overflow: 'hidden', marginBottom: 28 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t('detail.tasteTitle')}</span>
                      {tasteAllFree && (
                        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('detail.noExtraCharge')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {visibleTasteOptions.map(opt => {
                        const sel    = isSelected(opt.groupId, opt.id);
                        const optOut = isOptionUnavailable(opt.id);
                        const po     = PERSONALIZATION[opt.option_name_th.trim()];
                        const label  = lang === 'en'
                          ? (po?.labelEn ?? cleanLabel(opt.option_name_en || opt.option_name_th))
                          : (po?.labelTh ?? cleanLabel(opt.option_name_th));
                        return (
                          <motion.button
                            key={opt.id}
                            whileTap={prefersReduced || optOut ? undefined : { scale: 0.94 }}
                            onClick={optOut ? undefined : () => handleSelect(opt.groupId, opt.id, 'MULTI_SELECT')}
                            aria-disabled={optOut}
                            style={{
                              minHeight: 38, padding: '7px 12px', borderRadius: 'var(--r-pill)',
                              border: sel ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                              background: sel ? 'rgba(181,81,30,0.06)' : 'var(--bg)',
                              color: sel ? 'var(--accent)' : 'var(--ink-2)',
                              fontSize: 13, fontFamily: 'var(--serif)',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              opacity: optOut ? 0.35 : 1,
                              cursor: optOut ? 'default' : undefined,
                            }}
                          >
                            {sel && !optOut && (
                              <motion.span
                                initial={prefersReduced ? false : { scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ fontSize: 10 }}
                              >{I.check(10)}</motion.span>
                            )}
                            {label}
                            {optOut && <span style={{ fontSize: 10, opacity: 0.8 }}>{t('menu.optionUnavailable')}</span>}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>

                {/* 4) เพิ่มเติมให้มื้อนี้ — single heading, flat chip list, no sub-group labels */}
                {extrasGroups.some(g => g.options.some(opt => !ruleHiddenIds.has(opt.id))) && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 1, background: 'var(--line)', marginBottom: 16 }} />
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--ink-3)', marginBottom: 12,
                    }}>{t('detail.extrasTitle')}</div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {extrasGroups.flatMap(g =>
                        g.options.filter(opt => !ruleHiddenIds.has(opt.id)).map(opt => {
                          const sel    = (selections[g.id] ?? []).includes(opt.id);
                          const optOut = isOptionUnavailable(opt.id);
                          const label  = lang === 'en'
                            ? (cleanLabel(opt.option_name_en) || cleanLabel(opt.option_name_th))
                            : cleanLabel(opt.option_name_th);
                          return (
                            <motion.button
                              key={opt.id}
                              whileTap={prefersReduced || optOut ? undefined : { scale: 0.94 }}
                              onClick={optOut ? undefined : () => handleSelect(g.id, opt.id, g.selection_type)}
                              aria-disabled={optOut}
                              style={{
                                minHeight: 40, padding: '8px 12px', borderRadius: 'var(--r-pill)',
                                border: sel ? '1.5px solid var(--ink-2)' : '1px solid var(--line)',
                                background: sel ? 'var(--bg-3)' : 'var(--bg)',
                                color: sel ? 'var(--ink-2)' : 'var(--ink-3)',
                                fontSize: 12, fontFamily: 'var(--serif)',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                opacity: optOut ? 0.35 : 1,
                                cursor: optOut ? 'default' : undefined,
                              }}
                            >
                              {sel && !optOut && <span style={{ fontSize: 10 }}>{I.check(10)}</span>}
                              {label}
                              {optOut
                                ? <span style={{ fontSize: 10, opacity: 0.8 }}>{t('menu.optionUnavailable')}</span>
                                : opt.price_adjustment > 0 && (
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
                                      +฿{opt.price_adjustment}
                                    </span>
                                  )
                              }
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 6) Summary — blended, thin line, no colored card */}
                {phase === 'ready' && item && canOrder && (
                  <div style={{ marginTop: 32 }}>
                    <div style={{ height: 1, background: 'var(--line)', marginBottom: 14 }} />
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>
                      {t('detail.summaryReady')}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '.12em',
                      color: 'var(--ink-3)', marginBottom: 6,
                    }}>{t('detail.summaryTitle')}</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>
                      {lang === 'en' ? item.name_en : item.name_th}
                    </div>
                    {(selSpiceLabel || (hasSizes && selSizeLabel)) && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}>
                        {[selSpiceLabel, hasSizes ? selSizeLabel : ''].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {selectedPersonLabels.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
                        {selectedPersonLabels.join(' · ')}
                      </div>
                    )}
                    <em style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)' }}>
                      {hasAnyPersonSelection ? t('detail.summaryTaglineCustom') : t('detail.summaryTaglineDefault')}
                    </em>
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
              /* Step 1 footer: price left + primary button */
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                  ฿{unitPrice}
                </span>
                <motion.button
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  onClick={() => setStep('make-it-yours')}
                  style={{
                    flex: 1, minHeight: 50, borderRadius: 'var(--r-pill)',
                    background: 'var(--ink)', color: 'var(--on-accent)',
                    border: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '10px 16px', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t('detail.nextBtn')} {I.arrow(13)}
                  </span>
                  {lang === 'th' && t('detail.nextBtnSub') && (
                    <span style={{ fontSize: 10, opacity: 0.5, fontWeight: 400 }}>
                      {t('detail.nextBtnSub')}
                    </span>
                  )}
                </motion.button>
              </div>
            ) : (
              /* Step 2 footer: ← back + qty + add to cart */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setStep('essentials')}
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'var(--bg-3)', border: '1px solid var(--line)',
                      display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
                      flexShrink: 0,
                    }}
                  >{I.back(18)}</button>

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

                  <motion.button
                    whileTap={prefersReduced || isCurrentlyUnavailable ? undefined : { scale: 0.97 }}
                    onClick={isCurrentlyUnavailable ? undefined : handleAdd}
                    aria-disabled={isCurrentlyUnavailable}
                    style={{
                      flex: 1, height: 50, borderRadius: 'var(--r-pill)',
                      background: (isShopOpen && !isCurrentlyUnavailable) ? 'var(--accent)' : 'var(--bg-3)',
                      color: (isShopOpen && !isCurrentlyUnavailable) ? '#fff' : 'var(--ink-3)',
                      border: (isShopOpen && !isCurrentlyUnavailable) ? 'none' : '1px solid var(--line)',
                      fontSize: 13, fontWeight: 600,
                      cursor: isCurrentlyUnavailable ? 'default' : undefined,
                    }}
                  >{isCurrentlyUnavailable ? t('menu.unavailable') : t('detail.addToCart', total)}</motion.button>
                </div>

                {/* Closed tap message */}
                {closedTapMsg && (
                  <div style={{
                    marginTop: 8, textAlign: 'center',
                    fontSize: 12, color: 'var(--ink-3)',
                  }}>
                    {shopClosedMsg}
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
