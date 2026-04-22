export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background?: string;
  text?: string;
}

export interface BrandFonts {
  heading: string;
  body: string;
  accent?: string;
}

export type ToneOfVoice = 'professional' | 'friendly' | 'bold' | 'luxury' | 'playful' | 'minimalist';

/** Langue du texte dans les visuels générés (ISO 639-1). */
export type OutputLanguageCode = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl';

export type AssetType =
  | 'facebook-ad'
  | 'instagram-post'
  | 'instagram-story'
  | 'linkedin-post'
  | 'linkedin-banner'
  | 'twitter-post'
  | 'animated-logo'
  | 'logo-remake'
  | 'business-card'
  | 'email-signature'
  | 'presentation-template'
  | 'social-cover'
  | 'brand-icon';

export interface GeneratedAsset {
  id: string;
  type: AssetType;
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  format: string;
  createdAt: string;
  prompt?: string;
  metadata?: Record<string, any>;
}

export interface ImagerProject {
  id: string;
  owner_id: string | null;
  guest_session_id?: string | null;
  brand_name: string;
  brand_colors: BrandColors;
  brand_logo_url?: string;
  brand_fonts: BrandFonts;
  brand_description?: string;
  target_audience?: string;
  tone_of_voice: ToneOfVoice;
  /** Langue du texte dans les images / vidéos générées */
  output_language?: OutputLanguageCode | string;
  generated_assets: GeneratedAsset[];
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface CreateImagerProjectInput {
  brand_name: string;
  brand_colors?: Partial<BrandColors>;
  brand_logo_url?: string;
  brand_fonts?: Partial<BrandFonts>;
  brand_description?: string;
  target_audience?: string;
  tone_of_voice?: ToneOfVoice;
  output_language?: OutputLanguageCode | string;
}

export interface GenerateAssetInput {
  projectId: string;
  assetType: AssetType;
  customPrompt?: string;
  additionalContext?: string;
  /** Surcharge optionnelle (sinon valeur du projet) */
  output_language?: OutputLanguageCode | string;
}

export const ASSET_DIMENSIONS: Record<AssetType, { width: number; height: number }> = {
  'facebook-ad': { width: 1200, height: 628 },
  'instagram-post': { width: 1080, height: 1080 },
  'instagram-story': { width: 1080, height: 1920 },
  'linkedin-post': { width: 1080, height: 1080 },
  'linkedin-banner': { width: 1500, height: 300 },
  'twitter-post': { width: 1200, height: 675 },
  'animated-logo': { width: 800, height: 800 },
  'logo-remake': { width: 1024, height: 1024 },
  'business-card': { width: 1050, height: 600 },
  'email-signature': { width: 600, height: 200 },
  'presentation-template': { width: 1920, height: 1080 },
  'social-cover': { width: 1500, height: 500 },
  'brand-icon': { width: 1024, height: 1024 },
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  'facebook-ad': 'Publicité Facebook',
  'instagram-post': 'Post Instagram',
  'instagram-story': 'Story Instagram',
  'linkedin-post': 'Post LinkedIn',
  'linkedin-banner': 'Bannière LinkedIn',
  'twitter-post': 'Post Twitter/X',
  'animated-logo': 'Logo Animé',
  'logo-remake': 'Logo remaker',
  'business-card': 'Carte de Visite',
  'email-signature': 'Signature Email',
  'presentation-template': 'Template Présentation',
  'social-cover': 'Couverture Réseaux Sociaux',
  'brand-icon': 'Icônes & pictogrammes',
};
