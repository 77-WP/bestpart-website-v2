import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, normalizeOrderStatus } from '../lib/supabase';
import { getLocalOrderIds } from '../lib/localOrders';
import { I } from './icons';
import { useT } from '../i18n';

type TabId = 'home' | 'menu' | 'orders' | 'me';

const ACTIVE_STATUSES = ['awaiting_payment', 'pending', 'preparing'];

function useHasActiveOrders(override?: boolean): boolean {
  const [hasActive, setHasActive] = useState(override ?? false);

  useEffect(() => {
    if (override !== undefined) { setHasActive(override); return; }
    const ids = getLocalOrderIds();
    if (ids.length === 0) return;
    Promise.allSettled(
      ids.slice(0, 10).map(id =>
        supabase.functions.invoke('get-order', { body: { order_id: id } })
          .then(({ data, error }) => {
            if (error || !data) return false;
            return ACTIVE_STATUSES.includes(normalizeOrderStatus((data as { status: string }).status));
          })
      )
    ).then(results => {
      const anyActive = results.some(r => r.status === 'fulfilled' && r.value === true);
      setHasActive(anyActive);
    });
  }, [override]);

  return hasActive;
}

export function TabBar({ active, hasActiveOrder }: { active: TabId; hasActiveOrder?: boolean }) {
  const navigate = useNavigate();
  const { t } = useT();
  const hasActive = useHasActiveOrders(hasActiveOrder);

  const eff = active === 'me' ? 'orders' : active;

  const activeColor = '#FBF3E3';
  const mutedColor  = 'rgba(251,243,227,0.42)';

  const sideBtn = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    background: 'none',
    border: 0,
    color: isActive ? activeColor : mutedColor,
    padding: '10px 0 8px',
    cursor: 'pointer',
    transition: 'color 0.15s',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    fontFamily: 'var(--sans)',
  };

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      width: 'calc(100% - 32px)',
      maxWidth: 448,
      zIndex: 40,
      height: 72,
      pointerEvents: 'none',
    }}>

      {/* ── Floating pill ───────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 60,
        background: 'var(--ink)',
        borderRadius: 'var(--r-pill)',
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: '0 8px 32px -6px rgba(43,33,24,0.48)',
        overflow: 'hidden',
        pointerEvents: 'all',
      }}>
        {/* Left — หน้าแรก / Home */}
        <button onClick={() => navigate('/')} style={sideBtn(eff === 'home')}>
          {I.home(20)}
          <span style={labelStyle}>{t('nav.home')}</span>
        </button>

        {/* Center spacer */}
        <div style={{ width: 72, flexShrink: 0 }} />

        {/* Right — ออเดอร์ / Orders */}
        <button
          onClick={() => navigate('/orders')}
          style={{ ...sideBtn(eff === 'orders'), position: 'relative' }}
        >
          {I.receipt(20)}
          {hasActive && (
            <span style={{
              position: 'absolute',
              top: 8,
              right: 'calc(50% - 14px)',
              width: 7, height: 7,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '1.5px solid var(--ink)',
            }} />
          )}
          <span style={labelStyle}>{t('nav.orders')}</span>
        </button>
      </div>

      {/* ── Center raised button — เมนู / Menu ──────────── */}
      <button
        onClick={() => navigate('/order')}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 6,
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: eff === 'menu' ? '#c4601f' : 'var(--accent)',
          border: '4px solid var(--bg)',
          color: '#FFFDF8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          boxShadow: '0 4px 20px rgba(181,81,30,0.55)',
          cursor: 'pointer',
          pointerEvents: 'all',
          transition: 'background 0.15s',
        }}
      >
        {I.dinein(18)}
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: 'var(--sans)',
          lineHeight: 1,
          color: '#FFFDF8',
        }}>{t('nav.menu')}</span>
      </button>
    </div>
  );
}
