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
function useCountdown(expiresAt: string | null) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

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
  const pollingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const paidRef         = useRef(false);
  const autoFetchedRef  = useRef(false); // prevents StrictMode double-invoke on mount

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
    setState({ phase: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('create-beam-charge', {
        body: { order_id: orderId },
      });
      if (error || !data) {
        const rawMsg = error?.message ?? 'ไม่สามารถสร้าง QR ได้';
        // FunctionsHttpError carries the edge function's response body in .context
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
        phase:       'ready',
        qrImage:     data.qr_image,
        expiresAt:   data.expires_at,
        chargeId:    data.charge_id,
        amountSatang: data.amount,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด';
      setState({ phase: 'error', message: msg });
    }
  }, [orderId]);

  /* Initial QR load — guarded so StrictMode double-mount only fires once */
  useEffect(() => {
    if (autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    fetchQr();
  }, [fetchQr]);

  /* Mark expired when countdown hits 0 */
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

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

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
            marginTop: 20,
            padding: 12,
            borderRadius: 'var(--r-md)',
            border: '1.5px solid var(--line)',
            background: '#fff',
          }}>
            <img
              src={`data:image/png;base64,${state.qrImage}`}
              alt="PromptPay QR"
              style={{ width: 200, height: 200, display: 'block' }}
            />
          </div>

          {/* Countdown */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: countdown < 60 ? 'var(--accent)' : 'var(--ink-3)' }}>
              {I.clock(14)}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 13,
              color: countdown < 60 ? 'var(--accent)' : 'var(--ink-2)',
            }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>หมดอายุใน</span>
          </div>

          {/* Instructions */}
          <div style={{
            marginTop: 20, width: '100%',
            padding: '14px 16px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--line)',
          }}>
            <div className="kicker muted" style={{ marginBottom: 8 }}>วิธีชำระเงิน</div>
            {[
              'เปิดแอปธนาคาร หรือแอปที่รองรับ PromptPay',
              'เลือก "สแกน QR" หรือ "จ่ายด้วย QR"',
              'สแกน QR ด้านบน และยืนยันการชำระ',
              'หน้านี้จะอัปเดตอัตโนมัติเมื่อรับชำระแล้ว',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--ink)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 9, fontWeight: 700,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
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
