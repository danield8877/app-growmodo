import type { CorsOptions } from 'cors';

/**
 * Origines CORS = domaine(s) exact(s) du frontend (schéma + host + port).
 * Ex. https://amen-design.fr,https://www.amen-design.fr,http://localhost:5173
 */
function buildAllowedOriginsList(): string[] {
  const fromVar = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (fromVar.length > 0) {
    return fromVar;
  }
  const app = process.env.PUBLIC_APP_URL?.trim();
  if (app && /^https?:\/\//i.test(app)) {
    try {
      return [new URL(app).origin];
    } catch {
      /* ignore */
    }
  }
  return [];
}

/**
 * CORS: si `CORS_ALLOWED_ORIGINS` ou `PUBLIC_APP_URL` fournit des origines, on restreint
 * (évite d’ouvrir l’API sur internet sans contrôle). Sinon en dev, tout le monde; en prod, warning.
 */
export function getCorsOptions(): CorsOptions {
  const allowed = buildAllowedOriginsList();

  if (allowed.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[cors] CORS_ALLOWED_ORIGINS et PUBLIC_APP_URL vides : CORS large (même comportement qu’avant). ' +
          'Définissez CORS_ALLOWED_ORIGINS (origines exactes du frontend) pour un déploiement serré.'
      );
    }
    return { origin: true };
  }

  return {
    origin(requestOrigin, callback) {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      if (allowed.includes(requestOrigin)) {
        callback(null, true);
        return;
      }
      // eslint-disable-next-line no-console
      console.warn(`[cors] origine refusée: ${requestOrigin} (autorisées: ${allowed.length})`);
      callback(null, false);
    },
  };
}
