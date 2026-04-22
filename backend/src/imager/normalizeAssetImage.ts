import sharp from 'sharp';

/** Fond neutre si `contain` (sorties logo / icône seules). */
export const CONTAIN_PAD_BG = { r: 12, g: 14, b: 22, alpha: 1 };

/** Options Sharp alignées sur `generateAsset` — à garder synchro avec les tests. */
export function resizeOptionsForAsset(assetType: string, width: number, height: number): sharp.ResizeOptions {
  const logoOnly = assetType === 'logo-remake' || assetType === 'brand-icon';
  const fit = logoOnly ? 'contain' : 'cover';
  /** Bandeaux larges : le modèle place souvent le visuel utile vers le bas ; `south` évite le vide en haut après `cover`. */
  const position =
    assetType === 'linkedin-banner' || assetType === 'email-signature' ? 'south' : 'centre';
  return {
    width,
    height,
    fit,
    position: logoOnly ? 'centre' : position,
    ...(logoOnly ? { background: CONTAIN_PAD_BG } : {}),
  };
}

export async function normalizeImageBufferForAsset(
  input: Buffer,
  width: number,
  height: number,
  assetType: string
): Promise<Buffer> {
  return sharp(input).resize(resizeOptionsForAsset(assetType, width, height)).png().toBuffer();
}
