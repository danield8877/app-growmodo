import { prisma } from '../db';
import { ensureAbsoluteDemoLink } from './generateEmail';
import { buildRevamperPublicDemoUrl, resolvePublicAppBase } from './publicAppUrl';
import { buildTransporter, resolveSmtpConfig } from './buildTransporter';
import { JobStatus, type Prisma } from '../../generated/prisma/client';

export interface Contact {
  email: string;
  name?: string;
  company?: string;
  siteUrl?: string;
}

interface SendStats {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

function interpolate(template: string, contact: Contact, previewUrl: string): string {
  return template
    .replace(/\{\{name\}\}/g, contact.name ?? '')
    .replace(/\{\{company\}\}/g, contact.company ?? '')
    .replace(/\{\{siteUrl\}\}/g, contact.siteUrl ?? '')
    .replace(/\{\{previewUrl\}\}/g, previewUrl);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function sendCampaign(campaignId: string): Promise<SendStats> {
  const campaign = await prisma.emailerCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campagne introuvable.');

  const owner = await prisma.user.findUnique({
    where: { id: campaign.userId },
    select: { smtpSettings: true },
  });

  const template = campaign.template as Record<string, unknown>;
  const subject = typeof template.subject === 'string' ? template.subject : '(Sans objet)';
  let bodyHtml = typeof template.bodyHtml === 'string' ? template.bodyHtml : '';
  let bodyText = typeof template.bodyText === 'string' ? template.bodyText : undefined;

  if (!bodyHtml) throw new Error('Template vide. Génère d\'abord le contenu via /generate.');

  const aiCtx = (campaign.aiContext ?? {}) as Record<string, unknown>;
  const isEn = aiCtx.language === 'en';
  const demoUrl = buildRevamperPublicDemoUrl(campaign.revamperProjectId, resolvePublicAppBase()) ?? '';
  if (demoUrl) {
    bodyHtml = ensureAbsoluteDemoLink(
      bodyHtml,
      demoUrl,
      isEn ? 'View the demo online' : 'Voir la démo en ligne'
    );
    if (bodyText && !bodyText.includes(demoUrl)) {
      bodyText = `${bodyText.trimEnd()}\n\n${isEn ? 'Demo' : 'Démo'}: ${demoUrl}`;
    }
  }

  const rawContacts = Array.isArray(campaign.contacts) ? (campaign.contacts as unknown[]) : [];
  const contacts: Contact[] = rawContacts.map((c) => {
    const o = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
    return {
      email: typeof o.email === 'string' ? o.email.trim() : '',
      name: typeof o.name === 'string' ? o.name.trim() : undefined,
      company: typeof o.company === 'string' ? o.company.trim() : undefined,
      siteUrl: typeof o.siteUrl === 'string' ? o.siteUrl.trim() : undefined,
    };
  }).filter((c) => c.email.includes('@'));

  await prisma.emailerCampaign.update({
    where: { id: campaignId },
    data: { status: JobStatus.RUNNING },
  });

  const smtpConfig = resolveSmtpConfig(
    campaign.smtpConfig !== null && campaign.smtpConfig !== undefined
      ? campaign.smtpConfig
      : owner?.smtpSettings ?? undefined
  );
  if (!smtpConfig.from.trim()) {
    throw new Error(
      'Expéditeur (From) manquant : renseignez l’email expéditeur dans Paramètres → SMTP ou SMTP_FROM / SMTP_USER sur le serveur.'
    );
  }
  const transporter = buildTransporter(smtpConfig);

  const stats: SendStats = { total: contacts.length, sent: 0, failed: 0, errors: [] };

  for (const contact of contacts) {
    try {
      const userEmail = smtpConfig.user.trim();
      const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) ? userEmail : undefined;

      await transporter.sendMail({
        from: smtpConfig.from,
        ...(replyTo ? { replyTo } : {}),
        to: contact.email,
        subject: interpolate(subject, contact, demoUrl),
        html: interpolate(bodyHtml, contact, demoUrl),
        text: bodyText ? interpolate(bodyText, contact, demoUrl) : undefined,
      });
      stats.sent += 1;
    } catch (e) {
      stats.failed += 1;
      stats.errors.push({
        email: contact.email,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Délai anti-spam entre chaque envoi
    if (contacts.indexOf(contact) < contacts.length - 1) {
      await sleep(2000);
    }
  }

  const finalStatus = stats.failed === stats.total ? JobStatus.FAILED : JobStatus.DONE;

  await prisma.emailerCampaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      stats: stats as unknown as Prisma.InputJsonValue,
      sentAt: new Date(),
    },
  });

  return stats;
}
