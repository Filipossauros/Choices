import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ptPT } from './pt-PT';

i18n.use(initReactI18next).init({
  resources: { 'pt-PT': ptPT },
  lng: 'pt-PT',
  fallbackLng: 'pt-PT',
  interpolation: { escapeValue: false },
});

export default i18n;
