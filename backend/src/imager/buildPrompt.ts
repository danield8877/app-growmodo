export type AssetType =
  | 'facebook-ad'
  | 'instagram-post'
  | 'instagram-story'
  | 'linkedin-post'
  | 'linkedin-banner'
  | 'twitter-post'
  | 'animated-logo'
  | 'logo-remake'
  | 'video-intro'
  | 'animate-image'
  | 'business-card'
  | 'email-signature'
  | 'presentation-template'
  | 'social-cover'
  | 'brand-icon';

type P = (b: string, bd: string, ta: string, t: string) => string;

/**
 * Appended to every image prompt so the model keeps brand marks readable and uncropped.
 * English for best model compliance.
 */
export const LOGO_SAFE_ZONE_RULE =
  'LAYOUT RULES (mandatory): Any brand mark, logo, wordmark, or text must be fully visible inside the frame—never cropped at the edges. Leave a generous safe margin (padding) on all sides; scale down if needed so nothing is cut off. No element clipped by the frame borders.';

/**
 * Global, sector-agnostic: sober photoreal marketing, no cartoon / fantasy / random metaphors.
 * Applies to all industries; do not name specific sectors or subjects here.
 */
export const IMAGER_VISUAL_DISCIPLINE =
  'VISUAL DISCIPLINE (mandatory, any industry): Use photorealistic or near-photoreal corporate marketing imagery only—credible stock-photo look (real office, workspace, hands, product detail, neutral abstract texture, soft gradient). Modern, clean, believable. Not stylized “AI art”, not painterly, not surreal. FORBIDDEN: cartoon, anime, comic, illustrated mascots, flat vector characters, clip-art, children’s-book look, or any clearly drawn/non-photographic style. FORBIDDEN: fantasy or symbolic scenes, unrelated monuments or architecture as metaphor, dreamlike landscapes, sci-fi cityscapes, neon cyberpunk or holographic UI clichés—unless the client explicitly asked for that in Additional requirements. Stay generic, professional, and restrained; avoid decorative metaphors and “invented” spectacle.';

/** Le fichier logo envoyé en entrée doit rester le repère graphique officiel (layouts, pubs, etc.). */
export function IMAGER_BRAND_MARK_DISCIPLINE(brandName: string): string {
  const name = (brandName || 'Brand').trim() || 'Brand';
  return `BRAND MARK (mandatory): The supplied source image is the official brand logo or mark. Reproduce it faithfully—preserve shapes and colors; do not invent a different logo, emblem, or placeholder block (no random square or fake icon as “logo”). Do not generate a new brand symbol. If you cannot place the mark clearly, use clean typography with the brand name “${name}” only—no substitute graphic logo.`;
}

/** Vidéo logo animé : conserver le visuel source, pas le remplacer par du texte seul. */
export const IMAGER_ANIMATED_LOGO_DISCIPLINE =
  'ANIMATED LOGO (mandatory): The source image is the official brand mark. Preserve it exactly—same shapes, colors, and proportions. Subtle, professional, loop-friendly motion only; do not replace the logo with plain text or a different symbol.';

/** Logo redesign output only — no scenes. */
export const IMAGER_LOGO_REMAKE_DISCIPLINE =
  'LOGO OUTPUT DISCIPLINE (mandatory): Output ONLY the redesigned logo on a flat white or transparent background. No website mockups, no hero scenes, no photography, no UI frames. The mark must look like a credible professional logo—not a cartoon mascot unless the source mark clearly is.';

/** Single icon asset — not cartoon. */
export const IMAGER_ICON_DISCIPLINE =
  'ICON DISCIPLINE (mandatory): Exactly ONE icon or pictogram. Style: refined photoreal 3D material OR minimal geometric symbol. FORBIDDEN: cartoon character, illustrated mascot, anime, comic, flat clip-art mascot. Do not embed a fake company logo or wordmark—graphic symbol only.';

/** Video from an existing full creative (not only the logo file). */
export const IMAGER_ANIMATE_IMAGE_DISCIPLINE =
  'SOURCE FIDELITY (mandatory): Preserve the reference frame’s composition and branding. Do not restyle the whole image into illustration or cartoon. Do not introduce new logos, watermarks, or random symbols. Motion only—no replacement of photographic content with drawn content.';

export function imagerGlobalRulesForAssetType(assetType: AssetType, brandName: string): string {
  if (assetType === 'logo-remake') {
    return `\n\n${IMAGER_LOGO_REMAKE_DISCIPLINE}`;
  }
  if (assetType === 'brand-icon') {
    return `\n\n${IMAGER_ICON_DISCIPLINE}`;
  }
  if (assetType === 'animate-image') {
    return `\n\n${IMAGER_VISUAL_DISCIPLINE}\n\n${IMAGER_ANIMATE_IMAGE_DISCIPLINE}`;
  }
  if (assetType === 'animated-logo') {
    return `\n\n${IMAGER_VISUAL_DISCIPLINE}\n\n${IMAGER_ANIMATED_LOGO_DISCIPLINE}`;
  }
  return `\n\n${IMAGER_VISUAL_DISCIPLINE}\n\n${IMAGER_BRAND_MARK_DISCIPLINE(brandName)}`;
}

/** English name for the model; `code` is ISO 639-1 (fr, en, …). */
export function languageInstructionForPrompt(code?: string): string {
  const key = (code || 'fr').toLowerCase().trim().slice(0, 2);
  const names: Record<string, string> = {
    fr: 'French',
    en: 'English',
    es: 'Spanish',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
  };
  const name = names[key] ?? names.fr;
  return `LANGUAGE (mandatory): All text, headlines, slogans, button labels, and any readable copy in the image must be written in ${name}.`;
}

const BASE: Record<AssetType, P> = {
  'facebook-ad': (b, bd, ta, t) =>
    `Create a professional Facebook ad image for ${b}. ${bd} Target audience: ${ta}. Tone: ${t}. Full-width landscape: hero photo, gradient, and background must span the entire frame (no narrow centered panel on empty margins).`,
  'instagram-post': (b, bd, ta, t) =>
    `Design an eye-catching Instagram post for ${b}. ${bd} Style: modern, visually appealing, ${t}. Perfect for social media engagement.`,
  'instagram-story': (b, bd, ta, t) =>
    `Create a dynamic Instagram story for ${b}. ${bd} Vertical format, bold and engaging, ${t} tone.`,
  'linkedin-post': (b, bd, ta, t) =>
    `Design a square 1:1 LinkedIn feed post image for ${b}. ${bd} Business-appropriate, ${t}, targeting ${ta}. Format: exactly square (1080×1080 style).`,
  'linkedin-banner': (b, bd, ta, t) =>
    `Create a professional LinkedIn profile cover banner for ${b}. ${bd} Corporate, sleek, ${t} tone.`,
  'twitter-post': (b, bd, ta, t) =>
    `Design an engaging Twitter/X post image for ${b}. ${bd} Concise, impactful, ${t} style.`,
  'animated-logo': (b, bd, ta, t) =>
    `Create an animated logo concept for ${b}. ${bd} Modern, dynamic, ${t} aesthetic. Show motion-ready design. Target: ${ta}.`,
  'logo-remake': (b, bd, ta, t) =>
    `Redesign the attached logo into a new, modern logo. Keep the same brand identity but create a fresh, professional logo. Output ONLY the new logo on a clean white or transparent background. Brand: ${b}. ${bd}`,
  'video-intro': (b, bd, ta, t) =>
    `Design a video intro frame for ${b}. ${bd} Cinematic, professional, ${t} style. High-impact opening.`,
  'animate-image': (b, bd, ta, t) =>
    `Animate an existing marketing visual for ${b}. ${bd} Subtle motion, preserve layout and branding. Tone: ${t}. Audience: ${ta}.`,
  'business-card': (b, bd, ta, t) =>
    `Create a modern business card design for ${b}. ${bd} Professional, memorable, ${t} aesthetic.`,
  'email-signature': (b, bd, ta, t) =>
    `Design a professional email signature banner for ${b}. ${bd} Clean, corporate, includes space for contact info.`,
  'presentation-template': (b, bd, ta, t) =>
    `Create a presentation slide template for ${b}. ${bd} Professional, clean layout, ${t} design.`,
  'social-cover': (b, bd, ta, t) =>
    `Design a social media cover image for ${b}. ${bd} Universal format, professional, ${t} aesthetic.`,
  'brand-icon': (b, bd, ta, t) =>
    `Create a single premium 3D icon or pictogram for ${b}. ${bd} The icon must visually represent the business sector. Style: modern 3D, premium, one clear icon on transparent or soft background, suitable for app/UI. ${t}.`,
};

export const ASSET_DIMENSIONS: Record<AssetType, { width: number; height: number }> = {
  'facebook-ad': { width: 1200, height: 628 },
  'instagram-post': { width: 1080, height: 1080 },
  'instagram-story': { width: 1080, height: 1920 },
  'linkedin-post': { width: 1080, height: 1080 },
  /** Bandeau type cover LinkedIn (full width) */
  'linkedin-banner': { width: 1500, height: 300 },
  'twitter-post': { width: 1200, height: 675 },
  'animated-logo': { width: 800, height: 800 },
  'logo-remake': { width: 1024, height: 1024 },
  'video-intro': { width: 1920, height: 1080 },
  'animate-image': { width: 1080, height: 1080 },
  'business-card': { width: 1050, height: 600 },
  'email-signature': { width: 600, height: 200 },
  'presentation-template': { width: 1920, height: 1080 },
  'social-cover': { width: 1500, height: 500 },
  'brand-icon': { width: 1024, height: 1024 },
};

/**
 * Plein cadre sans bandes vides — tout en gardant la consigne BRAND MARK (logo fidèle, pas du texte seul).
 * Exclu : logo-remake, brand-icon.
 */
export function formatCoverInstructionForAssetType(assetType: AssetType): string {
  const { width, height } = ASSET_DIMENSIONS[assetType];
  const r = width / height;
  const ratioDesc =
    Math.abs(r - 1) < 0.08
      ? 'square 1:1'
      : r > 1.12
        ? `wide landscape (target ${width}×${height}px, W÷H≈${r.toFixed(2)})`
        : `tall portrait (target ${width}×${height}px)`;

  const linkedinExtra =
    assetType === 'linkedin-banner'
      ? ' LinkedIn cover: profile photo overlaps bottom-center—place headline and mark mainly upper ~60%, but background must still span the full width with no empty side gutters.'
      : '';

  return (
    `OUTPUT LAYOUT (mandatory): Target ${width}×${height}px (${ratioDesc}). ` +
    `Full-bleed composition: background, photography, gradients, and color fields must reach all four edges. ` +
    `FORBIDDEN: letterboxing, pillarboxing, large neutral margins, or a small centered “card” on empty space. ` +
    `Integrate the official brand mark from the reference image faithfully (BRAND MARK rules)—do not substitute plain text for the logo. ` +
    `Scale the mark so it stays fully visible.${linkedinExtra}`
  );
}

export function buildImagerPrompt(
  assetType: string,
  brandName: string,
  brandDescription?: string,
  toneOfVoice?: string,
  targetAudience?: string,
  customPrompt?: string,
  additionalContext?: string,
  outputLanguage?: string
): string {
  const b = brandName || 'Brand';
  const bd = brandDescription ? `${brandDescription} ` : '';
  const t = toneOfVoice || 'professional';
  const ta = targetAudience || 'professionals';
  const key = assetType in BASE ? (assetType as AssetType) : 'instagram-post';
  let out = BASE[key](b, bd, ta, t);
  if (key !== 'logo-remake' && key !== 'brand-icon') {
    out += `\n\n${formatCoverInstructionForAssetType(key)}`;
  }
  if (additionalContext?.trim()) out += `\n\nContext: ${additionalContext.trim()}`;
  if (customPrompt?.trim()) out += `\n\nAdditional requirements: ${customPrompt.trim()}`;
  out += `\n\n${languageInstructionForPrompt(outputLanguage)}`;
  out += imagerGlobalRulesForAssetType(key, b);
  out += `\n\n${LOGO_SAFE_ZONE_RULE}`;
  return out;
}
