import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db';
import { type AuthedRequest } from '../middleware/requireAuth';
import { requireUserOrGuest } from '../middleware/requireUserOrGuest';
import { ownerCreatePair, revamperWhere } from '../ownerScope';
import { revamperToApi } from '../serializers';
import { handleRevamperGenerate, handleRevamperGenerateStream } from '../revamper/generateHandler';
import { JobStatus, type Prisma } from '../../generated/prisma/client';
import {
  cancelQueuedRevamperJob,
  dequeueProjectFromQueue,
  enqueueRevamperJob,
  getRevamperQueueSnapshot,
} from '../revamper/queue';
import path from 'path';
import fs from 'fs/promises';
import { stableAssetName } from '../revamper/stitchClient';
import { optimizeStitchPrompt } from '../revamper/optimizePrompt';
import { buildBriefWithClaude } from '../revamper/buildBrief';
import { parseUserInstructionsBody } from '../revamper/userInstructions';

const router = Router();
const FETCH_THUMB_TIMEOUT_MS = 20_000;

const revamperEditorUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const I18N_LANGS = ['en', 'fr', 'de', 'es', 'it'] as const;
type I18nLang = (typeof I18N_LANGS)[number];

function parseGenerateBody(body: Record<string, unknown>): {
  url: string;
  stylePreference?: string;
  sectionsOverride?: string[];
  baseInstructions?: string;
  supplementaryInstructions?: string;
  enableI18n: boolean;
  sourceLang?: I18nLang;
} {
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const stylePreference = typeof body.stylePreference === 'string' ? body.stylePreference.trim() : undefined;
  const sectionsOverride = Array.isArray(body.sections)
    ? body.sections.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : undefined;
  const { baseInstructions, supplementaryInstructions } = parseUserInstructionsBody(body);
  const enableI18n = body.enableI18n === true;
  const rawLang = typeof body.sourceLang === 'string' ? body.sourceLang.slice(0, 2).toLowerCase() : '';
  const sourceLang = I18N_LANGS.includes(rawLang as I18nLang) ? (rawLang as I18nLang) : undefined;
  return {
    url,
    stylePreference,
    sectionsOverride,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  };
}

function titleFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || 'Refonte';
  } catch {
    return 'Refonte';
  }
}

function asObject(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function extFromImageContentType(ct: string | null): string {
  const s = (ct || '').toLowerCase();
  if (s.includes('image/png')) return 'png';
  if (s.includes('image/jpeg')) return 'jpg';
  if (s.includes('image/webp')) return 'webp';
  if (s.includes('image/gif')) return 'gif';
  if (s.includes('image/svg')) return 'svg';
  return 'jpg';
}

async function persistThumbnailFromUrl(params: {
  sourceUrl: string;
  projectId: string;
}): Promise<string | null> {
  if (!/^https?:\/\//i.test(params.sourceUrl)) return null;
  try {
    const res = await fetch(params.sourceUrl, { signal: AbortSignal.timeout(FETCH_THUMB_TIMEOUT_MS) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type');
    const ext = extFromImageContentType(ct);
    const fileName = stableAssetName(params.sourceUrl, ext);
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const dir = path.join(uploadsRoot, 'revamper', params.projectId, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, fileName);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return `/uploads/revamper/${encodeURIComponent(params.projectId)}/assets/${encodeURIComponent(fileName)}`;
  } catch {
    return null;
  }
}

router.get('/', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const rows = await prisma.revamperProject.findMany({
    where: revamperWhere(req),
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(revamperToApi));
});

/** Tableau de bord file d’attente + liste des projets (paramètres / jobs). */
router.get('/jobs/dashboard', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const queue = getRevamperQueueSnapshot();
  const rows = await prisma.revamperProject.findMany({
    where: revamperWhere(req),
    orderBy: { createdAt: 'desc' },
  });
  const positionById = new Map(queue.pendingOrder.map((id, i) => [id, i + 1]));
  res.json({
    queue,
    projects: rows.map((row) => ({
      ...revamperToApi(row),
      queue_position: positionById.get(row.id) ?? null,
      is_running: queue.runningIds.includes(row.id),
    })),
  });
});

/** Annule un job encore en file (statut QUEUED). */
router.post('/jobs/:id/cancel', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const row = await prisma.revamperProject.findFirst({
    where: { id, ...revamperWhere(req) },
  });
  if (!row) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  if (row.status !== JobStatus.QUEUED) {
    res.status(400).json({
      error:
        row.status === JobStatus.RUNNING
          ? 'running'
          : row.status === JobStatus.DONE
            ? 'done'
            : 'not_cancellable',
    });
    return;
  }
  const queueOwnerKey = row.userId ?? `guest:${row.guestSessionId!}`;
  const result = await cancelQueuedRevamperJob(id, queueOwnerKey);
  if (!result.ok) {
    if (result.error === 'forbidden') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    if (result.error === 'running') {
      res.status(400).json({ error: 'running' });
      return;
    }
    res.status(409).json({ error: 'not_in_queue' });
    return;
  }
  const updated = await prisma.revamperProject.findUnique({ where: { id } });
  res.json({
    queue: getRevamperQueueSnapshot(),
    project: updated ? revamperToApi(updated) : null,
  });
});

/** Lecture seule sans auth (lien de partage). */
router.get('/share/:id', async (req, res) => {
  const id = String(req.params.id);
  const row = await prisma.revamperProject.findUnique({ where: { id } });
  if (!row) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  res.json(revamperToApi(row));
});

/** Image upload pour l’éditeur visuel (assets du projet). */
router.post(
  '/:id/upload-asset',
  requireUserOrGuest,
  revamperEditorUpload.single('file'),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const row = await prisma.revamperProject.findFirst({
      where: { id, ...revamperWhere(req) },
    });
    if (!row) {
      res.status(404).json({ error: 'Introuvable' });
      return;
    }
    if (!req.file?.buffer) {
      res.status(400).json({ error: 'Fichier requis' });
      return;
    }
    const ext = path.extname(req.file.originalname) || '.png';
    const fileName = `editor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const dir = path.join(process.cwd(), 'uploads', 'revamper', id, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, fileName);
    await fs.writeFile(outPath, req.file.buffer);
    const url = `/uploads/revamper/${encodeURIComponent(id)}/assets/${encodeURIComponent(fileName)}`;
    res.json({ url });
  }
);

router.get('/:id', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const row = await prisma.revamperProject.findFirst({
    where: { id, ...revamperWhere(req) },
  });
  if (!row) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  res.json(revamperToApi(row));
});

router.post('/repair-thumbnails', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const rows = await prisma.revamperProject.findMany({
    where: revamperWhere(req),
    select: { id: true, analysis: true },
    orderBy: { createdAt: 'desc' },
  });

  let repaired = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const row of rows) {
    const analysisObj = asObject(row.analysis);
    const img = analysisObj.generatedImageUrl;
    if (typeof img !== 'string' || !img.trim()) {
      skipped += 1;
      continue;
    }
    const current = img.trim();
    if (current.startsWith('/uploads/')) {
      skipped += 1;
      continue;
    }
    const localUrl = await persistThumbnailFromUrl({
      sourceUrl: current,
      projectId: row.id,
    });
    if (!localUrl) {
      failed.push(row.id);
      continue;
    }
    const nextAnalysis = {
      ...analysisObj,
      generatedImageUrl: localUrl,
    } as Prisma.InputJsonValue;
    await prisma.revamperProject.update({
      where: { id: row.id },
      data: { analysis: nextAnalysis },
    });
    repaired += 1;
  }

  res.json({ repaired, skipped, failed });
});

router.post('/', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title : 'Refonte';
  const sourceUrl = typeof b.source_url === 'string' ? b.source_url : null;
  const analysis = (b.analysis ?? {}) as Prisma.InputJsonValue;
  const html = typeof b.html === 'string' ? b.html : '';
  const css = typeof b.css === 'string' ? b.css : '';
  const js = typeof b.js === 'string' ? b.js : '';
  const modelId = typeof b.model_id === 'string' ? b.model_id : null;
  const stylePreference = typeof b.style_preference === 'string' ? b.style_preference : null;
  const status =
    typeof b.status === 'string' && Object.values(JobStatus).includes(b.status as JobStatus)
      ? (b.status as JobStatus)
      : undefined;

  const owner = ownerCreatePair(req);
  const row = await prisma.revamperProject.create({
    data: {
      ...owner,
      title,
      sourceUrl,
      analysis,
      html,
      css,
      js,
      modelId,
      stylePreference,
      ...(status ? { status } : {}),
    },
  });
  res.status(201).json(revamperToApi(row));
});

router.patch('/:id', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const b = req.body as Record<string, unknown>;
  const existing = await prisma.revamperProject.findFirst({
    where: { id, ...revamperWhere(req) },
  });
  if (!existing) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  const data: Prisma.RevamperProjectUpdateInput = {};
  if (typeof b.title === 'string') data.title = b.title;
  if ('source_url' in b) data.sourceUrl = b.source_url == null ? null : String(b.source_url);
  if (b.analysis !== undefined) data.analysis = b.analysis as Prisma.InputJsonValue;
  if (typeof b.html === 'string') data.html = b.html;
  if (typeof b.css === 'string') data.css = b.css;
  if (typeof b.js === 'string') data.js = b.js;
  if ('model_id' in b) data.modelId = b.model_id == null ? null : String(b.model_id);
  if ('style_preference' in b) data.stylePreference = b.style_preference == null ? null : String(b.style_preference);
  if (typeof b.status === 'string' && Object.values(JobStatus).includes(b.status as JobStatus)) {
    data.status = b.status as JobStatus;
  }

  const row = await prisma.revamperProject.update({ where: { id }, data });
  res.json(revamperToApi(row));
});

router.delete('/:id', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  dequeueProjectFromQueue(id);
  const r = await prisma.revamperProject.deleteMany({
    where: { id, ...revamperWhere(req) },
  });
  if (r.count === 0) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  res.status(204).send();
});

router.post('/jobs/enqueue', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const {
    url,
    stylePreference,
    sectionsOverride,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  } = parseGenerateBody(b);
  if (!url) {
    res.status(400).json({ error: 'URL requise' });
    return;
  }

  const analysis: Record<string, unknown> = {
    lang: 'fr',
    title: titleFromUrl(url),
    __queuedSections: sectionsOverride ?? [],
    ...(baseInstructions ? { __baseInstructions: baseInstructions } : {}),
    ...(supplementaryInstructions ? { __supplementaryInstructions: supplementaryInstructions } : {}),
    ...(enableI18n ? { __enableI18n: true } : {}),
    ...(sourceLang ? { __sourceLang: sourceLang } : {}),
    __job: {
      status: JobStatus.QUEUED,
      label: 'En file',
      detail: 'Le job est en attente.',
      updatedAt: new Date().toISOString(),
    },
  };

  const owner = ownerCreatePair(req);
  const row = await prisma.revamperProject.create({
    data: {
      ...owner,
      title: titleFromUrl(url),
      sourceUrl: url,
      analysis: analysis as Prisma.InputJsonValue,
      html: '',
      css: '',
      js: '',
      stylePreference: stylePreference ?? null,
      status: JobStatus.QUEUED,
    },
  });

  const queueOwnerKey = row.userId ?? `guest:${row.guestSessionId!}`;
  await enqueueRevamperJob({
    projectId: row.id,
    queueOwnerKey,
    url,
    stylePreference,
    sectionsOverride,
    baseInstructions,
    supplementaryInstructions,
    enableI18n,
    sourceLang,
  });

  res.status(201).json(revamperToApi(row));
});

router.post('/:id/repair-thumbnail', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const row = await prisma.revamperProject.findFirst({
    where: { id, ...revamperWhere(req) },
    select: { id: true, analysis: true },
  });
  if (!row) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  const analysisObj = asObject(row.analysis);
  const img = analysisObj.generatedImageUrl;
  if (typeof img !== 'string' || !img.trim()) {
    res.status(400).json({ error: 'Aucune miniature à réparer.' });
    return;
  }
  if (img.startsWith('/uploads/')) {
    res.json({ ok: true, message: 'Miniature déjà locale.', generatedImageUrl: img });
    return;
  }
  const localUrl = await persistThumbnailFromUrl({
    sourceUrl: img,
    projectId: row.id,
  });
  if (!localUrl) {
    res.status(502).json({ error: 'Impossible de télécharger la miniature distante (URL expirée ou inaccessible).' });
    return;
  }
  const nextAnalysis = {
    ...analysisObj,
    generatedImageUrl: localUrl,
  } as Prisma.InputJsonValue;
  const updated = await prisma.revamperProject.update({
    where: { id: row.id },
    data: { analysis: nextAnalysis },
  });
  res.json(revamperToApi(updated));
});

router.post('/generate-stream', requireUserOrGuest, async (req: AuthedRequest, res) => {
  await handleRevamperGenerateStream(req, res);
});

router.post('/generate', requireUserOrGuest, async (req: AuthedRequest, res) => {
  await handleRevamperGenerate(req, res);
});

/**
 * Optimise un texte d'idée utilisateur pour Stitch.
 * - Par défaut : "Brief Builder" via Claude Opus 4.7 (reformulation structurée).
 * - Fallback : Grok si la clé Anthropic manque ou si Claude échoue.
 * - body.mode = 'grok' force la reformulation Grok (ancien comportement).
 */
router.post('/optimize-prompt', requireUserOrGuest, async (req: AuthedRequest, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const raw = typeof b.prompt === 'string' ? b.prompt : '';
    const sourceUrl = typeof b.sourceUrl === 'string' ? b.sourceUrl : undefined;
    const mode = typeof b.mode === 'string' ? b.mode.toLowerCase() : '';

    if (mode === 'grok') {
      const optimized = await optimizeStitchPrompt(raw);
      res.json({ prompt: optimized, model: 'grok' });
      return;
    }

    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY);
    if (hasAnthropic) {
      try {
        const optimized = await buildBriefWithClaude({ userPrompt: raw, sourceUrl });
        res.json({ prompt: optimized, model: 'claude' });
        return;
      } catch (e) {
        console.warn('[optimize-prompt] Claude failed, falling back to Grok:', e);
      }
    }

    const optimized = await optimizeStitchPrompt(raw);
    res.json({ prompt: optimized, model: 'grok' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    res.status(400).json({ error: msg });
  }
});

export default router;
