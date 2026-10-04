import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useCart, cartTotal, itemTotal, type CartItem } from '../store/cart';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { ProductSheet } from '../components/menu/ProductSheet';
import { useT } from '../i18n';
import { supabase } from '../lib/supabase';
import { computeSlots } from '../config/shop';
import { TEST_MODE } from '../config/env';

/* ── Drinks ──────────────────────────────────────────────── */
const DRINKS_CAT_NAME_TH = 'เครื่องดื่ม';

type DrinkItem = {
  id: string; name_th: string; name_en: string;
  base_price: number; image_url: string | null;
};

/* ── Warm glow (same as menu page) ──────────────────────── */
const GLOW = 'radial-gradient(circle at 50% 50%, rgba(255,215,120,0.30) 0%, rgba(251,243,227,0.12) 55%, transparent 78%)';

/* ── Cart item summary ───────────────────────────────────── */
function ItemSummary({ it }: { it: CartItem }) {
  const line2 = [it.sizeLabel, it.spice].filter(Boolean);
  const free  = it.addons.filter(a => a.price === 0);
  const paid  = it.addons.filter(a => a.price > 0);
  return (
    <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.65 }}>
      {line2.length > 0 && <div>{line2.join(' · ')}</div>}
      {free.length > 0 && (
        <>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.10em', color: 'var(--gold)', marginTop: 2, marginBottom: 1 }}>
            YOUR BEST PART
          </div>
          <div>{free.map(a => a.label).join(' · ')}</div>
        </>
      )}
      {paid.length > 0 && <div>{paid.map(a => `${a.label} +฿${a.price}`).join(' · ')}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CART PAGE
══════════════════════════════════════════════════════════ */
export default function Cart() {
  const navigate       = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReduced = useReducedMotion();
  const { t, lang }    = useT();

  const {
    items, remove, setQty, clear, add,
    cutlery, condiments, setCutlery, setCondiments,
    kitchenNote, setKitchenNote,
  } = useCart();

  const method   = searchParams.get('method') ?? 'takeaway';
  const isDineIn = method === 'dine-in';
  const total    = cartTotal(items);

  /* ProductSheet: item param opens sheet (editCartId read by ProductSheet) */
  const itemId = searchParams.get('item');

  /* Shop info for ProductSheet */
  const [shopInfo] = useState(() => {
    const base = computeSlots();
    if (!TEST_MODE) return base;
    const slots = base.slots.length > 0
      ? base.slots
      : [{ label: 'พร้อมเร็วสุด', sub: `~12 นาที`, value: null, isAsap: true as const }];
    return { isOpen: true, slots, nextOpenMsg: '' };
  });

  /* Drinks */
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  useEffect(() => {
    supabase.from('categories').select('id').eq('name_th', DRINKS_CAT_NAME_TH).limit(1)
      .then(({ data: cats }) => {
        if (!cats?.[0]) return;
        supabase.from('menu_items')
          .select('id, name_th, name_en, base_price, image_url')
          .eq('category_id', cats[0].id).eq('is_active', true).order('display_order')
          .then(({ data }) => { if (data) setDrinks(data as DrinkItem[]); });
      });
  }, []);

  /* Undo */
  const [undoItem, setUndoItem] = useState<CartItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function removeWithUndo(it: CartItem) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoItem(it);
    remove(it.cartId);
    undoTimer.current = setTimeout(() => setUndoItem(null), 4000);
  }
  function handleUndo() {
    if (!undoItem) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    add(undoItem);
    setUndoItem(null);
  }
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  /* Clear confirmation */
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  /* Drink helpers */
  const drinkQty = (id: string) =>
    items.filter(it => it.itemId === id).reduce((s, it) => s + it.qty, 0);

  function addDrink(drink: DrinkItem) {
    const existing = items.find(it => it.itemId === drink.id && it.isDrink);
    if (existing) { setQty(existing.cartId, existing.qty + 1); return; }
    add({
      cartId: `${drink.id}-${Date.now()}`, itemId: drink.id,
      name: drink.name_th, nameEn: drink.name_en,
      tone: 'clay', topping: 'egg', imageUrl: drink.image_url ?? undefined,
      basePrice: drink.base_price, sizeLabel: '', sizePrice: 0,
      spice: '', addons: [], qty: 1, isDrink: true,
    });
  }
  function decDrink(drink: DrinkItem) {
    const existing = items.find(it => it.itemId === drink.id && it.isDrink);
    if (!existing) return;
    existing.qty <= 1 ? remove(existing.cartId) : setQty(existing.cartId, existing.qty - 1);
  }

  /* Kitchen note */
  const [noteExpanded, setNoteExpanded] = useState(() => kitchenNote.length > 0);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  function handleNoteChange(val: string) {
    const trimmed = val.trimStart().slice(0, 200);
    setKitchenNote(trimmed);
    if (noteRef.current) {
      noteRef.current.style.height = 'auto';
      noteRef.current.style.height = Math.min(noteRef.current.scrollHeight, 100) + 'px';
    }
  }

  /* ── EMPTY STATE ─────────────────────────────────────────── */
  if (items.length === 0 && !undoItem) {
    return (
      <div className="page" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
          <button onClick={() => navigate('/order')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
            {I.back(22)}
          </button>
          <div style={{ flex: 1 }}>
            <div className="kicker">{t('cart.header')}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>{t('cart.header.emptySub')}</div>
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', gap: 12, textAlign: 'center', padding: '0 32px',
        }}>
          <div style={{ fontSize: 40, opacity: 0.25, color: 'var(--ink-3)' }}>{I.bag(40)}</div>
          <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>{t('cart.header.emptyTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{t('cart.emptyMsg')}</div>
          <button
            onClick={() => navigate('/order')}
            style={{
              marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
              border: 0, padding: '12px 24px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13,
            }}
          >{t('cart.emptyBtn')} {I.arrow(14)}</button>
        </div>
        <TabBar active="menu" />
      </div>
    );
  }

  /* ── Round button for drink stepper ─────────────────────── */
  const roundBtn: React.CSSProperties = {
    width: 24, height: 24, borderRadius: '50%',
    background: 'var(--ink)', color: 'var(--on-accent)',
    border: 0, display: 'grid', placeItems: 'center',
    cursor: 'pointer', flexShrink: 0,
  };

  /* ── FULL CART ───────────────────────────────────────────── */
  return (
    <div className="page" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 116px)' }}>

      {/* Header */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}
      >
        <button onClick={() => navigate('/order')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
          {I.back(22)}
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">{t('cart.header')}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>
            {t('cart.items', items.reduce((s, i) => s + i.qty, 0))}
          </div>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 0, padding: 0 }}
        >{t('cart.clearAll')}</button>
      </motion.div>

      {/* ── 1. Cart lines ────────────────────────────────────── */}
      <div style={{ padding: '4px 18px 0' }}>
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.div
              key={it.cartId}
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.18 }}
              style={{
                display: 'flex', gap: 10, padding: '14px 0',
                borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              {/* Image — frameless, warm glow */}
              <div style={{
                width: 80, height: 80, flexShrink: 0,
                background: GLOW,
                display: 'grid', placeItems: 'center',
              }}>
                {it.imageUrl ? (
                  <img src={it.imageUrl} alt={it.name}
                    style={{ width: 74, height: 74, objectFit: 'contain' }}
                  />
                ) : (
                  <Bowl tone={it.tone} topping={it.topping} size={68} />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.2 }}>
                  {lang === 'en' ? it.nameEn : it.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
                  {lang === 'en' ? it.name : it.nameEn}
                </div>

                <ItemSummary it={it} />

                {/* Qty stepper + price */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', background: 'var(--bg-2)',
                  }}>
                    <button
                      onClick={() => it.qty <= 1 ? removeWithUndo(it) : setQty(it.cartId, it.qty - 1)}
                      style={{ width: 32, height: 32, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}
                    >{it.qty <= 1 ? I.trash(14) : I.minus(14)}</button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 14 }}>{it.qty}</span>
                    <button
                      onClick={() => setQty(it.cartId, it.qty + 1)}
                      style={{ width: 32, height: 32, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
                    >{I.plus(14)}</button>
                  </div>
                  <span className="price thb" style={{ fontSize: 16 }}>{itemTotal(it)}</span>
                </div>

                {/* Edit button — food items only */}
                {!it.isDrink && (
                  <button
                    onClick={() => setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.set('item', it.itemId);
                      next.set('editCartId', it.cartId);
                      return next;
                    })}
                    style={{
                      marginTop: 6, background: 'none',
                      border: '1px solid var(--line)',
                      padding: '0 10px', borderRadius: 'var(--r-pill)',
                      fontSize: 11, color: 'var(--ink-2)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      minHeight: 28,
                    }}
                  >
                    {I.pencil(11)} {t('cart.editLabel')}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Undo toast */}
      <AnimatePresence>
        {undoItem && (
          <motion.div
            key="undo"
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              margin: '8px 18px 0', padding: '10px 14px',
              borderRadius: 'var(--r-md)', background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12, color: 'var(--ink-2)',
            }}
          >
            <span>{t('cart.removedMsg')}</span>
            <button
              onClick={handleUndo}
              style={{ background: 'none', border: 0, padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}
            >{t('cart.undoLabel')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. Drinks rail ───────────────────────────────────── */}
      {drinks.length > 0 && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.04 }}
          style={{ marginTop: 20 }}
        >
          <div style={{ padding: '0 18px', marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              {t('cart.drinksSection')}
            </div>
          </div>

          {/* ≤3 → full-width equal row; >3 → horizontal scroll */}
          <div style={drinks.length <= 3
            ? { padding: '0 18px', display: 'flex', gap: 10 }
            : { display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: 18, paddingRight: 18 }
          }>
            {drinks.map(drink => {
              const count = drinkQty(drink.id);
              const cardStyle: React.CSSProperties = drinks.length <= 3
                ? { flex: 1 }
                : { flexShrink: 0, width: 96 };

              return (
                <div key={drink.id} style={cardStyle}>
                  {/* Glow + image (square aspect ratio, fixed height prevents overflow onto text) */}
                  <div style={{
                    width: '100%', paddingTop: '100%', position: 'relative',
                    background: GLOW, borderRadius: 10,
                  }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                      {drink.image_url ? (
                        <img src={drink.image_url} alt={lang === 'en' ? drink.name_en : drink.name_th}
                          style={{ width: '78%', height: '78%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ opacity: 0.18, color: 'var(--ink-3)' }}>{I.bag(28)}</span>
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: 12, fontFamily: 'var(--serif)', lineHeight: 1.25, marginTop: 5, color: 'var(--ink)' }}>
                    {lang === 'en' ? drink.name_en : drink.name_th}
                  </div>

                  {/* Price + stepper (fixed-height row so all cards are equal) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 4, minHeight: 28,
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                      ฿{drink.base_price}
                    </span>
                    {count > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <motion.button
                          whileTap={prefersReduced ? undefined : { scale: 0.88 }}
                          onClick={() => decDrink(drink)} style={roundBtn}
                        >{I.minus(10)}</motion.button>
                        <span style={{ minWidth: 14, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{count}</span>
                        <motion.button
                          whileTap={prefersReduced ? undefined : { scale: 0.88 }}
                          onClick={() => addDrink(drink)} style={roundBtn}
                        >{I.plus(10)}</motion.button>
                      </div>
                    ) : (
                      <motion.button
                        whileTap={prefersReduced ? undefined : { scale: 0.88 }}
                        onClick={() => addDrink(drink)} style={roundBtn}
                      >{I.plus(13)}</motion.button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── 3. Cutlery & condiments — hidden for dine-in ──────── */}
      {!isDineIn && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.06 }}
          style={{ margin: '20px 18px 0', paddingTop: 14, borderTop: '1px solid var(--line)' }}
        >
          <div style={{ fontSize: 10, letterSpacing: '.05em', color: 'var(--ink-3)', marginBottom: 10 }}>
            {t('cart.cutlerySection')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Cutlery chip */}
            <button
              onClick={() => setCutlery(!cutlery)}
              style={{
                flex: 1, minHeight: 40, borderRadius: 'var(--r-pill)',
                border: cutlery ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                background: cutlery ? 'var(--ink)' : 'transparent',
                color: cutlery ? 'var(--on-accent)' : 'var(--ink-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {cutlery && <span style={{ color: 'var(--on-accent)' }}>{I.check(11)}</span>}
              <span style={{ color: cutlery ? 'var(--on-accent)' : 'var(--ink-3)' }}>{I.fork(13)}</span>
              <span>{t('cart.cutleryChip')}</span>
            </button>

            {/* Condiments chip */}
            <button
              onClick={() => setCondiments(!condiments)}
              style={{
                flex: 1, minHeight: 40, borderRadius: 'var(--r-pill)',
                border: condiments ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                background: condiments ? 'var(--ink)' : 'transparent',
                color: condiments ? 'var(--on-accent)' : 'var(--ink-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {condiments && <span style={{ color: 'var(--on-accent)' }}>{I.check(11)}</span>}
              <span style={{ color: condiments ? 'var(--on-accent)' : 'var(--ink-3)' }}>{I.sauce(13)}</span>
              <span>{t('cart.condimentsChip')}</span>
            </button>
          </div>
          {/* TODO(session3): send cutlery/condiments to orders INSERT */}
        </motion.div>
      )}

      {/* ── 4. Kitchen note ──────────────────────────────────── */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.07 }}
        style={{ margin: '16px 18px 0', paddingTop: 14, borderTop: '1px solid var(--line)' }}
      >
        <div style={{ fontSize: 10, letterSpacing: '.05em', color: 'var(--ink-3)', marginBottom: 8 }}>
          {t('cart.kitchenNoteTitle')}
        </div>

        {noteExpanded ? (
          <div style={{ position: 'relative' }}>
            <textarea
              ref={noteRef}
              autoFocus
              value={kitchenNote}
              onChange={e => handleNoteChange(e.target.value)}
              onBlur={() => { if (!kitchenNote.trim()) { setNoteExpanded(false); } }}
              placeholder={t('cart.kitchenNotePlaceholder')}
              maxLength={200}
              rows={2}
              style={{
                width: '100%', resize: 'none', boxSizing: 'border-box',
                background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)', padding: '10px 12px',
                fontSize: 13, fontFamily: 'var(--sans)', color: 'var(--ink)',
                outline: 'none', lineHeight: 1.55,
                paddingBottom: 22, /* room for counter */
              }}
            />
            <span style={{
              position: 'absolute', bottom: 7, right: 10,
              fontSize: 9, color: 'var(--ink-3)',
              pointerEvents: 'none',
            }}>{kitchenNote.length}/200</span>
          </div>
        ) : (
          <button
            onClick={() => setNoteExpanded(true)}
            style={{
              width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)', padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'text', textAlign: 'left',
            }}
          >
            <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{I.notepad(14)}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('cart.kitchenNotePlaceholder')}</span>
          </button>
        )}
        {/* TODO(session3/4): trim and escape kitchen note before sending to DB/Telegram */}
      </motion.div>

      {/* ── 5. Total ─────────────────────────────────────────── */}
      <div style={{ padding: '20px 18px 0' }}>
        <div style={{ height: 1, background: 'var(--line)', marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{t('cart.totalLabel')}</span>
          <span className="thb price" style={{ fontSize: 24 }}>{total}</span>
        </div>
      </div>

      {/* Sticky checkout button */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: `14px 18px calc(env(safe-area-inset-bottom, 0px) + 14px)`,
        background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
      }}>
        <button
          onClick={() => navigate('/checkout')}
          style={{
            width: '100%', background: 'var(--ink)', color: 'var(--on-accent)',
            border: 0, padding: '16px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{t('cart.continueBtn', total)}</span>
          <span>{I.arrow(14)}</span>
        </button>
      </div>

      {/* Clear confirmation sheet */}
      <AnimatePresence>
        {showClearConfirm && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(43,33,24,0.48)' }}
            />
            <motion.div
              key="sheet"
              initial={prefersReduced ? false : { y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              style={{
                position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '100%', maxWidth: 480, zIndex: 91,
                background: 'var(--bg)', borderRadius: '20px 20px 0 0',
                padding: '24px 20px calc(env(safe-area-inset-bottom, 0px) + 32px)',
              }}
            >
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 6 }}>{t('cart.clearConfirmTitle')}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 24 }}>{t('cart.clearConfirmMsg')}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-pill)', background: 'var(--bg-3)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer' }}
                >{t('cart.clearConfirmCancel')}</button>
                <button
                  onClick={() => { clear(); setShowClearConfirm(false); setUndoItem(null); }}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-pill)', background: 'var(--accent)', border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                >{t('cart.clearConfirmOk')}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ProductSheet — edit mode */}
      {itemId && (
        <ProductSheet isShopOpen={shopInfo.isOpen} shopNextOpen={shopInfo.nextOpenMsg} />
      )}
    </div>
  );
}
