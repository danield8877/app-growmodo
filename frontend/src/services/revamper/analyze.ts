import type { RevamperAnalysis } from './types';

/** Extrait les couleurs depuis les balises <style> et attributs style (regex simples) */
function extractColors(html: string): RevamperAnalysis['colors'] {
  const colors: RevamperAnalysis['colors'] = {};
  const styleBlock = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  const styleContent = (styleBlock || []).join(' ');
  const inlineStyles = html.match(/style\s*=\s*["']([^"']+)["']/gi) || [];

  const tryColor = (regex: RegExp, key: keyof RevamperAnalysis['colors']) => {
    const m = styleContent.match(regex) || inlineStyles.join(' ').match(regex);
    if (m && m[1]) colors[key] = m[1].trim();
  };
  tryColor(/(?:--primary|color:\s*|background(?:-color)?:\s*)(#[a-fA-F0-9]{3,8}|rgb\a?\([^)]+\)|rgba?\([^)]+\)|[a-zA-Z]+)/, 'primary');
  tryColor(/(?:--secondary|secondary[^:]*:\s*)(#[a-fA-F0-9]{3,8}|rgb\a?\([^)]+\)|[a-zA-Z]+)/, 'secondary');
  tryColor(/background(?:-color)?:\s*([#a-fA-F0-9]{3,8}|rgb\a?\([^)]+\)|[a-zA-Z]+)/, 'background');
  tryColor(/color:\s*([#a-fA-F0-9]{3,8}|rgb\a?\([^)]+\)|[a-zA-Z]+)/, 'text');

  if (!colors.primary) colors.primary = '#2563eb';
  if (!colors.background) colors.background = '#ffffff';
  if (!colors.text) colors.text = '#1f2937';
  return colors;
}

/** Analyse un document HTML et retourne les infos pour la refonte. Ne lance pas. */
export function analyzeHtml(html: string): RevamperAnalysis {
  if (!html || typeof html !== 'string') {
    return {
      lang: 'fr',
      title: 'Site',
      colors: { primary: '#2563eb', background: '#ffffff', text: '#1f2937' },
      menuItems: [],
      contentSnippets: ['Bienvenue', 'Découvrez nos services.'],
    };
  }

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  } catch {
    return {
      lang: 'fr',
      title: 'Site',
      colors: extractColors(html),
      menuItems: [],
      contentSnippets: [],
    };
  }

  const lang =
    doc.documentElement.getAttribute('lang') ||
    doc.querySelector('meta[http-equiv="Content-Language"]')?.getAttribute('content')?.slice(0, 2) ||
    doc.querySelector('meta[property="og:locale"]')?.getAttribute('content')?.slice(0, 2) ||
    'fr';

  const title =
    doc.querySelector('title')?.textContent?.trim() ||
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
    'Site';

  const menuItems: { label: string; href: string }[] = [];
  try {
    const navSelectors = 'nav a, header a, [role="navigation"] a, .nav a, .menu a';
    doc.querySelectorAll(navSelectors).forEach((a: Element) => {
      const label = a.textContent?.trim();
      const href = a.getAttribute?.('href') || '#';
      if (label && label.length < 50) menuItems.push({ label, href });
    });
  } catch (_) {}
  const seen = new Set<string>();
  const uniqueMenu = menuItems.filter((m) => {
    const k = m.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let logoUrl: string | null = null;
  try {
    const logoImg = doc.querySelector('header img[alt*="logo"], .logo img, [class*="logo"] img, img[src*="logo"]') as HTMLImageElement | null;
    if (logoImg && logoImg.getAttribute('src')) logoUrl = logoImg.getAttribute('src');
  } catch (_) {}

  const contentSnippets: string[] = [];
  try {
    doc.querySelectorAll('h1, h2, h3, p').forEach((el: Element) => {
      const t = el.textContent?.trim();
      if (t && t.length > 2 && t.length < 300) contentSnippets.push(t);
    });
  } catch (_) {}

  const colors = extractColors(html);

  return {
    lang: lang || 'fr',
    title: title || 'Site',
    colors,
    logoUrl,
    menuItems: uniqueMenu.slice(0, 8),
    contentSnippets: contentSnippets.length > 0 ? contentSnippets.slice(0, 15) : ['Bienvenue', 'Découvrez nos services et notre expertise.'],
  };
}
