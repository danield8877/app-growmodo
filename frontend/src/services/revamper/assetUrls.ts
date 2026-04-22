import { getApiBase } from '../../lib/api';

/**
 * Les refontes stockent souvent des URLs racine `/uploads/...`.
 * En dev, l'app tourne sur :5173 et l'API sur :3001, donc on force
 * ces chemins à pointer vers le backend.
 *
 * Aperçu public (`/revamper/public/:id`) : si les images ne s’affichent pas en prod,
 * vérifier `VITE_API_URL` / `getApiBase()` et CORS sur `GET /api/revamper/share/:id`
 * (un nouveau projet sur la base Coolify actuelle est le bon test de validation).
 */
export function absolutizeUploadsUrls(input: string): string {
  if (!input) return input;
  const apiBase = getApiBase().replace(/\/$/, '');
  const uploadsBase = `${apiBase}/uploads/`;

  // Réécriture conservatrice pour éviter de casser du CSS/JS arbitraire :
  // on ne touche que les attributs HTML d'assets.
  const withAttrs = input.replace(
    /((?:src|href|poster)\s*=\s*["'])\/uploads\//gi,
    `$1${uploadsBase}`
  );
  const withSrcset = withAttrs.replace(
    /((?:srcset)\s*=\s*["'][^"']*)\/uploads\//gi,
    `$1${uploadsBase}`
  );
  return withSrcset;
}

export function absolutizeUploadsUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/uploads/')) return url;
  const apiBase = getApiBase().replace(/\/$/, '');
  return `${apiBase}${url}`;
}
