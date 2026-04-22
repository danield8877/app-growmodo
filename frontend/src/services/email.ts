import { apiJson } from '../lib/api';

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  return apiJson<{ ok: boolean }>('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ to, subject, text, html }),
  });
}
