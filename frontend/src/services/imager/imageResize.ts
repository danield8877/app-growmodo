import { resolveMediaUrl } from '../../lib/api';

/**
 * Redimensionne une image (URL) aux dimensions exactes du document.
 * Utilise un canvas : à exécuter côté navigateur.
 * L'image est centrée en "contain" avec fond blanc si le ratio source diffère.
 */
export async function resizeImageToBlob(
  imageUrl: string,
  width: number,
  height: number,
  mimeType: string = 'image/png'
): Promise<Blob> {
  const res = await fetch(resolveMediaUrl(imageUrl), { mode: 'cors' });
  if (!res.ok) throw new Error('Impossible de charger l\'image');
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, dx, dy, dw, dh);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Export canvas échoué'))),
      mimeType,
      0.92
    );
  });
}
