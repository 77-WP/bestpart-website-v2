import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, cartTotal, itemTotal } from '../store/cart';
import { useLang } from '../store/lang';
import { LANG_MAP } from '../config/lang';
import { supabase } from '../lib/supabase';
import { I } from '../components/icons';
import { SHOP, shopCloseLabel, computeSlots, roundUp5, minToHHMM, type ShopInfo } from '../config/shop';
import { TEST_MODE, ENABLE_BEAM, CURBSIDE_PROMPTPAY_ONLY } from '../config/env';
import { LINKS } from '../config/links';
import { saveLocalOrder } from '../lib/localOrders';

/* ── Constants ───────────────────────────────────────────── */
const METHODS = [
  { id: 'dine',     key: 'methodDine'     as const },
  { id: 'takeaway', key: 'methodTakeaway' as const },
  { id: 'curbside', key: 'methodCurbside' as const },
];

const FULFILLMENT_MAP: Record<string, string> = {
  dine:     'dine-in',
  takeaway: 'takeaway',
  curbside: 'curbside',
};

const CONTACT_KEY = 'bp_contact';
const VEHICLE_KEY = 'bp_vehicle';

const VEHICLE_COLORS: { id: string; bg: string; border?: string; labelKey: string }[] = [
  { id: 'white',  bg: '#FFFFFF', border: '#D0C8BC', labelKey: 'colorWhite'  },
  { id: 'black',  bg: '#1A1A1A',                    labelKey: 'colorBlack'  },
  { id: 'gray',   bg: '#9E9E9E',                    labelKey: 'colorGray'   },
  { id: 'red',    bg: '#C0392B',                    labelKey: 'colorRed'    },
  { id: 'blue',   bg: '#2255A4',                    labelKey: 'colorBlue'   },
  { id: 'other',  bg: 'linear-gradient(135deg,#f6d365,#fda085)', labelKey: 'colorOther' },
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
  fontSize: 14,
  color: 'var(--ink)',
  outline: 'none',
};

/* Build TEST_MODE-safe ShopInfo */
function makeShopInfo(): ShopInfo {
  const base = computeSlots();
  if (!TEST_MODE) return base;
  if (base.isOpen && base.slots.length > 0) return base;
  // Force open with ASAP slot when outside hours in TEST_MODE
  const now    = new Date();
  const bkk    = new Date(now.getTime() + 7 * 3600 * 1000);
  const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
  const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
  return {
    isOpen:      true,
    slots:       [{ label: minToHHMM(asapMin), diffMin: SHOP.prepMinutes, value: null, isAsap: true }],
    nextOpenMsg: '',
  };
}

/* ── Component ───────────────────────────────────────────── */
export default function Checkout() {
  const navigate       = useNavigate();
  const { items, clear } = useCart();
  const { lang }       = useLang();
  const L              = LANG_MAP[lang];

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

  /* ── Shop info — recomputed every minute ────────────────── */
  const [shopInfo, setShopInfo] = useState<ShopInfo>(makeShopInfo);

  /* ── Selected slot — undefined = not chosen ────────────── */
  // null = ASAP, "HH:MM" = fixed time, undefined = nothing chosen yet
  const [selSlot,        setSelSlot]        = useState<string | null | undefined>(undefined);
  const [slotExpiredMsg, setSlotExpiredMsg] = useState(false);

  const recompute = useCallback(() => {
    const fresh = makeShopInfo();
    setShopInfo(fresh);
    // If a fixed slot was selected and it no longer exists, deselect
    if (typeof selSlot === 'string') {
      const stillValid = fresh.slots.some(s => s.value === selSlot);
      if (!stillValid) {
        setSelSlot(undefined);
        setSlotExpiredMsg(true);
      }
    }
  }, [selSlot]);

  useEffect(() => {
    const t = setInterval(recompute, 60_000);
    return () => clearInterval(t);
  }, [recompute]);

  /* ── Contact — prefill from localStorage ───────────────── */
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [nameTouched,  setNameTouched]  = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

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

  /* ── Computed ────────────────────────────────────────────  */
  const subtotal   = cartTotal(items);
  const total      = subtotal;
  const itemCount  = items.reduce((s, i) => s + i.qty, 0);
  const nameOk     = name.trim().length > 0;
  const phoneOk    = isPhoneOk(phone);

  // Which fixed slot (if any) is currently selected — for confirmation line
  const selectedSlotObj = selSlot === null
    ? shopInfo.slots.find(s => s.isAsap) ?? null
    : shopInfo.slots.find(s => s.value === selSlot) ?? null;

  /* ── Submit ──────────────────────────────────────────────  */
  async function handleConfirm() {
    setNameTouched(true);
    setPhoneTouched(true);
    setSubmitHint(null);

    // Validate in order — scroll to first issue
    if (!method) {
      setSubmitHint(L.validMethod);
      methodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (isCurbside && !vehicleColor) {
      setSubmitHint(L.validVehicleColor);
      vehicleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (isCurbside && vehicleColor === 'other' && colorOtherText.trim() === '') {
      setSubmitHint(L.validVehicleColorOther);
      colorOtherInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      colorOtherInputRef.current?.focus();
      return;
    }
    if (selSlot === undefined) {
      setSubmitHint(L.validTime);
      timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Re-check slot validity at submit time
    const currentInfo = makeShopInfo();
    if (typeof selSlot === 'string' && !currentInfo.slots.some(s => s.value === selSlot)) {
      setSelSlot(undefined);
      setSlotExpiredMsg(true);
      setSubmitHint(L.validTime);
      timeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!nameOk) {
      setSubmitHint(L.validName);
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameRef.current?.focus();
      return;
    }
    if (!phoneOk) {
      setSubmitHint(L.validPhone);
      phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phoneRef.current?.focus();
      return;
    }
    if (!shopInfo.isOpen) return;

    setLoading(true);
    setError(null);

    const orderItems = items.map(it => ({
      name:       it.name,
      name_en:    it.nameEn,
      item_id:    it.itemId,
      qty:        it.qty,
      unit_price: itemTotal(it) / it.qty,
      total:      itemTotal(it),
      size:       it.sizeLabel,
      spice:      it.spice,
      addons:     it.addons,
    }));

    const isBeam = payment === 'promptpay';

    // Sanitize: only accept "HH:MM" — anything else → null
    const rawPickup  = selSlot ?? null;
    const pickupTime = rawPickup && /^\d{2}:\d{2}(:\d{2})?$/.test(rawPickup) ? rawPickup : null;

    // TODO(curbside): include vehicle details in order when ready
    const insertPayload = {
      items:                   orderItems,
      subtotal:                subtotal,
      discount_amount:         0,
      delivery_fee:            0,
      grand_total:             total,
      status:                  isBeam ? 'awaiting_payment' : 'pending',
      payment_status:          'pending',
      fulfillment_type:        FULFILLMENT_MAP[method] ?? 'takeaway',
      checkout_payment_method: isBeam ? 'promptpay' : 'cash',
      internal_notes:          isBeam ? null : 'จ่ายที่ร้าน',
      pickup_time:             pickupTime,
      source:                  'web',
    };

    if (TEST_MODE) console.log('[INSERT orders] payload:', insertPayload);

    const { data, error: dbError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select('id')
      .single();

    if (dbError || !data) {
      console.error('[INSERT orders] failed:', {
        message: dbError?.message,
        code:    dbError?.code,
        details: dbError?.details,
        hint:    dbError?.hint,
      });
      setLoading(false);
      setError(
        TEST_MODE && dbError
          ? `[INSERT orders] ${dbError.message}${dbError.code ? ` / ${dbError.code}` : ''}`
          : L.orderError
      );
      return;
    }

    const orderId = data.id;
    saveLocalOrder(orderId, new Date().toISOString());

    // Save contact for next visit (only on success)
    localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: name.trim(), phone: digitsOnly(phone) }));

    // Save vehicle for next visit (only on success)
    if (isCurbside && vehicleColor) {
      localStorage.setItem(VEHICLE_KEY, JSON.stringify({
        color:          vehicleColor,
        colorOtherText: sanitizeVehicleText(colorOtherText),
        brand:          vehicleBrand,
        brandOtherText: sanitizeVehicleText(brandOtherText),
      }));
    }

    /* INSERT order_contacts — fail silently */
    supabase
      .from('order_contacts')
      .insert({ order_id: orderId, name: name.trim(), phone: digitsOnly(phone) })
      .then(({ error: contactErr }) => {
        if (contactErr) console.error('[INSERT order_contacts] failed:', {
          message: contactErr.message, code: contactErr.code,
          details: contactErr.details, hint: contactErr.hint,
        });
      });

    clear();

    if (isBeam) {
      navigate(`/pay/${orderId}`);
    } else {
      navigate(`/track/${orderId}`);
    }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="page" style={{ paddingBottom: 120 }}>

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
          <div className="kicker">{L.checkoutKicker}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>{L.checkoutTitle}</div>
        </div>
      </div>

      {/* ── 1. วิธีรับ ──────────────────────────────────────── */}
      <div ref={methodRef} style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
          {L.sectionMethod}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
          padding: 4, borderRadius: 'var(--r-md)',
          background: 'var(--bg-3)',
          outline: submitHint === L.validMethod && !method ? '1.5px solid var(--accent)' : 'none',
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
                {L[m.key]}
              </div>
            </button>
          ))}
        </div>
        {submitHint === L.validMethod && !method && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5 }}>{L.validMethod}</div>
        )}
      </div>

      {/* ── 1b. รถของคุณ (curbside only) ──────────────────────── */}
      {isCurbside && (
        <div ref={vehicleRef} style={{ padding: '14px 18px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
            {L.sectionVehicle}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.55 }}>
            {L.vehicleDesc}
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
                  {(L as unknown as Record<string, string>)[c.labelKey]}
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
                placeholder={L.colorOtherPlaceholder}
                value={colorOtherText}
                onChange={e => { setColorOtherText(stripControl(e.target.value)); setSubmitHint(null); }}
                style={{
                  width: '100%', background: 'var(--bg-2)',
                  border: submitHint === L.validVehicleColorOther ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', padding: '8px 12px',
                  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {submitHint === L.validVehicleColorOther && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{L.validVehicleColorOther}</div>
              )}
            </div>
          )}
          {submitHint === L.validVehicleColor && !vehicleColor && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6 }}>{L.validVehicleColor}</div>
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
                  {L.brandOther}
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
                placeholder={L.brandOtherPlaceholder}
                value={brandOtherText}
                onChange={e => setBrandOtherText(stripControl(e.target.value))}
                style={{
                  width: '100%', background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', padding: '8px 12px',
                  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── 2. รับที่ (single line, hidden branch-picker component kept) ── */}
      {/* Branch picker component kept but not rendered — for future multi-branch use */}
      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink-3)', marginRight: 2 }}>{lang === 'th' ? 'รับที่' : 'Pickup at'}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 12.5, color: 'var(--ink)' }}>{SHOP.branchName}</span>
          <span style={{ color: 'var(--ink-3)' }}>·</span>
          <span style={{ color: 'var(--ink-3)' }}>{L.openUntil(shopCloseLabel())}</span>
          {LINKS.googleMaps && (
            <>
              <span style={{ color: 'var(--ink-3)' }}>·</span>
              <a
                href={LINKS.googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
              >
                {L.mapLink}
              </a>
            </>
          )}
        </div>
      </div>

      {/* ── 3. เวลารับ ──────────────────────────────────────── */}
      <div ref={timeRef} style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
          {L.sectionTime}
        </div>

        {/* Method not chosen yet */}
        {!method && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-3)',
          }}>
            {L.timeChooseMethodFirst}
          </div>
        )}

        {/* Shop closed */}
        {method && !shopInfo.isOpen && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(43,33,24,0.06)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-2)',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{L.shopClosedLabel}</span>
            {' · '}<span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{shopInfo.nextOpenMsg}</span>
          </div>
        )}

        {/* Near close — no slots available */}
        {method && shopInfo.isOpen && shopInfo.slots.length === 0 && (
          <div style={{
            padding: '12px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(43,33,24,0.06)', border: '1px solid var(--line)',
            fontSize: 13, color: 'var(--ink-2)',
          }}>
            {L.timeNearCloseMsg}
          </div>
        )}

        {/* Slot expired warning */}
        {slotExpiredMsg && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
            {L.timeExpiredMsg}
          </div>
        )}

        {/* Time slots grid */}
        {method && shopInfo.isOpen && shopInfo.slots.length > 0 && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
              outline: submitHint === L.validTime && selSlot === undefined ? '1.5px solid var(--accent)' : 'none',
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
                        {L.timeEarliestBadge}
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
                      {L.timeInMin(s.diffMin)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Confirmation line */}
            {selSlot !== undefined && selectedSlotObj && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-2)', fontWeight: 600 }}>
                {L.timeConfirm(selectedSlotObj.label)}
              </div>
            )}

            {/* Validation hint */}
            {submitHint === L.validTime && selSlot === undefined && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5 }}>{L.validTime}</div>
            )}
          </>
        )}
      </div>

      {/* ── 4. ผู้รับ ────────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            {L.sectionContact}
          </div>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--accent-2)',
            background: 'rgba(74,93,63,0.14)', padding: '3px 8px', borderRadius: 'var(--r-pill)',
          }}>
            {L.noSignupBadge}
          </span>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{L.nameLabel}</div>
          <input
            ref={nameRef}
            type="text"
            autoComplete="name"
            placeholder={L.namePlaceholder}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            style={{
              ...inputBase,
              border: nameTouched && !nameOk ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            }}
          />
          {nameTouched && !nameOk && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{L.nameError}</div>
          )}
        </div>

        {/* Phone */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{L.phoneLabel}</div>
          <input
            ref={phoneRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={L.phonePlaceholder}
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
          {phoneTouched && !phoneOk && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
              {phone.trim() === '' ? L.phoneErrorEmpty : L.phoneErrorInvalid}
            </div>
          )}
        </div>

        {/* PDPA — keep exactly as-is */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ color: 'var(--accent-2)', flexShrink: 0, marginTop: 1 }}>{I.check(12)}</span>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            {L.pdpaText}
          </span>
        </div>
      </div>

      {/* ── 5. ชำระเงิน ─────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>
          {L.sectionPayment}
        </div>
        {isCurbside && CURBSIDE_PROMPTPAY_ONLY && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--r-sm)', marginBottom: 6,
            background: 'var(--bg-3)', fontSize: 11, color: 'var(--ink-3)',
          }}>
            {L.curbsidePromptpayOnly}
          </div>
        )}
        {[
          { id: 'promptpay', label: L.promptpayLabel, sub: L.promptpaySub, icon: I.qr(16) },
          { id: 'cash',      label: L.cashLabel,      sub: L.cashSub,      icon: I.cash(16) },
        ]
          .filter(p => ENABLE_BEAM || p.id !== 'promptpay')
          .filter(p => !(isCurbside && CURBSIDE_PROMPTPAY_ONLY && p.id === 'cash'))
          .map(p => (
          <label
            key={p.id}
            onClick={() => setPayment(p.id)}
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
            {L.sectionSummary}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)' }}>
            <span style={{ fontFamily: 'var(--mono)' }}>{L.summaryNItems(itemCount, total)}</span>
            {I.chevron(14, summaryOpen ? 'up' : 'down')}
          </span>
        </button>

        {summaryOpen && (
          <div style={{
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
          {L.editCart}
        </button>
      </div>

      {/* ── Sticky button ────────────────────────────────────── */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '12px 18px calc(env(safe-area-inset-bottom, 0px) + 18px)',
        background: 'var(--bg)', borderTop: '1px solid var(--line)', zIndex: 30,
      }}>
        {error && (
          <div style={{
            marginBottom: 8, padding: '10px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(178,58,31,0.10)', color: 'var(--accent)',
            fontSize: 12, textAlign: 'center',
          }}>{error}</div>
        )}
        {submitHint && !error && (
          <div style={{
            marginBottom: 8, fontSize: 11, color: 'var(--accent)',
            textAlign: 'center', fontWeight: 600,
          }}>{submitHint}</div>
        )}
        <button
          onClick={handleConfirm}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 0, padding: '16px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.75 : 1,
          }}
        >
          <span>
            {loading
              ? L.orderLoading
              : !shopInfo.isOpen
                ? L.shopClosedLabel
                : payment === 'promptpay'
                  ? L.payBtnQR(total)
                  : L.payBtnCash(total)}
          </span>
          {!loading && <span>{I.arrow(14)}</span>}
        </button>
      </div>
    </div>
  );
}
