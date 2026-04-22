import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../db';
import { type AuthedRequest } from '../middleware/requireAuth';
import { requireUserOrGuest } from '../middleware/requireUserOrGuest';
import { ownerCreatePair, imagerWhere } from '../ownerScope';
import { imagerToApi } from '../serializers';
import type { Prisma } from '../../generated/prisma/client';
import { runImagerGenerate } from '../imager/generateAsset';
import { extractPaletteFromImageUrl } from '../imager/extractPalette';
import {
  finalizeDraftLogoToProject,
  isLogoDraftUrl,
  runLogoDraftGeneration,
} from '../imager/logoGeneration';
import { expandImagerContextWithGrok } from '../imager/xaiChat';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'imager-tmp');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    void fs.mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/generate-asset', requireUserOrGuest, async (req: AuthedRequest, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const projectId = typeof b.projectId === 'string' ? b.projectId.trim() : '';
    if (!projectId) {
      res.status(400).json({ error: 'projectId requis.' });
      return;
    }
    const proj = await prisma.imagerProject.findFirst({
      where: { id: projectId, ...imagerWhere(req) },
    });
    if (!proj) {
      res.status(404).json({ error: 'Projet introuvable.' });
      return;
    }
    const assetType = typeof b.assetType === 'string' ? b.assetType : 'instagram-post';
    console.log(
      `[imager] generate-asset assetType=${assetType} grokConfigured=${Boolean(
        process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim()
      )}`
    );

    try {
      const num = (v: unknown): number | undefined => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
        return undefined;
      };
      const sw = num(b.sourceWidth);
      const sh = num(b.sourceHeight);
      const outputLang =
        typeof b.output_language === 'string' && b.output_language.trim() !== ''
          ? b.output_language.trim()
          : proj.outputLanguage;
      const out = await runImagerGenerate({
        assetType,
        brandName: proj.brandName,
        brandColors: (proj.brandColors as Record<string, unknown>) || {},
        brandDescription: proj.brandDescription ?? undefined,
        targetAudience: proj.targetAudience ?? undefined,
        toneOfVoice: proj.toneOfVoice,
        outputLanguage: outputLang,
        customPrompt: typeof b.customPrompt === 'string' ? b.customPrompt : undefined,
        additionalContext: typeof b.additionalContext === 'string' ? b.additionalContext : undefined,
        referenceImageUrl: typeof b.referenceImageUrl === 'string' ? b.referenceImageUrl : proj.brandLogoUrl ?? undefined,
        sourceWidth: sw,
        sourceHeight: sh,
        projectId,
      });
      res.json(out);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (status === 400) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Requête invalide' });
        return;
      }
      if (status === 501) {
        res.status(501).json({ error: e instanceof Error ? e.message : 'Non implémenté' });
        return;
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur génération.' });
  }
});

/** Enrichit mots-clés / notes courtes en contexte détaillé pour Grok Imagine (modèle texte xAI). */
router.post('/enrich-context', requireUserOrGuest, async (req: AuthedRequest, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const keywords = typeof b.keywords === 'string' ? b.keywords.trim() : '';
    if (!keywords) {
      res.status(400).json({ error: 'keywords requis (mots-clés ou notes).' });
      return;
    }
    if (!process.env.GROK_API_KEY?.trim() && !process.env.XAI_API_KEY?.trim()) {
      res.status(503).json({ error: 'GROK_API_KEY (ou XAI_API_KEY) manquant dans backend/.env.' });
      return;
    }
    const brandName = typeof b.brand_name === 'string' ? b.brand_name.trim() : '';
    if (!brandName) {
      res.status(400).json({ error: 'brand_name requis.' });
      return;
    }
    const enriched = await expandImagerContextWithGrok({
      brandName,
      toneOfVoice: typeof b.tone_of_voice === 'string' ? b.tone_of_voice : undefined,
      brandDescription: typeof b.brand_description === 'string' ? b.brand_description : null,
      targetAudience: typeof b.target_audience === 'string' ? b.target_audience : null,
      keywords,
      existingContext:
        typeof b.existing_context === 'string' && b.existing_context.trim() !== ''
          ? b.existing_context.trim()
          : undefined,
      customPromptHint:
        typeof b.custom_prompt_hint === 'string' && b.custom_prompt_hint.trim() !== ''
          ? b.custom_prompt_hint.trim()
          : undefined,
    });
    res.json({ enriched });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur enrichissement.' });
  }
});

/** Génère plusieurs logos (Grok Imagine) pour le formulaire de création — sans projet existant. */
router.post('/generate-logos', requireUserOrGuest, async (req: AuthedRequest, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const brandName = typeof b.brand_name === 'string' ? b.brand_name.trim() : '';
    if (!brandName) {
      res.status(400).json({ error: 'brand_name requis.' });
      return;
    }
    if (!process.env.GROK_API_KEY?.trim() && !process.env.XAI_API_KEY?.trim()) {
      res.status(503).json({ error: 'GROK_API_KEY (ou XAI_API_KEY) manquant dans backend/.env.' });
      return;
    }
    const tone = typeof b.tone_of_voice === 'string' ? b.tone_of_voice : undefined;
    const userPrompt = typeof b.logo_prompt === 'string' ? b.logo_prompt : undefined;
    const out = await runLogoDraftGeneration({ brandName, toneOfVoice: tone, userPrompt });
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur génération logos.' });
  }
});

/** Palette dérivée d’une image déjà servie sous `/uploads/...`. */
router.post('/extract-palette', requireUserOrGuest, async (req: AuthedRequest, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const imageUrl = typeof b.image_url === 'string' ? b.image_url.trim() : '';
    if (!imageUrl.startsWith('/uploads/')) {
      res.status(400).json({ error: 'image_url invalide (attendu: chemin /uploads/...).' });
      return;
    }
    const colors = await extractPaletteFromImageUrl(imageUrl);
    res.json(colors);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur extraction palette.' });
  }
});

router.get('/', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const rows = await prisma.imagerProject.findMany({
    where: imagerWhere(req),
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(imagerToApi));
});

router.get('/:id', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const row = await prisma.imagerProject.findFirst({
    where: { id, ...imagerWhere(req) },
  });
  if (!row) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  res.json(imagerToApi(row));
});

router.post('/', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const brandName = typeof b.brand_name === 'string' ? b.brand_name : '';
  const owner = ownerCreatePair(req);
  const rawLogo =
    typeof b.brand_logo_url === 'string' && b.brand_logo_url.trim() !== '' ? b.brand_logo_url.trim() : null;

  const createData = {
    ...owner,
    brandName,
    brandColors: (b.brand_colors as Prisma.InputJsonValue) ?? {},
    brandLogoUrl: rawLogo,
    brandFonts: (b.brand_fonts as Prisma.InputJsonValue) ?? {},
    brandDescription: typeof b.brand_description === 'string' ? b.brand_description : null,
    targetAudience: typeof b.target_audience === 'string' ? b.target_audience : null,
    toneOfVoice: typeof b.tone_of_voice === 'string' ? b.tone_of_voice : 'professional',
    outputLanguage: typeof b.output_language === 'string' ? b.output_language : 'fr',
    generatedAssets: [] as unknown as Prisma.InputJsonValue,
    status: 'draft',
  };

  let row;
  try {
    row = await prisma.imagerProject.create({ data: createData });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error(e);
    res.status(500).json({
      error: err.message ?? 'Création projet impossible.',
      prismaCode: err.code,
    });
    return;
  }

  if (rawLogo && isLogoDraftUrl(rawLogo)) {
    const finalized = await finalizeDraftLogoToProject(rawLogo, row.id);
    if (finalized) {
      const updated = await prisma.imagerProject.update({
        where: { id: row.id },
        data: { brandLogoUrl: finalized },
      });
      res.status(201).json(imagerToApi(updated));
      return;
    }
  }

  res.status(201).json(imagerToApi(row));
});

router.patch('/:id', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const b = req.body as Record<string, unknown>;
  const existing = await prisma.imagerProject.findFirst({
    where: { id, ...imagerWhere(req) },
  });
  if (!existing) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  const data: Prisma.ImagerProjectUpdateInput = {};
  if (typeof b.brand_name === 'string') data.brandName = b.brand_name;
  if (b.brand_colors !== undefined) data.brandColors = b.brand_colors as Prisma.InputJsonValue;
  if ('brand_logo_url' in b) data.brandLogoUrl = b.brand_logo_url == null ? null : String(b.brand_logo_url);
  if (b.brand_fonts !== undefined) data.brandFonts = b.brand_fonts as Prisma.InputJsonValue;
  if ('brand_description' in b) data.brandDescription = b.brand_description == null ? null : String(b.brand_description);
  if ('target_audience' in b) data.targetAudience = b.target_audience == null ? null : String(b.target_audience);
  if (typeof b.tone_of_voice === 'string') data.toneOfVoice = b.tone_of_voice;
  if (typeof b.output_language === 'string') data.outputLanguage = b.output_language;
  if (b.generated_assets !== undefined) data.generatedAssets = b.generated_assets as Prisma.InputJsonValue;
  if (typeof b.status === 'string') data.status = b.status;

  const row = await prisma.imagerProject.update({ where: { id }, data });
  res.json(imagerToApi(row));
});

router.delete('/:id', requireUserOrGuest, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const r = await prisma.imagerProject.deleteMany({
    where: { id, ...imagerWhere(req) },
  });
  if (r.count === 0) {
    res.status(404).json({ error: 'Introuvable' });
    return;
  }
  res.status(204).send();
});

router.post('/:id/logo', requireUserOrGuest, upload.single('file'), async (req: AuthedRequest, res) => {
  try {
    const pid = String(req.params.id);
    const proj = await prisma.imagerProject.findFirst({
      where: { id: pid, ...imagerWhere(req) },
    });
    if (!proj) {
      res.status(404).json({ error: 'Introuvable' });
      return;
    }
    const file = req.file;
    if (!file?.path) {
      res.status(400).json({ error: 'Fichier manquant (field: file).' });
      return;
    }
    const destDir = path.join(process.cwd(), 'uploads', 'imager', proj.id);
    await fs.mkdir(destDir, { recursive: true });
    const ext = path.extname(file.originalname) || path.extname(file.filename) || '.png';
    const finalName = `logo-${Date.now()}${ext}`;
    const dest = path.join(destDir, finalName);
    await fs.rename(file.path, dest);
    const url = `/uploads/imager/${proj.id}/${finalName}`;
    const row = await prisma.imagerProject.update({
      where: { id: proj.id },
      data: { brandLogoUrl: url },
    });
    res.json({ url, project: imagerToApi(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload impossible.' });
  }
});

export default router;
