const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const TOKEN_KEY = 'revamperr_token';
const GUEST_TOKEN_KEY = 'revamperr_guest_token';

/** Évite un chargement infini si l’API / Prisma ne répond pas (pool bloqué, etc.). */
const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

/** Extension de RequestInit permettant de surcharger le timeout par requête (ex: 10 min pour la gen vidéo Grok). */
export type ApiRequestInit = RequestInit & { timeoutMs?: number };

async function fetchWithTimeout(url: string, init: ApiRequestInit = {}): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...rest, signal: rest.signal ?? controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export function getApiBase(): string {
  return API;
}

/** Origine HTTP pour les fichiers sous `/uploads` (jamais le suffixe `/api` de VITE_API_URL). */
function originForStaticFiles(): string {
  let base = API.replace(/\/$/, '');
  base = base.replace(/\/api\/?$/i, '');
  try {
    if (base.startsWith('http://') || base.startsWith('https://')) {
      return new URL(base).origin;
    }
  } catch {
    /* ignore */
  }
  return base.startsWith('http') ? base : `http://${base}`;
}

/**
 * URL utilisable dans <img src> / fetch pour les médias stockés sous `/uploads/...`.
 * En dev (Vite), préfère la même origine que la page + proxy `/uploads` pour éviter 404 / CORS.
 */
export function resolveMediaUrl(stored: string | null | undefined): string {
  if (stored == null || stored === '') return '';
  const s = stored.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) {
    if (typeof window !== 'undefined' && import.meta.env.DEV && s.startsWith('/uploads/')) {
      return `${window.location.origin}${s}`;
    }
    return `${originForStaticFiles()}${s}`;
  }
  return `${originForStaticFiles()}/${s.replace(/^\/+/, '')}`;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getGuestToken(): string | null {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function setGuestToken(token: string | null): void {
  if (token) localStorage.setItem(GUEST_TOKEN_KEY, token);
  else localStorage.removeItem(GUEST_TOKEN_KEY);
}

/** JWT à envoyer aux API : compte utilisateur prioritaire, sinon invité. */
export function getAuthBearerToken(): string | null {
  return getAccessToken() ?? getGuestToken();
}

/** Crée une session invité côté API si aucune n’existe. */
export async function ensureGuestSession(): Promise<string> {
  const existing = getGuestToken();
  if (existing) return existing;
  const url = `${API}/api/guest/session`;
  const res = await fetchWithTimeout(url, { method: 'POST' });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j?.error === 'string') msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as { token: string };
  setGuestToken(data.token);
  return data.token;
}

export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const userToken = getAccessToken();
  const guestToken = getGuestToken();
  const headers = new Headers(init.headers);
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (userToken) headers.set('Authorization', `Bearer ${userToken}`);
  else if (guestToken) headers.set('Authorization', `Bearer ${guestToken}`);
  const url = path.startsWith('http') ? path : `${API}${path.startsWith('/') ? path : `/${path}`}`;
  return fetchWithTimeout(url, { ...init, headers });
}

export async function apiJson<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j?.error === 'string') msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
