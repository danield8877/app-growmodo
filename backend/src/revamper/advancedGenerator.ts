import Anthropic from '@anthropic-ai/sdk';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import { loadRevampAdvancedConfig } from './advancedConfig';
import { backendRoot } from '../loadEnv';
import {
  buildBrandContextBlock,
  detectSiteType,
  hostnameFromUrl,
  extractColorsFromExternalStylesheets,
  extractColorsFromHtml,
  extractDocumentLang,
  extractLogoUrl,
  fetchHtmlDocument,
  guessLangFromText,
  mergeColorPalettes,
  stripHtmlToText,
  type SiteTypeId,
} from './siteAnalysis';

function ensureHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('URL requise.');
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    throw new Error('URL invalide.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL invalide.');
  return u.href;
}

function extractHtmlOnly(text: string): string {
  const t = text.trim();
  const md = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (md ? md[1] : t).trim();
}

async function fetchJinaMarkdown(url: string, baseUrl: string): Promise<string> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const target = `${base}${url}`;
  const res = await fetch(target, { headers: { Accept: 'text/plain, text/markdown,*/*' } });
  if (!res.ok) throw new Error(`Jina Reader HTTP ${res.status}`);
  const txt = (await res.text()).trim();
  if (!txt) throw new Error('Jina Reader a retourne un contenu vide.');
  return txt.length > 60_000 ? `${txt.slice(0, 60_000)}\n\n[...contenu tronque...]` : txt;
}

async function captureScreenshotBase64(
  url: string,
  opts: {
    width: number;
    height: number;
    navigationTimeoutMs: number;
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  }
): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 1 });
    page.setDefaultNavigationTimeout(opts.navigationTimeoutMs);
    await page.goto(url, { waitUntil: opts.waitUntil });
    const buf = (await page.screenshot({
      fullPage: false,
      type: 'png',
      encoding: 'binary',
    })) as Buffer;
    return buf.toString('base64');
  } finally {
    await browser.close();
  }
}

function buildPrompt(template: string, markdown: string, brandContext: string): string {
  let t = template;
  if (!t.includes('{{BRAND_CONTEXT}}')) {
    t = `CONTEXTE MARQUE (respecter — couleurs, logo, vocabulaire métier):\n{{BRAND_CONTEXT}}\n\n${t}`;
  }
  return t.replace(/\{\{BRAND_CONTEXT\}\}/g, brandContext).replace(/\{\{MARKDOWN\}\}/g, markdown);
}

export async function generateAdvancedRevampHtml(rawUrl: string): Promise<string> {
  dotenv.config({ path: path.join(backendRoot, '.env') });
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configure.');
  const url = ensureHttpUrl(rawUrl);
  const cfg = await loadRevampAdvancedConfig();

  const [markdown, screenshotB64, html] = await Promise.all([
    fetchJinaMarkdown(url, cfg.jinaReaderBaseUrl),
    captureScreenshotBase64(url, {
      width: cfg.puppeteer.viewport.width,
      height: cfg.puppeteer.viewport.height,
      navigationTimeoutMs: cfg.puppeteer.navigationTimeoutMs,
      waitUntil: cfg.puppeteer.waitUntil,
    }),
    fetchHtmlDocument(url),
  ]);

  const titleFromMd = markdown.match(/^#\s+(.+)/m)?.[1]?.trim();
  const title =
    html?.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim() ||
    titleFromMd ||
    new URL(url).hostname;
  const description =
    html?.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]?.trim() || '';

  let colors: string[] = [];
  if (html) {
    const inline = extractColorsFromHtml(html);
    const ext = await extractColorsFromExternalStylesheets(html, url);
    colors = mergeColorPalettes(inline, ext);
  }
  const logoUrl = html ? extractLogoUrl(html, url) : undefined;
  const bodyText = `${markdown}\n${html ? stripHtmlToText(html, 8000) : ''}`;
  const type: SiteTypeId = detectSiteType({
    url,
    title,
    description,
    bodyText,
  });

  const contentExcerpt = `${title}\n${description}\n${markdown}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4500);
  const lang =
    (html ? extractDocumentLang(html) : undefined) ?? guessLangFromText(`${title}\n${description}\n${markdown}`) ?? 'en';

  const brandContext = buildBrandContextBlock({
    type,
    title,
    description,
    colors,
    logoUrl,
    sourceHostname: hostnameFromUrl(url),
    contentLanguage: lang,
    contentExcerpt,
  });

  const prompt = buildPrompt(cfg.promptTemplate, markdown, brandContext);

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: cfg.anthropic.model,
    max_tokens: cfg.anthropic.maxTokens,
    temperature: cfg.anthropic.temperature,
    system: cfg.systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshotB64,
            },
          },
        ],
      },
    ],
  });

  const textParts: string[] = [];
  for (const c of msg.content) {
    if (c.type === 'text' && 'text' in c && typeof c.text === 'string') {
      textParts.push(c.text);
    }
  }
  const text = textParts.join('\n').trim();
  const htmlOut = extractHtmlOnly(text);
  if (!htmlOut || !/<[a-z][\s\S]*>/i.test(htmlOut)) {
    throw new Error("Claude n'a pas retourne de HTML valide.");
  }
  return htmlOut;
}
