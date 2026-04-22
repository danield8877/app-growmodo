import { apiJson } from '../lib/api';

export type SmtpSettingsResponse = {
  host: string;
  port: number;
  user: string;
  from: string;
  has_password: boolean;
};

export async function getSmtpSettings(): Promise<SmtpSettingsResponse> {
  return apiJson<SmtpSettingsResponse>('/api/auth/smtp-settings');
}

export async function saveSmtpSettings(input: {
  host: string;
  port: number;
  user: string;
  from: string;
  /** Vide = conserver le mot de passe déjà enregistré */
  pass?: string;
}): Promise<{ ok: boolean }> {
  return apiJson<{ ok: boolean }>('/api/auth/smtp-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function testSmtpSettings(input: {
  host: string;
  port: number;
  user: string;
  from: string;
  pass?: string;
  use_saved_password?: boolean;
}): Promise<{ ok: boolean; message?: string; error?: string; from?: string }> {
  return apiJson<{ ok: boolean; message?: string; error?: string; from?: string }>(
    '/api/auth/smtp-test',
    {
      method: 'POST',
      body: JSON.stringify({
        smtp_config: {
          host: input.host,
          port: input.port,
          user: input.user,
          from: input.from,
          ...(input.pass?.trim() ? { pass: input.pass.trim() } : {}),
        },
        use_saved_password: input.use_saved_password === true,
      }),
    }
  );
}

/** Envoie un email de test au destinataire indiqué (même config que testSmtpSettings). */
export async function sendSmtpTestEmail(input: {
  to: string;
  host: string;
  port: number;
  user: string;
  from: string;
  pass?: string;
  use_saved_password?: boolean;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  return apiJson<{ ok: boolean; message?: string; error?: string }>(
    '/api/auth/smtp-send-test',
    {
      method: 'POST',
      body: JSON.stringify({
        to: input.to.trim(),
        smtp_config: {
          host: input.host,
          port: input.port,
          user: input.user,
          from: input.from,
          ...(input.pass?.trim() ? { pass: input.pass.trim() } : {}),
        },
        use_saved_password: input.use_saved_password === true,
      }),
    }
  );
}
