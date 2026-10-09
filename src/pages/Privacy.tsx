import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { I } from '../components/icons';
import { PRIVACY_CONTACT, PRIVACY_CONTACT_URL } from '../config/privacy';

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink)',
  marginTop: 22,
  marginBottom: 6,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ink-2)',
  lineHeight: 1.7,
  margin: 0,
};

const listItem: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ink-2)',
  lineHeight: 1.7,
  marginBottom: 4,
};

export default function Privacy() {
  const navigate = useNavigate();
  const { t, dict } = useT();

  const sections: Array<{ heading: string; itemKey?: keyof typeof dict; text?: string }> = [
    {
      heading: t('privacy.sec.controller'),
      text:    t('privacy.controllerBody'),
    },
    {
      heading: t('privacy.sec.data'),
      itemKey: 'privacy.dataItems',
    },
    {
      heading: t('privacy.sec.legal'),
      itemKey: 'privacy.legalItems',
    },
    {
      heading: t('privacy.sec.processors'),
      itemKey: 'privacy.processorItems',
    },
    {
      heading: t('privacy.sec.retention'),
      itemKey: 'privacy.retentionItems',
    },
    {
      heading: t('privacy.sec.rights'),
      text:    t('privacy.rightsBody'),
    },
  ];

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
        <p style={{ ...bodyStyle, marginBottom: 4 }}>{t('privacy.noSell')}</p>

        {sections.map(sec => (
          <div key={sec.heading}>
            <div style={sectionHeading}>{sec.heading}</div>
            {sec.text && <p style={{ ...bodyStyle, marginBottom: 0 }}>{sec.text}</p>}
            {sec.itemKey && (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(dict[sec.itemKey] as string[]).map((item, i) => (
                  <li key={i} style={listItem}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

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
