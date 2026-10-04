import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useCart, cartTotal, itemTotal, type CartItem } from '../store/cart';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { ProductSheet } from '../components/menu/ProductSheet';
import { useLang } from '../store/lang';
import { LANG_MAP } from '../config/lang';
import { supabase } from '../lib/supabase';
import { computeSlots } from '../config/shop';
import { TEST_MODE } from '../config/env';

/* ── Drinks category identifier ─────────────────────────── */
const DRINKS_CAT_NAME_TH = 'เครื่องดื่ม';

type DrinkItem = {
  id: string;
  name_th: string;
  name_en: string;
  base_price: number;
  image_url: string | null;
};

/* ── Simple toggle ───────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none',
        background: value ? 'var(--accent-2)' : 'var(--bg-3)',
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.18s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s',
        display: 'block',
      }} />
    </button>
  );
}

/* ── Cart item summary helpers ───────────────────────────── */
function ItemSummary({ it }: { it: CartItem }) {
  const line2Parts = [it.sizeLabel, it.spice].filter(Boolean);
  const freeAddons = it.addons.filter(a => a.price === 0);
  const paidAddons = it.addons.filter(a => a.price > 0);
  const hasYBP    = freeAddons.length > 0;

  return (
    <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.65 }}>
      {line2Parts.length > 0 && (
        <div>{line2Parts.join(' · ')}</div>
      )}
      {hasYBP && (
        <div style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '.10em',
          color: 'var(--gold)', marginTop: 2, marginBottom: 1,
        }}>YOUR BEST PART</div>
      )}
      {freeAddons.length > 0 && (
        <div>{freeAddons.map(a => a.label).join(' · ')}</div>
      )}
      {paidAddons.length > 0 && (
        <div>{paidAddons.map(a => `${a.label} +฿${a.price}`).join(' · ')}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CART PAGE
══════════════════════════════════════════════════════════ */
export default function Cart() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReduced = useReducedMotion();
  const { lang }       = useLang();
  const T              = LANG_MAP[lang];

  const { items, remove, setQty, clear, cutlery, condiments, setCutlery, setCondiments, add } = useCart();

  /* Fulfillment method — read from URL param set by CartBar */
  const method = searchParams.get('method') ?? 'takeaway';
  const isDineIn = method === 'dine-in';

  /* Total */
  const total = cartTotal(items);

  /* Shop info — for ProductSheet */
  const [shopInfo] = useState(() => {
    const base = computeSlots();
    if (!TEST_MODE) return base;
    const slots = base.slots.length > 0
      ? base.slots
      : [{ label: 'พร้อมเร็วสุด', sub: `~12 นาที`, value: null, isAsap: true as const }];
    return { isOpen: true, slots, nextOpenMsg: '' };
  });

  /* ProductSheet trigger — item param opens the sheet; editCartId is read by ProductSheet directly */
  const itemId = searchParams.get('item');

  /* Drinks from DB */
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  useEffect(() => {
    supabase
      .from('categories')
      .select('id')
      .eq('name_th', DRINKS_CAT_NAME_TH)
      .limit(1)
      .then(({ data: cats }) => {
        if (!cats?.[0]) return;
        supabase
          .from('menu_items')
          .select('id, name_th, name_en, base_price, image_url')
          .eq('category_id', cats[0].id)
          .eq('is_active', true)
          .order('display_order')
          .then(({ data }) => { if (data) setDrinks(data as DrinkItem[]); });
      });
  }, []);

  /* Undo on item remove */
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
  const drinkCountInCart = (drinkId: string) =>
    items.filter(it => it.itemId === drinkId).reduce((s, it) => s + it.qty, 0);

  function addDrink(drink: DrinkItem) {
    /* If same drink already in cart, increment qty instead of adding a new line */
    const existing = items.find(it => it.itemId === drink.id && it.isDrink);
    if (existing) {
      setQty(existing.cartId, existing.qty + 1);
    } else {
      add({
        cartId:    `${drink.id}-${Date.now()}`,
        itemId:    drink.id,
        name:      drink.name_th,
        nameEn:    drink.name_en,
        tone:      'clay',
        topping:   'egg',
        imageUrl:  drink.image_url ?? undefined,
        basePrice: drink.base_price,
        sizeLabel: '',
        sizePrice: 0,
        spice:     '',
        addons:    [],
        qty:       1,
        isDrink:   true,
      });
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
            <div className="kicker">ตะกร้า · YOUR BAG</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>ว่างอยู่</div>
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', gap: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '0 32px',
        }}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>{I.bag(40)}</div>
          <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>ตะกร้าว่าง</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{T.cartEmptyMsg}</div>
          <button
            onClick={() => navigate('/order')}
            style={{
              marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
              border: 0, padding: '12px 24px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13,
            }}
          >{T.cartEmptyBtn} {I.arrow(14)}</button>
        </div>
        <TabBar active="menu" />
      </div>
    );
  }

  /* ── FULL CART ───────────────────────────────────────────── */
  return (
    <div className="page" style={{ paddingBottom: 130 }}>

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
          <div className="kicker">ตะกร้า · YOUR BAG</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>
            {T.cartItems(items.reduce((s, i) => s + i.qty, 0))}
          </div>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 0, padding: 0 }}
        >{T.clearAll}</button>
      </motion.div>

      {/* Cart lines */}
      <div style={{ padding: '6px 18px 0' }}>
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.div
              key={it.cartId}
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, height: 0, overflow: 'hidden', paddingTop: 0, paddingBottom: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                display: 'flex', gap: 12, padding: '16px 0',
                borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              {/* Image / Bowl */}
              <div style={{
                width: 64, height: 64, borderRadius: 'var(--r-sm)',
                background: 'var(--bg-2)', display: 'grid', placeItems: 'center', flexShrink: 0,
                overflow: 'hidden',
              }}>
                {it.imageUrl ? (
                  <img src={it.imageUrl} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Bowl tone={it.tone} topping={it.topping} size={56} />
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
                    >
                      {it.qty <= 1 ? I.trash(14) : I.minus(14)}
                    </button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 14 }}>{it.qty}</span>
                    <button
                      onClick={() => setQty(it.cartId, it.qty + 1)}
                      style={{ width: 32, height: 32, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
                    >{I.plus(14)}</button>
                  </div>
                  <span className="price thb" style={{ fontSize: 16 }}>{itemTotal(it)}</span>
                </div>

                {/* Edit link — food items only */}
                {!it.isDrink && (
                  <button
                    onClick={() => setSearchParams(prev => {
                      const next = new URLSearchParams(prev);
                      next.set('item', it.itemId);
                      next.set('editCartId', it.cartId);
                      return next;
                    })}
                    style={{
                      marginTop: 6, background: 'none', border: 0, padding: 0,
                      fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer', textDecoration: 'underline',
                      textDecorationColor: 'var(--line)',
                    }}
                  >
                    {T.editMyWay} {lang === 'en' ? '' : '/ Edit My Way'}
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
            initial={prefersReduced ? false : { opacity: 0, y: 8 }}
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
            <span>{T.removedMsg}</span>
            <button
              onClick={handleUndo}
              style={{ background: 'none', border: 0, padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}
            >{T.undoLabel}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drinks rail */}
      {drinks.length > 0 && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          style={{ marginTop: 22 }}
        >
          <div style={{ padding: '0 18px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              {T.drinksSection}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: 18, paddingRight: 18, paddingBottom: 4 }}>
            {drinks.map(drink => {
              const count = drinkCountInCart(drink.id);
              return (
                <div
                  key={drink.id}
                  style={{
                    flexShrink: 0, width: 100,
                    borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                    background: 'var(--bg-2)', overflow: 'hidden',
                  }}
                >
                  {/* Image */}
                  <div style={{ width: '100%', height: 70, background: 'var(--bg-3)', position: 'relative', display: 'grid', placeItems: 'center' }}>
                    {drink.image_url ? (
                      <img src={drink.image_url} alt={drink.name_th}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontSize: 24, opacity: 0.2 }}>{I.bag(28)}</span>
                    )}
                    {count > 0 && (
                      <span style={{
                        position: 'absolute', top: 5, right: 5,
                        minWidth: 18, height: 18, borderRadius: 9,
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
                        display: 'grid', placeItems: 'center', padding: '0 4px',
                      }}>{count}</span>
                    )}
                  </div>
                  {/* Info + button */}
                  <div style={{ padding: '8px 8px 8px' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--serif)', lineHeight: 1.2, marginBottom: 2 }}>
                      {lang === 'en' ? drink.name_en : drink.name_th}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                      ฿{drink.base_price}
                    </div>
                    <motion.button
                      whileTap={prefersReduced ? undefined : { scale: 0.90 }}
                      onClick={() => addDrink(drink)}
                      style={{
                        width: '100%', height: 28, border: 0, borderRadius: 'var(--r-pill)',
                        background: 'var(--ink)', color: 'var(--on-accent)',
                        display: 'grid', placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >{I.plus(13)}</motion.button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Cutlery & condiments — hidden for dine-in */}
      {!isDineIn && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          style={{ margin: '22px 18px 0', paddingTop: 16, borderTop: '1px solid var(--line)' }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
            {T.cutlerySection}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>{T.cutleryLabel}</span>
            <Toggle value={cutlery} onChange={setCutlery} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>{T.condimentsLabel}</span>
            <Toggle value={condiments} onChange={setCondiments} />
          </div>
          {/* TODO(session3): send cutlery/condiments values to orders INSERT */}
        </motion.div>
      )}

      {/* Total */}
      <div style={{ padding: '22px 18px 0' }}>
        <div style={{ height: 1, background: 'var(--line)', marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{T.totalLabel}</span>
          <span className="thb price" style={{ fontSize: 24 }}>{total}</span>
        </div>
      </div>

      {/* Sticky checkout button */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '14px 18px 26px', background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
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
          <span>{lang === 'th' ? 'ไปต่อ' : 'Continue'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{total}</span>
            {I.arrow(14)}
          </span>
        </button>
      </div>

      {/* Clear confirmation sheet */}
      <AnimatePresence>
        {showClearConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(43,33,24,0.48)' }}
            />
            <motion.div
              initial={prefersReduced ? false : { y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              style={{
                position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '100%', maxWidth: 480, zIndex: 91,
                background: 'var(--bg)', borderRadius: '20px 20px 0 0',
                padding: '24px 20px 40px',
              }}
            >
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginBottom: 6 }}>{T.clearConfirmTitle}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 24 }}>{T.clearConfirmMsg}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 'var(--r-pill)',
                    background: 'var(--bg-3)', border: '1px solid var(--line)',
                    fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer',
                  }}
                >{T.clearConfirmCancel}</button>
                <button
                  onClick={() => { clear(); setShowClearConfirm(false); setUndoItem(null); }}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 'var(--r-pill)',
                    background: 'var(--accent)', border: 'none',
                    fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
                  }}
                >{T.clearConfirmOk}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ProductSheet — edit mode from cart */}
      {itemId && (
        <ProductSheet
          isShopOpen={shopInfo.isOpen}
          shopNextOpen={shopInfo.nextOpenMsg}
        />
      )}
    </div>
  );
}
