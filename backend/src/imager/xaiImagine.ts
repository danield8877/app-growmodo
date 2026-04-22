import sharp from 'sharp';
import { readUploadsFileBuffer } from './resolveUploadsFile';
import type { XaiImageAspectRatio } from './xaiAspectRatios';

const XAI_BASE = 'https://api.x.ai/v1';

export type { XaiImageAspectRatio } from './xaiAspectRatios';
export { xaiAspectRatioFromDimensions } from './xaiAspectRatios';

export function getXaiApiKey(): string {
  const k = process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim();
  if (!k) throw new Error('GROK_API_KEY (ou XAI_API_KEY) manquant dans backend/.env.');
  return k;
}

/** Télécharge l’image (localhost OK) et renvoie une data URI PNG pour les APIs xAI (évite les URLs non joignables par leurs serveurs). */
export async function fetchImageAsPngDataUri(imageUrl: string): Promise<string> {
  const local = await readUploadsFileBuffer(imageUrl);
  if (local) {
    const png = await sharp(local).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  }
  if (imageUrl.trim().startsWith('/uploads/')) {
    throw new Error(`Fichier local introuvable pour: ${imageUrl}`);
  }
  const buf = Buffer.from(await fetchRemoteBuffer(imageUrl));
  const png = await sharp(buf).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function fetchRemoteBuffer(imageUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Téléchargement image source: ${res.status}`);
  return await res.arrayBuffer();
}

/** Créativité contrôlée par le prompt uniquement — l’API xAI images ne documente pas de paramètre `temperature`. */
export async function xaiImageEdit(params: {
  prompt: string;
  sourceDataUri: string;
  aspectRatio?: XaiImageAspectRatio;
  quality?: 'low' | 'medium' | 'high';
}): Promise<{ url: string }> {
  const key = getXaiApiKey();
  const body: Record<string, unknown> = {
    model: 'grok-imagine-image',
    prompt: params.prompt.slice(0, 8000),
    image: {
      url: params.sourceDataUri,
      type: 'image_url',
    },
    aspect_ratio: params.aspectRatio ?? 'auto',
  };
  if (params.quality) body.quality = params.quality;
  const res = await fetch(`${XAI_BASE}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Grok image edit: ${res.status} ${text.slice(0, 400)}`);
  const data = JSON.parse(text) as { data?: { url?: string }[] };
  const u = data?.data?.[0]?.url;
  if (!u) throw new Error('Réponse Grok image edit invalide.');
  return { url: u };
}

/** Génération texte → image (plusieurs variantes en un appel, rapide avec quality medium). */
export async function xaiImageGenerations(params: {
  prompt: string;
  n: number;
  aspectRatio?: string;
  quality?: 'low' | 'medium' | 'high';
}): Promise<string[]> {
  const key = getXaiApiKey();
  const res = await fetch(`${XAI_BASE}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-imagine-image',
      prompt: params.prompt.slice(0, 8000),
      n: Math.min(Math.max(params.n, 1), 10),
      aspect_ratio: params.aspectRatio ?? '1:1',
      quality: params.quality ?? 'medium',
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Grok image generations: ${res.status} ${text.slice(0, 400)}`);
  const data = JSON.parse(text) as { data?: { url?: string }[] };
  const urls = (data.data ?? []).map((d) => d?.url).filter((u): u is string => Boolean(u));
  if (urls.length === 0) throw new Error('Aucune image générée (réponse vide).');
  return urls;
}

/** Ratios supportés par l’API vidéo xAI */
export type XaiVideoAspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';

export function pickVideoAspectRatio(w: number, h: number): XaiVideoAspect {
  const r = w / h;
  if (Math.abs(r - 1) < 0.08) return '1:1';
  if (r < 0.85) return '9:16';
  return '16:9';
}

export async function xaiVideoFromImage(params: {
  prompt: string;
  /** Data URI ou URL HTTPS publique */
  imageUrl: string;
  aspectRatio: XaiVideoAspect;
  durationSec?: number;
  resolution?: '480p' | '720p';
}): Promise<{ videoUrl: string; durationSec?: number }> {
  const key = getXaiApiKey();
  const body: Record<string, unknown> = {
    model: 'grok-imagine-video',
    prompt: params.prompt.slice(0, 8000),
    image: { url: params.imageUrl },
    aspect_ratio: params.aspectRatio,
    duration: params.durationSec ?? 8,
    resolution: params.resolution ?? '720p',
  };

  const post = await fetch(`${XAI_BASE}/videos/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const postText = await post.text();
  if (!post.ok) throw new Error(`Grok vidéo (start): ${post.status} ${postText.slice(0, 400)}`);
  const { request_id: requestId } = JSON.parse(postText) as { request_id?: string };
  if (!requestId) throw new Error('Grok vidéo: pas de request_id.');

  const maxAttempts = 150;
  const intervalMs = 4000;
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(`${XAI_BASE}/videos/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(60_000),
    });
    const t = await r.text();
    let data: {
      status?: string;
      video?: { url?: string | null; duration?: number };
      error?: { message?: string };
    };
    try {
      data = JSON.parse(t) as typeof data;
    } catch {
      throw new Error(`Grok vidéo (poll): réponse invalide ${t.slice(0, 200)}`);
    }
    if (data.status === 'done' && data.video?.url) {
      return { videoUrl: data.video.url, durationSec: data.video.duration };
    }
    if (data.status === 'failed' || data.status === 'expired') {
      throw new Error(data.error?.message || `Grok vidéo: ${data.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timeout: génération vidéo Grok Imagine (essayez une durée plus courte).');
}
