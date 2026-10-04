import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLang } from '../store/lang';
import { LANG_MAP } from '../config/lang';
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

export default function Pay() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate    = useNavigate();
  const { lang }    = useLang();
  const L           = LANG_MAP[lang];

  const [state, setState]     = useState<QrState>({ phase: 'loading' });
  const [orderNum, setOrderNum] = useState<number | null>(null);
  const pollingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const paidRef     = useRef(false);

  const fetchPromiseRef = useRef<{ orderId: string; promise: Promise<void> } | null>(null);

  const expiresAt = state.phase === 'ready' ? state.expiresAt : null;
  const countdown = useCountdown(expiresAt);

  /* Navigate to track once paid */
  const handlePaid = useCallback(() => {
    if (paidRef.current) return;
    paidRef.current = true;
    if (pollingRef.current) clearInterval(pollingRef.current);
    navigate(`/track/${orderId}`, { replace: true });
  }, [navigate, orderId]);

  /* Fetch / refresh QR from edge function */
  const fetchQr = useCallback(async () => {
    if (!orderId) return;
    if (fetchPromiseRef.current?.orderId === orderId) {
      return fetchPromiseRef.current.promise;
    }
    setState({ phase: 'loading' });
    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-beam-charge', {
          body: { order_id: orderId },
        });
        if (error || !data) {
          const rawMsg  = error?.message ?? 'ไม่สามารถสร้าง QR ได้';
          const context = (error as unknown as { context?: { body?: string; status?: number } })?.context;
          const detail  = context?.body   ? ` — ${context.body}`           : '';
          const status  = context?.status ? ` (HTTP ${context.status})`    : '';
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

  /* Fetch order number for display */
  useEffect(() => {
    if (!orderId) return;
    supabase.from('orders').select('order_number').eq('id', orderId).single()
      .then(({ data }) => { if (data?.order_number) setOrderNum(data.order_number); });
  }, [orderId]);

  /* Mark expired */
  useEffect(() => {
    if (state.phase === 'ready' && countdown === 0) {
      setState({ phase: 'expired' });
    }
  }, [countdown, state.phase]);

  /* Realtime subscription */
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`pay-order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const rec = payload.new as { payment_status?: string };
          if (rec.payment_status === 'paid') handlePaid();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, handlePaid]);

  /* Polling fallback every 5 s */
  useEffect(() => {
    if (!orderId) return;
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('orders').select('payment_status').eq('id', orderId).single();
      if (data?.payment_status === 'paid') handlePaid();
    }, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [orderId, handlePaid]);

  /* ── Save QR ──────────────────────────────────────────────  */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'hint'>('idle');

  const handleSaveQr = useCallback(async () => {
    if (state.phase !== 'ready') return;
    setSaveStatus('saving');
    try {
      const res  = await fetch(`data:image/png;base64,${state.qrImage}`);
      const blob = await res.blob();
      const file = new File([blob], 'promptpay-qr.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'PromptPay QR' });
        setSaveStatus('saved');
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = 'promptpay-qr.png';
        a.click();
        URL.revokeObjectURL(url);
        setSaveStatus('saved');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setSaveStatus('idle');
      } else {
        setSaveStatus('hint');
      }
    }
  }, [state]);

  /* ── Display helpers ──────────────────────────────────────  */
  const displayMins = countdown !== null ? Math.floor(countdown / 60) : 0;
  const displaySecs = countdown !== null ? countdown % 60 : 0;
  const nearExpiry  = countdown !== null && countdown < 300; // < 5 min

  const orderNumStr = orderNum != null
    ? String(orderNum)
    : orderId?.slice(-4).toUpperCase() ?? '';

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
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{L.payTitle}</div>
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
              {L.payOrderLabel(orderNumStr)}
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
            disabled={saveStatus === 'saving'}
            style={{
              marginTop: 16, width: '100%',
              background: saveStatus === 'saved' ? 'rgba(74,93,63,0.10)' : 'var(--ink)',
              color: saveStatus === 'saved' ? 'var(--accent-2)' : '#fff',
              border: saveStatus === 'saved' ? '1px solid var(--line)' : 0,
              padding: '14px 18px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: saveStatus === 'saving' ? 'default' : 'pointer',
            }}
          >
            {saveStatus === 'saved' ? I.check(16) : I.download(16)}
            {saveStatus === 'saving'
              ? L.saveQrSaving
              : saveStatus === 'saved'
                ? L.saveQrDone
                : L.saveQrBtn}
          </button>

          {saveStatus === 'hint' && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
              {L.saveQrHint}
            </div>
          )}

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
              {L.countdownLabel(
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
              { icon: I.download(20), label: L.stepSave },
              { icon: I.smartphone(20), label: L.stepOpenApp },
              { icon: I.qr(20), label: L.stepScanPhoto },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                flex: 1, padding: '0 4px',
              }}>
                <span style={{ color: 'var(--ink-3)' }}>{step.icon}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.35 }}>
                  {step.label}
                </span>
                {i < 2 && (
                  <span style={{
                    position: 'absolute',
                    fontSize: 12, color: 'var(--line-2)',
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Waiting indicator */}
          <div style={{
            marginTop: 20, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--ink-3)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-2)',
              flexShrink: 0,
              animation: 'bp-pulse 1.8s ease-in-out infinite',
            }} />
            {L.waitingMsg}
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
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{L.expiredTitle}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{L.expiredSub}</div>
          <button
            onClick={fetchQr}
            style={{
              marginTop: 8, background: 'var(--accent)', color: 'var(--on-accent)',
              border: 0, padding: '14px 32px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13, letterSpacing: '.04em', cursor: 'pointer',
            }}
          >
            {L.expiredBtn}
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
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>เกิดข้อผิดพลาด</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{state.message}</div>
          <button
            onClick={fetchQr}
            style={{
              marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
              border: 0, padding: '14px 32px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {L.retryBtn}
          </button>
        </div>
      )}
    </div>
  );
}
