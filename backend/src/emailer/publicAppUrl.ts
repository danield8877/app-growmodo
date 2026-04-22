/**
 * Base URL du frontend (sans slash final), pour construire les liens /revamper/public/:id dans les emails.
 * Priorité : corps de requête (public_app_url) → PUBLIC_APP_URL → FRONTEND_URL → défaut dev.
 */
export function resolvePublicAppBase(clientOverride?: string | null): string | undefined {
  const raw = typeof clientOverride === 'string' ? clientOverride.trim() : '';
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }

  const fromEnv = (process.env.PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:5173';
  }

  return undefined;
}

export function buildRevamperPublicDemoUrl(
  projectId: string | null | undefined,
  base: string | undefined
): string | undefined {
  const b = base?.trim().replace(/\/$/, '');
  if (!b || !projectId) return undefined;
  return `${b}/revamper/public/${projectId}`;
}
