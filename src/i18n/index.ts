import { useLang } from '../store/lang';
import { TH } from './th';
import { EN } from './en';
import type { Dict } from './th';

export { TH, EN };
export type { Dict };

export const DICT: Record<'th' | 'en', Dict> = { th: TH, en: EN };

/** Central i18n hook. Returns t() function + raw dict + current lang + setLang. */
export function useT() {
  const { lang, setLang } = useLang();
  const dict = DICT[lang];

  function t(key: keyof Dict, ...args: any[]): string {
    const val = dict[key];
    if (typeof val === 'function') return (val as (...a: any[]) => string)(...args);
    if (Array.isArray(val)) return (val as string[]).join(', ');
    return val as string;
  }

  return { t, lang, setLang, dict };
}
