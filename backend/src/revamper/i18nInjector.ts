import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import type { AnyNode, Element as DomElement } from 'domhandler';

/**
 * Post-processeur i18n (port du plugin desginerr WP) :
 * après la génération Stitch, tague les nœuds de texte visibles,
 * demande à Claude Opus les traductions EN / DE / FR / ES,
 * puis injecte un switcher (4 drapeaux) + un script vanilla qui bascule
 * le textContent / les attributs traduisibles au clic.
 *
 * Le HTML reste 100 % auto-contenu (dictionnaire inline, pas de CDN).
 */

const ANTHROPIC_I18N_MODEL =
  process.env.ANTHROPIC_I18N_MODEL?.trim() ||
  process.env.ANTHROPIC_PROMPT_MODEL?.trim() ||
  'claude-opus-4-7';
const MAX_TOKENS = 8000;
const MAX_STRINGS = 300;

export type SupportedLang = 'en' | 'de' | 'fr' | 'es' | 'it';
const SUPPORTED: SupportedLang[] = ['en', 'de', 'fr', 'es', 'it'];
const LANG_NAMES: Record<SupportedLang, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
};
const TRANSLATABLE_ATTRS = ['alt', 'placeholder', 'title', 'aria-label', 'value'] as const;
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'code', 'pre', 'svg']);

export type I18nResult = {
  html: string;
  translated: boolean;
  error: string | null;
  stringsCount: number;
};

function normalizeLang(lang: string | undefined | null): SupportedLang {
  const v = (typeof lang === 'string' ? lang.slice(0, 2).toLowerCase().trim() : '') as SupportedLang;
  return SUPPORTED.includes(v) ? v : 'en';
}

/**
 * Entrée principale : tague le HTML, traduit, injecte le switcher.
 * Si la traduction échoue ou si aucune string n'est trouvée, renvoie le HTML d'origine intact.
 */
export async function translateAndInjectI18n(params: {
  html: string;
  sourceLang?: string;
}): Promise<I18nResult> {
  const sourceLang = normalizeLang(params.sourceLang);
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      html: params.html,
      translated: false,
      error: 'Clé API Anthropic manquante — switcher de langue désactivé.',
      stringsCount: 0,
    };
  }

  const tagged = tagTextNodes(params.html);
  const stringsCount = Object.keys(tagged.strings).length;
  if (stringsCount === 0) {
    return { html: params.html, translated: false, error: null, stringsCount: 0 };
  }

  let translations: Record<string, Record<string, string>>;
  try {
    translations = await fetchTranslations(tagged.strings, sourceLang, apiKey);
  } catch (e) {
    return {
      html: params.html,
      translated: false,
      error: `Traduction indisponible — switcher désactivé. (${e instanceof Error ? e.message : 'err'})`,
      stringsCount,
    };
  }

  if (Object.keys(translations).length === 0) {
    return {
      html: params.html,
      translated: false,
      error: 'Traduction indisponible — switcher désactivé.',
      stringsCount,
    };
  }

  translations[sourceLang] = tagged.strings;
  const finalHtml = injectSwitcherAndDict(tagged.html, translations, sourceLang);
  return { html: finalHtml, translated: true, error: null, stringsCount };
}

/**
 * Parse le HTML avec cheerio, ajoute `data-i18n="k{N}"` sur chaque nœud de texte visible,
 * et `data-i18n-attr-{attr}="k{N}"` sur les attributs traduisibles.
 * Retourne { html, strings: { kN: texte } }.
 */
function tagTextNodes(html: string): { html: string; strings: Record<string, string> } {
  const $ = cheerio.load(html);
  const strings: Record<string, string> = {};
  let counter = 0;

  /** True si l'un des ancêtres de `node` (inclus) est dans SKIP_TAGS. */
  function hasForbiddenAncestor(node: AnyNode | null): boolean {
    let walker: AnyNode | null = node;
    while (walker) {
      if (walker.type === 'tag' && SKIP_TAGS.has((walker as DomElement).tagName.toLowerCase())) {
        return true;
      }
      walker = (walker.parent as AnyNode | null) ?? null;
    }
    return false;
  }

  const textNodes: AnyNode[] = [];
  $('body *, body').contents().each((_, n) => {
    if (n.type !== 'text') return;
    const raw = (n as unknown as { data?: string }).data ?? '';
    if (!raw.trim()) return;
    const parent = n.parent as AnyNode | null;
    if (!parent || parent.type !== 'tag') return;
    if (hasForbiddenAncestor(parent)) return;
    textNodes.push(n);
  });

  for (const node of textNodes) {
    if (counter >= MAX_STRINGS) break;
    if (node.type !== 'text') continue;
    const raw = (node as unknown as { data?: string }).data ?? '';
    const text = raw.trim();
    if (!text) continue;

    const leading = /^\s/.test(raw) ? ' ' : '';
    const trailing = /\s$/.test(raw) ? ' ' : '';

    counter += 1;
    const key = `k${counter}`;
    strings[key] = text;

    const spanHtml = `<span data-i18n="${key}">${escHtml(text)}</span>`;
    const replacement = `${leading}${spanHtml}${trailing}`;
    $(node as unknown as DomElement).replaceWith(replacement);
  }

  for (const attr of TRANSLATABLE_ATTRS) {
    if (counter >= MAX_STRINGS) break;
    const elements = $(`[${attr}]`).toArray();
    for (const el of elements) {
      if (counter >= MAX_STRINGS) break;
      if (el.type !== 'tag') continue;
      if (hasForbiddenAncestor(el as AnyNode)) continue;
      const $el = $(el as DomElement);
      const v = ($el.attr(attr) ?? '').trim();
      if (!v) continue;
      if (attr === 'value') {
        const tag = (el as DomElement).tagName.toLowerCase();
        const type = ($el.attr('type') ?? '').toLowerCase();
        if (!(tag === 'input' && (type === 'submit' || type === 'button' || type === 'reset'))) {
          continue;
        }
      }
      counter += 1;
      const key = `k${counter}`;
      strings[key] = v;
      $el.attr(`data-i18n-attr-${attr}`, key);
    }
  }

  return { html: $.html(), strings };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Appelle Claude Opus pour traduire le dictionnaire source vers les 3 langues manquantes.
 * Retourne { lang => { kN => texte } } (uniquement les langues reçues non vides).
 */
async function fetchTranslations(
  strings: Record<string, string>,
  sourceLang: SupportedLang,
  apiKey: string,
): Promise<Record<string, Record<string, string>>> {
  const targets = SUPPORTED.filter((l) => l !== sourceLang);
  const targetNames = targets.map((l) => LANG_NAMES[l]);

  const system = [
    'You are a professional UI translator.',
    `You receive a JSON object mapping stable keys (k1, k2, ...) to short website copy strings in ${LANG_NAMES[sourceLang]}.`,
    `Translate every value into: ${targetNames.join(', ')}.`,
    'Keep translations idiomatic, concise, and tone-matched to marketing/UI copy (not literal).',
    'Keep the exact same keys. Do not translate brand names, proper nouns, numbers, emojis, currency symbols, URLs.',
    'Preserve punctuation and casing style. If a string is a single word (e.g. button), keep it short.',
    `Return ONLY a single JSON object of shape { "${targets.join('": {...}, "')}": {...} } where each inner object mirrors the input keys.`,
    'No prose, no markdown fences.',
  ].join(' ');

  const client = new Anthropic({ apiKey });
  const payloadUser = JSON.stringify({ source: sourceLang, targets, strings });

  const message = await client.messages.create({
    model: ANTHROPIC_I18N_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: payloadUser }],
  });

  let text = message.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  text = text.replace(/^```[a-zA-Z0-9]*\s*|\s*```$/gm, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // On essaie d'extraire le 1er objet JSON.
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Réponse IA non-JSON');
    parsed = JSON.parse(m[0]);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Réponse IA invalide');
  }

  const json = parsed as Record<string, unknown>;
  const out: Record<string, Record<string, string>> = {};
  for (const t of targets) {
    const entry = json[t];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const dict: Record<string, string> = {};
    const src = entry as Record<string, unknown>;
    for (const k of Object.keys(strings)) {
      const v = src[k];
      dict[k] = typeof v === 'string' ? v : strings[k];
    }
    out[t] = dict;
  }
  return out;
}

/**
 * Injecte le switcher en premier enfant de <header> ou <nav>, sinon en fixed top-left.
 * Ajoute le CSS avant </head> et le <script> avant </body>.
 */
function injectSwitcherAndDict(
  html: string,
  translations: Record<string, Record<string, string>>,
  sourceLang: SupportedLang,
): string {
  const dictJson = JSON.stringify(translations);
  const script = switcherScript(dictJson, sourceLang);
  const inlineSwitcher = switcherHtml(sourceLang, false);
  const fixedSwitcher = switcherHtml(sourceLang, true);
  const style = switcherCss();

  let out = html;

  let injectedInline = false;
  const replaceFirst = (subject: string, re: RegExp, fn: (match: string) => string): { subject: string; found: boolean } => {
    let found = false;
    const next = subject.replace(re, (m) => {
      if (found) return m;
      found = true;
      return fn(m);
    });
    return { subject: next, found };
  };

  const rHeaderOpen = replaceFirst(out, /<header(\s[^>]*)?>/i, (m) => `${m}\n${inlineSwitcher}`);
  if (rHeaderOpen.found) {
    out = rHeaderOpen.subject;
    injectedInline = true;
  } else {
    const rNavOpen = replaceFirst(out, /<nav(\s[^>]*)?>/i, (m) => `${m}\n${inlineSwitcher}`);
    if (rNavOpen.found) {
      out = rNavOpen.subject;
      injectedInline = true;
    }
  }

  const r3 = replaceFirst(out, /<\/head\s*>/i, (m) => `${style}\n${m}`);
  if (r3.found) {
    out = r3.subject;
  } else {
    out = `${style}\n${out}`;
  }

  if (!injectedInline) {
    const r4 = replaceFirst(out, /<body[^>]*>/i, (m) => `${m}\n${fixedSwitcher}`);
    if (r4.found) {
      out = r4.subject;
    } else {
      out = `${fixedSwitcher}${out}`;
    }
  }

  const r5 = replaceFirst(out, /<\/body\s*>/i, (m) => `${script}\n${m}`);
  if (r5.found) {
    out = r5.subject;
  } else {
    out = `${out}${script}`;
  }

  return out;
}

function switcherCss(): string {
  return `<style id="desginerr-lang-switcher-style">
.desginerr-lang-switcher{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,.08);box-shadow:0 4px 16px rgba(0,0,0,.08);border-radius:999px;padding:6px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;vertical-align:middle;margin-left:12px;pointer-events:auto;position:relative;z-index:9999}
.desginerr-lang-switcher--fixed{position:fixed !important;top:16px;left:16px;z-index:9999 !important;margin:0}
.desginerr-lang-switcher button{all:unset;cursor:pointer !important;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;transition:transform .15s ease,box-shadow .15s ease;opacity:.55;pointer-events:auto !important;position:relative;z-index:1}
.desginerr-lang-switcher button:hover{opacity:1;transform:scale(1.08)}
.desginerr-lang-switcher button[aria-pressed="true"]{opacity:1;box-shadow:0 0 0 2px #111 inset,0 0 0 1px #fff}
.desginerr-lang-switcher svg{display:block;width:100%;height:100%;pointer-events:none}
@media (max-width:640px){.desginerr-lang-switcher{padding:4px;gap:4px;margin-left:8px}.desginerr-lang-switcher button{width:24px;height:24px}.desginerr-lang-switcher--fixed{top:10px;left:10px;z-index:9999 !important}}
</style>`;
}

function flagSvg(code: SupportedLang): string {
  switch (code) {
    case 'en':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><clipPath id="s"><path d="M0,0v30h60v-30z"/></clipPath><clipPath id="t"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath><g clip-path="url(#s)"><path d="M0,0v30h60v-30z" fill="#012169"/><path d="M0,0 60,30M60,0 0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 60,30M60,0 0,30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></svg>';
    case 'de':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><rect width="5" height="3" fill="#000"/><rect width="5" height="2" y="1" fill="#D00"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>';
    case 'fr':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#002654"/><rect width="1" height="2" x="2" fill="#CE1126"/></svg>';
    case 'es':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect width="3" height="1" y="0.5" fill="#F1BF00"/></svg>';
    case 'it':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#009246"/><rect width="1" height="2" x="2" fill="#CE2B37"/></svg>';
  }
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function switcherHtml(active: SupportedLang, fixed: boolean): string {
  const labels: Record<SupportedLang, string> = {
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
  };
  const buttons = SUPPORTED.map((code) => {
    const pressed = code === active ? 'true' : 'false';
    return `<button type="button" data-lang="${escAttr(code)}" aria-pressed="${pressed}" aria-label="${escAttr(labels[code])}" title="${escAttr(labels[code])}">${flagSvg(code)}</button>`;
  }).join('');
  const classes = `desginerr-lang-switcher${fixed ? ' desginerr-lang-switcher--fixed' : ''}`;
  return `<div class="${classes}" role="group" aria-label="Language">${buttons}</div>`;
}

function switcherScript(dictJson: string, sourceLang: SupportedLang): string {
  const safeJson = dictJson.replace(/<\/script/gi, '<\\/script');
  return `<script id="desginerr-i18n-script">
(function(){
  var DICT = ${safeJson};
  var SRC = "${sourceLang}";
  var KEY = "desginerr.lang";
  function apply(lang){
    if(!DICT[lang]) lang = SRC;
    var dict = DICT[lang] || {};
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      var k = el.getAttribute("data-i18n");
      if(dict[k] !== undefined) el.textContent = dict[k];
    });
    ["alt","placeholder","title","aria-label","value"].forEach(function(attr){
      document.querySelectorAll("[data-i18n-attr-"+attr+"]").forEach(function(el){
        var k = el.getAttribute("data-i18n-attr-"+attr);
        if(dict[k] !== undefined) el.setAttribute(attr, dict[k]);
      });
    });
    document.documentElement.setAttribute("lang", lang);
    document.querySelectorAll(".desginerr-lang-switcher button").forEach(function(b){
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    try { localStorage.setItem(KEY, lang); } catch(e){}
  }
  function init(){
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch(e){}
    apply(saved && DICT[saved] ? saved : SRC);
    document.querySelectorAll(".desginerr-lang-switcher button").forEach(function(b){
      b.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        apply(b.getAttribute("data-lang"));
      }, true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
</script>`;
}
