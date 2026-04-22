import { apiJson } from '../lib/api';

export type CampaignStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

export interface Contact {
  email: string;
  name?: string;
  company?: string;
  siteUrl?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface AiContext {
  language?: 'fr' | 'en';
  tone?: 'formal' | 'friendly' | 'bold';
  generatedAt?: string;
}

export interface EmailTemplate {
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export interface EmailerCampaign {
  id: string;
  user_id: string;
  name: string;
  status: CampaignStatus;
  contacts: Contact[];
  template: EmailTemplate;
  ai_context: AiContext | null;
  smtp_config: SmtpConfig | null;
  revamper_project_id: string | null;
  stats: CampaignStats | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignParams {
  name: string;
  contacts?: Contact[];
  template?: EmailTemplate;
  ai_context?: AiContext;
  smtp_config?: SmtpConfig | null;
  revamper_project_id?: string | null;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function listCampaigns() {
  return apiJson<EmailerCampaign[]>('/api/emailer/campaigns');
}

export function getCampaign(id: string) {
  return apiJson<EmailerCampaign>(`/api/emailer/campaigns/${id}`);
}

export function createCampaign(params: CreateCampaignParams) {
  return apiJson<EmailerCampaign>('/api/emailer/campaigns', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateCampaign(id: string, params: Partial<CreateCampaignParams>) {
  return apiJson<EmailerCampaign>(`/api/emailer/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function deleteCampaign(id: string) {
  return apiJson<void>(`/api/emailer/campaigns/${id}`, { method: 'DELETE' });
}

// ── IA + Envoi ───────────────────────────────────────────────────────────────

export interface GenerateParams {
  language?: 'fr' | 'en';
  tone?: 'formal' | 'friendly' | 'bold';
  site_url?: string;
  /** Origine du frontend (ex. window.location.origin) pour construire le lien /revamper/public/:id */
  public_app_url?: string;
}

export function generateCampaignEmail(id: string, params: GenerateParams) {
  return apiJson<{ campaign: EmailerCampaign; generated: EmailTemplate }>(
    `/api/emailer/campaigns/${id}/generate`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export interface SendStats {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export function sendCampaign(id: string) {
  return apiJson<{ stats: SendStats; campaign: EmailerCampaign }>(
    `/api/emailer/campaigns/${id}/send`,
    { method: 'POST' }
  );
}

// ── SMTP ─────────────────────────────────────────────────────────────────────

export function testSmtp(smtpConfig?: Partial<SmtpConfig>) {
  return apiJson<{ ok: boolean; message?: string; error?: string; from?: string }>(
    '/api/emailer/smtp/test',
    { method: 'POST', body: JSON.stringify(smtpConfig ? { smtp_config: smtpConfig } : {}) }
  );
}
