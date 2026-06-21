import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';

/**
 * Lightweight i18n setup. We use the Portuguese source text itself as the
 * translation key (natural keys): in PT no resources are needed (i18next returns
 * the key verbatim), and EN is provided as an override dictionary. This lets us
 * retrofit translations without inventing abstract keys for every string.
 *
 * Strings with values use i18next interpolation, e.g. t('{{n}} níveis', { n }).
 */
export const LANG_KEY = 'choices-lang';
export type Lang = 'pt' | 'en';

const saved = (localStorage.getItem(LANG_KEY) as Lang | null) ?? 'pt';

i18n.use(initReactI18next).init({
  lng: saved,
  fallbackLng: 'pt',
  resources: { en: { translation: en } },
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

export function setLang(lang: Lang) {
  i18n.changeLanguage(lang);
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en';
}

document.documentElement.lang = saved === 'pt' ? 'pt-PT' : 'en';

export default i18n;
