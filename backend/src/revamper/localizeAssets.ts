import path from 'path';
import fs from 'fs/promises';
import { stableAssetName } from './stitchClient';

type LocalizeResult = { html: string; css: string; downloaded: number };

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

function looksLikeFragmentOrNonAsset(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  if (s.startsWith('#')) return true;
  if (s.startsWith('mailto:') || s.startsWith('tel:') || s.startsWith('javascript:') || s.startsWith('data:')) return true;
  return false;
}

function isLikelyAssetPath(absUrl: string): boolean {
  try {
    const u = new URL(absUrl);
    const p = u.pathname.toLowerCase();
    return /\.(?:png|jpe?g|webp|gif|svg|ico|avif|bmp|css|js|mjs|woff2?|ttf|otf|eot|mp4|webm|mp3|wav)(?:$|\?)/i.test(
      p + (u.search || '')
    );
  } catch {
    return false;
  }
}

function isAssetContentType(ct: string | null): boolean {
  const s = (ct || '').toLowerCase();
  return (
    s.includes('image/') ||
    s.includes('font/') ||
    s.includes('text/css') ||
    s.includes('javascript') ||
    s.includes('application/x-font-') ||
    s.includes('application/font-')
  );
}

function looksLikeIllustrationUrl(absUrl: string): boolean {
  const s = absUrl.toLowerCase();
  if (s.includes('illustration') || s.includes('cartoon') || s.includes('clipart')) {
    return true;
  }
  if (
    s.includes('storyset') ||
    s.includes('undraw') ||
    s.includes('dribbble') ||
    s.includes('drawkit') ||
    s.includes('midjourney') ||
    s.includes('dalle') ||
    s.includes('shutterstock.com/illustration') ||
    s.includes('freepik.com/vector') ||
    s.includes('freepik.com/premium-vector')
  ) {
    return true;
  }
  if (s.includes('images.unsplash.com/photo-')) {
    return false;
  }
  if (s.includes('images.pexels.com/photos/')) {
    return false;
  }
  if (s.includes('unsplash.com') || s.includes('pexels.com')) {
    return true;
  }
  return s.includes('/vector') || s.includes('/anime') || s.includes('/mascot');
}

function buildPhotoPlaceholderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#f3f4f6"/>
    <stop offset="100%" stop-color="#e5e7eb"/>
  </linearGradient>
</defs>
<rect width="1200" height="800" fill="url(#g)"/>
<rect x="80" y="120" width="1040" height="560" rx="20" fill="#d1d5db"/>
<path d="M140 620 L420 360 L620 520 L780 420 L1060 620 Z" fill="#9ca3af"/>
<circle cx="930" cy="260" r="60" fill="#e5e7eb"/>
<text x="600" y="725" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" fill="#6b7280">Image placeholder</text>
</svg>`;
}

async function ensurePlaceholderImage(assetsDir: string): Promise<string> {
  const fileName = 'placeholder-photo.svg';
  const outPath = path.join(assetsDir, fileName);
  try {
    await fs.access(outPath);
  } catch {
    await fs.writeFile(outPath, buildPhotoPlaceholderSvg(), 'utf8');
  }
  return fileName;
}

function guessExtFromContentType(ct: string | null, fallback: string): string {
  const s = (ct || '').toLowerCase();
  if (s.includes('image/png')) return 'png';
  if (s.includes('image/jpeg')) return 'jpg';
  if (s.includes('image/webp')) return 'webp';
  if (s.includes('image/gif')) return 'gif';
  if (s.includes('image/svg')) return 'svg';
  if (s.includes('font/woff2')) return 'woff2';
  if (s.includes('font/woff')) return 'woff';
  if (s.includes('text/css')) return 'css';
  return fallback;
}

function collectHtmlUrls(html: string): string[] {
  const urls: string[] = [];
  const attrRe = /\s(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) {
    const u = m[1].trim();
    if (looksLikeFragmentOrNonAsset(u)) continue;
    urls.push(u);
  }
  return urls;
}

function collectCssUrls(css: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const u = m[1].trim();
    if (looksLikeFragmentOrNonAsset(u)) continue;
    urls.push(u);
  }
  return urls;
}

function replaceAllExact(input: string, from: string, to: string): string {
  if (!from) return input;
  return input.split(from).join(to);
}

export type LocalizeProgress = { step: string; label: string; detail?: string };

export async function localizeAssets(params: {
  html: string;
  css: string;
  baseUrl: string;
  uploadsRoot: string;
  projectId: string;
  onProgress?: (p: LocalizeProgress) => void;
}): Promise<LocalizeResult> {
  const assetsDir = path.join(params.uploadsRoot, 'revamper', params.projectId, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });
  const placeholderName = await ensurePlaceholderImage(assetsDir);
  const placeholderPublicUrl = `/uploads/revamper/${encodeURIComponent(params.projectId)}/assets/${encodeURIComponent(placeholderName)}`;

  const htmlUrls = collectHtmlUrls(params.html);
  const cssUrls = collectCssUrls(params.css);
  const unique = Array.from(new Set([...htmlUrls, ...cssUrls]));

  let html = params.html;
  let css = params.css;
  let downloaded = 0;

  params.onProgress?.({
    step: 'assets_scan',
    label: 'Assets locaux',
    detail: `${unique.length} URL(s) unique(s) à traiter…`,
  });

  let index = 0;
  for (const raw of unique) {
    index += 1;
    if (looksLikeFragmentOrNonAsset(raw)) continue;
    let abs: string;
    try {
      abs = new URL(raw, params.baseUrl).href;
    } catch {
      continue;
    }
    if (!isHttpUrl(abs)) continue;
    if (looksLikeIllustrationUrl(abs)) {
      html = replaceAllExact(html, raw, placeholderPublicUrl);
      css = replaceAllExact(css, raw, placeholderPublicUrl);
      html = replaceAllExact(html, abs, placeholderPublicUrl);
      css = replaceAllExact(css, abs, placeholderPublicUrl);
      continue;
    }

    try {
      params.onProgress?.({
        step: 'asset_fetch',
        label: 'Téléchargement asset',
        detail: `[${index}/${unique.length}] ${abs.slice(0, 120)}${abs.length > 120 ? '…' : ''}`,
      });
      const res = await fetch(abs);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type');
      if (!isLikelyAssetPath(abs) && !isAssetContentType(ct)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = guessExtFromContentType(ct, 'bin');
      const fileName = stableAssetName(abs, ext);
      const outPath = path.join(assetsDir, fileName);
      await fs.writeFile(outPath, buf);
      downloaded += 1;

      const publicUrl = `/uploads/revamper/${encodeURIComponent(params.projectId)}/assets/${encodeURIComponent(fileName)}`;

      // Replace raw occurrences (relative or absolute) in both html and css.
      html = replaceAllExact(html, raw, publicUrl);
      css = replaceAllExact(css, raw, publicUrl);
      html = replaceAllExact(html, abs, publicUrl);
      css = replaceAllExact(css, abs, publicUrl);
    } catch {
      // ignore download failures
    }
  }

  params.onProgress?.({
    step: 'assets_done',
    label: 'Assets locaux',
    detail: `${downloaded} fichier(s) écrit(s) sous /uploads`,
  });

  return { html, css, downloaded };
}

