import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, type SupportedLang } from '../i18n/config';

const LANG_LABELS: Record<SupportedLang, string> = {
  fr: 'FR',
  en: 'EN',
  es: 'ES',
  pt: 'PT',
  it: 'IT',
  de: 'DE',
};

type LanguageSelectorProps = {
  /** Bouton icône seule (sidebar, etc.) */
  compact?: boolean;
  /** Menu au-dessus du bouton (évite d’être coupé en bas de sidebar) */
  menuAbove?: boolean;
};

export default function LanguageSelector({ compact = false, menuAbove = false }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const raw = (i18n.language || 'fr').split('-')[0] as SupportedLang;
  const current: SupportedLang = SUPPORTED_LANGS.includes(raw) ? raw : 'fr';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const menuPosition = menuAbove
    ? 'bottom-full left-0 right-auto mb-1'
    : 'right-0 top-full mt-1';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={
          compact
            ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 glass-panel text-gray-700 transition hover:bg-gray-200/80 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10 sm:h-10 sm:w-10'
            : 'flex h-9 min-w-[4.75rem] items-center justify-center gap-1 rounded-lg border border-gray-300 glass-panel px-2 text-xs font-semibold uppercase text-gray-700 transition hover:bg-gray-200/80 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10 sm:h-10 sm:min-w-[5.25rem] sm:gap-1.5 sm:px-2.5 sm:text-sm'
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Langue / Language"
        title={`${LANG_LABELS[current]}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Languages className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" aria-hidden />
        {!compact && (
          <>
            <span>{LANG_LABELS[current]}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform sm:h-4 sm:w-4 ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choisir la langue"
          className={`absolute z-[60] min-w-[10rem] overflow-hidden rounded-lg border border-gray-200/90 bg-white/95 py-1 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#141218]/95 ${menuPosition}`}
        >
          {SUPPORTED_LANGS.map((code) => (
            <li key={code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={code === current}
                className={`flex w-full items-center px-3 py-2 text-left text-sm font-medium transition ${
                  code === current
                    ? 'bg-white/12 text-neutral-900 dark:text-white'
                    : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10'
                }`}
                onClick={() => {
                  void i18n.changeLanguage(code).then(() => setOpen(false));
                }}
              >
                {LANG_LABELS[code]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
