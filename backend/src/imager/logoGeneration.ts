import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { backendRoot } from '../loadEnv';
import { xaiImageGenerations } from './xaiImagine';
import { localFilePathFromUploadsUrl } from './resolveUploadsFile';

const LOGO_VARIANTS = 4;

export function buildLogoGenerationPrompt(params: {
  brandName: string;
  toneOfVoice?: string;
  userPrompt?: string;
}): string {
  const tone = params.toneOfVoice || 'professional';
  const hint = params.userPrompt?.trim() ? ` User hint: ${params.userPrompt.trim()}.` : '';
  return (
    `Professional logo design for the brand name "${params.brandName}". ` +
    `Brand tone: ${tone}.${hint} ` +
    `Output: a single clean logo mark or wordmark, centered, flat vector style, ` +
    `high contrast, readable at small sizes, square 1:1 composition. ` +
    `No device mockups, no photo backgrounds, no cluttered scenes. ` +
    `Prefer simple shapes or typography; limit decorative noise.`
  ).slice(0, 8000);
}

export async function runLogoDraftGeneration(params: {
  brandName: string;
  toneOfVoice?: string;
  userPrompt?: string;
}): Promise<{ draftId: string; urls: string[]; prompt: string }> {
  const prompt = buildLogoGenerationPrompt(params);
  const draftId = randomUUID();
  const outDir = path.join(backendRoot, 'uploads', 'imager', 'logo-drafts', draftId);
  await fs.mkdir(outDir, { recursive: true });

  const remoteUrls = await xaiImageGenerations({
    prompt,
    n: LOGO_VARIANTS,
    aspectRatio: '1:1',
    quality: 'medium',
  });

  const urls: string[] = [];
  for (let i = 0; i < remoteUrls.length; i++) {
    const remoteUrl = remoteUrls[i];
    const dest = path.join(outDir, `${i}.png`);
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`Téléchargement variante ${i + 1}: ${res.status}`);
    const fileBuf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, fileBuf);
    urls.push(`/uploads/imager/logo-drafts/${draftId}/${i}.png`);
  }

  return { draftId, urls, prompt };
}

const LOGO_DRAFT_RE = /^\/uploads\/imager\/logo-drafts\/[0-9a-f-]{36}\/\d+\.png$/i;

export function isLogoDraftUrl(url: string): boolean {
  return LOGO_DRAFT_RE.test(url.trim());
}

/** Copie un fichier brouillon vers le dossier projet et supprime le brouillon. */
export async function finalizeDraftLogoToProject(draftUrl: string, projectId: string): Promise<string | null> {
  if (!isLogoDraftUrl(draftUrl)) return null;
  const srcPath = localFilePathFromUploadsUrl(draftUrl);
  if (!srcPath) return null;
  try {
    await fs.access(srcPath);
  } catch {
    return null;
  }
  const destDir = path.join(backendRoot, 'uploads', 'imager', projectId);
  await fs.mkdir(destDir, { recursive: true });
  const destName = `logo-${Date.now()}.png`;
  const destPath = path.join(destDir, destName);
  await fs.copyFile(srcPath, destPath);
  const draftDir = path.dirname(srcPath);
  void fs.rm(draftDir, { recursive: true, force: true }).catch(() => {});
  return `/uploads/imager/${projectId}/${destName}`;
}
