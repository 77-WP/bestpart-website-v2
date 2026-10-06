import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart, cartTotal, itemTotal } from '../store/cart';
import { useT } from '../i18n';
import { supabase, readFnError } from '../lib/supabase';
import { I } from '../components/icons';
import { SHOP, shopCloseLabel, computeShopStatus, roundUp5, minToHHMM } from '../config/shop';
import { TEST_MODE, ENABLE_BEAM, CURBSIDE_PROMPTPAY_ONLY } from '../config/env';
import { LINKS } from '../config/links';
import { saveLocalOrder } from '../lib/localOrders';
import { track, getAnonymousId, getSessionId, getAcquisitionTag } from '../lib/analytics';
import {
  useShopStatusServer,
  getShop,
  getPaymentChannels,
  refreshMenuState,
  cartHasBlocking,
} from '../lib/menuState';
import { HelpLink } from '../components/HelpLink';

/* ── Constants ───────────────────────────────────────────── */
const METHODS = [
  { id: 'dine',     labelKey: 'checkout.methodDine'     as const },
  { id: 'takeaway', labelKey: 'checkout.methodTakeaway' as const },
  { id: 'curbside', labelKey: 'checkout.methodCurbside' as const },
];

const FULFILLMENT_MAP: Record<string, string> = {
  dine:     'dine-in',
  takeaway: 'takeaway',
  curbside: 'curbside',
};

const CONTACT_KEY  = 'bp_contact';
const VEHICLE_KEY  = 'bp_vehicle';
const REMEMBER_KEY = 'bp_contact_saved';

const VEHICLE_COLORS: { id: string; bg: string; border?: string; labelKey: string }[] = [
  { id: 'white',  bg: '#FFFFFF', border: '#D0C8BC', labelKey: 'checkout.colorWhite'  },
  { id: 'black',  bg: '#1A1A1A',                    labelKey: 'checkout.colorBlack'  },
  { id: 'gray',   bg: '#9E9E9E',                    labelKey: 'checkout.colorGray'   },
  { id: 'red',    bg: '#C0392B',                    labelKey: 'checkout.colorRed'    },
  { id: 'blue',   bg: '#2255A4',                    labelKey: 'checkout.colorBlue'   },
  { id: 'other',  bg: 'linear-gradient(135deg,#f6d365,#fda085)', labelKey: 'checkout.colorOther' },
];

const BRANDS = ['Toyota','Honda','Isuzu','Mazda','Mitsubishi','Nissan','MG','BYD','Tesla','BMW','Benz','Aion','Ford'];
const BRAND_OTHER_ID = '__other__';
const BRAND_DISPLAY_EN: Record<string, string> = { 'Benz': 'Mercedes-Benz' };
function brandLabel(brand: string, currentLang: string): string {
  if (currentLang === 'en' && BRAND_DISPLAY_EN[brand]) return BRAND_DISPLAY_EN[brand];
  return brand;
}

/* ── Helpers ─────────────────────────────────────────────── */
function digitsOnly(v: string) { return v.replace(/\D/g, ''); }
function isPhoneOk(v: string)  { return /^\d{10}$/.test(digitsOnly(v)); }
function stripControl(v: string) { return v.replace(/[\r\n\u0000-\u001F\u007F-\u009F]/g, ''); }
function sanitizeVehicleText(v: string) {
  return v.replace(/[\r\n\u0000-\u001F\u007F-\u009F]/g, '').replace(/\s+/g, ' ').trim();
}

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)',
  padding: '12px 14px',
  fontFamily: 'var(--sans)',
  fontSize: 16,
  color: 'var(--ink)',
  outline: 'none',
};

/* Build TEST_MODE-safe ShopStatus (used only for slot validity check at submit time) */
function makeShopInfo() {
  const base = computeShopStatus();
  if (!TEST_MODE) return base;
  if (base.isOpen && base.slots.length > 0) return base;
  const now    = new Date();
  const bkk    = new Date(now.getTime() + 7 * 3600 * 1000);
  const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
  const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
  return {
    isOpen:       true,
    slots:        [{ label: minToHHMM(asapMin), diffMin: SHOP.prepMinutes, value: null, isAsap: true }],
    nextOpenMsg:  '',
    previewOpen:  false,
    forcedClosed: false,
    reopenAt:     null,
  };
}

/* ── Component ───────────────────────────────────────────── */
export default function Checkout() {
  const navigate       = useNavigate();
  const { items, clear, cutlery, condiments, kitchenNote } = useCart();
  const { t, lang }    = useT();

  /* ── Method — null = not yet chosen this session ───────── */
  const [method, setMethodState] = useState<string | null>(() => {
    if (sessionStorage.getItem('bp_method_chosen') === 'true') {
      return sessionStorage.getItem('bp_method') ?? null;
    }
    return null;
  });

  function chooseMethod(id: string) {
    sessionStorage.setItem('bp_method', id);
    sessionStorage.setItem('bp_method_chosen', 'true');
    setMethodState(id);
    setSlotExpiredMsg(false);
  }

  /* ── Shop info — sourced from server menu-state poll ────── */
  const shopInfo   = useShopStatusServer();
  const isPreorder = shopInfo.serverShopStatus === 'preorder';

  function shopClosedMsg(): string {
    if (shopInfo.forcedClosed && shopInfo.reopenAt) {
      const bkk  = new Date(shopInfo.reopenAt.getTime() + 7 * 3_600_000);
      const date = bkk.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });
      const time = `${String(bkk.getUTCHours()).padStart(2,'0')}:${String(bkk.getUTCMinutes()).padStart(2,'0')}`;
      return t('shop.forcedClosed', date, time);
    }
    return t('menu.status.closed', shopInfo.nextOpenMsg);
  }

  /* ── Selected slot — undefined = not chosen ────────────── */
  // null = ASAP, "HH:MM" = fixed time, undefined = nothing chosen yet
  const [selSlot,        setSelSlot]        = useState<string | null | undefined>(undefined);
  const [slotExpiredMsg, setSlotExpiredMsg] = useState(false);

  // When slots update from server poll, deselect any fixed slot that no longer exists
  const slotsKey = shopInfo.slots.map(s => s.value ?? 'asap').join(',');
  useEffect(() => {
    if (typeof selSlot === 'string') {
      const stillValid = shopInfo.slots.some(s => s.value === selSlot);
      if (!stillValid) {
        setSelSlot(undefined);
        setSlotExpiredMsg(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey]);

  /* ── Contact — prefill from localStorage ───────────────── */
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [nameTouched,  setNameTouched]  = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [remember,     setRemember]     = useState(() => localStorage.getItem(REMEMBER_KEY) === 'true');

  useEffect(() => {
    const saved = localStorage.getItem(CONTACT_KEY);
    if (saved) {
      try {
        const { name: n, phone: p } = JSON.parse(saved);
        if (n) setName(n);
        if (p) setPhone(p);
      } catch { /* ignore */ }
    }
  }, []);

  /* ── Vehicle (curbside) ─────────────────────────────────── */
  const [vehicleColor,     setVehicleColor]     = useState<string | null>(null);
  const [colorOtherText,   setColorOtherText]   = useState('');
  const [vehicleBrand,     setVehicleBrand]     = useState<string | null>(null);
  const [brandOtherText,   setBrandOtherText]   = useState('');
  const vehicleRef        = useRef<HTMLDivElement>(null);
  const colorOtherInputRef = useRef<HTMLInputElement>(null);
  const isCurbside = method === 'curbside';

  useEffect(() => {
    const saved = localStorage.getItem(VEHICLE_KEY);
    if (saved) {
      try {
        const { color, colorOtherText: cot, brand, brandOtherText: bot } = JSON.parse(saved);
        if (color) setVehicleColor(color);
        if (cot)   setColorOtherText(cot);
        if (brand) setVehicleBrand(brand);
        if (bot)   setBrandOtherText(bot);
      } catch { /* ignore */ }
    }
  }, []);

  /* ── Payment ─────────────────────────────────────────────  */
  const [payment, setPayment] = useState(ENABLE_BEAM ? 'promptpay' : 'cash');

  /* Lock to PromptPay when curbside */
  useEffect(() => {
    if (isCurbside && CURBSIDE_PROMPTPAY_ONLY) setPayment('promptpay');
  }, [isCurbside]);

  /* Server payment channels */
  const serverChannels    = getPaymentChannels();
  const channelKey        = serverChannels.map(c => c.key).join(',');
  const activePaymentIds: string[] = serverChannels.length > 0
    ? serverChannels.map(c => c.key === 'promptpay_qr' ? 'promptpay' : 'cash')
    : ['promptpay', 'cash'];
  const noPaymentChannels = serverChannels.length > 0 && activePaymentIds.length === 0;

  /* Switch away from a payment method that the server has disabled */
  useEffect(() => {
    if (isCurbside && CURBSIDE_PROMPTPAY_ONLY) return;
    if (serverChannels.length === 0) return;
    if (!activePaymentIds.includes(payment) && activePaymentIds.length > 0) {
      setPayment(activePaymentIds[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, payment, isCurbside]);

  /* ── Summary collapsible ─────────────────────────────────  */
  const [summaryOpen, setSummaryOpen] = useState(false);

  /* ── Submission state ───────────────────────────────────── */
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [submitHint, setSubmitHint] = useState<string | null>(null);

  /* ── Refs for scroll-to-error ────────────────────────────  */
  const methodRef  = useRef<HTMLDivElement>(null);
  const timeRef    = useRef<HTMLDivElement>(null);
  const nameRef    = useRef<HTMLInputElement>(null);
  const phoneRef   = useRef<HTMLInputElement>(null);
  const barRef          = useRef<HTMLDivElement>(null);
  const summaryContentRef = useRef<HTMLDivElement>(null);

  /* ── Computed ────────────────────────────────────────────  */
  const subtotal   = cartTotal(items);
  const total      = subtotal;
  const itemCount  = items.reduce((s, i) => s + i.qty, 0);
  const nameOk     = name.trim().length > 0;
  const phoneOk    = isPhoneOk(phone);

  const hasBlockingItems  = cartHasBlocking(items.map(i => ({ itemId: i.itemId, optionIds: i.optionIds })));
  const isEffectivelyClosed = !shopInfo.isOpen || noPaymentChannels;

  // Which fixed slot (if any) is currently selected — for confirmation line
  const selectedSlotObj = selSlot === null
    ? shopInfo.slots.find(s => s.isAsap) ?? null
    : shopInfo.slots.find(s => s.value === selSlot) ?? null;

  /* ── Measure sticky bar → CSS variable ─────────────────── */
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      document.documentElement.style.setProperty('--checkout-bar-h', `${h}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--checkout-bar-h');
    };
  }, []);

  /* ── Scroll summary into view when expanded ─────────────  */
  useEffect(() => {
    if (summaryOpen && summaryContentRef.current) {
      summaryContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [summaryOpen]);

  /* checkout_started */
  useEffect(() => {
    track('checkout_started', {
      item_count: itemCount,
      subtotal:   total,
      ...(method ? { fulfillment_type: method } : {}),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Submit ──────────────────────────────────────────────  */
  const IDEM_KEY = 'bp_idem_key';

  async function handleConfirm() {
    if (loading) return;
    setNameTouched(true);
    setPhoneTouched(true);
    setSubmitHint(null);

    // Validate in order — scroll to first issue
    if (!method) {
      setSubmitHint(t('checkout.validMethod'));
      methodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (isCurbside && !vehicleColor) {
      setSubmitHint(t('checkout.validVehicleColor'));
      vehicleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (isCurbside && vehicleColor === 'other' && colorOtherText.trim() === '') {
      setSubmitHint(t('checkout.validVehicleColorOther'));
      colorOtherInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      colorOtherInputRef.current?.focus();
      return;
    }
    if (selSlot === undefined) {
      setSubmitHint(t('checkout.validTime'));
      timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Re-check slot validity at submit time
    const currentInfo = makeShopInfo();
    if (typeof selSlot === 'string' && !currentInfo.slots.some(s => s.value === selSlot)) {
      setSelSlot(undefined);
      setSlotExpiredMsg(true);
      setSubmitHint(t('checkout.validTime'));
      timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!nameOk) {
      setSubmitHint(t('checkout.validName'));
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameRef.current?.focus();
      return;
    }
    if (!phoneOk) {
      setSubmitHint(t('checkout.validPhone'));
      phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phoneRef.current?.focus();
      return;
    }
    if (isEffectivelyClosed) return;

    setLoading(true);
    setError(null);

    // Server-side pre-check: refresh state then guard on closed / cart blocked
    await refreshMenuState();
    const freshShop = getShop();
    if (freshShop?.status === 'closed') {
      setLoading(false);
      setError(t('order.error.shop_closed'));
      return;
    }
    if (cartHasBlocking(items.map(i => ({ itemId: i.itemId, optionIds: i.optionIds })))) {
      setLoading(false);
      setError(t('cart.blocked'));
      return;
    }

    // Idempotency key — create once per order attempt, reuse on retry, clear on success
    let idempotencyKey = sessionStorage.getItem(IDEM_KEY);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem(IDEM_KEY, idempotencyKey);
    }

    const isBeam = payment === 'promptpay';

    const pickupTime = selSlot === null ? 'asap' : selSlot;

    const vehiclePayload = (isCurbside && vehicleColor)
      ? {
          color: vehicleColor === 'other' ? sanitizeVehicleText(colorOtherText) : vehicleColor,
          ...(vehicleBrand
            ? { brand: vehicleBrand === BRAND_OTHER_ID ? sanitizeVehicleText(brandOtherText) : vehicleBrand }
            : {}),
        }
      : undefined;

    const campaign = getAcquisitionTag();
    const body = {
      idempotency_key:  idempotencyKey,
      fulfillment_type: FULFILLMENT_MAP[method] ?? 'takeaway',
      payment_method:   isBeam ? 'promptpay' : 'cash',
      pickup_time:      pickupTime,
      name:             name.trim(),
      phone:            digitsOnly(phone),
      customer_note:    stripControl(kitchenNote),
      cutlery,
      condiments,
      ...(vehiclePayload ? { vehicle: vehiclePayload } : {}),
      expected_total:   total,
      items:            items.map(it => ({
        item_id:    it.itemId,
        qty:        it.qty,
        option_ids: it.optionIds,
      })),
      anonymous_id: getAnonymousId(),
      session_id:   getSessionId(),
      ...(campaign ? { campaign } : {}),
    };

    if (TEST_MODE) console.log('[create-order] payload:', body);

    track('payment_started', { method: isBeam ? 'promptpay' : 'cash', total });

    const { data, error: fnError } = await supabase.functions.invoke('create-order', { body });

    const result = data as { order_id?: string } | null;

    if (fnError || !result?.order_id) {
      const { code } = fnError ? await readFnError(fnError) : { code: 'fallback' };
      track('payment_failed', { code });
      if (TEST_MODE) console.error('[create-order] failed, code:', code, fnError);
      setLoading(false);
      const errorMsg = (() => {
        switch (code) {
          case 'shop_closed':         return t('order.error.shop_closed');
          case 'too_late':            return t('order.error.too_late');
          case 'item_unavailable':    return t('order.error.item_unavailable');
          case 'option_unavailable':        return t('order.error.option_unavailable');
          case 'option_requires_missing':   return t('order.error.option_requires_missing');
          case 'price_changed':             return t('order.error.price_changed');
          case 'invalid_pickup_time': return t('order.error.invalid_pickup_time');
          case 'invalid_phone':       return t('order.error.invalid_phone');
          case 'rate_limited':        return t('order.error.rate_limited');
          case 'invalid_name':               return t('order.error.invalid_name');
          case 'invalid_option':             return t('order.error.invalid_option');
          case 'single_select_required':     return t('order.error.single_select_required');
          case 'vehicle_required':           return t('order.error.vehicle_required');
          case 'curbside_requires_promptpay': return t('order.error.curbside_requires_promptpay');
          case 'payment_method_unavailable': return t('order.error.payment_method_unavailable');
          case 'invalid_request':
          case 'server_error':               return t('order.error.server_error');
          default:                    return t('order.error.fallback');
        }
      })();
      setError(errorMsg);
      if (code === 'shop_closed' || code === 'item_unavailable' || code === 'option_unavailable') {
        void refreshMenuState();
      }
      return;
    }

    const orderId = result.order_id;
    sessionStorage.removeItem(IDEM_KEY);
    saveLocalOrder(orderId, new Date().toISOString(), name.trim());

    // Save contact only if user opted in
    if (remember) {
      localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: name.trim(), phone: digitsOnly(phone) }));
      localStorage.setItem(REMEMBER_KEY, 'true');
    } else {
      localStorage.removeItem(CONTACT_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }

    // Save vehicle only when user opts in (same gate as bp_contact)
    if (isCurbside && vehicleColor) {
      if (remember) {
        localStorage.setItem(VEHICLE_KEY, JSON.stringify({
          color:          vehicleColor,
          colorOtherText: sanitizeVehicleText(colorOtherText),
          brand:          vehicleBrand,
          brandOtherText: sanitizeVehicleText(brandOtherText),
        }));
      } else {
        localStorage.removeItem(VEHICLE_KEY);
      }
    }

    clear();

    if (isBeam) {
      navigate(`/pay/${orderId}`);
    } else {
      navigate(`/track/${orderId}`);
    }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="page" style={{ paddingBottom: 'calc(var(--checkout-bar-h, 88px) + 24px + env(safe-area-inset-bottom, 0px))' }}>

      {/* TEST MODE banner */}
      {TEST_MODE && (
        <div style={{
          background: '#b45309', color: '#fffdf8',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textAlign: 'center', padding: '5px 0',
        }}>
          TEST MODE — ห้ามใช้บัตรจริง
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '14px 18px 8px', display: 'flex', alignItems: 'center',
        gap: 12, borderBottom: '1px solid var(--line)',
      }}>
        <button onClick={() => navigate('/cart')}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}>
          {I.back(22)}
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">{t('checkout.kicker')}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>{t('checkout.title')}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{t('checkout.subtitle')}</div>
        </div>
      </div>

      {/* ── 1. วิธีรับ ──────────────────────────────────────── */}
      <div ref={methodRef} style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
          {t('checkout.sectionMethod')}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
          padding: 4, borderRadius: 'var(--r-md)',
          background: 'var(--bg-3)',
          outline: submitHint === t('checkout.validMethod') && !method ? '1.5px solid var(--accent)' : 'none',
          outlineOffset: 2,
        }}>
          {METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => chooseMethod(m.id)}
              style={{
                padding: '10px 6px', borderRadius: 'var(--r-sm)',
                background: method === m.id ? 'var(--bg)' : 'transparent',
                border: 0,
                boxShadow: method === m.id ? 'var(--sh-card)' : 'none',
              }}
            >
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 12,
                color: method === m.id ? 'var(--ink)' : 'var(--ink-3)',
              }}>
                {t(m.labelKey)}
              </div>
            </button>
          ))}
        </div>
        {submitHint === t('checkout.validMethod') && !method && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5 }}>{t('checkout.validMethod')}</div>
        )}
      </div>

      {/* ── 1b. รถของคุณ (curbside only) ──────────────────────── */}
      {isCurbside && (
        <div ref={vehicleRef} style={{ padding: '14px 18px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
            {t('checkout.sectionVehicle')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.55 }}>
            {t('checkout.vehicleDesc')}
          </div>

          {/* Color chips — required */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: vehicleColor === 'other' ? 0 : 10 }}>
            {VEHICLE_COLORS.map(c => {
              const selected = vehicleColor === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setVehicleColor(c.id); setSubmitHint(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 'var(--r-pill)',
                    border: selected ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    background: selected ? 'var(--bg-2)' : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12,
                    color: selected ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: c.bg,
                    border: `1px solid ${c.border ?? 'transparent'}`,
                    boxSizing: 'border-box',
                  }} />
                  {t(c.labelKey as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
          {vehicleColor === 'other' && (
            <div style={{ marginTop: 6, marginBottom: 10 }}>
              <input
                ref={colorOtherInputRef}
                type="text"
                autoFocus
                maxLength={20}
                placeholder={t('checkout.colorOtherPlaceholder')}
                value={colorOtherText}
                onChange={e => { setColorOtherText(stripControl(e.target.value)); setSubmitHint(null); }}
                style={{
                  width: '100%', background: 'var(--bg-2)',
                  border: submitHint === t('checkout.validVehicleColorOther') ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', padding: '8px 12px',
                  fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--ink)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {submitHint === t('checkout.validVehicleColorOther') && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{t('checkout.validVehicleColorOther')}</div>
              )}
            </div>
          )}
          {submitHint === t('checkout.validVehicleColor') && !vehicleColor && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6 }}>{t('checkout.validVehicleColor')}</div>
          )}

          {/* Brand chips — optional */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BRANDS.map(b => {
              const selected = vehicleBrand === b;
              return (
                <button
                  key={b}
                  onClick={() => setVehicleBrand(selected ? null : b)}
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--r-pill)',
                    border: selected ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    background: selected ? 'var(--bg-2)' : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12,
                    color: selected ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  {brandLabel(b, lang)}
                </button>
              );
            })}
            {(() => {
              const selected = vehicleBrand === BRAND_OTHER_ID;
              return (
                <button
                  key={BRAND_OTHER_ID}
                  onClick={() => setVehicleBrand(selected ? null : BRAND_OTHER_ID)}
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--r-pill)',
                    border: selected ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    background: selected ? 'var(--bg-2)' : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12,
                    color: selected ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  {t('checkout.brandOther')}
                </button>
              );
            })()}
          </div>
          {vehicleBrand === BRAND_OTHER_ID && (
            <div style={{ marginTop: 6 }}>
              <input
                type="text"
                autoFocus
                maxLength={20}
                placeholder={t('checkout.brandOtherPlaceholder')}
                value={brandOtherText}
                onChange={e => setBrandOtherText(stripControl(e.target.value))}
                style={{
                  width: '100%', background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', padding: '8px 12px',
                  fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--ink)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── 2. Location line ──────────────────────────────────── */}
      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {method ? (
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {method === 'dine'     ? t('checkout.locationDine', lang === 'en' ? SHOP.branchNameEn : SHOP.branchName)
               : method === 'curbside' ? t('checkout.locationCurbside', lang === 'en' ? SHOP.branchNameEn : SHOP.branchName)
               : t('checkout.locationTakeaway', lang === 'en' ? SHOP.branchNameEn : SHOP.branchName)}
            </span>
          ) : (
            <span style={{ color: 'var(--ink-3)', marginRight: 2 }}>{t('checkout.pickupAt')}</span>
          )}
          <span style={{ color: 'var(--ink-3)' }}>·</span>
          <span style={{ color: 'var(--ink-3)' }}>{t('checkout.openUntil', shopCloseLabel())}</span>
          {LINKS.googleMaps && (
            <>
              <span style={{ color: 'var(--ink-3)' }}>·</span>
              <a
                href={LINKS.googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
              >
                {t('checkout.mapLink')}
              </a>
            </>
          )}
        </div>
      </div>

      {/* ── 3. เวลารับ ──────────────────────────────────────── */}
      <div ref={timeRef} style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
          {t('checkout.sectionTime')}
        </div>

        {/* Method not chosen yet */}
        {!method && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-3)',
          }}>
            {t('checkout.timeChooseMethodFirst')}
          </div>
        )}

        {/* Shop closed */}
        {method && !shopInfo.isOpen && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(43,33,24,0.06)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-2)',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{shopClosedMsg()}</span>
          </div>
        )}

        {/* Near close — no slots available */}
        {method && shopInfo.isOpen && shopInfo.slots.length === 0 && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(43,33,24,0.06)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-2)',
          }}>
            {t('checkout.timeNearCloseMsg')}
          </div>
        )}

        {/* Slot expired warning */}
        {slotExpiredMsg && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
            {t('checkout.timeExpiredMsg')}
          </div>
        )}

        {/* Time slots grid */}
        {method && shopInfo.isOpen && shopInfo.slots.length > 0 && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
              outline: submitHint === t('checkout.validTime') && selSlot === undefined ? '1.5px solid var(--accent)' : 'none',
              outlineOffset: 3, borderRadius: 'var(--r-sm)',
            }}>
              {shopInfo.slots.map((s) => {
                const isSelected = selSlot === s.value;
                return (
                  <button
                    key={s.value ?? 'asap'}
                    onClick={() => {
                      setSelSlot(s.value);
                      setSlotExpiredMsg(false);
                      setSubmitHint(null);
                    }}
                    style={{
                      padding: '10px 10px 8px', borderRadius: 'var(--r-md)',
                      border: isSelected ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                      background: isSelected ? 'var(--bg-2)' : 'var(--bg)',
                      textAlign: 'left', position: 'relative',
                    }}
                  >
                    {s.isAsap && (
                      <span style={{
                        position: 'absolute', top: 5, right: 6,
                        fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
                        color: 'var(--accent)',
                        background: 'rgba(178,58,31,0.10)',
                        padding: '1px 5px', borderRadius: 'var(--r-pill)',
                      }}>
                        {isPreorder ? t('checkout.preorderLabel') : t('checkout.timeEarliestBadge')}
                      </span>
                    )}
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700,
                      color: isSelected ? 'var(--ink)' : 'var(--ink-2)',
                      lineHeight: 1.1, marginBottom: 3,
                    }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      {t('checkout.timeInMin', s.diffMin)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Preorder note */}
            {isPreorder && shopInfo.preorderOpensAtHHMM && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
                {t('checkout.preorderNote', shopInfo.preorderOpensAtHHMM)}
              </div>
            )}

            {/* Confirmation line */}
            {selSlot !== undefined && selectedSlotObj && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-2)', fontWeight: 600 }}>
                {t('checkout.timeConfirm', selectedSlotObj.label)}
              </div>
            )}

            {/* Validation hint */}
            {submitHint === t('checkout.validTime') && selSlot === undefined && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5 }}>{t('checkout.validTime')}</div>
            )}
          </>
        )}
      </div>

      {/* ── 4. ผู้รับ ────────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            {t('checkout.sectionContact')}
          </div>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--accent-2)',
            background: 'rgba(74,93,63,0.14)', padding: '3px 8px', borderRadius: 'var(--r-pill)',
          }}>
            {t('checkout.noSignupBadge')}
          </span>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{t('checkout.nameLabel')}</div>
          <input
            ref={nameRef}
            type="text"
            autoComplete="name"
            placeholder={t('checkout.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            style={{
              ...inputBase,
              border: nameTouched && !nameOk ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            }}
          />
          {nameTouched && !nameOk ? (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{t('checkout.nameError')}</div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>{t('checkout.nameHelper')}</div>
          )}
        </div>

        {/* Phone */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{t('checkout.phoneLabel')}</div>
          <input
            ref={phoneRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('checkout.phonePlaceholder')}
            value={phone}
            onChange={e => {
              const digits = digitsOnly(e.target.value);
              setPhone(digits.slice(0, 10));
            }}
            onBlur={() => setPhoneTouched(true)}
            style={{
              ...inputBase,
              fontFamily: 'var(--mono)',
              border: phoneTouched && !phoneOk ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            }}
          />
          {phoneTouched && !phoneOk ? (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
              {phone.trim() === '' ? t('checkout.phoneErrorEmpty') : t('checkout.phoneErrorInvalid')}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>{t('checkout.phoneHelper')}</div>
          )}
        </div>

        {/* Remember on this device checkbox */}
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--ink)', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('checkout.rememberLabel')}</span>
          </label>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, paddingLeft: 26 }}>
            {t('checkout.rememberHelper')}
          </div>
        </div>
      </div>

      {/* ── 5. ชำระเงิน ─────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
          {t('checkout.sectionPayment')}
        </div>
        {isCurbside && CURBSIDE_PROMPTPAY_ONLY && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--r-sm)', marginBottom: 6,
            background: 'var(--bg-3)', fontSize: 11, color: 'var(--ink-3)',
          }}>
            {t('checkout.curbsidePromptpayOnly')}
          </div>
        )}
        {[
          { id: 'promptpay', label: t('checkout.promptpayLabel'), sub: t('checkout.promptpaySub'), icon: I.qr(16) },
          { id: 'cash',      label: t('checkout.cashLabel'),      sub: t('checkout.cashSub'),      icon: I.cash(16) },
        ]
          .filter(p => activePaymentIds.includes(p.id))
          .filter(p => ENABLE_BEAM || p.id !== 'promptpay')
          .filter(p => !(isCurbside && CURBSIDE_PROMPTPAY_ONLY && p.id === 'cash'))
          .map(p => (
          <label
            key={p.id}
            onClick={() => { setPayment(p.id); track('payment_method_selected', { method: p.id }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 'var(--r-sm)', marginBottom: 6, cursor: 'pointer',
              border: payment === p.id ? '1.5px solid var(--ink)' : '1px solid var(--line)',
              background: payment === p.id ? 'var(--bg-2)' : 'var(--bg)',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              border: payment === p.id ? '6px solid var(--ink)' : '1.5px solid var(--line-2)',
              background: 'var(--bg)',
            }} />
            <span style={{ color: 'var(--ink-2)' }}>{p.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.sub}</div>
            </div>
          </label>
        ))}
      </div>

      {/* ── 6. สรุปรายการ ───────────────────────────────────── */}
      <div style={{ padding: '18px 18px 0' }}>
        <button
          onClick={() => setSummaryOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
            padding: '12px 14px', cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)' }}>
            {t('checkout.sectionSummary')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)' }}>
            <span style={{ fontFamily: 'var(--mono)' }}>{t('checkout.summaryNItems', itemCount, total)}</span>
            {I.chevron(14, summaryOpen ? 'up' : 'down')}
          </span>
        </button>

        {summaryOpen && (
          <div ref={summaryContentRef} style={{
            marginTop: 4, border: '1px solid var(--line)',
            borderTop: 'none', borderRadius: '0 0 var(--r-md) var(--r-md)',
            padding: '8px 14px',
          }}>
            {items.map(it => (
              <div key={it.cartId} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '4px 0', fontSize: 13, color: 'var(--ink-2)',
              }}>
                <span style={{ fontFamily: 'var(--serif)' }}>{it.name} ×{it.qty}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>฿{itemTotal(it)}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/cart')}
          style={{
            marginTop: 6, background: 'none', border: 0, cursor: 'pointer', padding: 0,
            fontSize: 11, color: 'var(--accent)', fontWeight: 600,
          }}
        >
          {t('checkout.editCart')}
        </button>
      </div>

      {/* ── Sticky button ────────────────────────────────────── */}
      <div ref={barRef} style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '12px 18px calc(env(safe-area-inset-bottom, 0px) + 18px)',
        background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
      }}>
        {/* Cart blocked — reserved space prevents layout jump */}
        <div style={{
          marginBottom: 8, fontSize: 11, color: 'var(--accent)',
          textAlign: 'center', fontWeight: 600,
          visibility: hasBlockingItems ? 'visible' : 'hidden',
        }}>
          {t('cart.blocked')}
        </div>
        {error && (
          <div style={{
            marginBottom: 8, padding: '10px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(178,58,31,0.10)', color: 'var(--accent)',
            border: '1px solid rgba(178,58,31,0.28)',
            fontSize: 12, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {I.info(14)} {error}
          </div>
        )}
        {submitHint && !error && (
          <div style={{
            marginBottom: 8, fontSize: 11, color: 'var(--accent)',
            textAlign: 'center', fontWeight: 600,
          }}>{submitHint}</div>
        )}
        <button
          onClick={handleConfirm}
          aria-disabled={isEffectivelyClosed || hasBlockingItems || loading || undefined}
          disabled={loading}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 0, padding: '16px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: loading || isEffectivelyClosed || hasBlockingItems ? 'default' : 'pointer',
            opacity: loading || isEffectivelyClosed || hasBlockingItems ? 0.75 : 1,
          }}
        >
          <span>
            {loading
              ? t('checkout.orderLoading')
              : isEffectivelyClosed
                ? t('checkout.shopClosedLabel')
                : payment === 'promptpay'
                  ? t('checkout.payBtnQR', total)
                  : t('checkout.payBtnCash', total)}
          </span>
          {!loading && <span>{I.arrow(14)}</span>}
        </button>
        <div style={{ textAlign: 'center', marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <Link to="/privacy" style={{ fontSize: 10, color: 'var(--ink-3)', textDecoration: 'none' }}>
            {t('privacy.link')}
          </Link>
          <HelpLink variant="help" />
        </div>
      </div>
    </div>
  );
}
