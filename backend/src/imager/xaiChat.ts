import { getXaiApiKey } from './xaiImagine';

const XAI_BASE = 'https://api.x.ai/v1';

/** Modèle texte rapide pour enrichir les prompts (override via XAI_CHAT_MODEL dans .env). */
const CHAT_MODEL = process.env.XAI_CHAT_MODEL?.trim() || 'grok-4-1-fast-non-reasoning';

/**
 * Transforme mots-clés / notes courtes en paragraphe de direction artistique pour Grok Imagine.
 */
export async function expandImagerContextWithGrok(params: {
  brandName: string;
  toneOfVoice?: string;
  brandDescription?: string | null;
  targetAudience?: string | null;
  keywords: string;
  existingContext?: string;
  customPromptHint?: string;
}): Promise<string> {
  const key = getXaiApiKey();
  const system = `You are a senior art director for AI marketing image generation. The user provides short keywords or rough notes (often comma-separated). Expand them into ONE concise paragraph (3–6 sentences) of concrete visual direction: lighting, mood, composition, color harmony with the brand, typography feel, and atmosphere. Write in the same language as the user's keywords. No markdown, no bullet lists, no quotation marks around the whole text. Plain text only.`;

  const parts = [
    `Brand: ${params.brandName}`,
    params.toneOfVoice ? `Tone: ${params.toneOfVoice}` : '',
    params.brandDescription ? `Brand description: ${params.brandDescription}` : '',
    params.targetAudience ? `Target audience: ${params.targetAudience}` : '',
    params.customPromptHint ? `Headline / hook to stay consistent with: ${params.customPromptHint}` : '',
    params.existingContext ? `Existing context (refine and enrich, keep compatible): ${params.existingContext}` : '',
    `Keywords / notes to expand: ${params.keywords}`,
  ].filter(Boolean);

  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: parts.join('\n') },
      ],
      temperature: 0.65,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Grok chat: ${res.status} ${text.slice(0, 400)}`);
  const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error('Réponse Grok vide.');
  return out.slice(0, 4000);
}
