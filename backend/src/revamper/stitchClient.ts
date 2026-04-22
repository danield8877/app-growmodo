import { createSign, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const STITCH_URL = 'https://stitch.googleapis.com/mcp';
const STITCH_TIMEOUT_MS = Math.max(60_000, Number(process.env.STITCH_TIMEOUT_MS ?? 300_000));
const STITCH_RETRY_MAX_ATTEMPTS = Math.max(1, Number(process.env.STITCH_RETRY_MAX_ATTEMPTS ?? 3));
const STITCH_RETRY_BASE_MS = Math.max(250, Number(process.env.STITCH_RETRY_BASE_MS ?? 1200));
const STITCH_RETRY_JITTER_MS = Math.max(0, Number(process.env.STITCH_RETRY_JITTER_MS ?? 400));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`${name} non configuré.`);
  return v.trim();
}

/**
 * Charge le JSON du compte de service : fichier (recommandé) ou variable inline.
 * Évite les erreurs "Bad control character" quand le JSON est collé multiligne dans .env.
 */
function loadServiceAccountJsonRaw(): string {
  const filePath =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Fichier credentials introuvable : ${resolved}`);
    }
    return fs.readFileSync(resolved, 'utf8');
  }
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!inline) {
    throw new Error(
      'Définissez GOOGLE_SERVICE_ACCOUNT_JSON_PATH (chemin vers le .json téléchargé depuis Google) ou GOOGLE_SERVICE_ACCOUNT_JSON.'
    );
  }
  return inline;
}

function parseServiceAccountJson(raw: string): { client_email: string; private_key: string } {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(cleaned) as { client_email?: string; private_key?: string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${msg}. Utilisez GOOGLE_SERVICE_ACCOUNT_JSON_PATH=C:\\chemin\\vers\\credentials.json (recommandé), ou un JSON sur une seule ligne sans retours à la ligne dans les chaînes.`
    );
  }
  const clientEmail = sa.client_email;
  const privateKeyPem = sa.private_key;
  if (!clientEmail || !privateKeyPem) {
    throw new Error('Le JSON du compte de service doit contenir client_email et private_key.');
  }
  return { client_email: clientEmail, private_key: privateKeyPem };
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function getGoogleAccessToken(): Promise<string> {
  const raw = loadServiceAccountJsonRaw();
  const { client_email: clientEmail, private_key: privateKeyPem } = parseServiceAccountJson(raw);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header), 'utf8'));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const message = `${headerB64}.${payloadB64}`;

  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  const signature = signer.sign(privateKeyPem);
  const jwt = `${message}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    throw new Error(`OAuth token: ${tokenRes.status}. ${tokenText.slice(0, 300)}`);
  }
  const tokenJson = JSON.parse(tokenText) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error('OAuth token invalide (access_token manquant).');
  return tokenJson.access_token;
}

function findContentText(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  if (Array.isArray(r.content)) {
    for (const item of r.content) {
      if (
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'text' &&
        typeof (item as Record<string, unknown>).text === 'string'
      ) {
        return (item as Record<string, unknown>).text as string;
      }
    }
  }
  if (typeof r.text === 'string') return r.text;
  for (const k of Object.keys(r)) {
    const t = findContentText(r[k]);
    if (t) return t;
  }
  return null;
}

function findField(obj: unknown, fieldName: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  const direct = r[fieldName];
  if (typeof direct === 'string') return direct;
  if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);
  for (const k of Object.keys(r)) {
    const v = findField(r[k], fieldName);
    if (v) return v;
  }
  return null;
}

/** Tous les segments texte MCP (plusieurs blocs content sont courants ; l’ancien code ne lisait que le premier). */
function collectMcpTextParts(obj: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 24 || !obj || typeof obj !== 'object') return out;
  const r = obj as Record<string, unknown>;
  if (Array.isArray(r.content)) {
    for (const item of r.content) {
      if (
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'text' &&
        typeof (item as Record<string, unknown>).text === 'string'
      ) {
        out.push((item as Record<string, unknown>).text as string);
      }
    }
  }
  for (const k of Object.keys(r)) {
    collectMcpTextParts(r[k], out, depth + 1);
  }
  return out;
}

/** Dernière ligne de défense : tout nom de ressource …/screens/{id} ou champs screenId / screen_id dans l’arbre. */
function deepFindScreenId(obj: unknown, depth = 0): string {
  if (depth > 28) return '';
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') {
    const full = obj.match(/projects\/[^/]+\/screens\/([^/"'\s,}]+)/);
    if (full) return full[1];
    const short = obj.match(/\/screens\/([^/"'\s,}]+)/);
    if (short) return short[1];
    try {
      return deepFindScreenId(JSON.parse(obj), depth + 1);
    } catch {
      return '';
    }
  }
  if (typeof obj === 'number' && Number.isFinite(obj)) return '';
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const s = deepFindScreenId(el, depth + 1);
      if (s) return s;
    }
    return '';
  }
  if (typeof obj !== 'object') return '';
  const r = obj as Record<string, unknown>;
  for (const key of ['screenId', 'screen_id'] as const) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) {
      const m = v.match(/screens\/([^/]+)/);
      return m ? m[1] : v.trim();
    }
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  for (const k of Object.keys(r)) {
    const s = deepFindScreenId(r[k], depth + 1);
    if (s) return s;
  }
  return '';
}

function extractProjectData(data: Record<string, unknown>): { projectId: string } {
  let projectId = '';
  const structured = data.structuredContent as Record<string, unknown> | undefined;
  if (structured) {
    const resourceName = (structured.name as string) || '';
    if (resourceName.startsWith('projects/')) projectId = resourceName.replace('projects/', '');
  }
  if (!projectId) {
    const content = findContentText(data);
    if (content) {
      try {
        const parsed = JSON.parse(content);
        const resourceName = parsed.name || '';
        if (typeof resourceName === 'string' && resourceName.startsWith('projects/'))
          projectId = resourceName.replace('projects/', '');
      } catch {
        const match = content.match(/"name"\s*:\s*"projects\/([^"]+)"/);
        if (match) projectId = match[1];
      }
    }
  }
  if (!projectId) {
    const found = findField(data, 'name');
    if (found && found.startsWith('projects/')) projectId = found.replace('projects/', '');
  }
  return { projectId };
}

function parseScreenIdFromTextBlob(blob: string): string {
  const trimmed = blob.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const resourceName = (parsed.name as string) || '';
    if (typeof resourceName === 'string') {
      const m2 = resourceName.match(/screens\/([^/]+)/);
      if (m2) return m2[1];
    }
    const sid = parsed.screenId ?? parsed.screen_id;
    if (typeof sid === 'string' && sid) return sid.match(/screens\/([^/]+)/)?.[1] || sid.trim();
    if (typeof sid === 'number' && Number.isFinite(sid)) return String(sid);
  } catch {
    const m3 = trimmed.match(/screens\/([^"'\s,}]+)/);
    if (m3) return m3[1];
  }
  return '';
}

function extractScreenData(data: Record<string, unknown>): { screenId: string } {
  let screenId = '';
  const structured = data.structuredContent as Record<string, unknown> | undefined;
  if (structured) {
    const resourceName = (structured.name as string) || '';
    const m = resourceName.match(/screens\/([^/]+)/);
    if (m) screenId = m[1];
    if (!screenId && structured.screen && typeof structured.screen === 'object') {
      const scr = structured.screen as Record<string, unknown>;
      const n = typeof scr.name === 'string' ? scr.name : '';
      const mS = n.match(/screens\/([^/]+)/);
      if (mS) screenId = mS[1];
      if (!screenId) {
        const sid = scr.screenId ?? scr.screen_id ?? scr.id;
        if (typeof sid === 'string' && sid) screenId = sid.match(/screens\/([^/]+)/)?.[1] || sid.trim();
        if (!screenId && typeof sid === 'number') screenId = String(sid);
      }
    }
  }
  if (!screenId) {
    const blobs = collectMcpTextParts(data);
    const toScan = blobs.length > 0 ? blobs : (() => {
      const single = findContentText(data);
      return single ? [single] : [];
    })();
    for (const content of toScan) {
      screenId = parseScreenIdFromTextBlob(content);
      if (screenId) break;
    }
  }
  if (!screenId) {
    const found = findField(data, 'name');
    if (found) {
      const m4 = found.match(/screens\/([^/]+)/);
      if (m4) screenId = m4[1];
    }
    if (!screenId) screenId = findField(data, 'screenId') || findField(data, 'screen_id') || '';
  }
  if (!screenId) screenId = deepFindScreenId(data);
  return { screenId };
}

async function callStitchAPI(
  token: string,
  googleCloudProjectId: string,
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const body = { jsonrpc: '2.0', method, params, id: Date.now() };
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= STITCH_RETRY_MAX_ATTEMPTS; attempt += 1) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), STITCH_TIMEOUT_MS);
    try {
      const res = await fetch(STITCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Goog-User-Project': googleCloudProjectId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);

      // 5xx Stitch: souvent transitoire -> retry.
      if (!res.ok) {
        const err = new Error(`Stitch HTTP ${res.status}`);
        if (res.status >= 500 && attempt < STITCH_RETRY_MAX_ATTEMPTS) {
          const backoff = STITCH_RETRY_BASE_MS * 2 ** (attempt - 1);
          const jitter = Math.floor(Math.random() * (STITCH_RETRY_JITTER_MS + 1));
          await sleep(backoff + jitter);
          lastErr = err;
          continue;
        }
        throw err;
      }

      const data = (await res.json()) as {
        result?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (data.error) {
        const err = data.error as { message?: string };
        throw new Error(err.message ?? JSON.stringify(data.error));
      }
      const result = data.result as Record<string, unknown> | undefined;
      if (result && (result as { isError?: unknown }).isError === true) {
        const contentText = findContentText(result);
        throw new Error(contentText || 'Stitch tool error');
      }
      return result || {};
    } catch (e) {
      clearTimeout(t);
      if (e instanceof Error && e.name === 'AbortError') {
        const timeoutErr = new Error(`Timeout (${method})`);
        if (attempt < STITCH_RETRY_MAX_ATTEMPTS) {
          const backoff = STITCH_RETRY_BASE_MS * 2 ** (attempt - 1);
          const jitter = Math.floor(Math.random() * (STITCH_RETRY_JITTER_MS + 1));
          await sleep(backoff + jitter);
          lastErr = timeoutErr;
          continue;
        }
        throw timeoutErr;
      }
      if (e instanceof Error) {
        lastErr = e;
      } else {
        lastErr = new Error(String(e));
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error('Stitch call failed');
}

async function getScreenUrls(
  token: string,
  googleCloudProjectId: string,
  stitchProjectId: string,
  screenId: string
): Promise<{ htmlCodeUrl: string | null; screenshotUrl: string | null }> {
  const data = (await callStitchAPI(token, googleCloudProjectId, 'tools/call', {
    name: 'get_screen',
    arguments: { projectId: stitchProjectId, screenId },
  })) as Record<string, unknown>;
  let htmlCodeUrl: string | null = null;
  let screenshotUrl: string | null = null;
  const structured = data.structuredContent as Record<string, unknown> | undefined;
  if (structured) {
    const htmlCode = structured.htmlCode as Record<string, unknown> | undefined;
    if (typeof htmlCode?.downloadUrl === 'string') htmlCodeUrl = htmlCode.downloadUrl as string;
    const screenshot = structured.screenshot as Record<string, unknown> | undefined;
    if (typeof screenshot?.downloadUrl === 'string') screenshotUrl = screenshot.downloadUrl as string;
  }
  if (!htmlCodeUrl || !screenshotUrl) {
    const content = findContentText(data);
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (!htmlCodeUrl && parsed.htmlCode?.downloadUrl) htmlCodeUrl = parsed.htmlCode.downloadUrl;
        if (!screenshotUrl && parsed.screenshot?.downloadUrl) screenshotUrl = parsed.screenshot.downloadUrl;
      } catch {
        /* ignore */
      }
    }
  }
  return { htmlCodeUrl, screenshotUrl };
}

export function parseHtmlToParts(fullHtml: string): { html: string; css: string; js: string; linkTags: string } {
  const styles: string[] = [];
  const scripts: string[] = [];
  const linkTags: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRegex.exec(fullHtml)) !== null) styles.push(sm[1].trim());
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scm: RegExpExecArray | null;
  while ((scm = scriptRegex.exec(fullHtml)) !== null) scripts.push(scm[1].trim());
  const linkRegex = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRegex.exec(fullHtml)) !== null) linkTags.push(lm[0].trim());
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : fullHtml;
  return {
    html: bodyContent,
    css: styles.join('\n\n') || '/* no styles */',
    js: scripts.join('\n\n') || '// no script',
    linkTags: linkTags.join('\n'),
  };
}

function extractHrefFromLinkTag(tag: string): string | null {
  const m = tag.match(/href\s*=\s*["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

function rewriteCssAssetUrls(cssText: string, cssFileUrl: string): string {
  // Rend absolues les URLs relatives des feuilles externes (fonts, sprites, etc.).
  let out = cssText.replace(/url\(\s*(['"]?)([^"')]+)\1\s*\)/gi, (_all, quote: string, rawUrl: string) => {
    const u = rawUrl.trim();
    if (!u || u.startsWith('data:') || u.startsWith('blob:')) return `url(${quote}${u}${quote})`;
    try {
      const abs = new URL(u, cssFileUrl).href;
      return `url(${quote}${abs}${quote})`;
    } catch {
      return `url(${quote}${u}${quote})`;
    }
  });
  // Même logique pour @import "..."/url(...)
  out = out.replace(/@import\s+(?:url\()?\s*(['"]?)([^"')\s;]+)\1\s*\)?\s*;/gi, (_all, quote: string, rawUrl: string) => {
    const u = rawUrl.trim();
    if (!u || u.startsWith('data:') || u.startsWith('blob:')) return `@import url(${quote}${u}${quote});`;
    try {
      const abs = new URL(u, cssFileUrl).href;
      return `@import url(${quote}${abs}${quote});`;
    } catch {
      return `@import url(${quote}${u}${quote});`;
    }
  });
  return out;
}

export async function fetchExternalStylesheets(linkTagsStr: string, baseUrl: string): Promise<string> {
  if (!linkTagsStr.trim()) return '';
  const tags = linkTagsStr
    .split(/\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  const parts: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const tag of tags) {
    const href = extractHrefFromLinkTag(tag);
    if (!href) continue;
    try {
      queue.push(new URL(href, baseUrl).href);
    } catch {
      /* ignore */
    }
  }
  while (queue.length > 0) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { headers: { Accept: 'text/css,*/*' } });
      if (res.ok) {
        const rawText = (await res.text()).trim();
        const text = rewriteCssAssetUrls(rawText, url);
        if (text) parts.push(`/* === Feuille externe: ${url} === */\n\n${text}`);
        const importRe = /@import\s+(?:url\()?\s*['"]?([^"')\s;]+)['"]?\s*\)?\s*;/gi;
        let m: RegExpExecArray | null;
        while ((m = importRe.exec(text)) !== null) {
          try {
            const importUrl = new URL(m[1], url).href;
            if (!seen.has(importUrl)) queue.push(importUrl);
          } catch {
            /* ignore malformed import */
          }
        }
      } else {
        parts.push(`/* === Feuille externe (${res.status}): ${url} === */`);
      }
    } catch {
      parts.push(`/* === Feuille externe (non récupérée): ${url} === */`);
    }
  }
  return parts.join('\n\n');
}

export function formatCss(css: string): string {
  if (!css || css === '/* no styles */') return css;
  return css
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n/)
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatHtml(html: string): string {
  if (!html) return html;
  return html
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/>\s*</g, '>\n<')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatJs(js: string): string {
  if (!js || js === '// no script') return js;
  return js
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stableAssetName(url: string, fallbackExt: string): string {
  const h = createHash('sha1').update(url).digest('hex').slice(0, 16);
  let ext = fallbackExt;
  try {
    const u = new URL(url);
    const p = u.pathname;
    const last = p.split('/').pop() || '';
    const dot = last.lastIndexOf('.');
    if (dot > -1 && dot < last.length - 1) ext = last.slice(dot + 1).toLowerCase().slice(0, 8);
  } catch {
    /* ignore */
  }
  return `${h}.${ext || fallbackExt}`;
}

export type StitchProgress = { step: string; label: string; detail?: string };

export async function stitchGenerateFromPrompt(
  prompt: string,
  onProgress?: (p: StitchProgress) => void
): Promise<{ htmlCodeUrl: string | null; screenshotUrl: string | null }> {
  const googleCloudProjectId = requireEnv('GOOGLE_CLOUD_PROJECT');
  onProgress?.({
    step: 'google_oauth',
    label: 'Google Cloud',
    detail: 'Obtention du jeton OAuth (compte de service)…',
  });
  const token = await getGoogleAccessToken();

  onProgress?.({
    step: 'stitch_create_project',
    label: 'Stitch',
    detail: 'create_project — nouveau projet UI…',
  });
  const createRes = await callStitchAPI(token, googleCloudProjectId, 'tools/call', {
    name: 'create_project',
    arguments: { title: `revamper-${Date.now()}` },
  });
  const { projectId } = extractProjectData(createRes);
  if (!projectId) throw new Error('Stitch: create_project a échoué.');

  onProgress?.({
    step: 'stitch_generate_screen',
    label: 'Stitch',
    detail: 'generate_screen_from_text — génération (souvent 1–3 min)…',
  });
  const modelId = (process.env.STITCH_MODEL_ID || 'GEMINI_3_PRO').trim();
  const genRes = await callStitchAPI(token, googleCloudProjectId, 'tools/call', {
    name: 'generate_screen_from_text',
    arguments: {
      projectId,
      prompt,
      deviceType: 'DESKTOP',
      modelId,
    },
  });
  const { screenId } = extractScreenData(genRes);
  if (!screenId) throw new Error('Stitch: generate_screen_from_text a échoué.');

  onProgress?.({
    step: 'stitch_get_screen',
    label: 'Stitch',
    detail: 'get_screen — URL HTML export + aperçu…',
  });
  return await getScreenUrls(token, googleCloudProjectId, projectId, screenId);
}

