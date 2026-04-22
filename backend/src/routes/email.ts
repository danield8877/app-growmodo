import { Router } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body as {
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
    };
    if (!to?.trim() || !subject?.trim() || (!text?.trim() && !html?.trim())) {
      res.status(400).json({ error: 'to, subject et text (ou html) requis.' });
      return;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? user ?? 'noreply@localhost';

    if (!host) {
      res.status(503).json({
        error: 'SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM).',
      });
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to: to.trim(),
      subject: subject.trim(),
      text: text?.trim() || undefined,
      html: html?.trim() || undefined,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Envoi impossible.' });
  }
});

export default router;
