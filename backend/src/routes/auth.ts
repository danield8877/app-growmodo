import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { signToken, verifyGuestToken } from '../auth/jwt';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth';
import type { Response } from 'express';
import { userToProfile, loginUserToProfile } from '../serializers';
import { buildTransporter, resolveSmtpConfig } from '../emailer/buildTransporter';
import type { Prisma } from '../../generated/prisma/client';

const router = Router();

const isDev = process.env.NODE_ENV !== 'production';

function authErrorPayload(e: unknown) {
  if (!isDev) return {};
  const msg = e instanceof Error ? e.message : String(e);
  return { debug: msg };
}

type SmtpStored = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, guest_token } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      guest_token?: string;
    };
    if (!email?.trim() || !password || password.length < 6) {
      res.status(400).json({ error: 'Email et mot de passe (6+ caractères) requis.' });
      return;
    }
    const exists = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (exists) {
      res.status(409).json({ error: 'Cet email est déjà utilisé.' });
      return;
    }
    let guestSessionId: string | null = null;
    if (typeof guest_token === 'string' && guest_token.trim()) {
      try {
        guestSessionId = verifyGuestToken(guest_token.trim()).sub;
      } catch {
        res.status(400).json({ error: 'Session invité invalide.' });
        return;
      }
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: email.trim().toLowerCase(),
          passwordHash,
          name: name?.trim() || null,
        },
      });
      if (guestSessionId) {
        await tx.revamperProject.updateMany({
          where: { guestSessionId },
          data: { userId: u.id, guestSessionId: null },
        });
        await tx.imagerProject.updateMany({
          where: { guestSessionId },
          data: { userId: u.id, guestSessionId: null },
        });
        await tx.guestSession.deleteMany({ where: { id: guestSessionId } });
      }
      return u;
    });
    const token = signToken({ sub: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      profile: userToProfile(user),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Inscription impossible.', ...authErrorPayload(e) });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, guest_token } = req.body as {
      email?: string;
      password?: string;
      guest_token?: string;
    };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis.' });
      return;
    }
    let guestSessionId: string | null = null;
    if (typeof guest_token === 'string' && guest_token.trim()) {
      try {
        guestSessionId = verifyGuestToken(guest_token.trim()).sub;
      } catch {
        /* ignore: connexion sans fusion invité */
      }
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid login credentials' });
      return;
    }
    let passwordOk = false;
    try {
      passwordOk = await bcrypt.compare(password, user.passwordHash);
    } catch (bcryptErr) {
      console.error('[auth/login] bcrypt.compare', bcryptErr);
      res.status(500).json({ error: 'Connexion impossible.', ...authErrorPayload(bcryptErr) });
      return;
    }
    if (!passwordOk) {
      res.status(401).json({ error: 'Invalid login credentials' });
      return;
    }
    if (guestSessionId) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.revamperProject.updateMany({
            where: { guestSessionId },
            data: { userId: user.id, guestSessionId: null },
          });
          await tx.imagerProject.updateMany({
            where: { guestSessionId },
            data: { userId: user.id, guestSessionId: null },
          });
          await tx.guestSession.deleteMany({ where: { id: guestSessionId } });
        });
      } catch (mergeErr) {
        console.error('[auth/login] fusion invité ignorée (état incohérent ou BDD)', mergeErr);
        /* la connexion reste valide même si la fusion échoue */
      }
    }
    const token = signToken({ sub: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      profile: loginUserToProfile(user),
    });
  } catch (e) {
    console.error('[auth/login]', e);
    res.status(500).json({ error: 'Connexion impossible.', ...authErrorPayload(e) });
  }
});

router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable.' });
      return;
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name }, profile: userToProfile(user) });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.patch('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { name: name?.trim() || null },
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, profile: userToProfile(user) });
  } catch {
    res.status(500).json({ error: 'Mise à jour impossible.' });
  }
});

/** Lecture SMTP compte (mot de passe jamais renvoyé). */
router.get('/smtp-settings', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { smtpSettings: true },
    });
    const s = (row?.smtpSettings as SmtpStored | null) ?? null;
    const pass = s?.pass;
    res.json({
      host: typeof s?.host === 'string' ? s.host : '',
      port: typeof s?.port === 'number' ? s.port : 587,
      user: typeof s?.user === 'string' ? s.user : '',
      from: typeof s?.from === 'string' ? s.from : '',
      has_password: typeof pass === 'string' && pass.length > 0,
    });
  } catch {
    res.status(500).json({ error: 'Lecture SMTP impossible.' });
  }
});

/** Enregistre le SMTP du compte (utilisé par Emailer si la campagne n’a pas de config dédiée). */
router.put('/smtp-settings', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const existing = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { smtpSettings: true },
    });
    const prev = (existing?.smtpSettings as SmtpStored | null) ?? {};
    const passIn = typeof b.pass === 'string' ? b.pass : '';
    const nextPass = passIn.trim() ? passIn.trim() : (typeof prev.pass === 'string' ? prev.pass : '');
    const portRaw = b.port;
    const port =
      typeof portRaw === 'number'
        ? portRaw
        : typeof portRaw === 'string' && portRaw.trim()
          ? Number(portRaw)
          : undefined;
    const next: SmtpStored = {
      host: typeof b.host === 'string' ? b.host.trim() : prev.host ?? '',
      port: Number.isFinite(port) ? (port as number) : (typeof prev.port === 'number' ? prev.port : 587),
      user: typeof b.user === 'string' ? b.user.trim() : prev.user ?? '',
      from: typeof b.from === 'string' ? b.from.trim() : prev.from ?? '',
      pass: nextPass,
    };
    await prisma.user.update({
      where: { id: req.userId! },
      data: { smtpSettings: next as unknown as Prisma.InputJsonValue },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Enregistrement SMTP impossible.' });
  }
});

/** Test connexion SMTP (formulaire ou mot de passe déjà enregistré si use_saved_password). */
router.post('/smtp-test', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const b = req.body as {
      smtp_config?: SmtpStored;
      use_saved_password?: boolean;
    };
    const row = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { smtpSettings: true },
    });
    const saved = (row?.smtpSettings as SmtpStored | null) ?? {};
    const incoming = b.smtp_config && typeof b.smtp_config === 'object' ? b.smtp_config : {};
    const merged: Record<string, unknown> = { ...saved, ...incoming };
    if (b.use_saved_password && typeof saved.pass === 'string' && saved.pass) {
      merged.pass = saved.pass;
    }
    const smtpConfig = resolveSmtpConfig(merged);
    if (!smtpConfig.host) {
      res.status(400).json({ ok: false, error: 'Serveur SMTP (host) requis.' });
      return;
    }
    const transporter = buildTransporter(smtpConfig);
    await transporter.verify();
    res.json({ ok: true, message: 'Connexion SMTP réussie.', from: smtpConfig.from });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Connexion SMTP échouée.',
    });
  }
});

/** Envoie un email de test (même fusion SMTP que smtp-test). */
router.post('/smtp-send-test', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const b = req.body as {
      to?: string;
      smtp_config?: SmtpStored;
      use_saved_password?: boolean;
    };
    const to = typeof b.to === 'string' ? b.to.trim() : '';
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      res.status(400).json({ ok: false, error: 'Adresse email destinataire invalide.' });
      return;
    }
    const row = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { smtpSettings: true },
    });
    const saved = (row?.smtpSettings as SmtpStored | null) ?? {};
    const incoming = b.smtp_config && typeof b.smtp_config === 'object' ? b.smtp_config : {};
    const merged: Record<string, unknown> = { ...saved, ...incoming };
    if (b.use_saved_password && typeof saved.pass === 'string' && saved.pass) {
      merged.pass = saved.pass;
    }
    const smtpConfig = resolveSmtpConfig(merged);
    if (!smtpConfig.host) {
      res.status(400).json({ ok: false, error: 'Serveur SMTP (host) requis.' });
      return;
    }
    const transporter = buildTransporter(smtpConfig);
    const userEmail = smtpConfig.user.trim();
    const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) ? userEmail : undefined;
    await transporter.sendMail({
      from: smtpConfig.from,
      ...(replyTo ? { replyTo } : {}),
      to,
      subject: 'Revamperr — test SMTP',
      text: 'Si vous recevez ce message, votre configuration SMTP fonctionne.',
      html: '<p>Si vous recevez ce message, votre configuration SMTP fonctionne.</p>',
    });
    res.json({ ok: true, message: 'Email de test envoyé.' });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Envoi de l'email de test échoué.",
    });
  }
});

export default router;
