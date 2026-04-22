import type { RevamperProject, ImagerProject, User, EmailerCampaign } from '../generated/prisma/client';

export function revamperToApi(p: RevamperProject) {
  return {
    id: p.id,
    user_id: p.userId,
    guest_session_id: p.guestSessionId,
    title: p.title,
    source_url: p.sourceUrl,
    analysis: p.analysis,
    html: p.html,
    css: p.css,
    js: p.js,
    model_id: p.modelId,
    style_preference: p.stylePreference,
    status: p.status,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export function imagerToApi(p: ImagerProject) {
  return {
    id: p.id,
    owner_id: p.userId,
    guest_session_id: p.guestSessionId,
    brand_name: p.brandName,
    brand_colors: p.brandColors,
    brand_logo_url: p.brandLogoUrl,
    brand_fonts: p.brandFonts,
    brand_description: p.brandDescription,
    target_audience: p.targetAudience,
    tone_of_voice: p.toneOfVoice,
    output_language: p.outputLanguage,
    generated_assets: p.generatedAssets,
    status: p.status,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export function emailerToApi(c: EmailerCampaign) {
  return {
    id: c.id,
    user_id: c.userId,
    name: c.name,
    status: c.status,
    contacts: c.contacts,
    template: c.template,
    ai_context: c.aiContext,
    smtp_config: c.smtpConfig,
    revamper_project_id: c.revamperProjectId,
    stats: c.stats,
    sent_at: c.sentAt?.toISOString() ?? null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function userToProfile(u: User) {
  return {
    id: u.id,
    role: 'professional' as const,
    subscription_plan: u.plan === 'FREE' ? ('free' as const) : u.plan === 'PRO' ? ('premium' as const) : ('enterprise' as const),
    full_name: u.name ?? '',
    company_name: null as string | null,
    avatar_url: null as string | null,
    onboarding_completed: true,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  };
}

/** Profil API pour POST /login (champs issus d’un `select` Prisma ciblé). */
export function loginUserToProfile(u: {
  id: string;
  plan: User['plan'];
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: u.id,
    role: 'professional' as const,
    subscription_plan:
      u.plan === 'FREE' ? ('free' as const) : u.plan === 'PRO' ? ('premium' as const) : ('enterprise' as const),
    full_name: u.name ?? '',
    company_name: null as string | null,
    avatar_url: null as string | null,
    onboarding_completed: true,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  };
}
