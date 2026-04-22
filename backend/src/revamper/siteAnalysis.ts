/**
 * Analyse de page HTML + métadonnées pour Revamper : type de site, couleurs, logo,
 * sections pertinentes — afin d'enrichir les prompts Stitch / Claude (pas seulement resto).
 */

/** Récupère le HTML brut (mêmes en-têtes qu’en crawl Revamper). */
export async function fetchHtmlDocument(target: string): Promise<string | null> {
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Hostname sans www — wordmark domaine dans les prompts Stitch. */
export function hostnameFromUrl(url: string): string | undefined {
  try {
    const u = url.trim();
    return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./i, '') || undefined;
  } catch {
    return undefined;
  }
}

export const SITE_TYPES = [
  'e-commerce',
  'blog',
  'saas-landing',
  'portfolio',
  'restaurant',
  'agency',
  'news-media',
  'documentation',
  'nonprofit',
  'real-estate',
  'education',
  'healthcare',
  'hospitality',
  'landing-page',
] as const;
export type SiteTypeId = (typeof SITE_TYPES)[number];

const TYPE_LABEL_EN: Record<string, string> = {
  'e-commerce': 'e-commerce / online store',
  blog: 'blog or editorial site',
  'saas-landing': 'SaaS or software product landing',
  portfolio: 'portfolio or creative showcase',
  restaurant: 'restaurant, food & beverage',
  agency: 'agency or professional services',
  'news-media': 'news or media outlet',
  documentation: 'documentation or technical reference',
  nonprofit: 'nonprofit or association',
  'real-estate': 'real estate or property listings',
  education: 'education or training',
  healthcare: 'healthcare or medical',
  hospitality: 'hotel or hospitality',
  'landing-page': 'general landing / corporate site',
};

const TYPE_DIRECTIVES_EN: Record<string, string> = {
  'e-commerce':
    'Use commerce-focused layout: product or offer highlights, clear CTAs, trust signals. Vocabulary: products, catalog, cart only if appropriate.',
  blog: 'Editorial layout: readable articles, clear categories, author/date if relevant. Avoid shop/cart vocabulary unless the source uses it.',
  'saas-landing':
    'SaaS-style: value proposition, features, social proof, signup/trial CTAs. Avoid unrelated restaurant/retail jargon.',
  portfolio: 'Visual-first: project grid or case studies, minimal generic marketing fluff.',
  restaurant:
    'Restaurant / F&B: menu highlights, reservations, atmosphere. Do NOT use e-commerce "products/collections" wording; prefer dishes, menu, reservations, opening hours.',
  agency: 'Agency: services, credibility, case studies or clients, contact. No fake product grid.',
  'news-media': 'News layout: headlines, sections, readability. No shopping cart language.',
  documentation: 'Docs-style: clear hierarchy, navigation, code or API blocks if relevant. No retail CTAs.',
  nonprofit: 'Mission-driven: donate/volunteer CTAs only if fitting; warm, trustworthy tone.',
  'real-estate': 'Listings or property focus: search, locations, contact agent. Not generic "features pricing" SaaS blocks.',
  education: 'Courses, programs, enrollment. Avoid unrelated shop terminology.',
  healthcare: 'Trust, appointments, services, compliance-minded tone. No fake e-commerce sections.',
  hospitality: 'Rooms, booking, amenities. Hotel vocabulary, not generic SaaS.',
  'landing-page':
    'Single coherent story: hero, supporting sections matching the original message. Match vocabulary to the inferred sector.',
};

/** Normalise une URL (résolution relative → absolue). */
export function resolveAbsoluteUrl(href: string, baseUrl: string): string | undefined {
  const t = href.trim();
  if (!t || t.startsWith('data:') || t.startsWith('javascript:')) return undefined;
  try {
    return new URL(t, baseUrl).href;
  } catch {
    return undefined;
  }
}

function normalizeHex(hex: string): string | undefined {
  const h = hex.replace(/^#/, '').toLowerCase();
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (h.length === 6 && /^[0-9a-f]{6}$/.test(h)) return `#${h}`;
  return undefined;
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Conversion HSL → hex (valeurs h 0–360, s et l en %). */
function hslToHex(h: number, s: number, l: number): string | undefined {
  if (![h, s, l].every((x) => Number.isFinite(x))) return undefined;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  const hh = ((h % 360) + 360) % 360;
  if (hh < 60) {
    rp = c;
    gp = x;
    bp = 0;
  } else if (hh < 120) {
    rp = x;
    gp = c;
    bp = 0;
  } else if (hh < 180) {
    rp = 0;
    gp = c;
    bp = x;
  } else if (hh < 240) {
    rp = 0;
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    gp = 0;
    bp = c;
  } else {
    rp = c;
    gp = 0;
    bp = x;
  }
  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255);
}

const BORING_HEX = new Set([
  '#000000',
  '#ffffff',
  '#fefefe',
  '#f8f9fa',
  '#f9fafb',
  '#f3f4f6',
  '#e5e7eb',
  '#d1d5db',
]);

function isBoringHex(hex: string): boolean {
  const lo = hex.toLowerCase();
  return lo === '#000' || lo === '#fff' || BORING_HEX.has(lo);
}

/** Extrait hex/rgb/hsl d’un bloc de texte type CSS (inline, <style>, ou fichier .css). */
export function collectColorsFromCssLikeText(cssText: string, into: Set<string>): void {
  const hexPattern = /#([0-9a-fA-F]{3})\b|#([0-9a-fA-F]{6})\b/g;
  let m: RegExpExecArray | null;
  const hexRe = new RegExp(hexPattern.source, 'g');
  while ((m = hexRe.exec(cssText)) !== null) {
    const raw = (m[1] || m[2]) ?? '';
    if (raw.length === 3 || raw.length === 6) {
      const n = normalizeHex(`#${raw}`);
      if (n && !isBoringHex(n)) into.add(n);
    }
  }

  const rgbRe = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rgbRe.exec(cssText)) !== null) {
    const r = Number(rm[1]);
    const g = Number(rm[2]);
    const b = Number(rm[3]);
    if ([r, g, b].every((x) => Number.isFinite(x))) {
      const hx = rgbToHex(r, g, b);
      if (!isBoringHex(hx)) into.add(hx);
    }
  }

  const hslRe = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hslRe.exec(cssText)) !== null) {
    const h = Number(hm[1]);
    const s = Number(hm[2]);
    const l = Number(hm[3]);
    const hx = hslToHex(h, s, l);
    if (hx && !isBoringHex(hx)) into.add(hx);
  }
}

/** Langue document (BCP47 primaire : fr, en, …). */
export function extractDocumentLang(html: string): string | undefined {
  const htmlTag = html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i);
  if (htmlTag?.[1]) {
    const p = htmlTag[1].trim().split(/[-_]/)[0].toLowerCase();
    if (/^[a-z]{2,3}$/.test(p)) return p;
  }
  const metaCl = html.match(
    /<meta[^>]+http-equiv\s*=\s*["']content-language["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  if (metaCl?.[1]) {
    const p = metaCl[1].trim().split(/[-_,]/)[0].toLowerCase();
    if (/^[a-z]{2,3}$/.test(p)) return p;
  }
  const og = html.match(
    /<meta[^>]+property\s*=\s*["']og:locale["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  if (og?.[1]) {
    const p = og[1].trim().split(/[-_]/)[0].toLowerCase();
    if (/^[a-z]{2,3}$/.test(p)) return p;
  }
  return undefined;
}

/** Heuristique légère si pas de langue HTML (extrait de page). */
export function guessLangFromText(text: string): string | undefined {
  const sample = text.slice(0, 2800).toLowerCase();
  const fr = (sample.match(/\b(le|la|les|des|une?|pour|avec|nous|votre|être|dans|sur|est|pas)\b/g) || []).length;
  const en = (sample.match(/\b(the|and|with|for|this|that|your|our|have|from|are|not)\b/g) || []).length;
  const es = (sample.match(/\b(el|la|los|las|para|con|una?|más|está|nuestro)\b/g) || []).length;
  const de = (sample.match(/\b(der|die|das|und|mit|für|ein|ist|nicht|wir)\b/g) || []).length;
  const scores = [
    { lang: 'fr', n: fr },
    { lang: 'en', n: en },
    { lang: 'es', n: es },
    { lang: 'de', n: de },
  ];
  scores.sort((a, b) => b.n - a.n);
  if (scores[0].n >= 6 && scores[0].n > scores[1].n * 1.15) return scores[0].lang;
  return undefined;
}

const STYLESHEET_FETCH_MAX = 4;
const STYLESHEET_MAX_BYTES = 100_000;

/** Couleurs depuis feuilles CSS liées (complète les styles inline souvent vides sur sites modernes). */
export async function extractColorsFromExternalStylesheets(html: string, baseUrl: string): Promise<string[]> {
  const into = new Set<string>();
  const links = [
    ...html.matchAll(/<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["']/gi),
  ]
    .map((x) => x[1])
    .slice(0, STYLESHEET_FETCH_MAX);

  for (const href of links) {
    const abs = resolveAbsoluteUrl(href, baseUrl);
    if (!abs || abs.startsWith('data:')) continue;
    try {
      const res = await fetch(abs, {
        headers: {
          Accept: 'text/css,*/*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const text = (await res.text()).slice(0, STYLESHEET_MAX_BYTES);
      collectColorsFromCssLikeText(text, into);
    } catch {
      /* ignore single sheet failure */
    }
  }
  return [...into].filter((c) => !isBoringHex(c)).slice(0, 12);
}

export function mergeColorPalettes(primary: string[], secondary: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of [...primary, ...secondary]) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= 8) break;
  }
  return out;
}

/** Extrait couleurs dominantes (hex + meta theme-color + rgb/hsl dans styles). */
export function extractColorsFromHtml(html: string): string[] {
  const colors = new Set<string>();

  const theme = html.match(
    /<meta[^>]+name\s*=\s*["']theme-color["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  if (theme?.[1]) {
    const v = theme[1].trim();
    if (v.startsWith('#')) {
      const n = normalizeHex(v);
      if (n && !isBoringHex(n)) colors.add(n);
    }
  }

  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const styleContent = styleBlocks.join('\n');
  const inlineStyles = html.match(/style\s*=\s*["']([^"']+)["']/gi) || [];
  const allStyles = `${styleContent}\n${inlineStyles.join('\n')}`;
  collectColorsFromCssLikeText(allStyles, colors);

  const filtered = [...colors].filter((c) => !isBoringHex(c));
  return mergeColorPalettes(filtered, []).slice(0, 8);
}

export function extractFontsFromHtml(html: string): string[] {
  const fonts = new Set<string>();
  const linkMatch = html.match(/<link[^>]+href\s*=\s*["']([^"']*fonts\.googleapis\.com[^"']*)["']/gi);
  if (linkMatch) {
    for (const link of linkMatch) {
      const family = link.match(/family=([^&:]+)/);
      if (family) fonts.add(decodeURIComponent(family[1].replace(/\+/g, ' ')));
    }
  }
  const fontFamilyPattern = /font-family\s*:\s*['"]?([^;'"]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = fontFamilyPattern.exec(html)) !== null) {
    const name = m[1].split(',')[0].trim().replace(/['"]/g, '');
    if (name && !/inherit|system|sans-serif|serif|monospace|default/i.test(name)) fonts.add(name);
  }
  return [...fonts].slice(0, 4);
}

/**
 * Heuristique logo : og:image, twitter:image, favicon apple-touch, puis img header/nav.
 */
export function extractLogoUrl(html: string, baseUrl: string): string | undefined {
  const og = html.match(
    /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  if (og?.[1]) {
    const u = resolveAbsoluteUrl(og[1].trim(), baseUrl);
    if (u) return u;
  }
  const tw = html.match(
    /<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  if (tw?.[1]) {
    const u = resolveAbsoluteUrl(tw[1].trim(), baseUrl);
    if (u) return u;
  }
  const apple = html.match(
    /<link[^>]+rel\s*=\s*["']apple-touch-icon["'][^>]+href\s*=\s*["']([^"']+)["']/i
  );
  if (apple?.[1]) {
    const u = resolveAbsoluteUrl(apple[1].trim(), baseUrl);
    if (u) return u;
  }

  const headerChunk = html.slice(0, Math.min(html.length, 120_000));
  const navImg = headerChunk.match(
    /<header[^>]*>[\s\S]*?<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i
  );
  if (navImg?.[1]) {
    const src = navImg[1];
    if (/logo|brand|site-title|navbar/i.test(navImg[0]) || /logo/i.test(src)) {
      const u = resolveAbsoluteUrl(src, baseUrl);
      if (u) return u;
    }
  }

  const anyLogoImg = headerChunk.match(
    /<img[^>]+(?:class|alt|id)\s*=\s*["'][^"']*logo[^"']*["'][^>]*src\s*=\s*["']([^"']+)["']/i
  );
  if (anyLogoImg?.[1]) {
    const u = resolveAbsoluteUrl(anyLogoImg[1].trim(), baseUrl);
    if (u) return u;
  }

  return undefined;
}

export function stripHtmlToText(html: string, maxLen: number): string {
  const t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/**
 * Déduit le type de site à partir de l'URL, titre, meta description et extrait de texte (markdown/HTML).
 */
export function detectSiteType(input: {
  url: string;
  title: string;
  description: string;
  bodyText: string;
}): SiteTypeId {
  const all = `${input.url} ${input.title} ${input.description} ${input.bodyText}`.toLowerCase();

  const score = (patterns: RegExp[]): number =>
    patterns.reduce((acc, re) => acc + (re.test(all) ? 1 : 0), 0);

  const ecommerce = score([
    /\b(woocommerce|shopify|prestashop|magento|add to cart|panier|checkout|boutique en ligne)\b/,
    /\b(e-?commerce|online store|product catalog|shopping cart)\b/,
    /\b(shop|store)\b.*\b(cart|product)\b/,
  ]);
  const blog = score([/\b(blog|article|journal|chronique|editorial)\b/, /\b(posted on|published|tags?:)\b/]);
  const saas = score([
    /\b(saas|software as a service|free trial|sign up|request demo|api key)\b/,
    /\b(pricing|per month|per seat|subscription)\b/,
  ]);
  const portfolio = score([/\b(portfolio|selected work|case studies|creative director)\b/, /\b(my work|projects)\b/]);
  const restaurant = score([
    /\b(restaurant|resto|brasserie|menu|carte des vins|réservation|reservation|chef|cuisine)\b/,
    /\b(dining|food & beverage|osteria|trattoria)\b/,
  ]);
  const agency = score([/\b(agency|agence|we build|our services|clients)\b/, /\b(digital agency|creative studio)\b/]);
  const news = score([/\b(actualit[ée]s|breaking news|editorial|journal|rédaction)\b/, /\b(newsletter|subscribe for news)\b/]);
  const docs = score([/\b(documentation|api reference|developer docs|getting started)\b/, /\b(read the docs)\b/]);
  const nonprofit = score([/\b(donation|nonprofit|association|ngo|bénévoles)\b/, /\b(charity|fundrais)\b/]);
  const realestate = score([/\b(immobilier|real estate|properties for sale|listing|m²|sqft)\b/]);
  const education = score([/\b(university|curriculum|course|campus|enrollment|école|formation)\b/]);
  const healthcare = score([/\b(clinic|hospital|patient|medical|healthcare|rendez-vous médical)\b/]);
  const hospitality = score([/\b(hotel|hôtel|booking\.com|rooms? available|stay with us)\b/]);

  const ranked: { type: SiteTypeId; s: number }[] = [
    { type: 'e-commerce', s: ecommerce },
    { type: 'blog', s: blog },
    { type: 'saas-landing', s: saas },
    { type: 'portfolio', s: portfolio },
    { type: 'restaurant', s: restaurant },
    { type: 'agency', s: agency },
    { type: 'news-media', s: news },
    { type: 'documentation', s: docs },
    { type: 'nonprofit', s: nonprofit },
    { type: 'real-estate', s: realestate },
    { type: 'education', s: education },
    { type: 'healthcare', s: healthcare },
    { type: 'hospitality', s: hospitality },
  ];

  ranked.sort((a, b) => b.s - a.s);
  if (ranked[0].s > 0) return ranked[0].type;
  return 'landing-page';
}

/** Sections déduites du HTML, filtrées selon le type (évite "pricing" hors contexte). */
export function extractSectionsSmart(html: string, siteType: SiteTypeId): string[] {
  const sections: string[] = [];
  if (/<nav[\s>]|<header[\s>]|role\s*=\s*["']navigation["']/i.test(html)) sections.push('navigation bar');
  if (/class\s*=\s*["'][^"']*hero[^"']*["']|<\s*section[\s\S]*?<h1/i.test(html)) {
    sections.push('hero section with headline and CTA');
  }
  if (/class\s*=\s*["'][^"']*feature[^"']*["']|\bbenefit\b/i.test(html)) {
    sections.push('features/benefits grid');
  }
  const hasPricingSection =
    /\b(pricing|tarifs?|plans?)\b/i.test(html) &&
    /class\s*=\s*["'][^"']*(pricing|price|plan)[^"']*["']/i.test(html);
  if (hasPricingSection && ['saas-landing', 'e-commerce', 'landing-page'].includes(siteType)) {
    sections.push('pricing table');
  }
  if (/testimonial|review|rating/i.test(html)) sections.push('testimonials/reviews');
  if (/\babout\b|qui sommes|über uns/i.test(html)) sections.push('about section');
  if (/contact|<\s*form\s/i.test(html)) sections.push('contact form');
  if (/cta|call-to-action/i.test(html)) sections.push('call-to-action section');
  if (/<footer/i.test(html)) sections.push('footer with links');
  if (siteType === 'restaurant' && /\b(menu|carte)\b/i.test(html)) {
    if (!sections.some((s) => /menu/i.test(s))) sections.push('menu or specialties highlight section');
  }
  if (sections.length === 0) {
    sections.push('navigation bar', 'hero section', 'main content area', 'footer');
  }
  return sections;
}

export function getTypeLabelEn(type: string): string {
  return TYPE_LABEL_EN[type] || TYPE_LABEL_EN['landing-page'];
}

export function getTypeDirectiveEn(type: string): string {
  return TYPE_DIRECTIVES_EN[type] || TYPE_DIRECTIVES_EN['landing-page'];
}

export type StitchPromptParams = {
  title: string;
  description: string;
  type: SiteTypeId;
  colors: string[];
  fonts: string[];
  sections: string[];
  logoUrl?: string;
  /** Domaine du site (sans www) pour wordmark texte. */
  sourceHostname?: string;
  stylePreference?: string;
  /** Code langue ISO pour tout le texte visible (fr, en, de, …). */
  contentLanguage?: string;
  /** Texte source réel (crawl) à respecter : offres, titres, vocabulaire. */
  contentExcerpt?: string;
  /** Consignes principales (sauvegardées côté client) — jamais au-dessus des règles système obligatoires. */
  baseInstructions?: string;
  /** Consignes complémentaires pour cette exécution uniquement (styles, détails). */
  supplementaryInstructions?: string;
};

const STYLE_SNIPPETS: Record<string, string> = {
  Moderne: 'Clean lines, subtle shadows, rounded corners, generous whitespace.',
  Minimaliste: 'Very minimal, restrained palette, strong typography.',
  Corporate: 'Professional, trustworthy, structured layout.',
  Creatif: 'Bold but coherent with the brand colors provided.',
  Luxe: 'Premium feel; refined spacing and sans-serif typography only—no decorative serifs unless the source site clearly uses them.',
  Élégant: 'Elegant, refined sans-serif (e.g. Inter, DM Sans)—avoid Times/Georgia for headings or stats.',
  Tech: 'Modern tech look while respecting brand colors (not generic blue if palette differs).',
  Brutalist: 'High contrast; still use the brand hex colors where appropriate.',
  Vintage: 'Retro mood; align with messaging and colors—still avoid cartoon imagery.',
  Playful: 'Friendly tone; do not contradict the sector-specific vocabulary; keep photography realistic.',
};

/** Règles non négociables : look corporate réel (pas cartoon / pas serif « catalogue »). */
const CORPORATE_TYPOGRAPHY_RULES = `TYPOGRAPHY (mandatory) — Use ONLY modern sans-serif fonts for the entire page: all headings, body text, statistics/KPI numbers, testimonials, quotes, buttons, and navigation. Prefer Inter, system-ui, -apple-system, Segoe UI, or load via Google Fonts (e.g. Inter, DM Sans, Plus Sans, Open Sans). Do NOT use Times New Roman, Georgia, Garamond, Playfair Display, or any serif font for large numbers, metrics, or corporate UI—those look dated and wrong for B2B/SaaS/corporate. Do NOT use italic serif for pull quotes; use clean sans-serif with normal or medium weight.`;

const CORPORATE_IMAGERY_RULES = `PHOTOGRAPHY & IMAGERY (mandatory) — NO flat vector illustrations. Real photography only (people, offices, products, architecture). Use ONLY these URL patterns: https://images.unsplash.com/photo-* (or /photos/ paths) and https://images.pexels.com/photos/* — any other image host is FORBIDDEN. Do NOT use undraw.co, storyset, dribbble, DALL·E, Midjourney, or any illustration/vector/cartoon URL. FORBIDDEN: cartoon or illustration style, anime, vector “flat people”, 3D renders of humans, clip-art, painterly or “AI art” aesthetics, oversaturated fake HDR portraits, or any image that looks like a drawing or game asset. If you cannot use a credible Unsplash/Pexels photo, use a neutral abstract gradient, subtle geometric pattern, or a simple initials avatar—never substitute with illustrated characters.`;

const PORTRAIT_AND_PEOPLE_RULES = `PEOPLE & PORTRAITS (mandatory) — If SOURCE CONTENT names a specific person or uses gendered pronouns (e.g. she/her/he/him/elle/il), any photo showing a recognizable professional must match that gender presentation and context. If gender is ambiguous, avoid close-up synthetic “hero portraits”: prefer hands-at-desk, office wide shot, cityscape, abstract texture, or neutral workspace—never a random face that contradicts the text.`;

const PHOTO_FINAL_CHECK =
  'FINAL PHOTO CHECK — Every human image must look like a believable real photograph (natural texture, credible lighting). No plastic doll faces, no cartoon, no video-game 3D characters, no glossy AI headshot clichés.';

/** Règle globale, sans cibler un secteur : éviter métaphores visuelles aléatoires et faux logos. */
const STITCH_GLOBAL_DISCIPLINE = `GLOBAL DISCIPLINE (mandatory, any business type): Do not invent unrelated symbolic imagery or random metaphors (fantasy architecture, unrelated monuments, surreal objects, decorative spectacle) unless they clearly match the crawled content and messaging. Prefer boring, credible, realistic photography or neutral abstractions. HEADER BRANDING: never use a logo image or brand-mark <img>—use a text wordmark only (company name and/or domain). Do not invent a fake emblem or symbol as the brand.`;

const STITCH_ICONS_RULE = `ICONS (mandatory) — Use a single icon set via CDN (prefer Lucide: unpkg.com/lucide@latest or esm.sh/lucide). Load once and reuse. EVERY primary navigation link MUST have a visible inline SVG icon (stroke, ~20px, currentColor) before the label. Feature lists, benefit rows, and service cards MUST each include a leading icon. Section titles may include a small icon. Do not leave empty .icon placeholders or missing glyphs—every intended icon slot must render. Footer social or contact rows: include icons where appropriate.`;

const CORPORATE_CONTRAST_RULES = `CONTRAST & READABILITY (mandatory) — Never use dark body text (#000000, #111827, #1f2937, near-black grays) on dark backgrounds, dark hero photos, or dark gradients. On dark or photographic heroes/headers: headings and primary copy MUST be light (#f8fafc or #ffffff); primary buttons should stay readable (e.g. solid brand-colored fill with white label, or a clearly light-filled button). On light sections below the fold, use dark text on light backgrounds. If text sits on a busy image, add a subtle overlay, scrim, or semi-opaque content panel behind the text—never rely on low-contrast black-on-dark. Avoid inline styles or CSS that force black text over dark imagery.`;

/** Fonds sombres : stats, deux colonnes, ET titres de section au milieu de page (souvent oubliés). */
const DARK_SECTION_KPI_CONTRAST_RULE = `DARK BACKGROUNDS (mandatory) — If ANY block or full-width section uses a dark background (navy, #0a1128, #0f172a, slate-900/800, or similar), ALL text must be light—including mid-page section titles (h1, h2, h3) that sit alone above cards or features, KPI labels, subtitles, and body lines. Use #ffffff / #f8fafc for titles and primary labels; #e2e8f0 / #cbd5e1 for secondary text. NEVER use black, text-black, text-gray-900, text-slate-900, or #111827 on that dark fill. Applies to two-column layouts (photo left, copy right) when text is on dark. Accent numbers in brand color are OK only if clearly readable; adjacent labels must be light.`;

/** Rappel ultra-court répété plusieurs fois dans le prompt pour forcer le modèle. */
const DARK_BG_HEADING_REMINDER =
  'CONTRAST CHECK — On dark blue/navy/slate section backgrounds: section headings (h2/h3) and ALL copy MUST be white or light gray—NEVER black or text-gray-900.';

/**
 * Prompt enrichi pour Google Stitch : préserve couleurs, logo, message, vocabulaire métier.
 */
const STITCH_PROMPT_MAX = 10_000;

export function buildStitchPrompt(p: StitchPromptParams): string {
  const typeStr = getTypeLabelEn(p.type);
  const typeDirective = getTypeDirectiveEn(p.type);
  const parts: string[] = [];

  const lang = (p.contentLanguage || 'en').trim().toLowerCase();
  const langName: Record<string, string> = {
    fr: 'French',
    en: 'English',
    de: 'German',
    es: 'Spanish',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    pl: 'Polish',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
  };
  const langLabel = langName[lang] || `language code ${lang}`;

  parts.push(
    `LANGUAGE — All user-visible copy (headings, buttons, navigation labels, body text, footer, forms) MUST be written in ${langLabel} (${lang}). Do not translate into English or any other language. Set <html lang="${lang}"> in the output.`
  );

  parts.push(DARK_SECTION_KPI_CONTRAST_RULE);
  parts.push(DARK_BG_HEADING_REMINDER);
  parts.push(CORPORATE_TYPOGRAPHY_RULES);
  parts.push(CORPORATE_IMAGERY_RULES);
  parts.push(PORTRAIT_AND_PEOPLE_RULES);
  parts.push(PHOTO_FINAL_CHECK);
  parts.push(STITCH_GLOBAL_DISCIPLINE);
  parts.push(STITCH_ICONS_RULE);
  parts.push(CORPORATE_CONTRAST_RULES);
  parts.push(DARK_BG_HEADING_REMINDER);

  parts.push(
    `You are redesigning ONE desktop-first marketing page. Inferred site sector: ${typeStr}. Original site name/title: "${(p.title || 'Website').slice(0, 120)}".`
  );
  parts.push(DARK_BG_HEADING_REMINDER);
  if (p.description?.trim()) {
    parts.push(
      `Original meta description / key messaging (preserve facts, tone, and language; do not invent unrelated services): ${p.description.slice(0, 450)}`
    );
  }

  const excerpt = (p.contentExcerpt || '').trim();
  if (excerpt.length > 0) {
    parts.push(
      `SOURCE CONTENT — The following text was crawled from the real site. Reuse the same offers, services, names, facts, and vocabulary where relevant. Do NOT invent different products, slogans, or business lines. Prefer paraphrasing only for layout; keep proper nouns and key claims accurate:\n---\n${excerpt.slice(0, 4200)}\n---`
    );
  }

  parts.push(`Sector-specific instructions: ${typeDirective}`);
  parts.push(DARK_BG_HEADING_REMINDER);

  if (p.colors.length > 0) {
    parts.push(
      `BRAND COLORS — You MUST base the UI palette on these hex values from the original site (primary accents, buttons, links, highlights): ${p.colors.slice(0, 8).join(', ')}. Use them as the main brand colors. Do NOT replace them with an unrelated generic palette (e.g. random blue/green startup theme).`
    );
  } else {
    parts.push(
      'No reliable hex palette was extracted: stay faithful to the sector; avoid a generic unrelated palette.'
    );
  }

  {
    const host = (p.sourceHostname || '').trim();
    const title = (p.title || 'Website').slice(0, 120);
    parts.push(
      `HEADER BRANDING (mandatory) — Do NOT use any logo image, <img> brand mark, or favicon blown up as a logo. Use a clean TEXT wordmark only: the site name "${title}"${host ? ` and/or the domain "${host}"` : ''}. Strong sans-serif typography; brand colors from the palette. Even if a logo image URL exists in analysis (${p.logoUrl ? 'one was detected' : 'none'}), do NOT embed it in the header—text only.`
    );
  }

  parts.push(DARK_BG_HEADING_REMINDER);

  if (p.fonts.length > 0) {
    parts.push(
      `Typography hint from original site (only use fonts that are clearly sans-serif; if any listed font is serif, ignore it for UI and use Inter or system-ui instead): ${p.fonts.slice(0, 3).join(', ')}.`
    );
  }

  parts.push(
    `Sections to include (adapt labels to the sector — e.g. not "products" for a restaurant unless the source is actually a shop): ${p.sections.slice(0, 8).join('; ')}.`
  );

  if (p.stylePreference && STYLE_SNIPPETS[p.stylePreference]) {
    parts.push(`Style preference: ${p.stylePreference}. ${STYLE_SNIPPETS[p.stylePreference]}`);
  }

  parts.push(
    'Output: single self-contained page, semantic HTML5, accessible, responsive. Re-confirm: sans-serif only; real photography or abstract placeholders only—no cartoon/illustration visuals; text-only header brand (no logo <img>); navigation and lists include visible Lucide-style icons as specified; EVERY dark section must have light text on ALL elements including mid-page h2/h3 titles—never black text on navy (see CONTRAST CHECK reminders above). Do not add fake e-commerce cart/checkout unless the sector is e-commerce.'
  );

  parts.push(PHOTO_FINAL_CHECK);

  let prompt = parts.join(' ');
  const base = (p.baseInstructions || '').trim();
  const sup = (p.supplementaryInstructions || '').trim();
  if (base) {
    prompt += `\n\nUSER BASE INSTRUCTIONS (your saved preferences — apply for tone, imagery, and copy; they MUST NOT override mandatory system rules above: contrast on dark backgrounds, accessibility, readable text, Lucide icons, text-only header brand, photography rules, and language).\n${base}`;
  }
  if (sup) {
    prompt += `\n\nUSER SUPPLEMENTARY INSTRUCTIONS (optional tweaks for this run only — e.g. extra style notes; same constraint: never contradict mandatory contrast, readability, or system rules).\n${sup}`;
  }
  if (prompt.length > STITCH_PROMPT_MAX) {
    prompt = prompt.slice(0, STITCH_PROMPT_MAX - 3) + '...';
  }
  return prompt;
}

/** Bloc texte pour le mode avancé (Claude) — cohérent avec Stitch. */
export function buildBrandContextBlock(input: {
  type: SiteTypeId;
  title: string;
  description: string;
  colors: string[];
  logoUrl?: string;
  sourceHostname?: string;
  contentLanguage?: string;
  contentExcerpt?: string;
}): string {
  const lang = (input.contentLanguage || 'en').trim();
  const host = (input.sourceHostname || '').trim();
  const lines = [
    `All user-visible text must be in language: ${lang} (match the source site).`,
    DARK_SECTION_KPI_CONTRAST_RULE,
    CORPORATE_TYPOGRAPHY_RULES,
    CORPORATE_IMAGERY_RULES,
    PORTRAIT_AND_PEOPLE_RULES,
    PHOTO_FINAL_CHECK,
    STITCH_GLOBAL_DISCIPLINE,
    STITCH_ICONS_RULE,
    CORPORATE_CONTRAST_RULES,
    DARK_BG_HEADING_REMINDER,
    DARK_BG_HEADING_REMINDER,
    `Detected site type: ${getTypeLabelEn(input.type)}`,
    `Original title: ${input.title.slice(0, 200)}`,
    input.description ? `Original description / messaging: ${input.description.slice(0, 500)}` : '',
    input.contentExcerpt?.trim()
      ? `Source page excerpt (reuse facts, names, vocabulary):\n${input.contentExcerpt.trim().slice(0, 4000)}`
      : '',
    input.colors.length
      ? `Brand colors to preserve (use in CSS): ${input.colors.join(', ')}`
      : 'Brand colors: not extracted — infer from screenshot and content; avoid unrelated palettes.',
    `Header: text wordmark only — site title "${input.title.slice(0, 120)}"${host ? ` or domain "${host}"` : ''}. Do NOT use a logo <img>${input.logoUrl ? ` (detected URL ignored for header: ${input.logoUrl})` : ''}.`,
    `Sector rules: ${getTypeDirectiveEn(input.type)}`,
  ].filter(Boolean);
  return lines.join('\n');
}
