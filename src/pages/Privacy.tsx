import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { I } from '../components/icons';
import { PRIVACY_CONTACT, PRIVACY_CONTACT_URL } from '../config/privacy';

const body: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ink-2)',
  lineHeight: 1.7,
  margin: 0,
};

const note: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--ink-3)',
  lineHeight: 1.6,
  margin: '4px 0 0',
};

const secHeading: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink)',
  marginTop: 20,
  marginBottom: 6,
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
  const [open, setOpen] = useState(false);

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
        {/* Summary */}
        <ul style={{ margin: '0 0 16px', paddingLeft: 18 }}>
          {(dict['privacy.summary.items'] as string[]).map((item, i) => (
            <li key={i} style={{ ...body, marginBottom: 6 }}>{item}</li>
          ))}
        </ul>

        {/* Accordion toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: 0, padding: '4px 0',
            fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer',
            display: 'block',
          }}
        >
          {open ? t('privacy.collapse') : t('privacy.readMore')}
        </button>

        {/* Accordion detail */}
        {open && (
          <div style={{ marginTop: 4 }}>
            {/* a) Data controller */}
            <div style={secHeading}>{t('privacy.sec.controller')}</div>
            <p style={body}>{t('privacy.controllerBody')}</p>

            {/* b) Data collected */}
            <div style={secHeading}>{t('privacy.sec.data')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(dict['privacy.dataItems'] as string[]).map((item, i) => (
                <li key={i} style={listItem}>{item}</li>
              ))}
            </ul>
            <p style={note}>{t('privacy.dataCaution')}</p>

            {/* c) Legal basis */}
            <div style={secHeading}>{t('privacy.sec.legal')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(dict['privacy.legalItems'] as string[]).map((item, i) => (
                <li key={i} style={listItem}>{item}</li>
              ))}
            </ul>

            {/* d) Processors */}
            <div style={secHeading}>{t('privacy.sec.processors')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(dict['privacy.processorItems'] as string[]).map((item, i) => (
                <li key={i} style={listItem}>{item}</li>
              ))}
            </ul>
            <p style={note}>{t('privacy.processorNote')}</p>

            {/* e) Retention */}
            <div style={secHeading}>{t('privacy.sec.retention')}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(dict['privacy.retentionItems'] as string[]).map((item, i) => (
                <li key={i} style={listItem}>{item}</li>
              ))}
            </ul>

            {/* f) Rights */}
            <div style={secHeading}>{t('privacy.sec.rights')}</div>
            <p style={body}>{t('privacy.rightsBody')}</p>

            {/* g) LINE contact link */}
            <div style={secHeading}>{t('privacy.sec.lineContact')}</div>
            <a
              href={PRIVACY_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...body, color: 'var(--ink-2)', textDecoration: 'underline' }}
            >
              {PRIVACY_CONTACT}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
