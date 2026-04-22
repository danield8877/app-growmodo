import { prisma } from '../db';
import { runRevamperGeneration } from './generateHandler';
import type { ParsedUserInstructions } from './userInstructions';
import type { SupportedLang } from './i18nInjector';
import { JobStatus, type Prisma } from '../../generated/prisma/client';

type EnqueueRevamperJobInput = {
  projectId: string;
  /** Clé de concurrence (userId ou guest:sessionId). */
  queueOwnerKey: string;
  url: string;
  stylePreference?: string;
  sectionsOverride?: string[];
  /** Active le switcher multi-langue (Claude Opus). */
  enableI18n?: boolean;
  /** Langue source pour le switcher multi-langue. */
  sourceLang?: SupportedLang;
  /** Consignes principales + complément (persistées dans analysis). */
} & ParsedUserInstructions;

type ProgressPayload = {
  step: string;
  label: string;
  detail?: string;
  elapsedMs: number;
};

type JobMeta = {
  status: JobStatus;
  step?: string;
  label?: string;
  detail?: string;
  elapsedMs?: number;
  error?: string;
  updatedAt: string;
};

type JobLog = {
  at: string;
  status: JobStatus;
  label: string;
  detail?: string;
  step?: string;
  elapsedMs?: number;
};

type QueueJob = EnqueueRevamperJobInput;

const MAX_CONCURRENCY = Math.max(1, Number(process.env.REVAMPER_MAX_CONCURRENCY ?? 1));
const MAX_PER_USER = Math.max(1, Number(process.env.REVAMPER_MAX_PER_USER ?? 1));
const MAX_LOGS = Math.max(10, Number(process.env.REVAMPER_JOB_LOG_LIMIT ?? 80));

const pending: QueueJob[] = [];
const running = new Set<string>();
const queued = new Set<string>();
const userRunningCount = new Map<string, number>();

let activeWorkers = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

async function updateProjectAnalysis(projectId: string, patchMeta: JobMeta): Promise<void> {
  const row = await prisma.revamperProject.findUnique({
    where: { id: projectId },
    select: { analysis: true },
  });
  if (!row) return;
  const analysisObj = asObject(row.analysis);
  const prevJob = asObject(analysisObj.__job);
  const next: Record<string, unknown> = {
    ...analysisObj,
    __job: {
      ...prevJob,
      ...patchMeta,
    },
  };
  await prisma.revamperProject.update({
    where: { id: projectId },
    data: { analysis: next as Prisma.InputJsonValue },
  });
}

async function appendJobLog(projectId: string, entry: JobLog): Promise<void> {
  const row = await prisma.revamperProject.findUnique({
    where: { id: projectId },
    select: { analysis: true },
  });
  if (!row) return;
  const analysisObj = asObject(row.analysis);
  const current = Array.isArray(analysisObj.__jobLogs) ? analysisObj.__jobLogs : [];
  const nextLogs = [...current, entry].slice(-MAX_LOGS);
  const next: Record<string, unknown> = {
    ...analysisObj,
    __jobLogs: nextLogs,
  };
  await prisma.revamperProject.update({
    where: { id: projectId },
    data: { analysis: next as Prisma.InputJsonValue },
  });
}

async function getCurrentJobMeta(projectId: string): Promise<Record<string, unknown>> {
  const row = await prisma.revamperProject.findUnique({
    where: { id: projectId },
    select: { analysis: true },
  });
  if (!row) return {};
  const analysisObj = asObject(row.analysis);
  return asObject(analysisObj.__job);
}

async function updateProgress(projectId: string, status: JobStatus, p: ProgressPayload): Promise<void> {
  await prisma.revamperProject.update({
    where: { id: projectId },
    data: { status },
  });
  await updateProjectAnalysis(projectId, {
    status,
    step: p.step,
    label: p.label,
    detail: p.detail,
    elapsedMs: p.elapsedMs,
    updatedAt: nowIso(),
  });
  await appendJobLog(projectId, {
    at: nowIso(),
    status,
    label: p.label,
    detail: p.detail,
    step: p.step,
    elapsedMs: p.elapsedMs,
  });
}

function canRunForUser(queueOwnerKey: string): boolean {
  return (userRunningCount.get(queueOwnerKey) ?? 0) < MAX_PER_USER;
}

function incUser(queueOwnerKey: string): void {
  userRunningCount.set(queueOwnerKey, (userRunningCount.get(queueOwnerKey) ?? 0) + 1);
}

function decUser(queueOwnerKey: string): void {
  const next = (userRunningCount.get(queueOwnerKey) ?? 0) - 1;
  if (next <= 0) userRunningCount.delete(queueOwnerKey);
  else userRunningCount.set(queueOwnerKey, next);
}

async function executeJob(job: QueueJob): Promise<void> {
  running.add(job.projectId);
  queued.delete(job.projectId);
  activeWorkers += 1;
  incUser(job.queueOwnerKey);
  try {
    await updateProjectAnalysis(job.projectId, {
      status: JobStatus.RUNNING,
      label: 'Job démarré',
      detail: 'Traitement en cours…',
      updatedAt: nowIso(),
    });
    await appendJobLog(job.projectId, {
      at: nowIso(),
      status: JobStatus.RUNNING,
      label: 'Job démarré',
      detail: 'Traitement en cours…',
      step: 'job_start',
    });
    await prisma.revamperProject.update({
      where: { id: job.projectId },
      data: { status: JobStatus.RUNNING },
    });

    const result = await runRevamperGeneration({
      storageKey: job.queueOwnerKey,
      projectId: job.projectId,
      url: job.url,
      stylePreference: job.stylePreference,
      sectionsOverride: job.sectionsOverride,
      baseInstructions: job.baseInstructions,
      supplementaryInstructions: job.supplementaryInstructions,
      enableI18n: job.enableI18n,
      sourceLang: job.sourceLang,
      onProgress: (p) => {
        void updateProgress(job.projectId, JobStatus.RUNNING, p);
      },
    });

    const title =
      (result.analysis?.title && typeof result.analysis.title === 'string' ? result.analysis.title : null) ||
      'Refonte';
    const mergedAnalysis = {
      ...(asObject(result.analysis) as Record<string, unknown>),
      __job: {
        status: JobStatus.DONE,
        label: 'Terminé',
        detail: 'Refonte prête.',
        updatedAt: nowIso(),
      },
    };

    await prisma.revamperProject.update({
      where: { id: job.projectId },
      data: {
        title,
        analysis: mergedAnalysis as Prisma.InputJsonValue,
        html: result.html,
        css: result.css,
        js: result.js,
        status: JobStatus.DONE,
      },
    });
    await appendJobLog(job.projectId, {
      at: nowIso(),
      status: JobStatus.DONE,
      label: 'Terminé',
      detail: 'Refonte prête.',
      step: 'job_done',
    });
  } catch (e) {
    const msgRaw = e instanceof Error ? e.message : 'Erreur inconnue';
    const meta = await getCurrentJobMeta(job.projectId);
    const step = typeof meta.step === 'string' ? meta.step : '';
    const label = typeof meta.label === 'string' ? meta.label : '';
    const msg =
      msgRaw.startsWith('Timeout') && (step || label)
        ? `Timeout pendant ${label || step}. Réessayez (ou réduisez la concurrence).`
        : msgRaw;
    await prisma.revamperProject.update({
      where: { id: job.projectId },
      data: { status: JobStatus.FAILED },
    });
    await updateProjectAnalysis(job.projectId, {
      status: JobStatus.FAILED,
      label: 'Échec',
      detail: msg,
      error: msg,
      updatedAt: nowIso(),
    });
    await appendJobLog(job.projectId, {
      at: nowIso(),
      status: JobStatus.FAILED,
      label: 'Échec',
      detail: msg,
      step: 'job_failed',
    });
  } finally {
    running.delete(job.projectId);
    activeWorkers -= 1;
    decUser(job.queueOwnerKey);
    void pumpQueue();
  }
}

async function pumpQueue(): Promise<void> {
  if (activeWorkers >= MAX_CONCURRENCY) return;
  while (activeWorkers < MAX_CONCURRENCY && pending.length > 0) {
    const idx = pending.findIndex((j) => canRunForUser(j.queueOwnerKey));
    if (idx === -1) return;
    const [job] = pending.splice(idx, 1);
    void executeJob(job);
  }
}

/** Retire un projet de la file (avant suppression projet ou annulation). */
export function dequeueProjectFromQueue(projectId: string): void {
  const idx = pending.findIndex((j) => j.projectId === projectId);
  if (idx !== -1) pending.splice(idx, 1);
  queued.delete(projectId);
  void pumpQueue();
}

export type RevamperQueueSnapshot = {
  maxConcurrency: number;
  maxPerUser: number;
  activeWorkers: number;
  pendingOrder: string[];
  runningIds: string[];
};

export function getRevamperQueueSnapshot(): RevamperQueueSnapshot {
  return {
    maxConcurrency: MAX_CONCURRENCY,
    maxPerUser: MAX_PER_USER,
    activeWorkers,
    pendingOrder: pending.map((j) => j.projectId),
    runningIds: [...running],
  };
}

/**
 * Annule un job encore en file (QUEUED). Retourne ok si le job a été retiré ou marqué annulé.
 */
export async function cancelQueuedRevamperJob(
  projectId: string,
  queueOwnerKey: string
): Promise<{ ok: true } | { ok: false; error: 'not_queued' | 'running' | 'forbidden' | 'wrong_status' }> {
  const idx = pending.findIndex((j) => j.projectId === projectId);
  if (idx === -1) {
    if (running.has(projectId)) return { ok: false, error: 'running' };
    return { ok: false, error: 'not_queued' };
  }
  const job = pending[idx]!;
  if (job.queueOwnerKey !== queueOwnerKey) return { ok: false, error: 'forbidden' };
  pending.splice(idx, 1);
  queued.delete(projectId);

  await prisma.revamperProject.update({
    where: { id: projectId },
    data: { status: JobStatus.CANCELLED },
  });
  await updateProjectAnalysis(projectId, {
    status: JobStatus.CANCELLED,
    label: 'Annulé',
    detail: 'Retiré de la file d’attente.',
    updatedAt: nowIso(),
  });
  await appendJobLog(projectId, {
    at: nowIso(),
    status: JobStatus.CANCELLED,
    label: 'Annulé',
    detail: 'Retiré de la file d’attente.',
    step: 'job_cancelled',
  });
  void pumpQueue();
  return { ok: true };
}

export async function enqueueRevamperJob(input: EnqueueRevamperJobInput): Promise<void> {
  if (queued.has(input.projectId) || running.has(input.projectId)) return;
  queued.add(input.projectId);
  pending.push({ ...input });
  await updateProjectAnalysis(input.projectId, {
    status: JobStatus.QUEUED,
    label: 'En file',
    detail: 'Le job est en attente d’un worker.',
    updatedAt: nowIso(),
  });
  await appendJobLog(input.projectId, {
    at: nowIso(),
    status: JobStatus.QUEUED,
    label: 'En file',
    detail: 'Le job est en attente d’un worker.',
    step: 'job_queued',
  });
  void pumpQueue();
}

export async function bootRevamperQueue(): Promise<void> {
  // Si le process a crash en RUNNING, on remet en QUEUED.
  await prisma.revamperProject.updateMany({
    where: { status: JobStatus.RUNNING },
    data: { status: JobStatus.QUEUED },
  });
  const rows = await prisma.revamperProject.findMany({
    where: { status: JobStatus.QUEUED },
    select: {
      id: true,
      userId: true,
      guestSessionId: true,
      sourceUrl: true,
      stylePreference: true,
      analysis: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const row of rows) {
    if (!row.sourceUrl) {
      // Job invalide: pas d'URL source.
      await prisma.revamperProject.update({
        where: { id: row.id },
        data: { status: JobStatus.FAILED },
      });
      await updateProjectAnalysis(row.id, {
        status: JobStatus.FAILED,
        label: 'Échec',
        detail: 'URL source manquante.',
        error: 'URL source manquante.',
        updatedAt: nowIso(),
      });
      await appendJobLog(row.id, {
        at: nowIso(),
        status: JobStatus.FAILED,
        label: 'Échec',
        detail: 'URL source manquante.',
        step: 'job_invalid',
      });
      continue;
    }
    const analysisObj = asObject(row.analysis);
    const sectionsRaw = analysisObj.__queuedSections;
    const sectionsOverride = Array.isArray(sectionsRaw)
      ? sectionsRaw.filter((s): s is string => typeof s === 'string')
      : undefined;
    const baseRaw = analysisObj.__baseInstructions;
    const supRaw = analysisObj.__supplementaryInstructions;
    const legacyRaw = analysisObj.__additionalInstructions;
    const baseInstructions =
      typeof baseRaw === 'string' && baseRaw.trim()
        ? baseRaw.trim()
        : typeof legacyRaw === 'string' && legacyRaw.trim()
          ? legacyRaw.trim()
          : undefined;
    const supplementaryInstructions =
      typeof supRaw === 'string' && supRaw.trim() ? supRaw.trim() : undefined;

    const enableI18n = analysisObj.__enableI18n === true;
    const rawLang = typeof analysisObj.__sourceLang === 'string' ? analysisObj.__sourceLang.slice(0, 2).toLowerCase() : '';
    const sourceLang = (['en', 'fr', 'de', 'es', 'it'] as const).includes(rawLang as SupportedLang)
      ? (rawLang as SupportedLang)
      : undefined;

    const queueOwnerKey = row.userId ?? `guest:${row.guestSessionId!}`;
    await enqueueRevamperJob({
      projectId: row.id,
      queueOwnerKey,
      url: row.sourceUrl,
      stylePreference: row.stylePreference ?? undefined,
      sectionsOverride,
      baseInstructions,
      supplementaryInstructions,
      enableI18n,
      sourceLang,
    });
  }
}
