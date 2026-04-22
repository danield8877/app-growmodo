import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { xaiVideoFromImage } from '../imager/xaiImagine';
import { getTypeLabelEn } from './siteAnalysis';
import type { SiteData } from './siteContent';

function getGrokKey(): string | undefined {
  return process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim();
}

/** Vidéo hero activée si clé Grok présente et pas désactivée explicitement (REVAMPER_HERO_VIDEO=false). */
export function isRevamperHeroVideoEnabled(): boolean {
  if (!getGrokKey()) return false;
  const v = process.env.REVAMPER_HERO_VIDEO?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
  return true;
}

/** Prompt motion vidéo dérivé du site (référence image = capture Stitch). */
export function buildHeroVideoPrompt(site: SiteData): string {
  const sector = getTypeLabelEn(site.type);
  const snippet = site.contentExcerpt.slice(0, 550).replace(/\s+/g, ' ').trim();
  const desc = site.description?.slice(0, 220) || '';
  return `Subtle cinematic background motion for a professional marketing page hero. Sector: ${sector}. Site: "${site.title.slice(0, 120)}". ${desc ? `Context: ${desc} ` : ''}${snippet ? `Themes and vocabulary from the real site: ${snippet}` : ''}

Motion: very slow, smooth movement only—gentle drift, soft light shift, or minimal parallax. Realistic, corporate, trustworthy. Absolutely NO cartoon or illustration look, NO anime, NO 3D mascot characters, NO glitch effects, NO morphing typography, NO surreal or AI-art aesthetic. Do not introduce new objects, characters, or unrelated symbolic scenery—only subtle motion on the existing frame. Preserve the overall layout and color feel of the reference frame. The result must loop cleanly for autoplay muted on a website hero.`.slice(
    0,
    7900
  );
}

async function filePathToPngDataUri(absPath: string): Promise<string> {
  const buf = await fs.readFile(absPath);
  const png = await sharp(buf).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function downloadVideo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement vidéo: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

/**
 * Génère une courte vidéo MP4 (Grok Imagine) à partir de la capture Stitch, sauvegardée localement.
 * @returns chemin public `/uploads/revamper/...` ou null si désactivé / erreur
 */
export async function generateHeroBackgroundVideo(params: {
  site: SiteData;
  screenshotPath: string;
  uploadsRoot: string;
  projectId: string;
}): Promise<string | null> {
  if (!isRevamperHeroVideoEnabled()) return null;

  const durationSec = Math.min(12, Math.max(4, Number(process.env.REVAMPER_HERO_VIDEO_DURATION_SEC ?? 6)));
  const resolution = (process.env.REVAMPER_HERO_VIDEO_RESOLUTION as '480p' | '720p') || '720p';

  const prompt = buildHeroVideoPrompt(params.site);
  const imageDataUri = await filePathToPngDataUri(params.screenshotPath);

  const { videoUrl } = await xaiVideoFromImage({
    prompt,
    imageUrl: imageDataUri,
    aspectRatio: '16:9',
    durationSec,
    resolution,
  });

  const dir = path.join(params.uploadsRoot, 'revamper', params.projectId, 'assets');
  await fs.mkdir(dir, { recursive: true });
  const fileName = `hero-bg-${Date.now()}.mp4`;
  const outPath = path.join(dir, fileName);
  await downloadVideo(videoUrl, outPath);

  return `/uploads/revamper/${encodeURIComponent(params.projectId)}/assets/${encodeURIComponent(fileName)}`;
}
