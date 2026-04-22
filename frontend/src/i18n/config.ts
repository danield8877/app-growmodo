import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationFR from './locales/fr/translation.json';
import translationEN from './locales/en/translation.json';
import translationES from './locales/es/translation.json';
import translationPT from './locales/pt/translation.json';
import translationIT from './locales/it/translation.json';
import translationDE from './locales/de/translation.json';
import dashboardFR from './locales/fr/dashboard.json';
import dashboardEN from './locales/en/dashboard.json';
import dashboardES from './locales/es/dashboard.json';
import dashboardPT from './locales/pt/dashboard.json';
import dashboardIT from './locales/it/dashboard.json';
import dashboardDE from './locales/de/dashboard.json';

export const SUPPORTED_LANGS = ['fr', 'en', 'es', 'pt', 'it', 'de'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const resources = {
  fr: { translation: { ...translationFR, dashboard: dashboardFR } },
  en: { translation: { ...translationEN, dashboard: dashboardEN } },
  es: { translation: { ...translationES, dashboard: dashboardES } },
  pt: { translation: { ...translationPT, dashboard: dashboardPT } },
  it: { translation: { ...translationIT, dashboard: dashboardIT } },
  de: { translation: { ...translationDE, dashboard: dashboardDE } },
};

function syncDocumentLang(lng: string) {
  const code = lng.split('-')[0];
  if ((SUPPORTED_LANGS as readonly string[]).includes(code)) {
    document.documentElement.lang = code;
  }
}

export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })
  .then(() => {
    syncDocumentLang(i18n.language);
    i18n.on('languageChanged', syncDocumentLang);
  });

export default i18n;
