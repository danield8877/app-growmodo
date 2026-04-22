import { getXaiApiKey } from '../imager/xaiImagine';

const XAI_BASE = 'https://api.x.ai/v1';
const CHAT_MODEL = process.env.XAI_CHAT_MODEL?.trim() || 'grok-4-1-fast-non-reasoning';

/**
 * Reformule le prompt Stitch pour le clarifier, supprimer redondances et renforcer les contraintes utiles,
 * sans changer l’intention (URL, sections, style, consignes métier).
 */
export async function optimizeStitchPrompt(prompt: string): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error('Prompt vide.');
  const key = getXaiApiKey();
  const system = `You rewrite prompts for a website redesign AI (Stitch). The user pastes a long structured prompt in English or French.
Your job: produce ONE improved prompt that:
- Keeps all factual constraints (URLs, section names, brand facts, language directives).
- Removes fluff and contradictions; merges duplicate instructions.
- Strengthens clarity for layout, typography, imagery (realistic photos, no cartoon unless explicitly requested), and accessibility.
- Does NOT invent new product claims or URLs; do not add marketing copy unrelated to the source.
- Output plain text only: no markdown fences, no preamble like "Here is". Same primary language as the input (if mixed, prefer French if the prompt is mostly French).`;

  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: trimmed.slice(0, 120_000) },
      ],
      temperature: 0.35,
      max_tokens: 8000,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Grok optimize prompt: ${res.status} ${text.slice(0, 400)}`);
  const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error('Réponse Grok vide.');
  return out.slice(0, 100_000);
}
