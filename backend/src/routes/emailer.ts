import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth';
import { emailerToApi } from '../serializers';
import { generateEmail } from '../emailer/generateEmail';
import { buildRevamperPublicDemoUrl, resolvePublicAppBase } from '../emailer/publicAppUrl';
import { sendCampaign } from '../emailer/sendCampaign';
import { buildTransporter, resolveSmtpConfig } from '../emailer/buildTransporter';
import { JobStatus, type Prisma } from '../../generated/prisma/client';

const router = Router();

router.use(requireAuth);

// ── Liste des campagnes ──────────────────────────────────────────────────────
router.get('/campaigns', async (req: AuthedRequest, res) => {
  const rows = await prisma.emailerCampaign.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(emailerToApi));
});

// ── Créer une campagne ───────────────────────────────────────────────────────
router.post('/campaigns', async (req: AuthedRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim() : 'Nouvelle campagne';
  const contacts = Array.isArray(b.contacts) ? b.contacts : [];
  const template = b.template && typeof b.template === 'object' && !Array.isArray(b.template)
    ? (b.template as Prisma.InputJsonValue)
    : {};
  const aiContext = b.ai_context ?? b.aiContext ?? null;
  const smtpConfig = b.smtp_config ?? b.smtpConfig ?? null;
  const revamperProjectId = typeof b.revamper_project_id === 'string' ? b.revamper_project_id : null;

  const row = await prisma.emailerCampaign.create({
    data: {
      userId: req.userId!,
      name,
      contacts: contacts as Prisma.InputJsonValue,
      template: template as Prisma.InputJsonValue,
      aiContext: aiContext as Prisma.InputJsonValue,
      smtpConfig: smtpConfig as Prisma.InputJsonValue,
      revamperProjectId,
    },
  });
  res.status(201).json(emailerToApi(row));
});

// ── Détail d'une campagne ────────────────────────────────────────────────────
router.get('/campaigns/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const row = await prisma.emailerCampaign.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!row) { res.status(404).json({ error: 'Introuvable' }); return; }
  res.json(emailerToApi(row));
});

// ── Mettre à jour une campagne ───────────────────────────────────────────────
router.patch('/campaigns/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.emailerCampaign.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) { res.status(404).json({ error: 'Introuvable' }); return; }

  const b = req.body as Record<string, unknown>;
  const data: Prisma.EmailerCampaignUncheckedUpdateInput = {};

  if (typeof b.name === 'string') data.name = b.name;
  if (Array.isArray(b.contacts)) data.contacts = b.contacts as Prisma.InputJsonValue;
  if (b.template !== undefined) data.template = b.template as Prisma.InputJsonValue;
  if (b.ai_context !== undefined) data.aiContext = (b.ai_context ?? null) as Prisma.InputJsonValue;
  if (b.smtp_config !== undefined) data.smtpConfig = (b.smtp_config ?? null) as Prisma.InputJsonValue;
  if ('revamper_project_id' in b) {
    data.revamperProjectId = typeof b.revamper_project_id === 'string' ? b.revamper_project_id : null;
  }

  const row = await prisma.emailerCampaign.update({ where: { id }, data });
  res.json(emailerToApi(row));
});

// ── Supprimer une campagne ───────────────────────────────────────────────────
router.delete('/campaigns/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const r = await prisma.emailerCampaign.deleteMany({
    where: { id, userId: req.userId! },
  });
  if (r.count === 0) { res.status(404).json({ error: 'Introuvable' }); return; }
  res.status(204).send();
});

// ── Générer le contenu email via IA ─────────────────────────────────────────
router.post('/campaigns/:id/generate', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const campaign = await prisma.emailerCampaign.findFirst({
    where: { id, userId: req.userId! },
    include: { revamperProject: true },
  });
  if (!campaign) { res.status(404).json({ error: 'Campagne introuvable.' }); return; }

  const b = req.body as Record<string, unknown>;
  const aiCtx = (campaign.aiContext ?? {}) as Record<string, unknown>;

  const language = (typeof b.language === 'string' ? b.language : aiCtx.language ?? 'fr') as 'fr' | 'en';
  const tone = (typeof b.tone === 'string' ? b.tone : aiCtx.tone ?? 'friendly') as 'formal' | 'friendly' | 'bold';

  // Extraire un prospect représentatif (premier contact)
  const contacts = Array.isArray(campaign.contacts) ? campaign.contacts as unknown[] : [];
  const firstContact = contacts[0] && typeof contacts[0] === 'object'
    ? contacts[0] as Record<string, unknown>
    : {};
  const prospect = {
    name: typeof firstContact.name === 'string' ? firstContact.name : undefined,
    company: typeof firstContact.company === 'string' ? firstContact.company : undefined,
    siteUrl: typeof firstContact.siteUrl === 'string' ? firstContact.siteUrl : (typeof b.site_url === 'string' ? b.site_url : 'example.com'),
  };

  const publicBase = resolvePublicAppBase(
    typeof b.public_app_url === 'string' ? b.public_app_url : undefined
  );

  // Extraire les infos du projet Revamper lié
  let revampedSite: { previewUrl?: string; title?: string; improvements?: string } | undefined;
  if (campaign.revamperProject) {
    const rp = campaign.revamperProject;
    const analysis = rp.analysis as Record<string, unknown>;
    const demoUrl = buildRevamperPublicDemoUrl(campaign.revamperProjectId, publicBase);
    revampedSite = {
      title: rp.title,
      previewUrl: demoUrl,
      improvements: typeof analysis.improvements === 'string' ? analysis.improvements
        : typeof analysis.summary === 'string' ? analysis.summary
        : undefined,
    };
  }

  try {
    const generated = await generateEmail({ prospect, revampedSite, language, tone });

    const updatedAiContext = {
      ...aiCtx,
      language,
      tone,
      generatedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    const row = await prisma.emailerCampaign.update({
      where: { id: campaign.id },
      data: {
        template: generated as unknown as Prisma.InputJsonValue,
        aiContext: updatedAiContext,
      },
    });

    res.json({ campaign: emailerToApi(row), generated });
  } catch (e) {
    console.error('[emailer/generate]', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur génération IA.' });
  }
});

// ── Lancer l'envoi de la campagne ────────────────────────────────────────────
router.post('/campaigns/:id/send', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const campaign = await prisma.emailerCampaign.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!campaign) { res.status(404).json({ error: 'Campagne introuvable.' }); return; }
  if (campaign.status === JobStatus.DONE) {
    res.status(400).json({ error: 'Cette campagne a déjà été envoyée.' });
    return;
  }
  if (campaign.status === JobStatus.RUNNING) {
    res.status(400).json({ error: 'Cette campagne est déjà en cours d\'envoi.' });
    return;
  }

  try {
    const stats = await sendCampaign(campaign.id);
    const updated = await prisma.emailerCampaign.findUnique({ where: { id: campaign.id } });
    res.json({ stats, campaign: updated ? emailerToApi(updated) : null });
  } catch (e) {
    console.error('[emailer/send]', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur envoi.' });
  }
});

// ── Tester la connexion SMTP ─────────────────────────────────────────────────
router.post('/smtp/test', async (req: AuthedRequest, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const bodyCfg =
      b.smtp_config && typeof b.smtp_config === 'object' && !Array.isArray(b.smtp_config)
        ? (b.smtp_config as Record<string, unknown>)
        : {};
    let userCfg: Record<string, unknown> = {};
    if (req.userId) {
      const u = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { smtpSettings: true },
      });
      const raw = u?.smtpSettings;
      userCfg =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    }
    const merged = { ...userCfg, ...bodyCfg };
    const smtpConfig = resolveSmtpConfig(merged);

    if (!smtpConfig.host) {
      res.status(400).json({
        error:
          'SMTP_HOST manquant. Renseignez le SMTP dans Paramètres → SMTP, ou dans .env (SMTP_*), ou la config SMTP de la campagne.',
      });
      return;
    }

    const transporter = buildTransporter(smtpConfig);
    await transporter.verify();
    res.json({ ok: true, message: 'Connexion SMTP réussie.', from: smtpConfig.from });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : 'Connexion SMTP échouée.' });
  }
});

export default router;
