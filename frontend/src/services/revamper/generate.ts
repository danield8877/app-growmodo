import type { RevamperAnalysis, RevamperResult } from './types';
import { getApiBase } from '../../lib/api';

const REVAMPER_ENDPOINT = `${getApiBase()}/api/revamper/generate`;
const REVAMPER_STREAM_ENDPOINT = `${getApiBase()}/api/revamper/generate-stream`;
const REVAMPER_ADVANCED_ENDPOINT = `${getApiBase()}/api/revamp-advanced`;

export type RevamperStreamProgress = {
  step: string;
  label: string;
  detail?: string;
  elapsedMs: number;
};

/**
 * Génère une refonte à partir d'une URL.
 * - Stitch : page complète (HTML/CSS/JS).
 * Options : stylePreference (Moderne, Minimaliste, Corporate, Creatif).
 */
/** Timeout en ms : doit dépasser le timeout serveur (Stitch + crawl). */
const REVAMPER_TIMEOUT_MS = 220_000;

/** Sections possibles pour la refonte (option "Section"). */
export const REVAMPER_SECTION_IDS = [
  'nav',
  'header',
  'hero',
  'footer',
  'cta',
  'faq',
  'about',
  'features',
  'pricing',
  'contact',
  'testimonials',
] as const;
export type RevamperSectionId = (typeof REVAMPER_SECTION_IDS)[number];

const SECTION_TO_PROMPT: Record<string, string> = {
  nav: 'navigation bar',
  header: 'header',
  hero: 'hero section with headline and CTA',
  footer: 'footer with links',
  cta: 'call-to-action section',
  faq: 'FAQ section with accordion',
  about: 'about us section',
  features: 'features/benefits grid',
  pricing: 'pricing table',
  contact: 'contact form',
  testimonials: 'testimonials/reviews',
};

export async function generateRevamp(
  url: string,
  options?: {
    stylePreference?: string;
    sections?: string[];
    baseInstructions?: string;
    supplementaryInstructions?: string;
    /** @deprecated utiliser baseInstructions */
    additionalInstructions?: string;
  },
  accessToken?: string | null
): Promise<RevamperResult> {
  if (!REVAMPER_ENDPOINT) {
    throw new Error('Impossible de générer la refonte. Endpoint non configuré.');
  }
  if (!accessToken) {
    throw new Error('Authentification requise.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REVAMPER_TIMEOUT_MS);

  const sectionsPrompt =
    options?.sections?.length &&
    options.sections.map((id) => SECTION_TO_PROMPT[id] || id).filter(Boolean);

  let res: Response;
  try {
    res = await fetch(REVAMPER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: url.trim(),
        stylePreference: options?.stylePreference ?? undefined,
        sections: sectionsPrompt ?? undefined,
        baseInstructions:
          options?.baseInstructions?.trim() || options?.additionalInstructions?.trim() || undefined,
        supplementaryInstructions: options?.supplementaryInstructions?.trim() || undefined,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Génération trop longue (timeout). Réessayez ou vérifiez votre connexion.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text();
    console.error('Revamper API error response:', errText);
    let message = 'Impossible de générer la refonte. Vérifiez l\'URL et réessayez.';
    try {
      const errJson = JSON.parse(errText);
      console.error('Parsed error:', errJson);
      if (typeof errJson?.error === 'string') {
        message = errJson.error;
        if (errJson.details) {
          console.error('Error details:', errJson.details);
          message += ` (${errJson.details})`;
        }
      }
    } catch {
      if (errText && errText.length < 500) message = errText;
    }
    throw new Error(message);
  }
  const data = (await res.json()) as RevamperResult;
  if (!data?.analysis) throw new Error('Réponse invalide.');
  if (data.html === undefined || data.css === undefined || data.js === undefined) throw new Error('Réponse invalide.');
  return data;
}

export async function generateAdvancedRevampHtml(
  url: string,
  accessToken?: string | null
): Promise<string> {
  if (!accessToken) {
    throw new Error('Authentification requise.');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(REVAMPER_ADVANCED_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url: url.trim() }),
      signal: controller.signal,
    });
    const txt = await res.text();
    let data: { success?: boolean; html?: string; error?: string } = {};
    try {
      data = JSON.parse(txt) as { success?: boolean; html?: string; error?: string };
    } catch {
      /* ignore */
    }
    if (!res.ok || data.success !== true || !data.html) {
      throw new Error(data.error || txt || 'Échec génération avancée.');
    }
    return data.html;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Génération avancée trop longue (timeout).');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseSseBlocks(
  buffer: string,
  onEvent: (obj: { type?: string; [k: string]: unknown }) => void
): string {
  let rest = buffer;
  let sep: number;
  while ((sep = rest.indexOf('\n\n')) !== -1) {
    const block = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5).trimStart();
      try {
        const obj = JSON.parse(payload) as { type?: string };
        onEvent(obj);
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
  return rest;
}

/**
 * Génération avec flux SSE réel (étapes crawl, Stitch, assets, etc.).
 */
export async function generateRevampWithProgress(
  url: string,
  options: {
    stylePreference?: string;
    sections?: string[];
    baseInstructions?: string;
    supplementaryInstructions?: string;
    /** @deprecated utiliser baseInstructions */
    additionalInstructions?: string;
    onProgress: (p: RevamperStreamProgress) => void;
  },
  accessToken: string | null
): Promise<RevamperResult> {
  if (!accessToken) throw new Error('Authentification requise.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REVAMPER_TIMEOUT_MS);

  const sectionsPrompt =
    options?.sections?.length &&
    options.sections.map((id) => SECTION_TO_PROMPT[id] || id).filter(Boolean);

  let res: Response;
  try {
    res = await fetch(REVAMPER_STREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: url.trim(),
        stylePreference: options?.stylePreference ?? undefined,
        sections: sectionsPrompt ?? undefined,
        baseInstructions:
          options.baseInstructions?.trim() || options.additionalInstructions?.trim() || undefined,
        supplementaryInstructions: options.supplementaryInstructions?.trim() || undefined,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Génération trop longue (timeout). Réessayez ou vérifiez votre connexion.');
    }
    throw err;
  }

  if (!res.ok) {
    clearTimeout(timeoutId);
    const errText = await res.text();
    let message = 'Impossible de générer la refonte.';
    try {
      const errJson = JSON.parse(errText) as { error?: string };
      if (typeof errJson?.error === 'string') message = errJson.error;
    } catch {
      if (errText && errText.length < 500) message = errText;
    }
    throw new Error(message);
  }

  if (!res.body) {
    clearTimeout(timeoutId);
    throw new Error('Réponse stream invalide (pas de corps).');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = '';
  const sink: { result?: RevamperResult; error?: string } = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      carry += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      carry = parseSseBlocks(carry, (obj) => {
        if (obj.type === 'progress') {
          options.onProgress({
            step: String(obj.step ?? ''),
            label: String(obj.label ?? ''),
            detail: typeof obj.detail === 'string' ? obj.detail : undefined,
            elapsedMs: typeof obj.elapsedMs === 'number' ? obj.elapsedMs : 0,
          });
        } else if (obj.type === 'result') {
          sink.result = {
            analysis: obj.analysis as RevamperResult['analysis'],
            html: String(obj.html ?? ''),
            css: String(obj.css ?? ''),
            js: String(obj.js ?? ''),
          };
        } else if (obj.type === 'error') {
          sink.error = typeof obj.message === 'string' ? obj.message : 'Erreur serveur';
        }
      });
      if (done) break;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (sink.error) throw new Error(sink.error);
  const out = sink.result;
  if (
    !out ||
    out.analysis == null ||
    out.html === undefined ||
    out.css === undefined ||
    out.js === undefined
  ) {
    throw new Error('Réponse stream incomplète.');
  }
  return out;
}

/** Génère une page d'accueil refaite à partir de l'analyse (langue conservée). Toujours retourne un résultat valide. */
export function generatePage(analysis: RevamperAnalysis): RevamperResult {
  const a = analysis ?? {};
  const lang = a.lang ?? 'fr';
  const title = a.title ?? 'Site';
  const colors = a.colors ?? {};
  const primary = colors.primary ?? '#2563eb';
  const background = colors.background ?? '#ffffff';
  const textColor = colors.text ?? '#1f2937';
  const secondary = colors.secondary ?? '#64748b';
  const menuItems = Array.isArray(a.menuItems) ? a.menuItems : [];
  const contentSnippets = Array.isArray(a.contentSnippets) ? a.contentSnippets : ['Bienvenue', 'Découvrez nos services.'];
  const logoUrl = a.logoUrl ?? null;

  const menuHtml =
    menuItems.length > 0
      ? menuItems
          .map((m) => `<a href="${escapeAttr(m.href || '#')}" class="nav-link">${escapeHtml(String(m.label))}</a>`)
          .join('\n          ')
      : '<a href="#" class="nav-link">Accueil</a><a href="#" class="nav-link">Services</a><a href="#" class="nav-link">Contact</a>';

  const heroTitle = contentSnippets.find((s) => s.length > 10 && s.length < 80) || title || 'Bienvenue';
  const heroSub =
    contentSnippets.find((s) => s.length > 30) || 'Découvrez nos services et notre expertise.';

  const logoImg = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="Logo" class="logo-img" />`
    : `<span class="logo-text">${escapeHtml(title || 'Logo')}</span>`;

  const contentParas = contentSnippets.slice(1, 4).map((s) => `<p>${escapeHtml(String(s))}</p>`).join('\n      ');
  const year = new Date().getFullYear();

  const html = `<!-- Refonte générée par Revamper - langue: ${escapeHtml(lang)} -->
<header class="header">
  <div class="container header-inner">
    <a href="#" class="logo">${logoImg}</a>
    <nav class="nav">${menuHtml}</nav>
  </div>
</header>
<main>
  <section class="hero">
    <div class="container">
      <h1 class="hero-title">${escapeHtml(heroTitle)}</h1>
      <p class="hero-sub">${escapeHtml(heroSub)}</p>
      <a href="#" class="cta">En savoir plus</a>
    </div>
  </section>
  <section class="content">
    <div class="container">
      ${contentParas || '<p>Contenu à personnaliser.</p>'}
    </div>
  </section>
</main>
<footer class="footer">
  <div class="container">
    <p>&copy; ${year} ${escapeHtml(title)}. Tous droits réservés.</p>
  </div>
</footer>`;

  const css = `/* Revamper - refonte */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: ${background};
  color: ${textColor};
  line-height: 1.6;
}
.container { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }
.header {
  background: ${background};
  border-bottom: 1px solid ${secondary};
  padding: 1rem 0;
}
.header-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.logo { display: flex; align-items: center; font-weight: 700; font-size: 1.25rem; color: ${primary}; text-decoration: none; }
.logo-img { max-height: 40px; width: auto; }
.logo-text { color: ${primary}; }
.nav { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.nav-link { color: ${textColor}; text-decoration: none; font-weight: 500; }
.nav-link:hover { color: ${primary}; }
.hero {
  padding: 4rem 0;
  text-align: center;
}
.hero-title { font-size: 2.5rem; color: ${textColor}; margin-bottom: 1rem; }
.hero-sub { font-size: 1.125rem; color: ${secondary}; max-width: 36em; margin: 0 auto 2rem; }
.cta {
  display: inline-block;
  background: ${primary};
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
}
.cta:hover { opacity: 0.9; }
.content { padding: 3rem 0; }
.content p { margin-bottom: 1rem; color: ${textColor}; }
.footer {
  border-top: 1px solid ${secondary};
  padding: 2rem 0;
  text-align: center;
  color: ${secondary};
  font-size: 0.875rem;
}`;

  const js = `// Revamper - script minimal
document.querySelectorAll('.nav-link').forEach(function(link) {
  link.addEventListener('click', function(e) {
    if (this.getAttribute('href') === '#') e.preventDefault();
  });
});`;

  return { analysis, html, css, js };
}

function escapeHtml(s: string): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
