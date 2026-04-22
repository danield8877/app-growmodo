import fs from 'fs/promises';
import path from 'path';
import { backendRoot } from '../loadEnv';

type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

export type RevampAdvancedConfig = {
  jinaReaderBaseUrl: string;
  puppeteer: {
    viewport: { width: number; height: number };
    navigationTimeoutMs: number;
    waitUntil: WaitUntil;
  };
  anthropic: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
  /** Instructions stables pour l’API Messages (rôle UI/UX), distinctes du prompt utilisateur. */
  systemPrompt: string;
  promptTemplate: string;
};

const DEFAULT_CONFIG: RevampAdvancedConfig = {
  jinaReaderBaseUrl: 'https://r.jina.ai/',
  puppeteer: {
    viewport: { width: 1440, height: 900 },
    navigationTimeoutMs: 30_000,
    waitUntil: 'networkidle2',
  },
  anthropic: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    temperature: 0.6,
  },
  systemPrompt: [
    'Tu es un expert senior en UI/UX et en pages HTML/CSS/JS autonomes (sans build).',
    'Tu respectes strictement le contexte marque et la capture d’écran fournis dans le message utilisateur (couleurs, hiérarchie, ton, secteur).',
    'Tu proposes une refonte moderne : espacements cohérents, échelle typographique claire, sections bien délimitées, CTA visibles — en évitant les palettes génériques « startup bleu » lorsque la marque impose d’autres couleurs.',
    'Accessibilité : HTML sémantique (header, main, nav, section, footer), contrastes lisibles, intitulés de liens et boutons explicites.',
    'Mobile-first, responsive ; CSS dans la page (style inline ou balise style) ; JS vanilla uniquement si utile.',
    'Arrière-plans « vitrine » (style moderne type landing UI) : uniquement CSS — dégradés animés (@keyframes sur background-position ou variables), calques absolus (inset:0) avec blur/opacité/mix-blend pour halos ou mesh discrets, sans bibliothèque externe ni Canvas/WebGL obligatoire.',
    'Pour l’accessibilité du mouvement : inclure @media (prefers-reduced-motion: reduce) { … } pour désactiver ou simplifier les animations de fond.',
    'Tu ne fabriques pas de faits sur l’entreprise : tu t’appuies sur le contenu fourni.',
    'Sortie : un document HTML complet uniquement, sans blocs markdown ni commentaires hors code.',
  ].join(' '),
  promptTemplate:
    'Tu as aussi une capture d\'ecran du site d\'origine (image jointe) : reproduis l\'identite visuelle (couleurs, hierarchie) et le logo si une URL logo est fournie dans le contexte ci-dessus.\n\nCONTENU DU SITE (markdown):\n{{MARKDOWN}}\n\nMISSION:\n1. Respecte le CONTEXTE MARQUE (secteur, couleurs hex, logo, vocabulaire — pas de "produits/panier" si ce n\'est pas du e-commerce).\n2. Propose une refonte moderne mais coherente avec la marque (pas une palette generique bleu startup si d\'autres couleurs sont imposees).\n3. Garde les faits et le ton du contenu source ; ameliore la clarte et l\'impact.\n4. UI : grille ou sections lisibles, rythme vertical homogene, titres hierarchises (h1 unique si pertinent), pas de texte illisible sur fond.\n5. Genere un HTML complet standalone (CSS inline ou balise <style>, JS vanilla si besoin).\n\nCONTRAINTES:\n- Mobile-first, responsive\n- SEO-friendly (titres, meta description si pertinent)\n- Performance : CSS raisonnable ; animations de fond légères (transform/opacity/background), pas de boucles lourdes sur le layout\n- Fond optionnel : ambiance animée discrète cohérente avec la marque (CSS pur) ; si animé, prévoir prefers-reduced-motion\n\nRETOURNE UNIQUEMENT LE CODE HTML, sans commentaire ni markdown.',
};

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function toNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function toStr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function toWaitUntil(v: unknown, fallback: WaitUntil): WaitUntil {
  const s = toStr(v, fallback);
  if (s === 'load' || s === 'domcontentloaded' || s === 'networkidle0' || s === 'networkidle2') return s;
  return fallback;
}

export async function loadRevampAdvancedConfig(): Promise<RevampAdvancedConfig> {
  const configured = process.env.REVAMP_ADVANCED_CONFIG_PATH?.trim();
  const configPath = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.join(backendRoot, configured)
    : path.join(backendRoot, 'config', 'revamp-advanced.config.json');

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const root = asObject(parsed);
    const pp = asObject(root.puppeteer);
    const vp = asObject(pp.viewport);
    const an = asObject(root.anthropic);

    return {
      jinaReaderBaseUrl: toStr(root.jinaReaderBaseUrl, DEFAULT_CONFIG.jinaReaderBaseUrl),
      puppeteer: {
        viewport: {
          width: Math.max(320, toNum(vp.width, DEFAULT_CONFIG.puppeteer.viewport.width)),
          height: Math.max(320, toNum(vp.height, DEFAULT_CONFIG.puppeteer.viewport.height)),
        },
        navigationTimeoutMs: Math.max(10_000, toNum(pp.navigationTimeoutMs, DEFAULT_CONFIG.puppeteer.navigationTimeoutMs)),
        waitUntil: toWaitUntil(pp.waitUntil, DEFAULT_CONFIG.puppeteer.waitUntil),
      },
      anthropic: {
        model: toStr(an.model, DEFAULT_CONFIG.anthropic.model),
        maxTokens: Math.max(512, toNum(an.maxTokens, DEFAULT_CONFIG.anthropic.maxTokens)),
        temperature: Math.min(1, Math.max(0, toNum(an.temperature, DEFAULT_CONFIG.anthropic.temperature))),
      },
      systemPrompt: toStr(root.systemPrompt, DEFAULT_CONFIG.systemPrompt),
      promptTemplate: toStr(root.promptTemplate, DEFAULT_CONFIG.promptTemplate),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
