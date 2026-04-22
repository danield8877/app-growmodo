import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/** Détecte une adresse email dans une chaîne (expéditeur brut ou "Nom <email>"). */
function extractEmailFromFromField(raw: string): string | null {
  const m = raw.match(/<([^>]+)>/);
  const candidate = (m?.[1] ?? raw).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return candidate;
  return null;
}

/**
 * Assure un en-tête From valide pour éviter les expéditeurs vides / bizarres (spam, avertissements).
 * Si l’expéditeur n’a pas d’email, on utilise le compte SMTP (`user`) comme adresse.
 */
export function normalizeMailFrom(fromRaw: string, smtpUser: string): string {
  const user = smtpUser.trim();
  const from = fromRaw.trim();
  if (!from && !user) return '';
  if (!from) return user;

  if (from.includes('<')) {
    return extractEmailFromFromField(from) ? from : user;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    return from;
  }

  if (user && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    const escaped = from.replace(/"/g, '\\"');
    return `"${escaped}" <${user}>`;
  }

  return user || from;
}

export function resolveSmtpConfig(override?: unknown): SmtpConfig {
  const o = override && typeof override === 'object' && !Array.isArray(override)
    ? (override as Record<string, unknown>)
    : {};

  const host = typeof o.host === 'string' && o.host.trim() ? o.host.trim() : (process.env.SMTP_HOST ?? '');
  const port = typeof o.port === 'number' ? o.port : Number(process.env.SMTP_PORT ?? 587);
  const user = typeof o.user === 'string' && o.user.trim() ? o.user.trim() : (process.env.SMTP_USER ?? '');
  const pass = typeof o.pass === 'string' && o.pass.trim() ? o.pass.trim() : (process.env.SMTP_PASS ?? '');
  const fromRaw = typeof o.from === 'string' && o.from.trim() ? o.from.trim() : (process.env.SMTP_FROM ?? '');
  const from = normalizeMailFrom(fromRaw || user, user);

  return { host, port, user, pass, from };
}

export function buildTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });
}
