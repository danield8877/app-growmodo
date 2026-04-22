import type { GenerateAssetInput, GeneratedAsset, AssetType, ImagerProject } from './types';
import { ASSET_DIMENSIONS } from './types';
import { apiFetch } from '../../lib/api';

/** Génération d’asset (surtout vidéo Grok Imagine): peut prendre jusqu’à ~3 min côté xAI. */
const IMAGER_GENERATE_TIMEOUT_MS = 10 * 60_000;

async function parseApiError(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { error?: string };
    if (typeof j?.error === 'string') return j.error;
  } catch {
    /* ignore */
  }
  return t || res.statusText;
}

type GenAssetApiResponse = {
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
};

type EnrichApiResponse = {
  enriched?: string;
  error?: string;
};

export const generateAssetService = {
  async generateAsset(input: GenerateAssetInput, project: ImagerProject): Promise<GeneratedAsset> {
    const isVideoAsset = ['animated-logo', 'video-intro'].includes(input.assetType);
    const dimensions = ASSET_DIMENSIONS[input.assetType];

    if (isVideoAsset) {
      return this.generateVideoAsset(input, project, dimensions);
    }

    const res = await apiFetch('/api/imager/generate-asset', {
      method: 'POST',
      timeoutMs: IMAGER_GENERATE_TIMEOUT_MS,
      body: JSON.stringify({
        projectId: input.projectId,
        assetType: input.assetType,
        customPrompt: input.customPrompt,
        additionalContext: input.additionalContext,
        output_language: input.output_language ?? project.output_language ?? 'fr',
      }),
    });

    const data = res.ok
      ? ((await res.json()) as {
          url?: string;
          error?: string;
          format?: string;
          prompt?: string;
          metadata?: Record<string, unknown>;
          thumbnailUrl?: string;
        })
      : null;

    if (!res.ok || !data?.url) {
      throw new Error(data?.error ?? (await parseApiError(res)));
    }

    return {
      id: crypto.randomUUID(),
      type: input.assetType,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl,
      width: dimensions.width,
      height: dimensions.height,
      format: data.format || 'png',
      createdAt: new Date().toISOString(),
      prompt: data.prompt,
      metadata: data.metadata,
    };
  },

  async generateVideoAsset(
    input: GenerateAssetInput,
    project: ImagerProject,
    dimensions: { width: number; height: number }
  ): Promise<GeneratedAsset> {
    const res = await apiFetch('/api/imager/generate-asset', {
      method: 'POST',
      timeoutMs: IMAGER_GENERATE_TIMEOUT_MS,
      body: JSON.stringify({
        projectId: input.projectId,
        assetType: input.assetType,
        customPrompt: input.customPrompt,
        additionalContext: input.additionalContext,
        output_language: input.output_language ?? project.output_language ?? 'fr',
      }),
    });
    const text = await res.text();
    let data: GenAssetApiResponse | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as GenAssetApiResponse;
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      throw new Error(data?.error || text || res.statusText);
    }
    if (!data?.url) {
      throw new Error('Réponse invalide pour la vidéo.');
    }
    const out = data;
    const url: string = out.url!;
    return {
      id: crypto.randomUUID(),
      type: input.assetType,
      url,
      thumbnailUrl: out.thumbnailUrl,
      width: dimensions.width,
      height: dimensions.height,
      format: 'mp4',
      createdAt: new Date().toISOString(),
      prompt: out.prompt,
      metadata: out.metadata,
    };
  },

  async animateAssetToVideo(
    projectId: string,
    sourceImageUrl: string,
    project: ImagerProject,
    _aspectRatio: '16:9' | '1:1' | '9:16' = '16:9',
    sourceWidth?: number,
    sourceHeight?: number
  ): Promise<GeneratedAsset> {
    const dimensions = ASSET_DIMENSIONS['animate-image'];
    const res = await apiFetch('/api/imager/generate-asset', {
      method: 'POST',
      timeoutMs: IMAGER_GENERATE_TIMEOUT_MS,
      body: JSON.stringify({
        projectId,
        assetType: 'animate-image',
        referenceImageUrl: sourceImageUrl,
        sourceWidth,
        sourceHeight,
        output_language: project.output_language ?? 'fr',
      }),
    });
    const text = await res.text();
    let data: GenAssetApiResponse | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as GenAssetApiResponse;
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      throw new Error(data?.error || text || res.statusText);
    }
    if (!data?.url) {
      throw new Error(data?.error || 'Réponse invalide pour la vidéo.');
    }
    const out = data;
    const url: string = out.url!;
    const w = typeof out.metadata?.width === 'number' ? out.metadata.width : sourceWidth ?? dimensions.width;
    const h = typeof out.metadata?.height === 'number' ? out.metadata.height : sourceHeight ?? dimensions.height;
    return {
      id: crypto.randomUUID(),
      type: 'animate-image',
      url,
      thumbnailUrl: out.thumbnailUrl,
      width: w,
      height: h,
      format: 'mp4',
      createdAt: new Date().toISOString(),
      prompt: out.prompt,
      metadata: out.metadata,
    };
  },

  async enrichContext(input: {
    brand_name: string;
    tone_of_voice?: string;
    brand_description?: string;
    target_audience?: string;
    keywords: string;
    existing_context?: string;
    custom_prompt_hint?: string;
  }): Promise<{ enriched: string }> {
    const res = await apiFetch('/api/imager/enrich-context', {
      method: 'POST',
      body: JSON.stringify({
        brand_name: input.brand_name,
        tone_of_voice: input.tone_of_voice,
        brand_description: input.brand_description,
        target_audience: input.target_audience,
        keywords: input.keywords,
        existing_context: input.existing_context,
        custom_prompt_hint: input.custom_prompt_hint,
      }),
    });
    const text = await res.text();
    let data: EnrichApiResponse | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as EnrichApiResponse;
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      throw new Error(data?.error || text || res.statusText);
    }
    if (!data?.enriched) {
      throw new Error('Réponse enrichissement invalide.');
    }
    return { enriched: data.enriched };
  },

  buildPrompt(
    assetType: AssetType,
    brandName: string,
    brandDescription?: string,
    toneOfVoice?: string,
    targetAudience?: string,
    customPrompt?: string
  ): string {
    const basePrompts: Record<AssetType, string> = {
      'facebook-ad': `Create a professional Facebook ad image for ${brandName}. ${brandDescription || ''} Target audience: ${targetAudience || 'professionals'}. Tone: ${toneOfVoice || 'professional'}. Include compelling visuals and space for ad copy.`,
      'instagram-post': `Design an eye-catching Instagram post for ${brandName}. ${brandDescription || ''} Style: modern, visually appealing, ${toneOfVoice || 'professional'}. Perfect for social media engagement.`,
      'instagram-story': `Create a dynamic Instagram story for ${brandName}. ${brandDescription || ''} Vertical format, bold and engaging, ${toneOfVoice || 'professional'} tone.`,
      'linkedin-post': `Design a square 1:1 LinkedIn feed post image for ${brandName}. ${brandDescription || ''} Business-appropriate, ${toneOfVoice || 'professional'}, targeting ${targetAudience || 'professionals'}.`,
      'linkedin-banner': `Create a professional LinkedIn banner for ${brandName}. ${brandDescription || ''} Corporate, sleek design, ${toneOfVoice || 'professional'} aesthetic.`,
      'twitter-post': `Design an engaging Twitter/X post image for ${brandName}. ${brandDescription || ''} Concise, impactful, ${toneOfVoice || 'professional'} style.`,
      'animated-logo': `Create an animated logo concept for ${brandName}. ${brandDescription || ''} Modern, dynamic, ${toneOfVoice || 'professional'} aesthetic. Show motion-ready design.`,
      'logo-remake': `Redesign the attached logo into a new, modern logo. Keep the same brand identity but create a fresh, professional logo. Output ONLY the new logo on a clean white or transparent background.`,
      'video-intro': `Design a video intro frame for ${brandName}. ${brandDescription || ''} Cinematic, professional, ${toneOfVoice || 'professional'} style. High-impact opening.`,
      'animate-image': `Animate an existing marketing visual for ${brandName}. ${brandDescription || ''} Subtle motion, preserve layout and branding. Tone: ${toneOfVoice || 'professional'}.`,
      'business-card': `Create a modern business card design for ${brandName}. ${brandDescription || ''} Professional, memorable, ${toneOfVoice || 'professional'} aesthetic.`,
      'email-signature': `Design a professional email signature banner for ${brandName}. ${brandDescription || ''} Clean, corporate, includes space for contact info.`,
      'presentation-template': `Create a presentation slide template for ${brandName}. ${brandDescription || ''} Professional, clean layout, ${toneOfVoice || 'professional'} design.`,
      'social-cover': `Design a social media cover image for ${brandName}. ${brandDescription || ''} Universal format, professional, ${toneOfVoice || 'professional'} aesthetic.`,
      'brand-icon': `Create a single premium 3D icon or pictogram for ${brandName}. ${brandDescription || ''} The icon must visually represent the business sector (e.g. digital/tech: globe, microchip, digital elements; medical: people, brain, medical tools; etc.). Style: modern 3D, premium, one clear icon on transparent or soft background, suitable for app/UI. ${toneOfVoice || 'professional'}.`,
    };

    const basePrompt = basePrompts[assetType];
    return customPrompt ? `${basePrompt}\n\nAdditional requirements: ${customPrompt}` : basePrompt;
  },
};
