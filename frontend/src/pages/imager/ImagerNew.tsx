import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Upload, Palette, Type, Users, Sparkles, Loader2, Wand2, ZoomIn, X } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../lib/api';
import { imagerProjectsService, type ToneOfVoice, type BrandColors } from '../../services/imager';

const TONE_VALUES: ToneOfVoice[] = ['professional', 'friendly', 'bold', 'luxury', 'playful', 'minimalist'];

export default function ImagerNew() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoGenPrompt, setLogoGenPrompt] = useState('');
  const [draftLogoUrls, setDraftLogoUrls] = useState<string[]>([]);
  const [selectedDraftUrl, setSelectedDraftUrl] = useState<string | null>(null);
  const [generatingLogos, setGeneratingLogos] = useState(false);
  /** Aperçu plein écran (logo uploadé ou proposition IA) */
  const [logoLightboxUrl, setLogoLightboxUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    brand_name: '',
    brand_description: '',
    target_audience: '',
    tone_of_voice: 'professional' as ToneOfVoice,
    primary_color: '#0066cc',
    secondary_color: '#ffffff',
    accent_color: '#000000',
    heading_font: 'Inter',
    body_font: 'Inter',
  });

  const clearGeneratedLogos = () => {
    setDraftLogoUrls([]);
    setSelectedDraftUrl(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      clearGeneratedLogos();
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateLogos = async () => {
    if (!user || !formData.brand_name.trim()) return;
    try {
      setGeneratingLogos(true);
      clearGeneratedLogos();
      setLogoFile(null);
      setLogoPreview('');
      const out = await imagerProjectsService.generateLogos({
        brand_name: formData.brand_name.trim(),
        tone_of_voice: formData.tone_of_voice,
        logo_prompt: logoGenPrompt.trim() || undefined,
      });
      setDraftLogoUrls(out.urls);
      if (out.urls[0]) {
        void selectDraftLogo(out.urls[0]);
      }
    } catch (error) {
      console.error('generate logos:', error);
      alert(t('dashboard.imager.new.logoGenError'));
    } finally {
      setGeneratingLogos(false);
    }
  };

  const selectDraftLogo = async (url: string) => {
    setSelectedDraftUrl(url);
    setLogoPreview(resolveMediaUrl(url));
    try {
      const pal = await imagerProjectsService.extractPalette(url);
      setFormData((prev) => ({
        ...prev,
        primary_color: pal.primary,
        secondary_color: pal.secondary,
        accent_color: pal.accent,
      }));
    } catch {
      /* palette facultative */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);

      let logoUrl = '';
      if (logoFile) {
        const tempProject = await imagerProjectsService.createProject(user.id, {
          brand_name: formData.brand_name,
        });
        logoUrl = await imagerProjectsService.uploadLogo(user.id, tempProject.id, logoFile);
        await imagerProjectsService.deleteProject(tempProject.id);
      } else if (selectedDraftUrl) {
        logoUrl = selectedDraftUrl;
      }

      const brandColors: BrandColors = {
        primary: formData.primary_color,
        secondary: formData.secondary_color,
        accent: formData.accent_color,
      };

      const project = await imagerProjectsService.createProject(user.id, {
        brand_name: formData.brand_name,
        brand_colors: brandColors,
        brand_logo_url: logoUrl,
        brand_fonts: {
          heading: formData.heading_font,
          body: formData.body_font,
        },
        brand_description: formData.brand_description,
        target_audience: formData.target_audience,
        tone_of_voice: formData.tone_of_voice,
      });

      navigate(`/imager/${project.id}`);
    } catch (error) {
      console.error('Error creating imager project:', error);
      alert(t('dashboard.imager.new.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.imager.new.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('dashboard.imager.new.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="glass-panel space-y-6 rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Sparkles size={24} className="text-primary" />
              {t('dashboard.imager.new.sectionBrand')}
            </h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.brandName')}</label>
              <input
                type="text"
                required
                value={formData.brand_name}
                onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                placeholder={t('dashboard.imager.new.brandNamePh')}
              />
            </div>

            <div className="space-y-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.logoOptional')}</label>
              <div className="flex flex-wrap items-center gap-4">
                {logoPreview && (
                  <div className="relative shrink-0">
                    <img
                      src={logoPreview}
                      alt=""
                      className="h-20 w-20 rounded-lg border-2 border-gray-300 object-contain dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoLightboxUrl(logoPreview)}
                      className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      title={t('dashboard.imager.zoomLogo')}
                      aria-label={t('dashboard.imager.zoomLogo')}
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 transition-all hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
                  <Upload size={20} />
                  <span>{t('dashboard.imager.new.uploadLogo')}</span>
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
              </div>

              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('dashboard.imager.new.logoAiHint')}</p>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.logoPromptLabel')}</label>
                <input
                  type="text"
                  value={logoGenPrompt}
                  onChange={(e) => setLogoGenPrompt(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  placeholder={t('dashboard.imager.new.logoPromptPh')}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!formData.brand_name.trim() || generatingLogos}
                    onClick={handleGenerateLogos}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingLogos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {generatingLogos ? t('dashboard.imager.new.generatingLogos') : t('dashboard.imager.new.createLogo')}
                  </button>
                  {draftLogoUrls.length > 0 && (
                    <button
                      type="button"
                      disabled={!formData.brand_name.trim() || generatingLogos}
                      onClick={handleGenerateLogos}
                      className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {t('dashboard.imager.new.regenerateLogos')}
                    </button>
                  )}
                </div>
                {draftLogoUrls.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">{t('dashboard.imager.new.pickLogo')}</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {draftLogoUrls.map((u) => (
                        <div
                          key={u}
                          className={`relative overflow-hidden rounded-xl border-2 bg-white p-2 transition-all dark:bg-gray-900 ${
                            selectedDraftUrl === u ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:border-primary/50 dark:border-gray-600'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => void selectDraftLogo(u)}
                            className="flex w-full min-h-[6rem] items-center justify-center"
                          >
                            <img src={resolveMediaUrl(u)} alt="" className="mx-auto max-h-24 w-full object-contain" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogoLightboxUrl(resolveMediaUrl(u));
                            }}
                            className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 bg-white/95 shadow-md text-gray-700 backdrop-blur-sm transition hover:bg-white dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-200"
                            title={t('dashboard.imager.zoomLogo')}
                            aria-label={t('dashboard.imager.zoomLogo')}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('dashboard.imager.new.paletteFromLogo')}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.brandDesc')}</label>
              <textarea
                value={formData.brand_description}
                onChange={(e) => setFormData({ ...formData, brand_description: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                placeholder={t('dashboard.imager.new.brandDescPh')}
              />
            </div>
          </div>

          <div className="glass-panel space-y-6 rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Palette size={24} className="text-primary" />
              {t('dashboard.imager.new.sectionColors')}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.primary')}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="h-12 w-16 cursor-pointer rounded-lg"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.secondary')}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="h-12 w-16 cursor-pointer rounded-lg"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.accent')}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    className="h-12 w-16 cursor-pointer rounded-lg"
                  />
                  <input
                    type="text"
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel space-y-6 rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Type size={24} className="text-primary" />
              {t('dashboard.imager.new.sectionType')}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.headingFont')}</label>
                <input
                  type="text"
                  value={formData.heading_font}
                  onChange={(e) => setFormData({ ...formData, heading_font: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800"
                  placeholder={t('dashboard.imager.new.fontPh')}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.bodyFont')}</label>
                <input
                  type="text"
                  value={formData.body_font}
                  onChange={(e) => setFormData({ ...formData, body_font: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800"
                  placeholder={t('dashboard.imager.new.fontPh')}
                />
              </div>
            </div>
          </div>

          <div className="glass-panel space-y-6 rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
              <Users size={24} className="text-primary" />
              {t('dashboard.imager.new.sectionAudience')}
            </h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.targetAudience')}</label>
              <input
                type="text"
                value={formData.target_audience}
                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800"
                placeholder={t('dashboard.imager.new.targetPh')}
              />
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.imager.new.toneTitle')}</label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {TONE_VALUES.map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all ${
                      formData.tone_of_voice === value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 hover:border-primary/50 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tone"
                      value={value}
                      checked={formData.tone_of_voice === value}
                      onChange={(e) => setFormData({ ...formData, tone_of_voice: e.target.value as ToneOfVoice })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {t(`dashboard.imager.new.tones.${value}.label` as const)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t(`dashboard.imager.new.tones.${value}.desc` as const)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/imager')}
              className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-all hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('dashboard.imager.new.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !formData.brand_name}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('dashboard.imager.new.creating') : t('dashboard.imager.new.submit')}
            </button>
          </div>
        </form>
      </div>

      {logoLightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLogoLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.imager.zoomLogo')}
        >
          <button
            type="button"
            onClick={() => setLogoLightboxUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white p-2 shadow-lg transition hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
            aria-label={t('dashboard.imager.result.closePreview')}
          >
            <X size={22} />
          </button>
          <img
            src={logoLightboxUrl}
            alt=""
            className="max-h-[min(85vh,900px)] max-w-[min(92vw,1200px)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
