const MATERIAL_TO_FA_SOLID: Record<string, string> = {
  check: 'check',
  done: 'check',
  check_circle: 'circle-check',
  check_circle_outline: 'circle-check',
  task_alt: 'circle-check',
  verify: 'check',
  cancel: 'circle-xmark',
  close: 'xmark',
  close_circle: 'circle-xmark',
  remove_circle: 'circle-minus',
  bolt: 'bolt',
  auto_awesome: 'wand-magic-sparkles',
  arrow_upward: 'arrow-up',
  arrow_forward: 'arrow-right',
  arrow_back: 'arrow-left',
  east: 'arrow-right',
  west: 'arrow-left',
  north: 'arrow-up',
  south: 'arrow-down',
  trending_up: 'chart-line',
  analytics: 'chart-column',
  groups: 'users',
  person: 'user',
  people: 'users',
  support_agent: 'headset',
  workspace_premium: 'crown',
  star: 'star',
  favorite: 'heart',
  shield: 'shield-halved',
  lock: 'lock',
  public: 'globe',
  language: 'globe',
  schedule: 'clock',
  calendar_month: 'calendar',
  email: 'envelope',
  call: 'phone',
  chat: 'comments',
  search: 'magnifying-glass',
  settings: 'gear',
  menu: 'bars',
  add: 'plus',
  remove: 'minus',
  home: 'house',
  article: 'file-lines',
  description: 'file-lines',
  rocket_launch: 'rocket',
  checklist: 'list-check',
  speed: 'gauge-high',
};

function normalizeMaterialToken(rawInner: string): string {
  const text = rawInner.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
  return text.toLowerCase().replace(/[\s-]+/g, '_');
}

export function remapMaterialIconsToFontAwesome(html: string): { html: string; used: boolean } {
  if (!html) return { html, used: false };
  let used = false;
  const re =
    /<(span|i)\b([^>]*?)class\s*=\s*["']([^"']*\bmaterial-(?:icons|symbols-[^"'\s]+)[^"']*)["']([^>]*)>([\s\S]*?)<\/\1>/gi;

  const out = html.replace(
    re,
    (_all, _tag: string, preAttrs: string, classValue: string, postAttrs: string, inner: string) => {
      const token = normalizeMaterialToken(inner);
      // Si inconnu, fallback visuel neutre (évite d'afficher le texte brut du token).
      const faName = MATERIAL_TO_FA_SOLID[token] || 'circle';
      used = true;

      const classes = classValue
        .split(/\s+/)
        .filter(Boolean)
        .filter((c) => !/^material-(icons|symbols-)/i.test(c));
      const mergedClass = ['fa-solid', `fa-${faName}`, ...classes].join(' ').trim();
      return `<i${preAttrs}class="${mergedClass}"${postAttrs}></i>`;
    }
  );

  return { html: out, used };
}

/** SRI aligné sur le fichier all.min.css 6.5.2 de cdnjs (hash base64 sensible à la casse). */
export const FONT_AWESOME_CDN =
  '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer">';
