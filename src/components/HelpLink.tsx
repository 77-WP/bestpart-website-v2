import { LINE_OA_URL } from '../config/contact';
import { useT } from '../i18n';

export function HelpLink({ variant = 'help' }: { variant?: 'help' | 'urgent' }) {
  const { t } = useT();
  return (
    <a
      href={LINE_OA_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        padding: '4px 0',
        fontSize: 12,
        color: 'var(--ink-3)',
        textDecoration: 'none',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V3z" />
      </svg>
      {variant === 'urgent' ? t('contact.urgent') : t('contact.help')}
    </a>
  );
}
