import type { Locale } from 'date-fns/locale';
import { de, enUS, es, fr, it, ptBR } from 'date-fns/locale';

const byLang: Record<string, Locale> = {
  fr,
  en: enUS,
  es,
  pt: ptBR,
  it,
  de,
};

export function getDateLocale(language: string | undefined): Locale {
  const code = (language || 'en').split('-')[0].toLowerCase();
  return byLang[code] ?? enUS;
}
