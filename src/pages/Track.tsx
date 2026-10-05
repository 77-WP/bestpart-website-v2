import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, type GetOrderResult, type GetOrderItem, normalizeOrderStatus, readFnError } from '../lib/supabase';
import { TabBar } from '../components/TabBar';
import { I } from '../components/icons';
import { SHOP } from '../config/shop';
import { LINKS } from '../config/links';
import { TEST_MODE } from '../config/env';
import { useT, DICT } from '../i18n';
import type { Dict } from '../i18n';
import { getLocalOrders } from '../lib/localOrders';

/* ── Bangkok time (UTC+7) — never uses system timezone ──────── */
function toBkkHHMM(date: Date): string {
  const bkk = new Date(date.getTime() + 7 * 3_600_000);
  return `${String(bkk.getUTCHours()).padStart(2, '0')}:${String(bkk.getUTCMinutes()).padStart(2, '0')}`;
}

/* ── ETA: estimated_ready_at → requested_ready_at → fallback ── */
function calcEta(order: GetOrderResult): { hhmm: string; minsLeft: number } | null {
  let etaMs: number;
  if (order.estimated_ready_at) {
    etaMs = new Date(order.estimated_ready_at).getTime();
  } else if (order.requested_ready_at) {
    etaMs = new Date(order.requested_ready_at).getTime();
  } else {
    etaMs = new Date(order.ordered_at).getTime() + SHOP.prepMinutes * 60_000;
  }
  const minsLeft = Math.max(0, Math.round((etaMs - Date.now()) / 60_000));
  return { hhmm: toBkkHHMM(new Date(etaMs)), minsLeft };
}

/* ── Step index mapping for progress bar ──────────────────── */
const BAR_STEP: Record<string, number> = {
  awaiting_payment: -1,
  pending:           0,
  preparing:         1,
  ready:             2,
  completed:         3,
  cancelled:        -1,
};

/* ── Loading skeleton ────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="page" style={{ paddingBottom: 120 }}>
      <div style={{
        paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        paddingBottom: 12, padding: '0 18px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg-3)' }} />
        <div style={{ width: 120, height: 14, borderRadius: 4, background: 'var(--bg-3)', marginTop: 8 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 18px 0', gap: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-3)' }} />
        <div style={{ width: 160, height: 22, borderRadius: 4, background: 'var(--bg-3)' }} />
        <div style={{ width: 120, height: 12, borderRadius: 4, background: 'var(--bg-3)' }} />
      </div>
    </div>
  );
}

/* ── Not found ────────────────────────────────────────────── */
function OrderNotFound({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  const { t: tLocal } = useT();
  return (
    <div className="page" style={{
      paddingBottom: 80, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', gap: 12, textAlign: 'center', padding: '0 32px',
    }}>
      <div style={{ fontSize: 40, opacity: 0.3 }}>{I.receipt(40)}</div>
      <div className="h-display-th" style={{ fontSize: 18, color: 'var(--ink-2)' }}>{tLocal('track.notFound')}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>#{orderId.slice(0, 8)}</div>
      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
          border: 0, padding: '12px 24px', borderRadius: 'var(--r-pill)',
          fontWeight: 600, fontSize: 13,
        }}
      >{tLocal('track.backHome')}</button>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function Track() {
  const { orderId }   = useParams<{ orderId: string }>();
  const navigate      = useNavigate();
  const { t, lang, dict } = useT();

  const [order,      setOrder]     = useState<(GetOrderResult & { status: string }) | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [notFound,   setNotFound]  = useState(false);
  const [loadError,  setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const prevStatus = useRef<string>('');
  const [animKey,  setAnimKey]  = useState(0);

  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Polling (replaces initial fetch + realtime) ─────────── */
  useEffect(() => {
    if (!orderId) { setLoading(false); setNotFound(true); return; }
    let stopped = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      if (stopped) return;
      const { data, error } = await supabase.functions.invoke('get-order', {
        body: { order_id: orderId },
      });
      if (stopped) return;
      if (error || !data) {
        const { code } = error ? await readFnError(error) : { code: 'fallback' };
        if (code === 'not_found') {
          setNotFound(true);
          stopped = true;
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        } else if (loading) {
          setLoadError(true);
        }
        if (loading) setLoading(false);
        return;
      }
      setLoadError(false);
      const raw = data as GetOrderResult;
      const normalized = normalizeOrderStatus(raw.status);
      if (normalized !== prevStatus.current) {
        prevStatus.current = normalized;
        setAnimKey(k => k + 1);
        document.title = statusDocTitle(normalized, lang as 'th' | 'en');
      }
      setOrder({ ...raw, status: normalized });
      setLoading(false);
      // Stop polling on terminal status
      if (normalized === 'completed' || normalized === 'cancelled') {
        stopped = true;
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      }
    }

    function startInterval() {
      if (stopped || pollInterval) return;
      pollInterval = setInterval(poll, 5000);
    }
    function stopInterval() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }
    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        stopInterval();
      } else {
        poll();
        startInterval();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    poll();
    startInterval();

    return () => {
      stopped = true;
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [orderId, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sheet helpers ────────────────────────────────────── */
  function openSheet()  {
    setSheetVisible(true);
    requestAnimationFrame(() => setSheetOpen(true));
  }
  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => setSheetVisible(false), 300);
  }

  if (loading)            return <Skeleton />;
  if (notFound)           return <OrderNotFound orderId={orderId ?? ''} />;
  if (loadError || !order) return (
    <div className="page" style={{
      paddingBottom: 80, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', gap: 12, textAlign: 'center', padding: '0 32px',
    }}>
      <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('track.loadError')}</div>
      <button
        onClick={() => { setLoadError(false); setLoading(true); setRetryCount(c => c + 1); }}
        style={{
          background: 'var(--ink)', color: 'var(--on-accent)',
          border: 0, padding: '12px 24px', borderRadius: 'var(--r-pill)',
          fontWeight: 600, fontSize: 13,
        }}
      >{t('track.retry')}</button>
    </div>
  );

  const status   = order.status ?? 'pending';
  const stepIdx  = BAR_STEP[status] ?? -1;
  const isCash   = order.payment_method === 'cash';
  const isReady  = status === 'ready';
  const isDone   = status === 'completed';

  /* ── Items ────────────────────────────────────────────── */
  const orderItems: GetOrderItem[] = (order.items ?? [])
    .filter(it => TEST_MODE || it.name !== 'ทดสอบ ฿1');

  /* ── Recipient label ──────────────────────────────────── */
  const lo = getLocalOrders().find(o => o.id === orderId);
  const label = lo?.name ?? order.call_name ?? `#${orderId!.slice(0, 8)}`;
  const labelIsName = !label.startsWith('#');

  /* ── ETA line ─────────────────────────────────────────── */
  const eta     = calcEta(order);
  const showEta = status === 'pending' || status === 'preparing';

  /* ── Customer name from localStorage ─────────────────── */
  const customerName = lo?.name ?? '';

  /* ── Created time ─────────────────────────────────────── */
  const createdHHMM = toBkkHHMM(new Date(order.ordered_at));

  /* ── Hero config ──────────────────────────────────────── */
  const hero = heroConfig(status, t, customerName);

  const animStyle: React.CSSProperties = reducedMotion ? {} : {
    animation: `bpFadeIn 0.35s ease both`,
  };

  return (
    <div className="page" style={{ paddingBottom: 120 }}>
      <style>{`
        @keyframes bpFadeIn {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bpSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        paddingBottom: 12, paddingLeft: 18, paddingRight: 18,
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate('/orders')}
          style={{ background: 'none', border: 0, padding: '4px 4px 4px 0', color: 'var(--ink)', flexShrink: 0 }}
          aria-label={t('track.back')}
        >
          {I.back(22)}
        </button>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>
          {t('track.title')}
        </div>
      </div>

      {/* ── Hero ──────────────────────────────────────────── */}
      <div
        key={animKey}
        style={{ padding: '28px 24px 0', textAlign: 'center', ...animStyle }}
      >
        {/* Icon circle */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto',
          background: hero.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: hero.color,
          ...(isReady && !reducedMotion ? {
            boxShadow: `0 0 0 8px ${hero.bg}`,
            outline: `2px solid ${hero.color}`,
          } : {}),
        }}>
          <hero.Icon />
        </div>

        {/* Headline */}
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 22, marginTop: 14, lineHeight: 1.25,
          color: hero.color,
        }}>
          {hero.headline}
        </div>

        {/* Sub-line */}
        {hero.sub && (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
            {hero.sub.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* ETA sub-line */}
        {showEta && eta && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
            {eta.minsLeft > 0
              ? t('track.eta', eta.hhmm, eta.minsLeft)
              : t('track.almostReady')}
          </div>
        )}

        {/* Awaiting payment — go to pay button */}
        {status === 'awaiting_payment' && (
          <button
            onClick={() => navigate(`/pay/${orderId}`)}
            style={{
              marginTop: 18, background: 'var(--gold)', color: '#fff',
              border: 0, padding: '13px 28px', borderRadius: 'var(--r-pill)',
              fontWeight: 700, fontSize: 14, letterSpacing: '0.03em',
            }}
          >
            {t('track.goToPay')}
          </button>
        )}

        {/* Created time */}
        {status !== 'completed' && status !== 'awaiting_payment' && (
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 8, letterSpacing: '.05em' }}>
            {lang === 'en' ? SHOP.branchNameEn : SHOP.branchName} · {createdHHMM}
          </div>
        )}
      </div>

      {/* ── Step progress row ─────────────────────────────── */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {(dict['track.steps'] as string[]).map((label, i) => {
            const done    = stepIdx >= i;
            const current = stepIdx === i;
            const isLast  = i === (dict['track.steps'] as string[]).length - 1;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line */}
                {!isLast && (
                  <div style={{
                    position: 'absolute', top: 11, left: '50%', width: '100%',
                    height: 2, background: stepIdx > i ? 'var(--accent)' : 'var(--line)',
                    transition: reducedMotion ? 'none' : 'background 0.4s',
                  }} />
                )}
                {/* Circle */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: done ? 'var(--accent)' : 'var(--bg-3)',
                  border: done ? '0' : '1.5px solid var(--line-2)',
                  display: 'grid', placeItems: 'center', color: '#fff',
                  position: 'relative', zIndex: 1,
                  boxShadow: current && !reducedMotion
                    ? '0 0 0 5px rgba(181,81,30,0.18)' : 'none',
                  transition: reducedMotion ? 'none' : 'all 0.4s',
                }}>
                  {done && I.check(12)}
                </div>
                {/* Label */}
                <div style={{
                  fontSize: 9, fontWeight: done ? 700 : 400,
                  color: done ? 'var(--ink)' : 'var(--ink-3)',
                  marginTop: 5, textAlign: 'center', letterSpacing: '0.04em',
                  lineHeight: 1.3,
                }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Cash banner ───────────────────────────────────── */}
      {isCash && !isDone && (
        <div style={{
          margin: '20px 18px 0',
          padding: '10px 14px',
          background: 'rgba(184,134,46,0.12)',
          border: '1px solid rgba(184,134,46,0.30)',
          borderRadius: 'var(--r-sm)',
          fontSize: 13, color: 'var(--gold)', fontWeight: 600, textAlign: 'center',
        }}>
          {t('track.cashBanner', order.grand_total)}
        </div>
      )}

      {/* ── Staff card ────────────────────────────────────── */}
      <div style={{
        margin: '16px 18px 0',
        padding: '14px 16px',
        background: isDone ? 'var(--bg-2)' : 'var(--ink)',
        borderRadius: 'var(--r-md)',
        border: isReady ? `2px solid var(--accent)` : 'none',
        transition: reducedMotion ? 'none' : 'all 0.4s',
        opacity: isDone ? 0.55 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Show to staff badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
          color: isDone ? 'var(--ink-3)' : 'rgba(251,243,227,0.55)',
          marginBottom: 6,
        }}>
          {I.receipt(10)}
          {t('track.showToStaff').toUpperCase()}
        </div>

        {/* Recipient name / order identifier */}
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: labelIsName ? 28 : 22,
          lineHeight: 1.1,
          color: isDone ? 'var(--ink-2)' : '#FBF3E3',
        }}>
          {label}
        </div>
        {labelIsName && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: isDone ? 'var(--ink-3)' : 'rgba(251,243,227,0.5)',
            marginTop: 2,
          }}>
            {order.call_name ?? `#${orderId!.slice(0, 8)}`}
          </div>
        )}

        {/* Payment badge */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
          padding: '3px 8px', borderRadius: 'var(--r-pill)',
          background: isDone ? 'var(--bg-3)' : 'rgba(255,255,255,0.12)',
          color: isDone ? 'var(--ink-3)'
            : isCash && !isDone ? 'rgba(251,243,227,0.65)' : 'rgba(251,243,227,0.8)',
        }}>
          {isDone
            ? t('track.collected')
            : isCash
              ? t('track.cash')
              : t('track.paid')}
        </div>
      </div>

      {/* ── Items row (collapsible trigger) ───────────────── */}
      <button
        onClick={openSheet}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', margin: '12px 0 0',
          padding: '14px 18px',
          background: 'none', border: 0,
          borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)' }}>
          {t('track.nItems', orderItems.length || 1, order.grand_total)}
        </span>
        {I.chevron(16, 'down')}
      </button>

      {/* ── Directions button ─────────────────────────────── */}
      <div style={{ padding: '12px 18px 0' }}>
        <a
          href={LINKS.googleMaps ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '13px 0',
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-pill)', color: 'var(--ink)',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}
        >
          {I.pin(16)}
          {t('track.directions')}
        </a>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div style={{
        padding: '18px 24px 0', textAlign: 'center',
        fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6,
      }}>
        {!isDone ? (
          <>
            <div>{t('track.footer')}</div>
            <div style={{ marginTop: 6 }}>
              <a
                href="/order"
                onClick={e => { e.preventDefault(); navigate('/order'); }}
                style={{ color: 'var(--ink-3)', textDecoration: 'underline', fontSize: 11 }}
              >
                {t('track.orderMore')}
              </a>
            </div>
          </>
        ) : (
          <a
            href="/orders"
            onClick={e => { e.preventDefault(); navigate('/orders'); }}
            style={{ color: 'var(--ink-3)', textDecoration: 'underline', fontSize: 11 }}
          >
            {t('track.allOrders')}
          </a>
        )}
      </div>

      {/* ── Items bottom sheet ────────────────────────────── */}
      {sheetVisible && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(43,33,24,0.6)',
            opacity: sheetOpen ? 1 : 0,
            transition: reducedMotion ? 'none' : 'opacity 0.2s',
          }}
          onClick={closeSheet}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--bg)',
              borderRadius: '16px 16px 0 0',
              maxHeight: '80dvh',
              overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
              transition: reducedMotion ? 'none' : 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div style={{
              position: 'sticky', top: 0, background: 'var(--bg)',
              padding: '16px 18px 12px',
              borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>
                {t('track.nItems', orderItems.length || 1, order.grand_total)}
              </div>
              <button
                onClick={closeSheet}
                style={{ background: 'none', border: 0, padding: 4, color: 'var(--ink)' }}
              >
                {I.close(20)}
              </button>
            </div>

            {/* Items */}
            <div style={{ padding: '8px 0' }}>
              {orderItems.length === 0 ? (
                <div style={{ padding: '24px 18px', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>
                  {t('track.noItems')}
                </div>
              ) : (
                orderItems.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 18px',
                      borderBottom: i < orderItems.length - 1 ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>
                          {lang === 'en' && it.name_en ? it.name_en : it.name}
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', marginLeft: 6 }}>
                            ×{it.qty}
                          </span>
                        </div>
                        {/* Customization summary */}
                        <ItemCustomSummary item={it} />
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, flexShrink: 0 }}>
                        ฿{it.line_total}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total row */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--line)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-2)' }}>
                {t('track.total')}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }}>
                ฿{order.grand_total}
              </div>
            </div>
          </div>
        </div>
      )}

      <TabBar active="orders" />
    </div>
  );
}

/* ── Item customization summary line ──────────────────────── */
function ItemCustomSummary({ item }: { item: GetOrderItem }) {
  const parts: string[] = [];
  if (item.variant) parts.push(item.variant);
  if (Array.isArray(item.modifiers)) {
    item.modifiers.forEach(m => { if (m.name) parts.push(m.name); });
  }
  if (parts.length === 0) return null;
  return (
    <div style={{
      fontSize: 11, color: 'var(--ink-3)', marginTop: 3,
      lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', gap: '0 4px',
    }}>
      {parts.map((p, i) => (
        <span key={i}>
          {p}{i < parts.length - 1 ? ' ·' : ''}
        </span>
      ))}
    </div>
  );
}

/* ── Hero config per status ───────────────────────────────── */
type HeroConf = {
  headline: string;
  sub:      string | null;
  color:    string;
  bg:       string;
  Icon:     () => React.ReactNode;
};

function heroConfig(status: string, t: (key: keyof Dict, ...args: any[]) => string, customerName: string): HeroConf {
  switch (status) {
    case 'awaiting_payment':
      return {
        headline: t('track.awaitingHeadline'),
        sub:      null,
        color:    'var(--gold)',
        bg:       'rgba(184,134,46,0.14)',
        Icon:     () => I.qr(32),
      };
    case 'pending': {
      return {
        headline: t('track.pendingHeadline', customerName),
        sub:      null,
        color:    'var(--gold)',
        bg:       'rgba(184,134,46,0.14)',
        Icon:     () => I.receipt(32),
      };
    }
    case 'preparing':
      return {
        headline: t('track.preparingHeadline'),
        sub:      null,
        color:    'var(--accent-2)',
        bg:       'rgba(74,93,63,0.14)',
        Icon:     () => I.dinein(32),
      };
    case 'ready':
      return {
        headline: t('track.readyHeadline'),
        sub:      t('track.readySub'),
        color:    'var(--accent)',
        bg:       'rgba(181,81,30,0.14)',
        Icon:     () => I.check(34),
      };
    case 'completed':
      return {
        headline: t('track.completedHeadline'),
        sub:      `${t('track.completedSub')}\n${t('track.completedSub2')}`,
        color:    'var(--accent-2)',
        bg:       'rgba(74,93,63,0.14)',
        Icon:     () => I.receipt(30),
      };
    default:
      return {
        headline: t('track.unknownHeadline'),
        sub:      t('track.unknownSub'),
        color:    'var(--ink-3)',
        bg:       'var(--bg-3)',
        Icon:     () => I.info(30),
      };
  }
}

/* ── Document title ───────────────────────────────────────── */
function statusDocTitle(status: string, lang: 'th' | 'en'): string {
  const d = DICT[lang];
  const map: Record<string, keyof typeof d> = {
    awaiting_payment: 'track.awaitingHeadline',
    pending:          'track.pendingHeadline',
    preparing:        'track.preparingHeadline',
    ready:            'track.readyHeadline',
    completed:        'track.completedHeadline',
  };
  const key = map[status];
  if (!key) return d['track.title'] as string;
  const val = d[key];
  return typeof val === 'string' ? val : (d['track.title'] as string);
}
