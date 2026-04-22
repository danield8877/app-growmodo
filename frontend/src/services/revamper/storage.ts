import { apiJson, apiFetch, getAccessToken, getGuestToken, getApiBase } from '../../lib/api';
import type { RevamperResult, RevamperAnalysis } from './types';

export type RevamperJobStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

export type RevamperQueueSnapshot = {
  maxConcurrency: number;
  maxPerUser: number;
  activeWorkers: number;
  pendingOrder: string[];
  runningIds: string[];
};

export type RevamperDashboardRow = RevamperProject & {
  queue_position: number | null;
  is_running: boolean;
};

export type RevamperJobMeta = {
  status?: RevamperJobStatus;
  step?: string;
  label?: string;
  detail?: string;
  elapsedMs?: number;
  error?: string;
  updatedAt?: string;
};

export interface RevamperProject {
  id: string;
  user_id: string | null;
  guest_session_id?: string | null;
  title: string;
  source_url: string | null;
  analysis: (Partial<RevamperAnalysis> & Record<string, unknown>) & { __job?: RevamperJobMeta };
  html: string;
  css: string;
  js: string;
  model_id: string | null;
  style_preference: string | null;
  status: RevamperJobStatus;
  created_at: string;
  updated_at: string;
}

function requireAuthOrGuest(): void {
  if (!getAccessToken() && !getGuestToken()) throw new Error('Connexion ou session invité requise.');
}

export async function createRevampPendingForImage(
  imageDataUrl: string,
  title: string = 'Génération en cours…'
): Promise<RevamperProject> {
  requireAuthOrGuest();
  const analysis = {
    lang: 'fr',
    title,
    colors: { primary: '#2563eb', background: '#ffffff', text: '#1f2937' },
    menuItems: [] as { label: string; href: string }[],
    contentSnippets: [] as string[],
    generatedImageUrl: imageDataUrl,
    generatingCode: true,
  };

  return apiJson<RevamperProject>('/api/revamper', {
    method: 'POST',
    body: JSON.stringify({
      title,
      source_url: null,
      analysis,
      html: '',
      css: '',
      js: '',
      model_id: null,
      style_preference: null,
    }),
  });
}

export async function saveRevamp(
  result: RevamperResult,
  sourceUrl: string | null,
  modelId?: string,
  stylePreference?: string
): Promise<RevamperProject> {
  requireAuthOrGuest();
  const title = result.analysis?.title || 'Nouvelle refonte';
  return apiJson<RevamperProject>('/api/revamper', {
    method: 'POST',
    body: JSON.stringify({
      title,
      source_url: sourceUrl ?? null,
      analysis: result.analysis || {},
      html: result.html || '',
      css: result.css || '',
      js: result.js || '',
      model_id: modelId || null,
      style_preference: stylePreference || null,
    }),
  });
}

export async function optimizeRevampPrompt(prompt: string): Promise<string> {
  requireAuthOrGuest();
  const res = await apiJson<{ prompt: string }>('/api/revamper/optimize-prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  return res.prompt;
}

export type RevamperSourceLang = 'en' | 'fr' | 'de' | 'es' | 'it';

export async function enqueueRevampJob(input: {
  url: string;
  stylePreference?: string;
  sections?: string[];
  /** Consignes principales (sauvegardées). */
  baseInstructions?: string;
  /** Consignes complémentaires pour cette génération. */
  supplementaryInstructions?: string;
  /** Active le switcher multi-langue (EN/DE/FR/ES via Claude Opus). */
  enableI18n?: boolean;
  /** Langue source du contenu généré (défaut 'en'). */
  sourceLang?: RevamperSourceLang;
  /** @deprecated envoyer baseInstructions */
  additionalInstructions?: string;
}): Promise<RevamperProject> {
  requireAuthOrGuest();
  const base =
    input.baseInstructions?.trim() ||
    input.additionalInstructions?.trim() ||
    undefined;
  const sup = input.supplementaryInstructions?.trim() || undefined;
  return apiJson<RevamperProject>('/api/revamper/jobs/enqueue', {
    method: 'POST',
    body: JSON.stringify({
      url: input.url.trim(),
      stylePreference: input.stylePreference || undefined,
      sections: input.sections?.length ? input.sections : undefined,
      baseInstructions: base,
      supplementaryInstructions: sup,
      enableI18n: input.enableI18n === true ? true : undefined,
      sourceLang: input.enableI18n ? input.sourceLang ?? 'en' : undefined,
    }),
  });
}

export async function getRevamps(): Promise<RevamperProject[]> {
  requireAuthOrGuest();
  return apiJson<RevamperProject[]>('/api/revamper');
}

export async function fetchRevamperJobsDashboard(): Promise<{
  queue: RevamperQueueSnapshot;
  projects: RevamperDashboardRow[];
}> {
  requireAuthOrGuest();
  return apiJson('/api/revamper/jobs/dashboard');
}

export async function cancelQueuedRevampJob(projectId: string): Promise<{
  queue: RevamperQueueSnapshot;
  project: RevamperProject | null;
}> {
  requireAuthOrGuest();
  return apiJson(`/api/revamper/jobs/${encodeURIComponent(projectId)}/cancel`, {
    method: 'POST',
  });
}

export async function getRevamp(id: string): Promise<RevamperProject | null> {
  requireAuthOrGuest();
  try {
    return await apiJson<RevamperProject>(`/api/revamper/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

/** Aperçu public (sans compte) — lien de partage. */
export async function getRevampPublic(id: string): Promise<RevamperProject | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/revamper/share/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as RevamperProject;
  } catch {
    return null;
  }
}

export async function deleteRevamp(id: string): Promise<void> {
  requireAuthOrGuest();
  const res = await apiFetch(`/api/revamper/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || 'Suppression impossible');
  }
}

export async function updateRevampTitle(id: string, title: string): Promise<void> {
  requireAuthOrGuest();
  await apiJson(`/api/revamper/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function updateRevampCode(
  id: string,
  code: { html: string; css: string; js: string }
): Promise<void> {
  requireAuthOrGuest();
  await apiJson(`/api/revamper/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ html: code.html ?? '', css: code.css ?? '', js: code.js ?? '' }),
  });
}

/** Upload d’image pour l’éditeur visuel (dossier assets du projet). */
export async function uploadRevamperEditorAsset(id: string, file: File): Promise<string> {
  requireAuthOrGuest();
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiFetch(`/api/revamper/${encodeURIComponent(id)}/upload-asset`, { method: 'POST', body: fd });
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try {
      const j = JSON.parse(t) as { error?: string };
      if (typeof j?.error === 'string') msg = j.error;
    } catch {
      /* keep */
    }
    throw new Error(msg || 'Upload impossible');
  }
  const j = (await res.json()) as { url: string };
  if (!j.url) {
    throw new Error('Réponse upload invalide');
  }
  return j.url;
}

export function parsePastedCode(fullHtml: string): { html: string; css: string; js: string } {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const styles: string[] = [];
  const scripts: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = styleRegex.exec(fullHtml)) !== null) styles.push(sm[1].trim());
  while ((sm = scriptRegex.exec(fullHtml)) !== null) scripts.push(sm[1].trim());
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch
    ? bodyMatch[1].trim()
    : fullHtml.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').trim();
  return {
    html: bodyContent,
    css: styles.join('\n\n') || '/* no styles */',
    js: scripts.join('\n\n') || '// no script',
  };
}

export async function saveRevampFromCode(
  code: { html: string; css: string; js: string },
  title?: string,
  options?: { modelId?: string; sourceUrl?: string | null }
): Promise<RevamperProject> {
  requireAuthOrGuest();
  const analysis = {
    lang: 'fr',
    title: title || 'Refonte depuis code',
    colors: { primary: '#2563eb', background: '#ffffff', text: '#1f2937' },
    menuItems: [] as { label: string; href: string }[],
    contentSnippets: [] as string[],
  };
  return apiJson<RevamperProject>('/api/revamper', {
    method: 'POST',
    body: JSON.stringify({
      title: analysis.title,
      source_url: options?.sourceUrl ?? null,
      analysis,
      html: code.html ?? '',
      css: code.css ?? '',
      js: code.js ?? '',
      model_id: options?.modelId ?? null,
      style_preference: null,
    }),
  });
}
