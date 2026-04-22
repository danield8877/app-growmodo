import { absolutizeUploadsUrls } from './assetUrls';
import { FONT_AWESOME_CDN, remapMaterialIconsToFontAwesome } from './iconsFallback';
import { getGoogleFontsFromCss, stripBrokenBlobUrls, PREVIEW_CORPORATE_FONT_OVERRIDE } from './previewFonts';
import type { RevamperProject } from './storage';

/** Data URI pour remplacer les images placeholder.pics (évite CORS en preview) */
const PLACEHOLDER_IMG_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='32' viewBox='0 0 120 32'%3E%3Crect fill='%23e5e7eb' width='120' height='32'/%3E%3C/svg%3E";

const FIXED_FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

const MATERIAL_ICON_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Icons&display=swap" rel="stylesheet">';

const MATERIAL_ICON_FALLBACK_CSS = `
.material-icons{
  font-family:'Material Icons' !important;
  font-weight:normal;
  font-style:normal;
  font-size:24px;
  line-height:1;
  letter-spacing:normal;
  text-transform:none;
  display:inline-block;
  white-space:nowrap;
  word-wrap:normal;
  direction:ltr;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  -moz-osx-font-smoothing:grayscale;
  font-feature-settings:'liga';
}
.material-symbols-outlined,.material-symbols-rounded,.material-symbols-sharp{
  font-family:'Material Symbols Outlined' !important;
  font-weight:400;
  font-style:normal;
  font-size:24px;
  line-height:1;
  letter-spacing:normal;
  text-transform:none;
  display:inline-block;
  white-space:nowrap;
  word-wrap:normal;
  direction:ltr;
  -webkit-font-feature-settings:'liga';
  -webkit-font-smoothing:antialiased;
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
}`;

const FIXED_TYPOGRAPHY_CSS = `
html,body{
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif !important;
}
h1,h2,h3,h4,h5,h6,button,.btn,.cta,nav a,[class*="title"],[class*="heading"]{
  font-family:'Manrope','Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif !important;
}
${PREVIEW_CORPORATE_FONT_OVERRIDE}`;

function hasTailwindUtilityClasses(html: string): boolean {
  if (!html) return false;
  return /class\s*=\s*["'][^"']*\b(?:flex|grid|container|mx-auto|px-\d|py-\d|bg-[^\s"']+|text-[^\s"']+|font-[^\s"']+|rounded(?:-[^\s"']+)?)\b/i.test(
    html
  );
}

export type BuildPreviewParams = {
  html: string;
  css: string;
  js: string;
  analysis: RevamperProject['analysis'];
  linkTags?: string;
  /** Script éditeur (injecté en dernier dans <body>) */
  editorBridgeScript?: string;
};

/**
 * Même logique que la preview RevamperResult (iframe srcDoc) — option script bridge pour l’éditeur.
 */
export function buildRevamperPreviewDocument(p: BuildPreviewParams): string {
  const { html, css, js, analysis, linkTags, editorBridgeScript } = p;
  const mergedLinkTags = linkTags || (analysis as { revamperFontLinks?: string } | undefined)?.revamperFontLinks;
  const lang = analysis?.lang || 'fr';
  const hasTailwindClasses = hasTailwindUtilityClasses(html || '');
  const primaryColor = analysis?.colors?.primary || '#2563eb';
  const secondaryColor = analysis?.colors?.secondary || '#64748b';
  const tailwindConfigScript = hasTailwindClasses
    ? `<script>tailwind.config={theme:{extend:{colors:{primary:'${primaryColor}',secondary:'${secondaryColor}'}}}}</script>`
    : '';
  const tailwindCdn = hasTailwindClasses ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
  const hasMaterialSymbols =
    html && (html.includes('material-symbols') || /class="[^"]*material-symbols[^"]*"/i.test(html));
  const hasMaterialIcons =
    html && (html.includes('material-icons') || /class="[^"]*material-icons[^"]*"/i.test(html));
  let googleFonts = FIXED_FONT_LINKS;
  if (hasMaterialSymbols || hasMaterialIcons) googleFonts += MATERIAL_ICON_LINKS;
  let htmlNoPlaceholder = (html || '').replace(
    /https:\/\/placeholder\.pics\/[^"'\s]*/g,
    PLACEHOLDER_IMG_DATA_URI
  );
  htmlNoPlaceholder = htmlNoPlaceholder.replace(
    /<img([^>]*)\ssrc\s*=\s*["'](?:#|about:blank)?["']/gi,
    '<img$1 src="' + PLACEHOLDER_IMG_DATA_URI + '"'
  );
  const iconFallback = remapMaterialIconsToFontAwesome(htmlNoPlaceholder);
  htmlNoPlaceholder = iconFallback.html;
  htmlNoPlaceholder = absolutizeUploadsUrls(htmlNoPlaceholder);
  htmlNoPlaceholder = stripBrokenBlobUrls(htmlNoPlaceholder, PLACEHOLDER_IMG_DATA_URI);
  const extraGoogleFonts = getGoogleFontsFromCss(css);
  const linkTagsForPreview = css?.includes('/* === Feuille externe') ? '' : mergedLinkTags || '';
  const docBackground = 'html, body { background: #0f172a; margin: 0; padding: 0; min-height: 100vh; }';
  const bridge = editorBridgeScript
    ? `<script>${editorBridgeScript.replace(/<\/script>/gi, '<\\/script>')}</script>`
    : '';
  return `<!DOCTYPE html><html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${googleFonts}
${extraGoogleFonts}
${linkTagsForPreview}
${iconFallback.used ? FONT_AWESOME_CDN : ''}
${tailwindCdn}
${tailwindConfigScript}
<style>${docBackground}\n${FIXED_TYPOGRAPHY_CSS}\n${MATERIAL_ICON_FALLBACK_CSS}\n${css || ''}</style>
</head>
<body>${htmlNoPlaceholder}<script>${(js || '').replace(/<\/script>/gi, '<\\/script>')}</script>${bridge}</body></html>`;
}
