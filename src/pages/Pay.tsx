import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { I } from '../components/icons';
import { TEST_MODE } from '../config/env';

type QrState =
  | { phase: 'loading' }
  | { phase: 'ready'; qrImage: string; expiresAt: string; chargeId: string; amountSatang: number }
  | { phase: 'expired' }
  | { phase: 'error'; message: string };

/* ── Countdown to expiry ─────────────────────────────────── */
// Returns null until the first tick — prevents a false "expired" on the render
// where state just became 'ready' but the interval hasn't fired yet (countdown=0 default).
function useCountdown(expiresAt: string | null): number | null {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecs(null);
      return;
    }
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
  const [state, setState] = useState<QrState>({ phase: 'loading' });
  const pollingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const paidRef     = useRef(false);

  // In-flight fetch keyed by orderId — deduplicates concurrent calls (e.g. StrictMode double-invoke).
  // cleared in finally so manual refresh ("สร้าง QR ใหม่") always starts a fresh fetch.
  const fetchPromiseRef = useRef<{ orderId: string; promise: Promise<void> } | null>(null);

  const expiresAt = state.phase === 'ready' ? state.expiresAt : null;
  const countdown = useCountdown(expiresAt); // number | null

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
    // Dedup: if there's already an in-flight fetch for this orderId, await it
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
          const rawMsg = error?.message ?? 'ไม่สามารถสร้าง QR ได้';
          const context = (error as unknown as { context?: { body?: string; status?: number } })?.context;
          const detail  = context?.body ? ` — ${context.body}` : '';
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
        // Clear ref so the next manual refresh starts a fresh fetch
        if (fetchPromiseRef.current?.orderId === orderId) {
          fetchPromiseRef.current = null;
        }
      }
    })();
    fetchPromiseRef.current = { orderId, promise };
    return promise;
  }, [orderId]);

  /* Initial QR load — useEffect fires on mount; the fetchPromiseRef guard handles StrictMode
     double-invoke: the second call sees the in-flight promise and awaits it instead of
     issuing a second network request. */
  useEffect(() => { fetchQr(); }, [fetchQr]);

  /* Mark expired — only when countdown has been initialized (≠ null) and reached 0.
     countdown is null on the first render after state→'ready', so this never fires prematurely. */
  useEffect(() => {
    if (state.phase === 'ready' && countdown === 0) {
      setState({ phase: 'expired' });
    }
  }, [countdown, state.phase]);

  /* Realtime subscription — watch for payment_status = 'paid' */
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
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single();
      if (data?.payment_status === 'paid') handlePaid();
    }, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [orderId, handlePaid]);

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

  const displayMins = countdown !== null ? Math.floor(countdown / 60) : 0;
  const displaySecs = countdown !== null ? countdown % 60 : 0;
  const nearExpiry  = countdown !== null && countdown < 60;

  return (
    <div className="page" style={{ paddingBottom: 40 }}>

      {/* TEST MODE banner */}
      {TEST_MODE && (
        <div style={{
          background: '#b45309', color: '#fffdf8',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textAlign: 'center', padding: '5px 0',
        }}>
          ⚠ TEST MODE — ห้ามใช้บัตรจริง
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
        <div style={{ flex: 1 }}>
          <div className="kicker">ชำระเงิน · PAYMENT</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, marginTop: 1 }}>สแกน PromptPay</div>
        </div>
      </div>

      {/* Loading */}
      {state.phase === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 18px', gap: 14 }}>
          <div style={{ width: 220, height: 220, borderRadius: 'var(--r-md)', background: 'var(--bg-3)' }} />
          <div style={{ width: 160, height: 12, borderRadius: 4, background: 'var(--bg-3)' }} />
          <div style={{ width: 120, height: 12, borderRadius: 4, background: 'var(--bg-3)' }} />
        </div>
      )}

      {/* QR ready */}
      {state.phase === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px 0', gap: 0 }}>

          {/* Amount */}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.08em', marginBottom: 6 }}>ยอดที่ต้องชำระ</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
            ฿{(state.amountSatang / 100).toFixed(2)}
          </div>

          {/* QR image */}
          <div style={{
            marginTop: 20, padding: 12,
            borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: '#fff',
          }}>
            <img
              src={`data:image/png;base64,${state.qrImage}`}
              alt="PromptPay QR"
              style={{ width: 200, height: 200, display: 'block' }}
            />
          </div>

          {/* Save QR button */}
          <button
            onClick={handleSaveQr}
            disabled={saveStatus === 'saving'}
            style={{
              marginTop: 12,
              background: saveStatus === 'saved' ? 'rgba(74,93,63,0.10)' : 'var(--bg-2)',
              border: '1px solid var(--line)',
              color: saveStatus === 'saved' ? 'var(--accent-2)' : 'var(--ink)',
              padding: '10px 24px',
              borderRadius: 'var(--r-pill)',
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: saveStatus === 'saving' ? 'default' : 'pointer',
            }}
          >
            {saveStatus === 'saved' ? I.check(15) : I.share(15)}
            {saveStatus === 'saving' ? 'กำลังบันทึก…' : saveStatus === 'saved' ? 'บันทึกแล้ว' : 'บันทึก QR'}
          </button>

          {/* Hint — shown when share/download fails */}
          {saveStatus === 'hint' && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
              กดค้างที่รูป QR เพื่อบันทึก
            </div>
          )}

          {/* Countdown */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: nearExpiry ? 'var(--accent)' : 'var(--ink-3)' }}>
              {I.clock(14)}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 13,
              color: nearExpiry ? 'var(--accent)' : 'var(--ink-2)',
            }}>
              {String(displayMins).padStart(2, '0')}:{String(displaySecs).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>หมดอายุใน</span>
          </div>

          {/* Instructions — 2 methods */}
          <div style={{
            marginTop: 20, width: '100%',
            padding: '14px 16px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)',
          }}>
            <div className="kicker muted" style={{ marginBottom: 10 }}>วิธีชำระเงิน</div>

            {/* Method 1: Scan */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', color: 'var(--ink-3)', marginBottom: 7 }}>
              วิธีที่ 1 — สแกน QR
            </div>
            {[
              'เปิดแอปธนาคาร เลือก "สแกน QR" หรือ "จ่ายด้วย QR"',
              'สแกน QR ด้านบน และยืนยันการชำระ',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--ink)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 9, fontWeight: 700,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}

            {/* Method 2: Save & upload */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', color: 'var(--ink-3)', margin: '4px 0 7px' }}>
              วิธีที่ 2 — บันทึก QR แล้วอัปโหลด
            </div>
            {[
              'กด "บันทึก QR" ด้านบน',
              'เปิดแอปธนาคาร เลือก "อัปโหลด QR" หรือ "จ่ายด้วย QR รูปภาพ"',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 1 ? 8 : 0 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bg-3)', color: 'var(--ink-2)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 9, fontWeight: 700,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}

            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)' }}>
              หน้านี้จะอัปเดตอัตโนมัติเมื่อรับชำระแล้ว
            </div>
          </div>

          {/* Waiting indicator */}
          <div style={{
            marginTop: 16, display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--ink-3)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-2)',
              animation: 'pulse 1.2s ease-in-out infinite',
            }} />
            รอการชำระเงิน…
          </div>
        </div>
      )}

      {/* Expired */}
      {state.phase === 'expired' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 44, opacity: 0.3 }}>{I.clock(44)}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>QR หมดอายุแล้ว</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            กรุณาสร้าง QR ใหม่เพื่อชำระเงิน
          </div>
          <button
            onClick={fetchQr}
            style={{
              marginTop: 8, background: 'var(--accent)', color: 'var(--on-accent)',
              border: 0, padding: '14px 32px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            }}
          >
            สร้าง QR ใหม่
          </button>
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 44, opacity: 0.3 }}>{I.receipt(44)}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>เกิดข้อผิดพลาด</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{state.message}</div>
          <button
            onClick={fetchQr}
            style={{
              marginTop: 8, background: 'var(--ink)', color: 'var(--on-accent)',
              border: 0, padding: '14px 32px', borderRadius: 'var(--r-pill)',
              fontWeight: 600, fontSize: 13,
            }}
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
}
