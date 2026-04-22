/** Familles Google Fonts reconnues → paramètre `family=` pour css2 (voir Google Fonts CSS API). */
export const GOOGLE_FONTS_MAP: Record<string, string> = {
  Inter: 'Inter:wght@300;400;500;600;700;800',
  Montserrat: 'Montserrat:wght@300;400;500;600;700',
  Manrope: 'Manrope:wght@400;500;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
  'Open Sans': 'Open+Sans:wght@400;500;600;700',
  Lato: 'Lato:wght@300;400;700',
  Poppins: 'Poppins:wght@300;400;500;600;700',
  Oswald: 'Oswald:wght@400;500;600;700',
  Raleway: 'Raleway:wght@400;500;600;700',
  Nunito: 'Nunito:wght@400;500;600;700',
  'Source Sans 3': 'Source+Sans+3:wght@400;500;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
  'Work Sans': 'Work+Sans:wght@300;400;500;600;700',
  Merriweather: 'Merriweather:wght@300;400;700',
  'Crimson Pro': 'Crimson+Pro:wght@400;500;600;700',
  'Fira Sans': 'Fira+Sans:wght@400;500;600;700',
  Ubuntu: 'Ubuntu:wght@300;400;500;700',
  Rubik: 'Rubik:wght@400;500;600;700',
  Quicksand: 'Quicksand:wght@400;500;600;700',
  Outfit: 'Outfit:wght@300;400;500;600;700',
  Sora: 'Sora:wght@400;500;600;700',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700',
  Figtree: 'Figtree:wght@400;500;600;700',
  Lexend: 'Lexend:wght@400;500;600;700',
};

/** Liens <link> Google Fonts pour les familles détectées dans le CSS généré. */
export function getGoogleFontsFromCss(css: string | undefined): string {
  if (!css?.trim()) return '';
  const fontFamilyRe = /font-family\s*:\s*['"]?([^;}'"]+)/gi;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = fontFamilyRe.exec(css)) !== null) {
    const raw = m[1].split(',')[0].trim().replace(/['"]/g, '').trim();
    if (raw && !/inherit|initial|unset|system-ui|sans-serif|serif|monospace/i.test(raw)) names.add(raw);
  }
  const families = [...names].slice(0, 6).filter((n) => GOOGLE_FONTS_MAP[n]);
  if (families.length === 0) return '';
  const query = families.map((f) => `family=${GOOGLE_FONTS_MAP[f]}`).join('&');
  return '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?' + query + '&display=swap" rel="stylesheet">';
}

/** Références blob invalides dans une iframe (autre contexte) → remplacer. */
export function stripBrokenBlobUrls(html: string, placeholderDataUri: string): string {
  if (!html.includes('blob:')) return html;
  return html.replace(/blob:https?:\/\/[^\s"'>)]+/gi, placeholderDataUri);
}

/**
 * Surcharge sans-serif sur le HTML généré (le modèle impose parfois des serifs sur KPI / citations).
 * Exclut Font Awesome et Material Symbols.
 */
export const PREVIEW_CORPORATE_FONT_OVERRIDE = `
body *:not([class*="fa-"]):not(.material-icons):not([class*="material-symbols"]) {
  font-family: 'Inter', 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif !important;
}
blockquote, q {
  font-style: normal !important;
}
`;
