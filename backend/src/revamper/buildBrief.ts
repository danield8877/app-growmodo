import Anthropic from '@anthropic-ai/sdk';

/**
 * "Brief Builder" (port du plugin desginerr WP) :
 * réécrit une idée libre/floue de l'utilisateur en un brief de design structuré
 * que Stitch/Gemini peut exécuter précisément. Utilise Claude Opus (4.7 par défaut).
 *
 * Contrairement à `optimizeStitchPrompt` (Grok, réécriture généraliste),
 * celui-ci produit UN brief structuré (objectif, sections, ton, contraintes)
 * dans un budget de 120–220 mots.
 */

const ANTHROPIC_PROMPT_MODEL =
  process.env.ANTHROPIC_PROMPT_MODEL?.trim() || 'claude-opus-4-7';
const MAX_USER_PROMPT = 2000;
const MAX_TOKENS = 1500;

const SYSTEM = [
  'You are a senior web-design prompt engineer.',
  'Given a short, possibly messy user idea for a web page, you rewrite it into a clear, structured design brief',
  'that a UI design generator (Google Stitch / Gemini) can execute precisely.',
  'Your rewritten brief must:',
  '1) Define the page goal and audience in one sentence.',
  '2) Name the key sections (hero, features, testimonials, pricing, CTA, footer, etc.) in visual order.',
  '3) Specify the tone (professional, premium, playful, bold, minimal…) and visual style (typography mood, colour direction, density).',
  '4) Mention layout hints (hierarchy, whitespace, device-first, motion cues).',
  '5) State concrete constraints (mandatory elements, things to avoid).',
  'Write the brief in English, third-person imperative, 120–220 words, as a single paragraph or a short bulleted block.',
  'Do NOT mention AI, models, or prompt engineering. Do NOT add disclaimers.',
  'Return ONLY the rewritten brief, no preamble, no markdown fences, no quotes.',
].join(' ');

/** Retire les éventuels fences markdown / guillemets résiduels. */
function sanitizeOutput(text: string): string {
  let t = text.replace(/^```[a-zA-Z0-9]*\s*|\s*```$/gm, '');
  t = t.replace(/^[\s"'`]+|[\s"'`]+$/g, '');
  return t.trim();
}

export async function buildBriefWithClaude(params: {
  userPrompt: string;
  sourceUrl?: string;
}): Promise<string> {
  const raw = (params.userPrompt || '').trim();
  if (!raw) throw new Error('Prompt vide.');

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configuré.');

  const client = new Anthropic({ apiKey });

  const userPrompt = raw.length > MAX_USER_PROMPT ? raw.slice(0, MAX_USER_PROMPT) : raw;
  const context = params.sourceUrl?.trim() ? `Source URL (context): ${params.sourceUrl.trim()}\n\n` : '';
  const userContent = `${context}User idea:\n${userPrompt}`;

  const message = await client.messages.create({
    model: ANTHROPIC_PROMPT_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = message.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const out = sanitizeOutput(text);
  if (!out) throw new Error("Réponse IA vide (brief non généré).");
  return out;
}
