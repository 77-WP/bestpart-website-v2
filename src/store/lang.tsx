import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'th' | 'en';

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'th',
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('bp_lang');
    return saved === 'en' ? 'en' : 'th';
  });

  function setLang(l: Lang) {
    localStorage.setItem('bp_lang', l);
    setLangState(l);
  }

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
