import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, readFnError } from '../lib/supabase';
import { useT } from '../i18n';
import type { GetOrderResult } from '../lib/supabase';
import { I } from '../components/icons';
import { TEST_MODE } from '../config/env';
import { HelpLink } from '../components/HelpLink';
import { track } from '../lib/analytics';

type QrState =
  | { phase: 'loading' }
  | { phase: 'ready'; qrImage: string; expiresAt: string; chargeId: string; amountSatang: number }
  | { phase: 'expired' }
  | { phase: 'error'; message: string; code?: string };

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

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Line\/|FBAN|FBAV|Instagram|TikTok|BytedanceWebview/i.test(ua);
}

export default function Pay() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate    = useNavigate();
  const { t }       = useT();

  const [state, setState]         = useState<QrState>({ phase: 'loading' });
  const [callName, setCallName]   = useState<string | null>(null);
  const [showQrOverlay, setShowQrOverlay] = useState(false);
  const [saveSheetUrl,  setSaveSheetUrl]  = useState<string | null>(null);
  const [copiedLink,    setCopiedLink]    = useState(false);
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
        /* ── Amount cross-check against get-order ─────────── */
        const amountSatang = data.amount as number;
        let verifiedAmountSatang = amountSatang;

        const fetchOrderAmount = async (): Promise<number | null> => {
          const { data: od, error: oe } = await supabase.functions.invoke('get-order', {
            body: { order_id: orderId },
          });
          if (oe || !od) return null;
          return Math.round((od as GetOrderResult).grand_total * 100);
        };

        let expected = await fetchOrderAmount();
        if (expected === null) {
          expected = await fetchOrderAmount(); // retry once on network failure
        }

        if (expected !== null) {
          if (expected !== amountSatang) {
            track('payment_failed', { code: 'amount_mismatch' });
            setState({ phase: 'error', message: t('pay.amountMismatch'), code: 'amount_mismatch' });
            return;
          }
          verifiedAmountSatang = expected;
        }
        // if expected === null after retry, show QR without blocking

        setState({
          phase:        'ready',
          qrImage:      data.qr_image,
          expiresAt:    data.expires_at,
          chargeId:     data.charge_id,
          amountSatang: verifiedAmountSatang,
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

  /* ── Display helpers (declared early — used in canvas effect below) ── */
  const orderNumStr = callName ?? orderId?.slice(-4).toUpperCase() ?? '';

  /* Pre-prepare composite QR image on canvas as soon as QR loads */
  useEffect(() => {
    if (!qrBase64) { qrFileRef.current = null; setQrFileReady(false); return; }

    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    const logoImg = new Image();
    const qrImg   = new Image();
    let loaded = 0;

    const amountSatang  = state.phase === 'ready' ? state.amountSatang : 0;
    const amountStr     = `฿${(amountSatang / 100).toFixed(2)}`;
    const orderLabel    = orderNumStr ? `${t('pay.qrCardOrderPrefix')} ${orderNumStr}` : '';
    const footerText    = t('pay.qrCardFooter');

    function drawComposite() {
      if (cancelled) return;

      // Background
      ctx!.fillStyle = '#FBF3E3';
      ctx!.fillRect(0, 0, W, H);

      // Logo (top center, max 240×160)
      const logoMaxW = 240, logoMaxH = 160, logoPadTop = 110;
      const lw0 = logoImg.naturalWidth || logoMaxW;
      const lh0 = logoImg.naturalHeight || logoMaxH;
      const logoScale = Math.min(logoMaxW / lw0, logoMaxH / lh0);
      const lw = Math.round(lw0 * logoScale);
      const lh = Math.round(lh0 * logoScale);
      ctx!.drawImage(logoImg, (W - lw) / 2, logoPadTop, lw, lh);

      // Amount (large mono)
      const amountY = logoPadTop + lh + 88;
      ctx!.fillStyle = '#2B2118';
      ctx!.textAlign = 'center';
      ctx!.font = '700 90px "DM Mono", monospace';
      ctx!.fillText(amountStr, W / 2, amountY);

      // Order label
      if (orderLabel) {
        ctx!.font = '400 38px "DM Sans", sans-serif';
        ctx!.fillStyle = '#8C7B6A';
        ctx!.fillText(orderLabel, W / 2, amountY + 58);
      }

      // QR white card (large)
      const qrSize = 520;
      const qrPad  = 28;
      const qrX    = (W - qrSize) / 2;
      const qrY    = amountY + (orderLabel ? 100 : 60);
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.roundRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 24);
      ctx!.fill();
      ctx!.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Footer
      ctx!.font = '400 34px "DM Sans", sans-serif';
      ctx!.fillStyle = '#8C7B6A';
      ctx!.fillText(footerText, W / 2, H - 72);

      // Export
      try {
        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          qrFileRef.current = new File([blob], 'promptpay-qr.png', { type: 'image/png' });
          setQrFileReady(true);
        }, 'image/png');
      } catch {
        // Tainted canvas (e.g. cross-origin logo) — fall back to plain QR file
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width  = 1024;
        fallbackCanvas.height = 1024;
        const fc = fallbackCanvas.getContext('2d');
        if (fc) {
          fc.fillStyle = '#ffffff';
          fc.fillRect(0, 0, 1024, 1024);
          const q = Math.round(1024 * 0.10);
          fc.drawImage(qrImg, q, q, 1024 - q * 2, 1024 - q * 2);
          fallbackCanvas.toBlob((blob2) => {
            if (!blob2 || cancelled) return;
            qrFileRef.current = new File([blob2], 'promptpay-qr.png', { type: 'image/png' });
            setQrFileReady(true);
          }, 'image/png');
        }
      }
    }

    function onLoad() {
      loaded++;
      if (loaded >= 2) drawComposite();
    }

    logoImg.onload  = onLoad;
    logoImg.onerror = onLoad; // proceed even if logo fails to load
    qrImg.onload    = onLoad;
    qrImg.onerror   = () => { /* can't draw without QR */ };

    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/brand/logo.png';
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = `data:image/png;base64,${qrBase64}`;

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrBase64, orderNumStr]);


  /* ── Save QR ──────────────────────────────────────────────  */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'hint'>('idle');

  /* canShare is evaluated at render time from the pre-built file */
  const canShareQr = qrFileReady && qrFileRef.current != null
    && !!navigator.canShare?.({ files: [qrFileRef.current] });

  function openSaveSheet(file: File) {
    const url = URL.createObjectURL(file);
    setSaveSheetUrl(url);
    setShowQrOverlay(true);
  }

  function closeSaveSheet() {
    setShowQrOverlay(false);
    setSaveSheetUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }

  function tryDownload(file: File): boolean {
    try {
      const url = URL.createObjectURL(file);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'promptpay-qr.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  const handleSaveQr = useCallback(() => {
    if (state.phase !== 'ready' || !qrFileRef.current) return;
    const file = qrFileRef.current;

    if (canShareQr) {
      /* Synchronous call — no await before this line so iOS user gesture is preserved */
      navigator.share({ files: [file], title: 'PromptPay QR' })
        .then(() => { setSaveStatus('saved'); })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') {
            setSaveStatus('idle'); // user dismissed share sheet — silent
          } else {
            // Share failed — try download (Android), else show sheet
            if (!isIOS() && tryDownload(file)) {
              setSaveStatus('saved');
            } else {
              openSaveSheet(file);
            }
          }
        });
      return;
    }

    // No Web Share API available
    if (!isIOS() && tryDownload(file)) {
      setSaveStatus('saved');
      return;
    }

    // iOS or download not possible — show sheet
    openSaveSheet(file);
  }, [state, canShareQr]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Remaining display helpers ──────────────────────────── */
  const displayMins = countdown !== null ? Math.floor(countdown / 60) : 0;
  const displaySecs = countdown !== null ? countdown % 60 : 0;
  const nearExpiry  = countdown !== null && countdown < 300; // < 5 min

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
          <HelpLink variant="urgent" />
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
          {state.code === 'amount_mismatch' ? (
            <HelpLink variant="urgent" />
          ) : (
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
          )}
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

      {/* Save sheet — long-press to save (or open-in-browser for in-app browsers) */}
      {showQrOverlay && state.phase === 'ready' && (
        <div
          onClick={closeSaveSheet}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(43,33,24,0.82)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20,
            padding: '32px 24px',
          }}
        >
          {isInAppBrowser() ? (
            <>
              <div style={{
                fontSize: 14, color: '#fffdf8', textAlign: 'center', lineHeight: 1.7, fontWeight: 600,
              }}>
                {t('pay.openInBrowser')}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard?.writeText(window.location.href).then(() => {
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  });
                }}
                style={{
                  background: 'rgba(255,255,255,0.18)', color: '#fffdf8',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '12px 28px', borderRadius: 'var(--r-pill)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                {copiedLink ? t('pay.copied') : t('pay.copyLink')}
              </button>
            </>
          ) : (
            <>
              {saveSheetUrl && (
                <img
                  src={saveSheetUrl}
                  alt="PromptPay QR"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 240, borderRadius: 16, display: 'block', maxHeight: '60vh', objectFit: 'contain',
                  }}
                />
              )}
              <div style={{
                fontSize: 13, color: '#fffdf8', textAlign: 'center', lineHeight: 1.6,
              }}>
                {t('pay.saveHintLongPress')}
              </div>
            </>
          )}
          <button
            onClick={closeSaveSheet}
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
