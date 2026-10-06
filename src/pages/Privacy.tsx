import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { I } from '../components/icons';
import { PRIVACY_CONTACT, PRIVACY_CONTACT_URL } from '../config/privacy';

export default function Privacy() {
  const navigate = useNavigate();
  const { t }    = useT();

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div style={{
        padding: '14px 18px 8px', display: 'flex', alignItems: 'center',
        gap: 12, borderBottom: '1px solid var(--line)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}
        >{I.back(22)}</button>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600 }}>
          {t('privacy.title')}
        </div>
      </div>

      <div style={{ padding: '20px 18px' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 0, marginBottom: 16 }}>
          {t('privacy.p1')}
        </p>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 0, marginBottom: 16 }}>
          {t('privacy.p2')}
        </p>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 0, marginBottom: 16 }}>
          {t('privacy.p3')}
        </p>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 0, marginBottom: 0 }}>
          {t('privacy.p4')}
        </p>
        {PRIVACY_CONTACT && (
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 24, marginBottom: 0 }}>
            {t('privacy.contact')}:{' '}
            <a
              href={PRIVACY_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}
            >
              {PRIVACY_CONTACT}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
