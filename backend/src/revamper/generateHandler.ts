import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/requireAuth';
import path from 'path';
import fs from 'fs/promises';
import { getSiteContent, buildRevamperAnalysis } from './siteContent';
import {
  fetchExternalStylesheets,
  formatCss,
  formatHtml,
  formatJs,
  parseHtmlToParts,
  stableAssetName,
  stitchGenerateFromPrompt,
} from './stitchClient';
import { localizeAssets } from './localizeAssets';
import { parseUserInstructionsBody } from './userInstructions';
import { translateAndInjectI18n, type SupportedLang } from './i18nInjector';

const FETCH_HTML_TIMEOUT_MS = 20_000;

export type RevamperProgressEvent = {
  type: 'progress';
  step: string;
  label: string;
  detail?: string;
  elapsedMs: number;
};

export type RevamperStreamPayload =
  | RevamperProgressEvent
  | {
      type: 'result';
      analysis: Record<string, unknown>;
      html: string;
      css: string;
      js: string;
      elapsedMs: number;
    }
  | { type: 'error'; message: string; elapsedMs: number };

export type RevamperBody = Record<string, unknown>;

function parseGenerateBody(body: RevamperBody): {
  url: string;
  sectionsOverride: string[] | undefined;
  stylePreference: string | undefined;
  baseInstructions?: string;
  supplementaryInstructions?: string;
  enableI18n: boolean;
  sourceLang?: SupportedLang;
} {
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const sectionsOverride = Array.isArray(body.sections)
    ? (body.sections as string[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : undefined;
  const stylePreference = typeof body.stylePreference === 'string' ? body.stylePreference : undefined;
  const { baseInstructions, supplementaryInstructions } = parseUserInstructionsBody(
    body as Record<string, unknown>
  );
  const enableI18n = body.enableI18n === true;
  const rawLang = typeof body.sourceLang === 'string' ? body.sourceLang.slice(0, 2).toLowerCase() : '';
  const sourceLang = (['en', 'fr', 'de', 'es', 'it'] as const).includes(rawLang as SupportedLang)
    ? (rawLang as SupportedLang)
    : undefined;
  return {
    url,
    sectionsOverride,
    stylePreference,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  };
}

function ensureSectionIds(html: string): { html: string; sectionIds: string[] } {
  let idx = 0;
  const sectionIds: string[] = [];
  const updated = html.replace(/<section\b([^>]*)>/gi, (_all, attrs: string) => {
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (idMatch?.[1]) {
      sectionIds.push(idMatch[1]);
      return `<section${attrs}>`;
    }
    idx += 1;
    const newId = `section-${idx}`;
    sectionIds.push(newId);
    return `<section id="${newId}"${attrs}>`;
  });
  return { html: updated, sectionIds };
}

function normalizeAnchorLinks(html: string): string {
  if (!html.trim()) return html;
  const hasTop = /\bid\s*=\s*["']top["']/i.test(html);
  let out = hasTop ? html : `<div id="top"></div>\n${html}`;

  const withSections = ensureSectionIds(out);
  out = withSections.html;
  const sectionIds = withSections.sectionIds;
  let nextSection = 0;

  // Remplace les liens href="#" morts par des ancres utiles.
  out = out.replace(/<a\b([^>]*?)href\s*=\s*["']#["']([^>]*)>([\s\S]*?)<\/a>/gi, (full, pre: string, post: string, text: string) => {
    const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (/(top|up|haut)/i.test(plainText)) {
      return `<a${pre}href="#top"${post}>${text}</a>`;
    }
    const target = sectionIds[nextSection] || 'top';
    if (nextSection < sectionIds.length - 1) nextSection += 1;
    return `<a${pre}href="#${target}"${post}>${text}</a>`;
  });

  return out;
}

function withHeroBackgroundClass(html: string): string {
  if (/\brvp-hero-bg\b/i.test(html)) return html;
  // Stitch : souvent <div> / <main> sans <section> — on cible le premier bloc hero plausible.
  return html.replace(
    /<section\b([^>]*)>|<main\b([^>]*)>|<div\b([^>]*)>|<header\b([^>]*)>/i,
    (full, a1: string | undefined, a2: string | undefined, a3: string | undefined, a4: string | undefined) => {
      const attrs = (a1 ?? a2 ?? a3 ?? a4) ?? '';
      if (/\brvp-hero-bg\b/i.test(attrs)) return full;
      const tagMatch = full.match(/^<(\w+)/);
      const tag = tagMatch ? tagMatch[1] : 'div';
      if (/\bclass\s*=\s*["']([^"']*)["']/i.test(full)) {
        return full.replace(/\bclass\s*=\s*["']([^"']*)["']/i, (_m, classes: string) => {
          return `class="${classes.trim()} rvp-hero-bg"`;
        });
      }
      return `<${tag} class="rvp-hero-bg"${attrs}>`;
    }
  );
}

function fallbackHeroSvgDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0f172a"/>
    <stop offset="100%" stop-color="#1e3a8a"/>
  </linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#g)"/>
<circle cx="1300" cy="180" r="220" fill="#334155" opacity="0.45"/>
<circle cx="260" cy="760" r="280" fill="#1d4ed8" opacity="0.35"/>
<rect x="180" y="190" width="1240" height="520" rx="36" fill="#0b1220" opacity="0.18"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function injectHeroVideoBlock(html: string, videoPublicPath: string, posterPublicPath: string): string {
  const esc = (s: string) => s.replace(/"/g, '&quot;');
  const src = esc(videoPublicPath);
  const poster = esc(posterPublicPath);
  const block = `<div class="rvp-hero-video-wrap" aria-hidden="true"><video class="rvp-hero-video" autoplay muted loop playsinline poster="${poster}"><source src="${src}" type="video/mp4" /></video></div>`;
  // Premier élément qui porte déjà rvp-hero-bg (section, main ou div selon withHeroBackgroundClass).
  return html.replace(
    /<(\w+)\b([^>]*\brvp-hero-bg\b[^>]*)>/i,
    (full, tag: string, attrs: string) => {
      let newAttrs = attrs;
      if (!/\bhas-hero-video\b/.test(attrs)) {
        if (/\bclass\s*=\s*["']([^"']*)["']/i.test(attrs)) {
          newAttrs = attrs.replace(/\bclass\s*=\s*["']([^"']*)["']/i, (_m, classes: string) => {
            const c = classes.trim();
            return `class="${c}${c ? ' ' : ''}has-hero-video"`;
          });
        } else {
          newAttrs = `${attrs} class="has-hero-video"`;
        }
      }
      return `<${tag}${newAttrs}>${block}`;
    }
  );
}

const RVP_STICKY_CLASS = 'rvp-sticky-nav';

function addClassToFirstTag(
  html: string,
  tag: 'nav' | 'header',
  className: string,
): { ok: true; out: string } | { ok: false } {
  const re = tag === 'nav' ? /<nav(\s[^>]*)?>/i : /<header(\s[^>]*)?>/i;
  let done = false;
  const out = html.replace(re, (full) => {
    if (done) return full;
    done = true;
    if (/\bclass\s*=\s*["'][^"']*["']/i.test(full)) {
      return full.replace(
        /\bclass\s*=\s*(["'])([^"']*)\1/i,
        (_m, q: string, classes: string) => {
          if (new RegExp(`\\b${className}\\b`).test(classes)) return `class=${q}${classes}${q}`;
          return `class=${q}${classes.trim() ? `${classes} ` : ''}${className}${q}`;
        },
      );
    }
    return full.replace(/>$/, ` class="${className}">`);
  });
  return done ? { ok: true, out } : { ok: false };
}

/** Post-traitement : première <nav> ou <header> reçoit une classe sticky + glass (styles dans policyCss). */
function enforceStickyNav(html: string): string {
  if (!html.trim()) {
    return html;
  }
  const nav = addClassToFirstTag(html, 'nav', RVP_STICKY_CLASS);
  if (nav.ok) {
    return nav.out;
  }
  const header = addClassToFirstTag(html, 'header', RVP_STICKY_CLASS);
  return header.ok ? header.out : html;
}

function enforceVisualPolicy(params: {
  html: string;
  css: string;
  heroImageUrl?: string | null;
  heroVideoUrl?: string | null;
}): { html: string; css: string } {
  let htmlWithHero = withHeroBackgroundClass(params.html);
  htmlWithHero = enforceStickyNav(htmlWithHero);
  const heroImage = params.heroImageUrl && params.heroImageUrl.trim() ? params.heroImageUrl.trim() : fallbackHeroSvgDataUri();
  const hasVideo = Boolean(params.heroVideoUrl?.trim());
  if (hasVideo && params.heroVideoUrl) {
    htmlWithHero = injectHeroVideoBlock(htmlWithHero, params.heroVideoUrl.trim(), heroImage);
  }

  const heroBgLayers = hasVideo
    ? 'linear-gradient(120deg,rgba(2,6,23,.62),rgba(15,23,42,.58))'
    : `linear-gradient(120deg,rgba(2,6,23,.62),rgba(15,23,42,.58)),url("${heroImage.replace(/"/g, '\\"')}")`;

  const policyCss = `
/* Revamper visual policy */
:root{
  --rvp-font-body:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
  --rvp-font-heading:'Manrope','Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
}
html,body{
  font-family:var(--rvp-font-body) !important;
}
h1,h2,h3,h4,h5,h6,.display-title,.hero-title,.headline,
button,.btn,.cta,nav a,.nav a,[class*="title"]{
  font-family:var(--rvp-font-heading) !important;
}
.rvp-hero-bg{
  position:relative;
  background-image:${heroBgLayers};
  background-size:cover;
  background-position:center;
  background-repeat:no-repeat;
  isolation:isolate;
}
.rvp-hero-video-wrap{
  position:absolute;
  inset:0;
  z-index:0;
  overflow:hidden;
  pointer-events:none;
}
.rvp-hero-video{
  width:100%;
  height:100%;
  object-fit:cover;
}
.rvp-hero-bg > *:not(.rvp-hero-video-wrap){
  position:relative;
  z-index:2;
}
.rvp-hero-bg::before{
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(180deg,rgba(2,6,23,.18),rgba(2,6,23,.46));
  z-index:1;
}
.rvp-hero-bg.has-hero-video .rvp-hero-video-wrap{
  z-index:0;
}
@media (prefers-reduced-motion: reduce){
  .rvp-hero-video-wrap{ display:none !important; }
}
/* Nav / en-tête principal : reste visible au scroll (post-traitement i18n / menu). */
.rvp-sticky-nav{
  position:sticky !important;
  top:0 !important;
  z-index:40 !important;
  -webkit-backdrop-filter:saturate(1.2) blur(8px) !important;
  backdrop-filter:saturate(1.2) blur(8px) !important;
}
/* Dernière couche : doit rester après le CSS Stitch (voir concaténation ci-dessous). */
.rvp-hero-bg h1,.rvp-hero-bg h2,.rvp-hero-bg h3,.rvp-hero-bg h4,.rvp-hero-bg h5,.rvp-hero-bg h6,
.rvp-hero-bg p,.rvp-hero-bg span,.rvp-hero-bg a,.rvp-hero-bg li,
.rvp-hero-bg label,.rvp-hero-bg button,.rvp-hero-bg [type="submit"],.rvp-hero-bg [role="button"],
.rvp-hero-bg strong,.rvp-hero-bg em,.rvp-hero-bg small,.rvp-hero-bg blockquote,.rvp-hero-bg cite,
.rvp-hero-bg figcaption,.rvp-hero-bg dt,.rvp-hero-bg dd,
.rvp-hero-bg [class*="title"],.rvp-hero-bg [class*="headline"],.rvp-hero-bg [class*="subtitle"]{
  color:#f8fafc !important;
  -webkit-text-fill-color:#f8fafc !important;
  text-shadow:0 2px 14px rgba(0,0,0,.45);
}
.rvp-hero-bg a:visited{
  color:#e2e8f0 !important;
}`;
  return {
    html: htmlWithHero,
    /* Politique en DERNIER pour gagner les duels !important avec le CSS généré. */
    css: `${params.css || ''}\n\n${policyCss}`.trim(),
  };
}

function extFromImageContentType(ct: string | null): string {
  const s = (ct || '').toLowerCase();
  if (s.includes('image/png')) return 'png';
  if (s.includes('image/jpeg')) return 'jpg';
  if (s.includes('image/webp')) return 'webp';
  if (s.includes('image/gif')) return 'gif';
  if (s.includes('image/svg')) return 'svg';
  return 'jpg';
}

async function localizeGeneratedScreenshot(params: {
  screenshotUrl: string;
  uploadsRoot: string;
  projectId: string;
}): Promise<{ publicUrl: string; absolutePath: string } | null> {
  try {
    const res = await fetch(params.screenshotUrl, { signal: AbortSignal.timeout(FETCH_HTML_TIMEOUT_MS) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type');
    const ext = extFromImageContentType(ct);
    const fileName = stableAssetName(params.screenshotUrl, ext);
    const dir = path.join(params.uploadsRoot, 'revamper', params.projectId, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, fileName);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    const publicUrl = `/uploads/revamper/${encodeURIComponent(params.projectId)}/assets/${encodeURIComponent(fileName)}`;
    return { publicUrl, absolutePath: outPath };
  } catch {
    return null;
  }
}

export async function runRevamperGeneration(params: {
  /** Dossiers temporaires quand projectId est absent (ex. génération sans projet persistant). */
  storageKey: string;
  /** Si défini, les assets vont sous ce dossier (ex. id projet). */
  projectId?: string;
  url: string;
  sectionsOverride?: string[];
  stylePreference?: string;
  /** Consignes utilisateur fusionnées dans le prompt Stitch (base + complément). */
  baseInstructions?: string;
  supplementaryInstructions?: string;
  /** Active le post-processing i18n (switcher EN/DE/FR/ES via Claude Opus). */
  enableI18n?: boolean;
  /** Langue source du contenu généré (défaut 'en'). */
  sourceLang?: SupportedLang;
  onProgress?: (e: Omit<RevamperProgressEvent, 'type'>) => void;
}): Promise<{ analysis: Record<string, unknown>; html: string; css: string; js: string }> {
  const {
    storageKey,
    projectId: projectIdOpt,
    url,
    sectionsOverride,
    stylePreference,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  } = params;
  const t0 = Date.now();
  const emit = (step: string, label: string, detail?: string) => {
    params.onProgress?.({ step, label, detail, elapsedMs: Date.now() - t0 });
  };

  emit('start', 'Démarrage', url);
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const assetProjectId = projectIdOpt ?? `${storageKey}-${Date.now()}`;

  const site = await getSiteContent(url, stylePreference, sectionsOverride, {
    baseInstructions,
    supplementaryInstructions,
  });
  emit('crawl_done', 'Site analysé', site.title?.slice(0, 80) || 'sans titre');

  const { htmlCodeUrl, screenshotUrl } = await stitchGenerateFromPrompt(site.prompt, (p) =>
    emit(p.step, p.label, p.detail)
  );

  if (!htmlCodeUrl) {
    throw new Error("Stitch n'a pas retourné d'URL HTML (htmlCodeUrl manquant).");
  }

  emit('fetch_html', 'Téléchargement HTML Stitch', htmlCodeUrl.slice(0, 100) + (htmlCodeUrl.length > 100 ? '…' : ''));
  const htmlRes = await fetch(htmlCodeUrl, { signal: AbortSignal.timeout(FETCH_HTML_TIMEOUT_MS) });
  if (!htmlRes.ok) {
    throw new Error(`Impossible de télécharger le HTML Stitch (${htmlRes.status}).`);
  }
  const fullHtml = await htmlRes.text();
  emit('parse_html', 'Extraction HTML / CSS / JS', `${Math.round(fullHtml.length / 1024)} Ko reçus`);

  const { html: parsedBodyHtml, css: inlineCss, js, linkTags } = parseHtmlToParts(fullHtml);
  const bodyHtml = normalizeAnchorLinks(parsedBodyHtml);
  const baseUrl = htmlCodeUrl;

  emit('fetch_css', 'Feuilles de style externes', linkTags ? `${linkTags.split('\n').filter(Boolean).length} lien(s)` : 'aucune');
  const externalCss = await fetchExternalStylesheets(linkTags, baseUrl);
  const combinedCss = [inlineCss && inlineCss !== '/* no styles */' ? inlineCss : '', externalCss]
    .filter(Boolean)
    .join('\n\n');

  const analysis = buildRevamperAnalysis(site) as Record<string, unknown>;
  /** Vidéo hero désactivée : fond hero = image (capture) uniquement, pas de MP4 Grok. */
  if (!screenshotUrl) {
    analysis.heroVideoStatus = 'skipped_no_stitch_screenshot';
  } else {
    emit('screenshot', 'Miniature projet', 'Sauvegarde locale de la capture…');
    const localized = await localizeGeneratedScreenshot({
      screenshotUrl,
      uploadsRoot,
      projectId: assetProjectId,
    });
    if (localized) {
      analysis.generatedImageUrl = localized.publicUrl;
      analysis.heroVideoStatus = 'disabled';
    } else {
      analysis.generatedImageUrl = screenshotUrl;
      analysis.heroVideoStatus = 'skipped_screenshot_download_failed';
    }
  }

  const local = await localizeAssets({
    html: bodyHtml,
    css: combinedCss || '/* no styles */',
    baseUrl,
    uploadsRoot,
    projectId: assetProjectId,
    onProgress: (p) => emit(p.step, p.label, p.detail),
  });

  const visual = enforceVisualPolicy({
    html: local.html,
    css: local.css || '/* no styles */',
    heroImageUrl: (analysis.generatedImageUrl as string | undefined) || null,
    heroVideoUrl: null,
  });

  let finalHtml = visual.html;
  if (enableI18n) {
    emit('i18n', 'Traduction multi-langue', 'Tagging + Claude Opus (EN/DE/FR/ES)…');
    const i18n = await translateAndInjectI18n({
      html: finalHtml,
      sourceLang: sourceLang ?? 'en',
    });
    if (i18n.translated) {
      finalHtml = i18n.html;
      analysis.i18n = {
        enabled: true,
        sourceLang: sourceLang ?? 'en',
        stringsCount: i18n.stringsCount,
      };
      emit('i18n_done', 'Switcher injecté', `${i18n.stringsCount} chaîne(s) traduite(s)`);
    } else {
      analysis.i18n = {
        enabled: false,
        sourceLang: sourceLang ?? 'en',
        stringsCount: i18n.stringsCount,
        error: i18n.error,
      };
      emit('i18n_skipped', 'i18n ignoré', i18n.error ?? 'Aucune chaîne traduisible.');
    }
  }

  emit('format', 'Formatage final', `${local.downloaded} asset(s) local(aux)`);

  return {
    analysis,
    html: formatHtml(finalHtml),
    css: formatCss(visual.css || '/* no styles */'),
    js: formatJs(js || ''),
  };
}

function writeSse(res: Response, data: RevamperStreamPayload): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function handleRevamperGenerateStream(req: AuthedRequest, res: Response): Promise<void> {
  const storageKey = req.userId ?? `guest:${req.guestSessionId!}`;
  const body = req.body as RevamperBody;

  if (body.imageToCode === true || body.continueImageToCode === true) {
    res.status(400).json({
      error: "Ce serveur est configuré pour Stitch (page complète) uniquement. Utilisez l'entrée URL.",
    });
    return;
  }

  const {
    url,
    sectionsOverride,
    stylePreference,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  } = parseGenerateBody(body);
  if (!url) {
    res.status(400).json({ error: 'URL requise' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const resAny = res as Response & { flushHeaders?: () => void };
  if (typeof resAny.flushHeaders === 'function') resAny.flushHeaders();

  const t0 = Date.now();
  try {
    const result = await runRevamperGeneration({
      storageKey,
      url,
      sectionsOverride,
      stylePreference,
      baseInstructions,
      supplementaryInstructions,
      enableI18n,
      sourceLang,
      onProgress: ({ step, label, detail, elapsedMs }) => {
        writeSse(res, { type: 'progress', step, label, detail, elapsedMs });
      },
    });
    writeSse(res, {
      type: 'result',
      analysis: result.analysis,
      html: result.html,
      css: result.css,
      js: result.js,
      elapsedMs: Date.now() - t0,
    });
  } catch (e) {
    console.error(e);
    writeSse(res, {
      type: 'error',
      message: e instanceof Error ? e.message : 'Erreur serveur',
      elapsedMs: Date.now() - t0,
    });
  } finally {
    res.end();
  }
}

export async function handleRevamperGenerate(req: AuthedRequest, res: Response): Promise<void> {
  const storageKey = req.userId ?? `guest:${req.guestSessionId!}`;
  const body = req.body as RevamperBody;

  if (body.imageToCode === true || body.continueImageToCode === true) {
    res.status(400).json({
      error: "Ce serveur est configuré pour Stitch (page complète) uniquement. Utilisez l'entrée URL.",
    });
    return;
  }

  const {
    url,
    sectionsOverride,
    stylePreference,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  } = parseGenerateBody(body);
  if (!url) {
    res.status(400).json({ error: 'URL requise' });
    return;
  }

  try {
    const result = await runRevamperGeneration({
      storageKey,
      url,
      sectionsOverride,
      stylePreference,
      baseInstructions,
      supplementaryInstructions,
      enableI18n,
      sourceLang,
    });
    res.json({
      analysis: result.analysis,
      html: result.html,
      css: result.css,
      js: result.js,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
}
