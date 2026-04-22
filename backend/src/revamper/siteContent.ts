import {
  buildStitchPrompt,
  detectSiteType,
  extractColorsFromExternalStylesheets,
  extractColorsFromHtml,
  extractDocumentLang,
  extractFontsFromHtml,
  extractLogoUrl,
  extractSectionsSmart,
  fetchHtmlDocument,
  guessLangFromText,
  mergeColorPalettes,
  stripHtmlToText,
  hostnameFromUrl,
  type SiteTypeId,
} from './siteAnalysis';

export type SiteData = {
  title: string;
  description: string;
  type: SiteTypeId;
  colors: string[];
  fonts: string[];
  sections: string[];
  /** URL absolue du logo si détectée */
  logoUrl?: string;
  /** Domaine source (sans www) pour prompts Stitch */
  sourceHostname?: string;
  /** Code langue (ISO 639-1) pour le prompt Stitch */
  lang: string;
  /** Extrait textuel crawlé injecté dans le prompt */
  contentExcerpt: string;
  prompt: string;
};

const STYLE_OPTIONS = new Set([
  'Moderne',
  'Minimaliste',
  'Corporate',
  'Creatif',
  'Luxe',
  'Élégant',
  'Tech',
  'Brutalist',
  'Vintage',
  'Playful',
]);

function buildContentExcerpt(input: { title: string; description: string; body: string }): string {
  const raw = [input.title, input.description, input.body].filter(Boolean).join('\n\n');
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length > 4500 ? `${collapsed.slice(0, 4497)}...` : collapsed;
}

function finalizeSite(
  partial: Omit<SiteData, 'prompt'>,
  stylePreference?: string,
  sectionsOverride?: string[],
  userPrompt?: { baseInstructions?: string; supplementaryInstructions?: string }
): SiteData {
  const sections =
    Array.isArray(sectionsOverride) && sectionsOverride.length > 0 ? sectionsOverride : partial.sections;
  const prompt = buildStitchPrompt({
    title: partial.title,
    description: partial.description,
    type: partial.type,
    colors: partial.colors,
    fonts: partial.fonts,
    sections,
    logoUrl: partial.logoUrl,
    sourceHostname: partial.sourceHostname,
    stylePreference: stylePreference && STYLE_OPTIONS.has(stylePreference) ? stylePreference : undefined,
    contentLanguage: partial.lang,
    contentExcerpt: partial.contentExcerpt,
    baseInstructions: userPrompt?.baseInstructions?.trim() || undefined,
    supplementaryInstructions: userPrompt?.supplementaryInstructions?.trim() || undefined,
  });
  return { ...partial, sections, prompt };
}

async function enrichFromHtml(
  base: Omit<SiteData, 'prompt' | 'type' | 'colors' | 'fonts' | 'sections' | 'logoUrl' | 'lang' | 'contentExcerpt'>,
  html: string | null,
  targetUrl: string,
  bodyTextForDetection: string,
  options?: {
    pageMarkdown?: string;
    stylePreference?: string;
    sectionsOverride?: string[];
    baseInstructions?: string;
    supplementaryInstructions?: string;
  }
): Promise<SiteData> {
  const htmlForColors = html || '';
  const inlineColors = htmlForColors ? extractColorsFromHtml(htmlForColors) : [];
  const hasLinkedCss = /<link[^>]+rel\s*=\s*["']stylesheet["']/i.test(htmlForColors);
  const externalColors =
    htmlForColors && (htmlForColors.length > 400 || hasLinkedCss)
      ? await extractColorsFromExternalStylesheets(htmlForColors, targetUrl)
      : [];
  const colors = mergeColorPalettes(inlineColors, externalColors);

  const fonts = htmlForColors ? extractFontsFromHtml(htmlForColors) : [];
  const logoUrl = htmlForColors ? extractLogoUrl(htmlForColors, targetUrl) : undefined;

  const md = options?.pageMarkdown?.trim() || '';
  const bodyFromHtml = htmlForColors ? stripHtmlToText(htmlForColors, 8000) : '';
  const excerptBody = md.length > 200 ? md : bodyFromHtml;
  const contentExcerpt = buildContentExcerpt({
    title: base.title,
    description: base.description,
    body: excerptBody,
  });

  const langGuessSource = `${base.title}\n${base.description}\n${bodyTextForDetection}\n${excerptBody}`;
  const lang =
    (htmlForColors ? extractDocumentLang(htmlForColors) : undefined) ??
    guessLangFromText(langGuessSource) ??
    'en';

  const type = detectSiteType({
    url: targetUrl,
    title: base.title,
    description: base.description,
    bodyText: `${bodyTextForDetection}\n${stripHtmlToText(htmlForColors, 6000)}`,
  });

  const sections = htmlForColors
    ? extractSectionsSmart(htmlForColors, type)
    : ['navigation bar', 'hero section with headline and CTA', 'main content', 'footer with links'];

  const partial: Omit<SiteData, 'prompt'> = {
    ...base,
    type,
    colors,
    fonts,
    sections,
    logoUrl,
    sourceHostname: hostnameFromUrl(targetUrl),
    lang,
    contentExcerpt,
  };
  return finalizeSite(partial, options?.stylePreference, options?.sectionsOverride, {
    baseInstructions: options?.baseInstructions,
    supplementaryInstructions: options?.supplementaryInstructions,
  });
}

function minimalFallbackPartial(url: string): Omit<SiteData, 'prompt'> {
  let target = url.trim();
  if (!target.startsWith('http')) target = 'https://' + target;
  let hostname = 'Site web';
  try {
    hostname = new URL(target).hostname.replace(/^www\./, '') || hostname;
  } catch {
    /* ignore */
  }
  const title = hostname ? hostname.charAt(0).toUpperCase() + hostname.slice(1) : 'Site web';
  const type = detectSiteType({ url: target, title, description: '', bodyText: hostname });
  return {
    title,
    description: '',
    type,
    colors: [],
    fonts: [],
    sections: ['navigation bar', 'hero section with headline and CTA', 'main content', 'footer with links'],
    logoUrl: undefined,
    sourceHostname: hostname,
    lang: 'en',
    contentExcerpt: hostname,
  };
}

export async function getSiteContent(
  url: string,
  stylePreference?: string,
  sectionsOverride?: string[],
  userPrompt?: { baseInstructions?: string; supplementaryInstructions?: string }
): Promise<SiteData> {
  let target = url.trim();
  if (!target.startsWith('http')) target = 'https://' + target;

  const jinaKey = process.env.JINA_API_KEY?.trim();
  if (jinaKey) {
    try {
      const jinaUrl = 'https://r.jina.ai/' + target;
      const res = await fetch(jinaUrl, {
        headers: { Authorization: `Bearer ${jinaKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { title?: string; description?: string; content?: string };
          title?: string;
          description?: string;
          content?: string;
        };
        const data = json.data ?? json;
        const title = data.title || new URL(target).hostname;
        const description = data.description || '';
        const content = data.content || '';
        const html = await fetchHtmlDocument(target);
        return enrichFromHtml(
          { title, description },
          html,
          target,
          `${title}\n${description}\n${content}`,
          {
            pageMarkdown: content,
            stylePreference,
            sectionsOverride,
            baseInstructions: userPrompt?.baseInstructions,
            supplementaryInstructions: userPrompt?.supplementaryInstructions,
          }
        );
      }
    } catch {
      /* fallback fetch */
    }
  }

  try {
    const html = await fetchHtmlDocument(target);
    if (!html) throw new Error('empty');
    const title = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim() || new URL(target).hostname;
    const description =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]?.trim() || '';
    return enrichFromHtml({ title, description }, html, target, title + description, {
      stylePreference,
      sectionsOverride,
      baseInstructions: userPrompt?.baseInstructions,
      supplementaryInstructions: userPrompt?.supplementaryInstructions,
    });
  } catch {
    return finalizeSite(minimalFallbackPartial(url), stylePreference, sectionsOverride, userPrompt);
  }
}

export function buildRevamperAnalysis(site: {
  title: string;
  colors: string[];
  sections: string[];
  logoUrl?: string;
  type?: string;
  lang?: string;
}) {
  const primary = site.colors[0] || '#2563eb';
  return {
    lang: site.lang ?? 'en',
    title: site.title || 'Site',
    siteType: site.type ?? 'landing-page',
    colors: { primary, background: '#ffffff', text: '#1f2937' },
    palette: site.colors.slice(0, 8),
    menuItems: [] as { label: string; href: string }[],
    contentSnippets: site.sections.slice(0, 8),
    logoUrl: site.logoUrl ?? null,
  };
}
