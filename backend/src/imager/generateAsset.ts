import fs from 'fs/promises';
import path from 'path';
import '../loadEnv';
import { backendRoot } from '../loadEnv';
import {
  buildImagerPrompt,
  ASSET_DIMENSIONS,
  LOGO_SAFE_ZONE_RULE,
  languageInstructionForPrompt,
  imagerGlobalRulesForAssetType,
  type AssetType,
} from './buildPrompt';
import {
  fetchImageAsPngDataUri,
  xaiImageEdit,
  xaiVideoFromImage,
  pickVideoAspectRatio,
  xaiAspectRatioFromDimensions,
} from './xaiImagine';
import { readUploadsFileBuffer } from './resolveUploadsFile';
import sharp from 'sharp';
import { normalizeImageBufferForAsset } from './normalizeAssetImage';
import {
  computeLuminanceStdDev,
  DEFAULT_BLANK_STD_DEV_THRESHOLD,
  isProbablyUniformOutput,
} from './imageUniformity';

const VIDEO_TYPES = new Set(['animated-logo', 'video-intro', 'animate-image']);

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const local = await readUploadsFileBuffer(url);
  if (local) return local;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement logo: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function normalizeImageForAsset(
  imagePath: string,
  width: number,
  height: number,
  assetType: string
): Promise<void> {
  const raw = await fs.readFile(imagePath);
  const out = await normalizeImageBufferForAsset(raw, width, height, assetType);
  await fs.writeFile(imagePath, out);

  if (process.env.IMAGER_REJECT_UNIFORM_OUTPUT === '1') {
    const std = await computeLuminanceStdDev(out);
    if (isProbablyUniformOutput(std, DEFAULT_BLANK_STD_DEV_THRESHOLD)) {
      const err = new Error(
        `Sortie image trop uniforme (écart-type luminance ${std.toFixed(1)} < ${DEFAULT_BLANK_STD_DEV_THRESHOLD}). Régénérez ou vérifiez le prompt / le logo source.`
      );
      (err as Error & { status: number }).status = 422;
      throw err;
    }
  }
}

/** Optionnel : petit watermark si l’édition Imagine n’a pas bien placé le logo (désactivé par défaut quand on utilise edits). */
async function overlayLogoIfPresent(
  imagePath: string,
  logoUrl: string | undefined,
  width: number,
  height: number,
  assetType: string,
  skip: boolean
): Promise<boolean> {
  if (skip || !logoUrl) return false;
  if (assetType === 'logo-remake') return false;

  const logoBuffer = await downloadBuffer(logoUrl);
  const maxLogoW = Math.max(96, Math.round(width * 0.18));
  const maxLogoH = Math.max(96, Math.round(height * 0.18));
  const logoPng = await sharp(logoBuffer).resize({ width: maxLogoW, height: maxLogoH, fit: 'inside' }).png().toBuffer();
  const logoMeta = await sharp(logoPng).metadata();
  const logoW = logoMeta.width ?? maxLogoW;
  const logoH = logoMeta.height ?? maxLogoH;
  const margin = Math.max(16, Math.round(Math.min(width, height) * 0.025));

  const composed = await sharp(imagePath)
    .composite([
      {
        input: logoPng,
        left: Math.max(0, width - logoW - margin),
        top: Math.max(0, height - logoH - margin),
      },
    ])
    .png()
    .toBuffer();
  await fs.writeFile(imagePath, composed);
  return true;
}

export async function runImagerGenerate(params: {
  assetType: string;
  brandName: string;
  brandColors?: Record<string, unknown>;
  brandDescription?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  /** ISO 639-1 (fr, en, …) — texte dans le visuel */
  outputLanguage?: string;
  customPrompt?: string;
  additionalContext?: string;
  referenceImageUrl?: string;
  /** Pour `animate-image` : dimensions de l’image source (asset cliqué). */
  sourceWidth?: number;
  sourceHeight?: number;
  projectId: string;
}): Promise<{
  url: string;
  format: string;
  prompt: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}> {
  const { assetType, projectId } = params;
  const provider = 'grok' as const;
  const isVideo = VIDEO_TYPES.has(assetType);
  const hasSourceImage = Boolean(params.referenceImageUrl);
  if (!hasSourceImage) {
    const err = new Error("Logo officiel requis: uploadez d'abord le logo de marque pour générer des assets.");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  let prompt: string;
  if (assetType === 'animate-image') {
    prompt = `Animate this existing marketing visual for ${params.brandName}. ${params.brandDescription ? `${params.brandDescription} ` : ''}Apply subtle, professional motion suitable for social media. Preserve composition, typography, colors, and all visible branding. VIDEO: Use uniform scaling only—do not stretch or squash the artwork (no non-uniform scaling). If the output aspect ratio differs from the source image, use letterboxing or pillarboxing so the frame is never deformed. The full logo and all text must remain fully visible and uncropped for the entire clip.`;
    if (params.customPrompt?.trim()) prompt += ` Additional direction: ${params.customPrompt.trim()}.`;
    if (params.additionalContext?.trim()) prompt += ` Context: ${params.additionalContext.trim()}.`;
    prompt += `\n\n${languageInstructionForPrompt(params.outputLanguage)}`;
    prompt += imagerGlobalRulesForAssetType('animate-image', params.brandName);
    prompt += `\n\n${LOGO_SAFE_ZONE_RULE}`;
  } else {
    prompt = buildImagerPrompt(
      assetType,
      params.brandName,
      params.brandDescription,
      params.toneOfVoice,
      params.targetAudience,
      params.customPrompt,
      params.additionalContext,
      params.outputLanguage
    );
    prompt +=
      '\n\nReference image: follow the BRAND MARK rules above; integrate the supplied artwork faithfully in layouts (banner, post, card, etc.).';
  }

  const dim =
    assetType === 'animate-image' && params.sourceWidth && params.sourceHeight
      ? { width: params.sourceWidth, height: params.sourceHeight }
      : ASSET_DIMENSIONS[assetType as AssetType] ?? ASSET_DIMENSIONS['instagram-post'];

  const dir = path.join(backendRoot, 'uploads', 'imager', projectId);
  await fs.mkdir(dir, { recursive: true });
  const baseName = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // ——— Grok Imagine uniquement : image + vidéo à partir du logo ———
  const sourceDataUri = await fetchImageAsPngDataUri(params.referenceImageUrl!);

  if (isVideo) {
    const videoNoDeform =
      'CRITICAL (video): Uniform scaling only—never stretch or squash the source artwork (no non-uniform scaling; preserve aspect ratio). If the video frame aspect ratio differs from the source image, use letterboxing or pillarboxing. The logo and all on-image text must remain fully visible and uncropped for the entire duration.';
    let videoPrompt: string;
    if (assetType === 'animated-logo') {
      videoPrompt = `${prompt}\n\nAnimate this logo: subtle professional motion, loop-friendly, preserve exact logo artwork. ${videoNoDeform}`;
    } else if (assetType === 'animate-image') {
      videoPrompt = `${prompt}\n\nMotion: smooth, on-brand; do not distort text or key layout elements. ${videoNoDeform}`;
    } else {
      videoPrompt = `${prompt}\n\nCinematic intro motion based on this brand visual; keep logo/branding recognizable. ${videoNoDeform}`;
    }

    const ar = pickVideoAspectRatio(dim.width, dim.height);
    const { videoUrl } = await xaiVideoFromImage({
      prompt: videoPrompt,
      imageUrl: sourceDataUri,
      aspectRatio: ar,
      durationSec: assetType === 'animated-logo' ? 6 : 8,
      resolution: '720p',
    });

    const videoPath = path.join(dir, `${baseName}.mp4`);
    await downloadToFile(videoUrl, videoPath);

    const videoRel = `/uploads/imager/${projectId}/${path.basename(videoPath)}`;
    return {
      url: videoRel,
      thumbnailUrl: params.referenceImageUrl,
      format: 'mp4',
      prompt: videoPrompt,
      metadata: {
        width: dim.width,
        height: dim.height,
        provider,
        assetType,
        imagine: 'video',
        xaiAspectRatio: ar,
      },
    };
  }

  const aspectRatio = xaiAspectRatioFromDimensions(dim.width, dim.height);

  // Images : édition / transformation à partir du logo (API officielle)
  const { url: remoteUrl } = await xaiImageEdit({
    prompt,
    sourceDataUri,
    aspectRatio,
    quality: 'high',
  });

  const filePath = path.join(dir, `${baseName}.png`);
  await downloadToFile(remoteUrl, filePath);
  await normalizeImageForAsset(filePath, dim.width, dim.height, assetType);
  const logoApplied = await overlayLogoIfPresent(
    filePath,
    params.referenceImageUrl,
    dim.width,
    dim.height,
    assetType,
    true
  );

  const rel = `/uploads/imager/${projectId}/${path.basename(filePath)}`;

  return {
    url: rel,
    format: 'png',
    prompt,
    metadata: {
      width: dim.width,
      height: dim.height,
      provider,
      assetType,
      imagine: 'image_edit',
      logoApplied,
      xaiAspectRatio: aspectRatio,
    },
  };
}
