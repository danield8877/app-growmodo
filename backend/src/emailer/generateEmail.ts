import Anthropic from '@anthropic-ai/sdk';

export interface GenerateEmailInput {
  prospect: {
    name?: string;
    company?: string;
    siteUrl: string;
  };
  revampedSite?: {
    /** URL absolue de la page démo publique (/revamper/public/:id) */
    previewUrl?: string;
    title?: string;
    improvements?: string;
  };
  language: 'fr' | 'en';
  tone: 'formal' | 'friendly' | 'bold';
}

/** Si l’IA n’a pas inclus l’URL, on ajoute un lien HTML valide en fin de corps. */
export function ensureAbsoluteDemoLink(
  bodyHtml: string,
  previewUrl: string,
  linkLabel = 'Voir la démo en ligne'
): string {
  const u = previewUrl.trim();
  if (!u) return bodyHtml;
  if (bodyHtml.includes('{{previewUrl}}')) return bodyHtml;
  if (bodyHtml.includes(u)) return bodyHtml;
  const asAmp = u.replace(/&/g, '&amp;');
  if (asAmp !== u && bodyHtml.includes(asAmp)) return bodyHtml;

  const safe = u.replace(/"/g, '&quot;');
  return `${bodyHtml.trimEnd()}<p><a href="${safe}" target="_blank" rel="noopener noreferrer">${linkLabel}</a></p>`;
}

/** Si l’IA renvoie du texte brut sans balises HTML, on l’enveloppe en <p>. */
export function coerceBodyToHtml(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/<[a-z][\s\S]*>/i.test(t)) return t;
  return t
    .split(/\n\n+/)
    .map((block) => `<p>${block.split('\n').join('<br/>')}</p>`)
    .join('');
}

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const TONE_LABELS = {
  formal: { fr: 'professionnel et sérieux', en: 'professional and serious' },
  friendly: { fr: 'chaleureux et accessible', en: 'warm and approachable' },
  bold: { fr: 'percutant et direct', en: 'impactful and direct' },
} as const;

export async function generateEmail(input: GenerateEmailInput): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configuré.');

  const client = new Anthropic({ apiKey });
  const { prospect, revampedSite, language, tone } = input;
  const toneLabel = TONE_LABELS[tone][language];

  const isFr = language === 'fr';

  const systemPrompt = isFr
    ? `Tu es un expert en prospection commerciale pour une agence web. Tu rédiges des emails de prospection percutants pour proposer des refontes de sites web. Ton style est ${toneLabel}. Tu dois toujours répondre avec un objet JSON valide contenant les champs "subject", "bodyHtml" et "bodyText".`
    : `You are an expert in commercial prospecting for a web agency. You write impactful prospecting emails to offer website redesigns. Your style is ${toneLabel}. You must always respond with a valid JSON object containing "subject", "bodyHtml" and "bodyText" fields.`;

  const prospectSection = isFr
    ? `Prospect : ${prospect.name ?? 'Inconnu'}, entreprise : ${prospect.company ?? 'inconnue'}, site actuel : ${prospect.siteUrl}`
    : `Prospect: ${prospect.name ?? 'Unknown'}, company: ${prospect.company ?? 'unknown'}, current website: ${prospect.siteUrl}`;

  const demoUrl = revampedSite?.previewUrl?.trim() ?? '';

  const revampSection = revampedSite
    ? isFr
      ? `Nous avons déjà créé une version refonte de leur site. Titre : "${revampedSite.title ?? 'Site revampé'}". ${demoUrl ? `URL publique de la démo (à utiliser telle quelle dans un lien <a href>) : ${demoUrl}` : ''} ${revampedSite.improvements ? `Points d'amélioration identifiés : ${revampedSite.improvements}` : ''}`
      : `We have already created a redesigned version of their website. Title: "${revampedSite.title ?? 'Revamped site'}". ${demoUrl ? `Public demo URL (use exactly in an <a href>): ${demoUrl}` : ''} ${revampedSite.improvements ? `Identified improvements: ${revampedSite.improvements}` : ''}`
    : isFr
      ? `Nous sommes une agence web spécialisée dans les refontes de sites web modernes et performants.`
      : `We are a web agency specialized in modern and high-performance website redesigns.`;

  const linkRulesFr = demoUrl
    ? `
- bodyHtml doit être du HTML pur : utilise <p>, <strong>, <a> uniquement. INTERDIT : syntaxe Markdown ([texte](url), **gras**, etc.).
- Pour le lien vers la maquette démo, utilise obligatoirement : <a href="{{previewUrl}}">texte du lien</a> (placeholder exact {{previewUrl}}, pas l’URL en dur dans le JSON si possible).
- Mentionne aussi le site du prospect avec la variable {{siteUrl}} au moins une fois (lien ou texte).
- Le lien {{previewUrl}} pointe vers la page de démo Revamper ; {{siteUrl}} vers le site actuel du prospect.`
    : `
- bodyHtml : HTML pur uniquement, pas de Markdown.`;

  const linkRulesEn = demoUrl
    ? `
- bodyHtml must be pure HTML: use <p>, <strong>, <a> only. FORBIDDEN: Markdown ([text](url), **bold**, etc.).
- For the demo mockup link, use: <a href="{{previewUrl}}">link text</a> (exact placeholder {{previewUrl}}).
- Include the prospect's site using {{siteUrl}} at least once.
- {{previewUrl}} is the Revamper demo page; {{siteUrl}} is the prospect's current site.`
    : `
- bodyHtml: pure HTML only, no Markdown.`;

  const instructions = isFr
    ? `Rédige un email de prospection commerciale en français avec les contraintes suivantes :
- Mentionne le site actuel du prospect et 2-3 faiblesses concrètes possibles (design daté, lenteur, pas responsive, etc.)
- Présente brièvement notre service de refonte
- Mentionne que nous avons une version démo prête à leur montrer${demoUrl ? ' et mets le lien HTML vers cette démo' : ''}
- Inclus un CTA clair (répondre à cet email, prendre un appel)
- Email concis : 3-4 paragraphes maximum
- Utilise {{name}} pour le prénom du destinataire, {{company}} pour son entreprise, {{siteUrl}} pour l’URL du site du prospect
${linkRulesFr}
- Réponds UNIQUEMENT avec ce JSON : {"subject": "...", "bodyHtml": "<p>...</p>", "bodyText": "..."}`
    : `Write a commercial prospecting email in English with these constraints:
- Mention the prospect's current website and 2-3 possible concrete weaknesses (outdated design, slow speed, not responsive, etc.)
- Briefly present our redesign service
- Mention that we have a demo version ready to show them${demoUrl ? ' and include the HTML link to that demo' : ''}
- Include a clear CTA (reply to this email, schedule a call)
- Concise email: 3-4 paragraphs maximum
- Use {{name}}, {{company}}, and {{siteUrl}} for the prospect's site URL
${linkRulesEn}
- Respond ONLY with this JSON: {"subject": "...", "bodyHtml": "<p>...</p>", "bodyText": "..."}`;

  const userPrompt = `${prospectSection}\n\n${revampSection}\n\n${instructions}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const rawText = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La réponse IA ne contient pas de JSON valide.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    throw new Error('JSON IA invalide : ' + jsonMatch[0].slice(0, 200));
  }

  const subject = typeof parsed.subject === 'string' ? parsed.subject : '';
  let bodyHtml = typeof parsed.bodyHtml === 'string' ? parsed.bodyHtml : '';
  bodyHtml = coerceBodyToHtml(bodyHtml);
  const bodyText = typeof parsed.bodyText === 'string' ? parsed.bodyText : bodyHtml.replace(/<[^>]+>/g, '');

  if (!subject || !bodyHtml) throw new Error('Email généré incomplet (subject ou bodyHtml manquant).');

  let htmlOut = bodyHtml;
  let textOut = bodyText;
  if (demoUrl) {
    htmlOut = htmlOut.replace(/\{\{previewUrl\}\}/g, demoUrl);
    if (!textOut.includes(demoUrl) && !textOut.includes('{{previewUrl}}')) {
      textOut = `${textOut.trimEnd()}\n\n${isFr ? 'Démo' : 'Demo'}: ${demoUrl}`;
    } else {
      textOut = textOut.replace(/\{\{previewUrl\}\}/g, demoUrl);
    }
  } else {
    htmlOut = htmlOut.replace(/\{\{previewUrl\}\}/g, '');
  }

  if (demoUrl) {
    htmlOut = ensureAbsoluteDemoLink(htmlOut, demoUrl, isFr ? 'Voir la démo en ligne' : 'View the demo online');
  }

  return { subject, bodyHtml: htmlOut, bodyText: textOut };
}

