/** Extrait html, css, js depuis la réponse brute (JSON, blocs markdown, etc.). */
export function extractHtmlCssJsFromRaw(raw: string): { html: string; css: string; js: string } {
  let html = '';
  let css = '';
  let js = '';
  function setFromParsed(parsed: {
    html?: string;
    css?: string;
    js?: string;
    HTML?: string;
    CSS?: string;
    JS?: string;
  }): void {
    html = typeof parsed.html === 'string' ? parsed.html : typeof parsed.HTML === 'string' ? parsed.HTML : '';
    css = typeof parsed.css === 'string' ? parsed.css : typeof parsed.CSS === 'string' ? parsed.CSS : '';
    js = typeof parsed.js === 'string' ? parsed.js : typeof parsed.JS === 'string' ? parsed.JS : '';
  }
  const blockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(raw)) !== null) {
    const blockContent = blockMatch[1].trim();
    if (blockContent.startsWith('{') && (blockContent.includes('html') || blockContent.includes('HTML'))) {
      try {
        const parsed = JSON.parse(blockContent) as Parameters<typeof setFromParsed>[0];
        setFromParsed(parsed);
        if (html || css) break;
      } catch {
        /* next */
      }
    }
  }
  if (!html && !css) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Parameters<typeof setFromParsed>[0];
        setFromParsed(parsed);
      } catch {
        /* fall through */
      }
    }
  }
  if (!html && !css) {
    const htmlBlock = raw.match(/```(?:html|HTML)?\s*([\s\S]*?)```/i);
    const cssBlock = raw.match(/```(?:css|CSS)?\s*([\s\S]*?)```/i);
    const jsBlock = raw.match(/```(?:js|javascript|JavaScript)?\s*([\s\S]*?)```/i);
    if (htmlBlock) html = htmlBlock[1].trim();
    if (cssBlock) css = cssBlock[1].trim();
    if (jsBlock) js = jsBlock[1].trim();
  }
  if (!html && !css) {
    const allBlocks = [...raw.matchAll(/```[\w]*\s*([\s\S]*?)```/g)];
    for (const m of allBlocks) {
      const s = m[1].trim();
      if (s.startsWith('<') && s.length > 10) {
        html = s;
        break;
      }
    }
  }
  return { html, css, js };
}

export function postProcessGeneratedHtml(html: string): string {
  const placeholder =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'/%3E";
  return html.replace(/<img([^>]*)\s+src\s*=\s*["'](?:#|about:blank)?["']/gi, `<img$1 src="${placeholder}"`);
}

const GOOGLE_FONTS_EDGE: Record<string, string> = {
  Inter: 'Inter:wght@300;400;500;600;700;800',
  Montserrat: 'Montserrat:wght@300;400;500;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
};

export function buildFontLinksFromCss(css: string): string {
  if (!css?.trim()) return '';
  const fontFamilyRe = /font-family\s*:\s*['"]?([^;}'"]+)/gi;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = fontFamilyRe.exec(css)) !== null) {
    const raw = m[1].split(',')[0].trim().replace(/['"]/g, '').trim();
    if (raw && !/inherit|initial|unset|system-ui|sans-serif|serif|monospace/i.test(raw)) names.add(raw);
  }
  const families = [...names].slice(0, 4).filter((n) => GOOGLE_FONTS_EDGE[n]);
  if (families.length === 0) return '';
  const query = families.map((f) => `family=${GOOGLE_FONTS_EDGE[f].replace(/ /g, '+')}`).join('&');
  return (
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?' +
    query +
    '&display=swap" rel="stylesheet">'
  );
}
