import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, readFnError } from '../lib/supabase';
import { useT } from '../i18n';
import type { GetOrderResult } from '../lib/supabase';
import { I } from '../components/icons';
import { TEST_MODE } from '../config/env';

type QrState =
  | { phase: 'loading' }
  | { phase: 'ready'; qrImage: string; expiresAt: string; chargeId: string; amountSatang: number }
  | { phase: 'expired' }
  | { phase: 'error'; message: string };

/* ── Countdown to expiry ─────────────────────────────────── */
function useCountdown(expiresAt: string | null): number | null {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) { setSecs(null); return; }
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
      setSecs(remaining);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  return secs;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export default function Pay() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate    = useNavigate();
  const { t }       = useT();

  const [state, setState]         = useState<QrState>({ phase: 'loading' });
  const [callName, setCallName]   = useState<string | null>(null);
  const [showQrOverlay, setShowQrOverlay] = useState(false);
  const paidRef      = useRef(false);
  const qrFileRef    = useRef<File | null>(null);
  const [qrFileReady, setQrFileReady] = useState(false);

  const fetchPromiseRef = useRef<{ orderId: string; promise: Promise<void> } | null>(null);

  const expiresAt = state.phase === 'ready' ? state.expiresAt : null;
  const countdown = useCountdown(expiresAt);
  const qrBase64  = state.phase === 'ready' ? state.qrImage : null;

  const [showSuccess, setShowSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Navigate to track once paid — show success overlay first */
  const handlePaid = useCallback(() => {
    if (paidRef.current) return;
    paidRef.current = true;
    setShowSuccess(true);
    successTimerRef.current = setTimeout(() => {
      navigate(`/track/${orderId}`, { replace: true });
    }, 2200);
  }, [navigate, orderId]);

  /* Cleanup success timer on unmount */
  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  /* Fetch / refresh QR from edge function */
  const fetchQr = useCallback(async () => {
    if (!orderId) return;
    if (fetchPromiseRef.current?.orderId === orderId) {
      return fetchPromiseRef.current.promise;
    }
    qrFileRef.current = null;
    setQrFileReady(false);
    setState({ phase: 'loading' });
    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-beam-charge', {
          body: { order_id: orderId },
        });
        if (error || !data) {
          const rawMsg  = error?.message ?? 'ไม่สามารถสร้าง QR ได้';
          const context = (error as unknown as { context?: { body?: string; status?: number } })?.context;
          const detail  = context?.body   ? ` — ${context.body}`        : '';
          const status  = context?.status ? ` (HTTP ${context.status})` : '';
          console.error('[create-beam-charge] failed:', { message: rawMsg, context });
          setState({
            phase:   'error',
            message: TEST_MODE ? `[create-beam-charge] ${rawMsg}${status}${detail}` : 'ไม่สามารถสร้าง QR ได้',
          });
          return;
        }
        setState({
          phase:        'ready',
          qrImage:      data.qr_image,
          expiresAt:    data.expires_at,
          chargeId:     data.charge_id,
          amountSatang: data.amount,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด';
        setState({ phase: 'error', message: msg });
      } finally {
        if (fetchPromiseRef.current?.orderId === orderId) {
          fetchPromiseRef.current = null;
        }
      }
    })();
    fetchPromiseRef.current = { orderId, promise };
    return promise;
  }, [orderId]);

  /* Initial QR load */
  useEffect(() => { fetchQr(); }, [fetchQr]);

  /* Poll get-order every 5s: fetch call_name on first hit, check payment_status */
  useEffect(() => {
    if (!orderId) return;
    let stopped = false;

    async function poll() {
      if (stopped) return;
      const { data, error } = await supabase.functions.invoke('get-order', { body: { order_id: orderId } });
      if (stopped) return;
      if (error || !data) {
        if (error) await readFnError(error); // fail silently
        return;
      }
      const row = data as GetOrderResult;
      if (row.call_name) setCallName(prev => prev ?? row.call_name);
      if (row.payment_status === 'paid') handlePaid();
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => { stopped = true; clearInterval(interval); };
  }, [orderId, handlePaid]);

  /* Mark expired */
  useEffect(() => {
    if (state.phase === 'ready' && countdown === 0) {
      setState({ phase: 'expired' });
    }
  }, [countdown, state.phase]);

  /* Pre-prepare QR file on canvas as soon as QR image loads */
  useEffect(() => {
    if (!qrBase64) { qrFileRef.current = null; setQrFileReady(false); return; }
    const SIZE = 1024;
    const QUIET = Math.round(SIZE * 0.10); // 10% quiet zone each side
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, QUIET, QUIET, SIZE - QUIET * 2, SIZE - QUIET * 2);
      canvas.toBlob((blob) => {
        if (!blob) return;
        qrFileRef.current = new File([blob], 'promptpay-qr.png', { type: 'image/png' });
        setQrFileReady(true);
      }, 'image/png');
    };
    img.src = `data:image/png;base64,${qrBase64}`;
  }, [qrBase64]);


  /* ── Save QR ──────────────────────────────────────────────  */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'hint'>('idle');

  /* canShare is evaluated at render time from the pre-built file */
  const canShareQr = qrFileReady && qrFileRef.current != null
    && !!navigator.canShare?.({ files: [qrFileRef.current] });

  const handleSaveQr = useCallback(() => {
    if (state.phase !== 'ready' || !qrFileRef.current) return;
    const file = qrFileRef.current;

    if (canShareQr) {
      /* Synchronous call — no await before this line so iOS user gesture is preserved */
      navigator.share({ files: [file], title: 'PromptPay QR' })
        .then(() => { setSaveStatus('saved'); })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') {
            setSaveStatus('idle');
          } else {
            /* Share failed — fall through to overlay / download */
            if (isIOS()) {
              setShowQrOverlay(true);
            } else {
              const url = URL.createObjectURL(file);
              const a   = document.createElement('a');
              a.href     = url;
              a.download = 'promptpay-qr.png';
              a.click();
              URL.revokeObjectURL(url);
              setSaveStatus('saved');
            }
          }
        });
      return;
    }

    if (isIOS()) {
      setShowQrOverlay(true);
      return;
    }

    /* Android / desktop fallback */
    const url = URL.createObjectURL(file);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'promptpay-qr.png';
    a.click();
    URL.revokeObjectURL(url);
    setSaveStatus('saved');
  }, [state, canShareQr]);

  /* ── Display helpers ──────────────────────────────────────  */
  const displayMins = countdown !== null ? Math.floor(countdown / 60) : 0;
  const displaySecs = countdown !== null ? countdown % 60 : 0;
  const nearExpiry  = countdown !== null && countdown < 300; // < 5 min

  const orderNumStr = callName ?? orderId?.slice(-4).toUpperCase() ?? '';

  /* ── QR size: ~70% of max-width (480) ──────────────────── */
  const QR_SIZE = 280;

  return (
    <div className="page" style={{ paddingBottom: 40 }}>

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
        padding: '16px 18px 12px', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}
        >{I.back(22)}</button>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{t('pay.title')}</div>
      </div>

      {/* Loading skeleton */}
      {state.phase === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 18px', gap: 14 }}>
          <div style={{ width: QR_SIZE, height: QR_SIZE, borderRadius: 'var(--r-md)', background: 'var(--bg-3)' }} />
          <div style={{ width: 160, height: 12, borderRadius: 4, background: 'var(--bg-3)' }} />
          <div style={{ width: 120, height: 12, borderRadius: 4, background: 'var(--bg-3)' }} />
        </div>
      )}

      {/* QR ready */}
      {state.phase === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 0', gap: 0 }}>

          {/* Amount */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 38, fontWeight: 700, lineHeight: 1,
          }}>
            ฿{(state.amountSatang / 100).toFixed(2)}
          </div>
          {orderNumStr && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
              {t('pay.orderLabel', orderNumStr)}
            </div>
          )}

          {/* QR in white frame */}
          <div style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            border: '1.5px solid var(--line)',
            background: '#fff',
            boxShadow: '0 2px 16px -4px rgba(43,33,24,0.10)',
          }}>
            <img
              src={`data:image/png;base64,${state.qrImage}`}
              alt="PromptPay QR"
              style={{ width: QR_SIZE, height: QR_SIZE, display: 'block' }}
            />
          </div>

          {/* Save QR button — full width dark */}
          <button
            onClick={handleSaveQr}
            disabled={saveStatus === 'saving' || !qrFileReady}
            style={{
              marginTop: 16, width: '100%',
              background: saveStatus === 'saved' ? 'rgba(74,93,63,0.10)' : 'var(--ink)',
              color: saveStatus === 'saved' ? 'var(--accent-2)' : '#fff',
              border: saveStatus === 'saved' ? '1px solid var(--line)' : 0,
              padding: '14px 18px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: (saveStatus === 'saving' || !qrFileReady) ? 'default' : 'pointer',
              opacity: !qrFileReady ? 0.5 : 1,
            }}
          >
            {saveStatus === 'saved' ? I.check(16) : I.download(16)}
            {saveStatus === 'saving'
              ? t('pay.saveQrSaving')
              : saveStatus === 'saved'
                ? t('pay.saveQrDone')
                : t('pay.saveQrBtn')}
          </button>

          {/* Countdown */}
          <div style={{
            marginTop: 16, width: '100%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--r-pill)',
            background: nearExpiry ? 'rgba(178,58,31,0.08)' : 'var(--bg-3)',
            fontSize: 13,
            color: nearExpiry ? 'var(--accent)' : 'var(--ink-2)',
          }}>
            <span style={{ color: nearExpiry ? 'var(--accent)' : 'var(--ink-3)' }}>{I.clock(14)}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>
              {t('pay.countdownLabel',
                String(displayMins).padStart(2, '0'),
                String(displaySecs).padStart(2, '0')
              )}
            </span>
          </div>

          {/* 3-step row */}
          <div style={{
            marginTop: 20, width: '100%',
            display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
          }}>
            {[
              { icon: I.download(20), label: t('pay.stepSave') },
              { icon: I.smartphone(20), label: t('pay.stepOpenApp') },
              { icon: I.qr(20), label: t('pay.stepScanPhoto') },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                flex: 1, padding: '0 4px',
              }}>
                <span style={{ color: 'var(--ink-3)' }}>{step.icon}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.35 }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Waiting indicator */}
          <div style={{
            marginTop: 20, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: 'var(--ink-2)', fontWeight: 500,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-2)',
              flexShrink: 0,
              animation: 'bp-pulse 1.8s ease-in-out infinite',
            }} />
            {t('pay.waitingStatus')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 8 }}>
            {t('pay.waitingMsg')}
          </div>
        </div>
      )}

      {/* Expired */}
      {state.phase === 'expired' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '48px 24px', gap: 12, textAlign: 'center',
        }}>
          <div style={{ color: 'var(--ink-3)', opacity: 0.5 }}>{I.clock(48)}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{t('pay.expiredTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{t('pay.expiredSub')}</div>
          <button
            onClick={fetchQr}
            style={{
              marginTop: 8, background: 'var(--accent)', color: 'var(--on-accent)',
              border: 0, padding: '14px 32px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13, letterSpacing: '.04em', cursor: 'pointer',
            }}
          >
            {t('pay.expiredBtn')}
          </button>
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '48px 24px', gap: 12, textAlign: 'center',
        }}>
          <div style={{ color: 'var(--ink-3)', opacity: 0.5 }}>{I.receipt(48)}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{t('pay.errorTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{state.message}</div>
          <button
            onClick={fetchQr}
            style={{
              marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
              border: 0, padding: '14px 32px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {t('pay.retryBtn')}
          </button>
        </div>
      )}

      {/* Payment success overlay */}
      {showSuccess && (
        <div
          onClick={() => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            navigate(`/track/${orderId}`, { replace: true });
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'var(--bg)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '32px 24px',
            animation: 'bpPaySuccess 0.28s ease both',
          }}
        >
          <style>{`
            @keyframes bpPaySuccess {
              from { opacity: 0; transform: scale(0.96); }
              to   { opacity: 1; transform: scale(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              .bp-pay-success-overlay { animation: none !important; }
            }
          `}</style>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(74,93,63,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-2)',
          }}>
            {I.check(34)}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, textAlign: 'center', color: 'var(--ink)' }}>
            {t('pay.successTitle')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', textAlign: 'center' }}>
            {t('pay.successSub')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>
            {t('pay.successSub2')}
          </div>
        </div>
      )}

      {/* iOS overlay — long-press to save */}
      {showQrOverlay && state.phase === 'ready' && (
        <div
          onClick={() => setShowQrOverlay(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(43,33,24,0.82)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20,
            padding: '32px 24px',
          }}
        >
          <img
            className="qr-save-img"
            src={`data:image/png;base64,${state.qrImage}`}
            alt="PromptPay QR"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280, height: 280,
              borderRadius: 16,
              background: '#fff',
              padding: 12,
              display: 'block',
            }}
          />
          <div style={{
            fontSize: 13, color: '#fffdf8', textAlign: 'center', lineHeight: 1.6,
          }}>
            {t('pay.saveQrOverlayHint')}
          </div>
          <button
            onClick={() => setShowQrOverlay(false)}
            style={{
              marginTop: 4, background: 'rgba(255,255,255,0.12)',
              color: '#fffdf8', border: '1px solid rgba(255,255,255,0.25)',
              padding: '12px 28px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {t('pay.closeOverlay')}
          </button>
        </div>
      )}
    </div>
  );
}
