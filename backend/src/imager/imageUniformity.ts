import sharp from 'sharp';

/**
 * Écart-type de luminance sur une version réduite (détecte image quasi uniforme / « beige vide »).
 * ~0 = plat ; >10 = contenu varié (ordre de grandeur).
 */
export async function computeLuminanceStdDev(buffer: Buffer): Promise<number> {
  const data = await sharp(buffer)
    .resize(48, 48, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();

  let sum = 0;
  let sumSq = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return Math.sqrt(variance);
}

/** Seuil conservateur : en dessous, sortie suspecte (modèle ou recadrage). */
export const DEFAULT_BLANK_STD_DEV_THRESHOLD = 6;

export function isProbablyUniformOutput(stdDev: number, threshold = DEFAULT_BLANK_STD_DEV_THRESHOLD): boolean {
  return stdDev < threshold;
}
