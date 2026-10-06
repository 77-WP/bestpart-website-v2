import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useT } from '../i18n';

const NOTICE_KEY = 'bp_notice_ack';

function lsGet(k: string): string | null  { try { return localStorage.getItem(k);  } catch { return null; } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function PrivacyBanner() {
  const { t }    = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [acked, setAcked] = useState(() => !!lsGet(NOTICE_KEY));

  if (acked || location.pathname === '/privacy') return null;

  function ack() {
    lsSet(NOTICE_KEY, '1');
    setAcked(true);
  }

  return (
    <div style={{
      position:  'fixed',
      left:      '50%',
      transform: 'translateX(-50%)',
      bottom:    'calc(60px + env(safe-area-inset-bottom, 0px) + 8px)',
      width:     'calc(100% - 36px)',
      maxWidth:  444,
      background:   'var(--bg-2)',
      border:       '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding:      '10px 14px',
      zIndex:       200,
      boxShadow:    '0 4px 20px -4px rgba(43,33,24,0.18)',
      display:      'flex',
      alignItems:   'center',
      gap:          10,
    }}>
      <span style={{ flex: 1, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.5 }}>
        {t('privacy.banner')}
      </span>
      <button
        onClick={() => navigate('/privacy')}
        style={{
          background: 'none', border: 0, padding: 0,
          fontSize: 11, color: 'var(--accent)', fontWeight: 600,
          cursor: 'pointer', flexShrink: 0,
          minHeight: 44, display: 'flex', alignItems: 'center',
        }}
      >{t('privacy.details')}</button>
      <button
        onClick={ack}
        style={{
          background: 'var(--ink)', color: 'var(--on-accent)',
          border: 0, padding: '8px 14px', borderRadius: 'var(--r-pill)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center',
        }}
      >{t('privacy.ack')}</button>
    </div>
  );
}
