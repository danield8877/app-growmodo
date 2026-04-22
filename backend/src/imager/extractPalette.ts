import sharp from 'sharp';
import { readUploadsFileBuffer } from './resolveUploadsFile';

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorDist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Extrait une palette primary / secondary / accent à partir d’un fichier déjà sous `/uploads/...`. */
export async function extractPaletteFromImageUrl(imageUrl: string): Promise<{
  primary: string;
  secondary: string;
  accent: string;
}> {
  const buf = await readUploadsFileBuffer(imageUrl);
  if (!buf) throw new Error('Image introuvable ou chemin invalide.');

  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += ch) {
    const a = ch === 4 ? data[i + 3] : 255;
    if (a < 28) continue;
    const qr = Math.floor(data[i] / 28) * 28;
    const qg = Math.floor(data[i + 1] / 28) * 28;
    const qb = Math.floor(data[i + 2] / 28) * 28;
    const key = `${qr},${qg},${qb}`;
    const cur = buckets.get(key);
    if (cur) {
      cur.r += data[i];
      cur.g += data[i + 1];
      cur.b += data[i + 2];
      cur.count += 1;
    } else {
      buckets.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], count: 1 });
    }
  }

  const centroids = [...buckets.values()].map((b) => ({
    r: b.r / b.count,
    g: b.g / b.count,
    b: b.b / b.count,
    count: b.count,
  }));

  centroids.sort((a, b) => b.count - a.count);

  const distinct: typeof centroids = [];
  for (const c of centroids) {
    if (distinct.length >= 12) break;
    if (distinct.every((d) => colorDist(d, c) > 35)) distinct.push(c);
  }

  const primary = distinct[0] ?? { r: 0, g: 102, b: 204, count: 1 };
  const lightest =
    [...distinct].sort((a, b) => luminance(b.r, b.g, b.b) - luminance(a.r, a.g, a.b))[0] ?? primary;
  const secondary =
    luminance(lightest.r, lightest.g, lightest.b) > luminance(primary.r, primary.g, primary.b) + 20
      ? lightest
      : { r: 250, g: 250, b: 252, count: 1 };

  let accent = distinct.find((d) => colorDist(d, primary) > 55) ?? distinct[1] ?? { r: 20, g: 20, b: 28, count: 1 };
  if (colorDist(accent, primary) < 40 && distinct[2]) accent = distinct[2];

  return {
    primary: rgbToHex(primary.r, primary.g, primary.b),
    secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
    accent: rgbToHex(accent.r, accent.g, accent.b),
  };
}
