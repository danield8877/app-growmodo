import { apiJson, apiFetch, getAccessToken, getGuestToken } from '../../lib/api';
import type { ImagerProject, CreateImagerProjectInput, GeneratedAsset } from './types';

function requireToken(): void {
  if (!getAccessToken() && !getGuestToken()) throw new Error('Authentification requise');
}

export const imagerProjectsService = {
  async getMyProjects(_userId: string): Promise<ImagerProject[]> {
    requireToken();
    return apiJson<ImagerProject[]>('/api/imager');
  },

  async getProject(projectId: string): Promise<ImagerProject | null> {
    requireToken();
    try {
      return await apiJson<ImagerProject>(`/api/imager/${encodeURIComponent(projectId)}`);
    } catch {
      return null;
    }
  },

  async createProject(_userId: string, input: CreateImagerProjectInput): Promise<ImagerProject> {
    requireToken();
    return apiJson<ImagerProject>('/api/imager', {
      method: 'POST',
      body: JSON.stringify({
        brand_name: input.brand_name,
        brand_colors: input.brand_colors || { primary: '#000000', secondary: '#ffffff', accent: '#0066cc' },
        brand_logo_url: input.brand_logo_url,
        brand_fonts: input.brand_fonts || { heading: 'Inter', body: 'Inter' },
        brand_description: input.brand_description,
        target_audience: input.target_audience,
        tone_of_voice: input.tone_of_voice || 'professional',
        output_language: input.output_language || 'fr',
      }),
    });
  },

  async updateProject(
    projectId: string,
    updates: Partial<Omit<ImagerProject, 'id' | 'owner_id' | 'created_at'>>
  ): Promise<ImagerProject> {
    requireToken();
    const body: Record<string, unknown> = { ...updates };
    if ('brand_name' in updates) body.brand_name = updates.brand_name;
    if ('brand_colors' in updates) body.brand_colors = updates.brand_colors;
    if ('brand_logo_url' in updates) body.brand_logo_url = updates.brand_logo_url;
    if ('brand_fonts' in updates) body.brand_fonts = updates.brand_fonts;
    if ('brand_description' in updates) body.brand_description = updates.brand_description;
    if ('target_audience' in updates) body.target_audience = updates.target_audience;
    if ('tone_of_voice' in updates) body.tone_of_voice = updates.tone_of_voice;
    if ('output_language' in updates) body.output_language = updates.output_language;
    if ('generated_assets' in updates) body.generated_assets = updates.generated_assets;
    if ('status' in updates) body.status = updates.status;

    return apiJson<ImagerProject>(`/api/imager/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async deleteProject(projectId: string): Promise<void> {
    requireToken();
    const res = await apiFetch(`/api/imager/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },

  async addGeneratedAsset(projectId: string, asset: GeneratedAsset): Promise<ImagerProject> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');
    const updatedAssets = [...project.generated_assets, asset];
    return this.updateProject(projectId, { generated_assets: updatedAssets });
  },

  async removeGeneratedAsset(projectId: string, assetId: string): Promise<ImagerProject> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');
    const updatedAssets = project.generated_assets.filter((a) => a.id !== assetId);
    return this.updateProject(projectId, { generated_assets: updatedAssets });
  },

  async uploadLogo(_userId: string, projectId: string, file: File): Promise<string> {
    requireToken();
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch(`/api/imager/${encodeURIComponent(projectId)}/logo`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const raw = await res.text();
      let msg = raw;
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (typeof j.error === 'string') msg = j.error;
      } catch {
        /* brut */
      }
      throw new Error(msg || 'Upload impossible');
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  },

  async uploadGeneratedImage(
    _userId: string,
    projectId: string,
    blob: Blob,
    filename: string
  ): Promise<string> {
    requireToken();
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    return this.uploadLogo(_userId, projectId, file);
  },

  /** Génère plusieurs logos (Grok Imagine) avant création du projet. */
  async generateLogos(input: {
    brand_name: string;
    tone_of_voice?: string;
    logo_prompt?: string;
  }): Promise<{ draftId: string; urls: string[]; prompt: string }> {
    requireToken();
    return apiJson('/api/imager/generate-logos', {
      method: 'POST',
      body: JSON.stringify({
        brand_name: input.brand_name,
        tone_of_voice: input.tone_of_voice,
        logo_prompt: input.logo_prompt,
      }),
    });
  },

  /** Palette dérivée d’une image déjà sous `/uploads/...`. */
  async extractPalette(imageUrl: string): Promise<{ primary: string; secondary: string; accent: string }> {
    requireToken();
    return apiJson('/api/imager/extract-palette', {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    });
  },
};
