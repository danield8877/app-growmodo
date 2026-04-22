import { useState, useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Palette,
  Type,
  Download,
  Sparkles,
  Trash2,
  X,
  Wand2,
  Plus,
  Share2,
  Settings,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Video,
  Mail,
  CreditCard,
  FileText,
  Eye,
  Edit,
  LayoutGrid,
  Filter,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  Shapes,
  ZoomIn,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  imagerProjectsService,
  generateAssetService,
  type ImagerProject,
  type AssetType,
  type OutputLanguageCode,
  ASSET_DIMENSIONS,
} from '../../services/imager';
import { resizeImageToBlob } from '../../services/imager/imageResize';
import { resolveMediaUrl } from '../../lib/api';

/** Dimensions d'affichage : toujours celles du type d'asset (fallback pour anciens assets sans width/height). */
function getAssetDimensions(asset: { type?: AssetType; width?: number; height?: number }) {
  const dims = asset.type ? ASSET_DIMENSIONS[asset.type] : ASSET_DIMENSIONS['instagram-post'];
  return {
    width: asset.width ?? dims?.width ?? 1080,
    height: asset.height ?? dims?.height ?? 1080,
  };
}

/**
 * Cadre plein écran sans bandes noires latérales : ne pas combiner `w-full` + `max-h` avec `aspect-ratio`
 * (la hauteur était plafonnée mais la largeur restait à 100 %, ce qui cassait le ratio).
 */
function previewFrameStyle(width: number, height: number): CSSProperties {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  return {
    aspectRatio: `${w} / ${h}`,
    width: `min(100%, calc(85vh * ${w} / ${h}))`,
    maxWidth: '100%',
  };
}

const OUTPUT_LANG_CODES: OutputLanguageCode[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'];

/** Dégradé et bordure à partir des couleurs marque (remplace le violet générique). */
function brandTileStyle(colors: { primary?: string; secondary?: string; accent?: string }): CSSProperties {
  const primary = colors.primary || '#2563eb';
  const accent = colors.accent || colors.secondary || primary;
  const rgba = (hex: string, a: number) => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return `rgba(37, 99, 235, ${a})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  return {
    background: `linear-gradient(145deg, ${rgba(primary, 0.2)} 0%, ${rgba(accent, 0.28)} 100%)`,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: rgba(primary, 0.42),
  };
}

const assetTypeIcons: Record<AssetType, React.ElementType> = {
  'facebook-ad': Facebook,
  'instagram-post': Instagram,
  'instagram-story': Instagram,
  'linkedin-post': Linkedin,
  'linkedin-banner': Linkedin,
  'twitter-post': Twitter,
  'animated-logo': Sparkles,
  'logo-remake': RefreshCw,
  'video-intro': Video,
  'animate-image': Video,
  'business-card': CreditCard,
  'email-signature': Mail,
  'presentation-template': FileText,
  'social-cover': Share2,
  'brand-icon': Shapes,
};

export default function ImagerResult() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const labelFor = (type: AssetType) => t(`dashboard.imager.assetTypes.${type}`);
  const [project, setProject] = useState<ImagerProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [enrichingContext, setEnrichingContext] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [gridColumns, setGridColumns] = useState<3 | 6 | 9>(3);
  const [filterType, setFilterType] = useState<AssetType | ''>('');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    brand_name: '',
    brand_description: '',
    primary_color: '#0066cc',
    secondary_color: '#ffffff',
    accent_color: '#000000',
  });
  const [savingProject, setSavingProject] = useState(false);
  const [animatingAssetId, setAnimatingAssetId] = useState<string | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<string>('fr');
  const [logoLightboxUrl, setLogoLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (project) setOutputLanguage(project.output_language?.trim() || 'fr');
  }, [project]);

  const persistOutputLanguage = async (code: string) => {
    if (!project) return;
    try {
      await imagerProjectsService.updateProject(project.id, { output_language: code });
      setProject((p) => (p ? { ...p, output_language: code } : null));
    } catch (e) {
      console.error(e);
    }
  };

  const loadProject = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await imagerProjectsService.getProject(projectId);
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
      navigate('/imager');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAsset = async (assetType: AssetType) => {
    if (!project || !user) return;
    if (!project.brand_logo_url) {
      alert(t('dashboard.imager.result.logoRequired'));
      return;
    }

    try {
      setGenerating(true);

      const effectsPrompt = customPrompt.trim();

      const asset = await generateAssetService.generateAsset(
        {
          projectId: project.id,
          assetType,
          customPrompt: effectsPrompt || undefined,
          additionalContext: additionalContext.trim() || undefined,
          output_language: outputLanguage,
        },
        { ...project, output_language: outputLanguage }
      );

      await imagerProjectsService.addGeneratedAsset(project.id, asset);
      await loadProject();

      setCustomPrompt('');
      setAdditionalContext('');
    } catch (error) {
      console.error('Error generating asset:', error);
      const message = error instanceof Error ? error.message : String(error);
      const isApiError = /Erreur API|API error|Erreur Edge Function|Edge Function|non-2xx|500|401|403|429|546/i.test(message);
      const apiName = 'GROK_API_KEY (ou XAI_API_KEY)';
      alert(
        isApiError
          ? t('dashboard.imager.result.genError', { message })
          : t('dashboard.imager.result.genErrorEnv', { api: apiName })
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleEnrichContext = async () => {
    if (!project) return;
    const raw = additionalContext.trim();
    if (!raw) {
      alert(t('dashboard.imager.result.enrichKeywordsRequired'));
      return;
    }
    try {
      setEnrichingContext(true);
      const { enriched } = await generateAssetService.enrichContext({
        brand_name: project.brand_name,
        tone_of_voice: project.tone_of_voice,
        brand_description: project.brand_description || undefined,
        target_audience: project.target_audience || undefined,
        keywords: raw,
        custom_prompt_hint: customPrompt.trim() || undefined,
      });
      setAdditionalContext(enriched);
    } catch (e) {
      console.error(e);
      alert(t('dashboard.imager.result.enrichContextError'));
    } finally {
      setEnrichingContext(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!project || !confirm(t('dashboard.imager.result.deleteAssetConfirm'))) return;

    try {
      await imagerProjectsService.removeGeneratedAsset(project.id, assetId);
      await loadProject();
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert(t('dashboard.imager.result.deleteAssetError'));
    }
  };

  const handleAnimateAsset = async (asset: { id: string; url: string; width?: number; height?: number; format?: string }) => {
    if (!project || !user || asset.format === 'mp4') return;
    const { width: w, height: h } = getAssetDimensions(asset);
    const ratio = w / h;
    const aspectRatio = ratio > 1.2 ? '16:9' : ratio < 0.85 ? '9:16' : '1:1';
    try {
      setAnimatingAssetId(asset.id);
      const videoAsset = await generateAssetService.animateAssetToVideo(
        project.id,
        asset.url,
        project,
        aspectRatio as '16:9' | '1:1' | '9:16',
        w,
        h
      );
      await imagerProjectsService.addGeneratedAsset(project.id, { ...videoAsset, url: videoAsset.url });
      await loadProject();
    } catch (error) {
      console.error('Error animating asset:', error);
      alert(error instanceof Error ? error.message : t('dashboard.imager.result.videoError'));
    } finally {
      setAnimatingAssetId(null);
    }
  };


  const handleDownloadAsset = async (asset: { url: string; width?: number; height?: number; type: AssetType; format?: string }) => {
    const { width: w, height: h } = getAssetDimensions(asset);
    const fileUrl = resolveMediaUrl(asset.url);
    if (asset.format === 'mp4') {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = `${labelFor(asset.type) || 'asset'}.mp4`;
      a.rel = 'noopener';
      a.target = '_blank';
      a.click();
      return;
    }
    try {
      const res = await fetch(fileUrl, { mode: 'cors' });
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('Canvas context');
      }
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${labelFor(asset.type) || 'asset'}-${w}x${h}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = `${labelFor(asset.type) || 'asset'}.png`;
      a.rel = 'noopener';
      a.target = '_blank';
      a.click();
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !user) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setLogoError(t('dashboard.imager.result.logoFormatError'));
      return;
    }
    setLogoError(null);
    try {
      setUploadingLogo(true);
      const logoUrl = await imagerProjectsService.uploadLogo(user.id, project.id, file);
      await imagerProjectsService.updateProject(project.id, { brand_logo_url: logoUrl });
      await loadProject();
    } catch (error) {
      console.error('Error uploading logo:', error);
      setLogoError(t('dashboard.imager.result.logoUploadError'));
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const openEditProject = () => {
    if (!project) return;
    setProjectForm({
      brand_name: project.brand_name,
      brand_description: project.brand_description || '',
      primary_color: project.brand_colors?.primary || '#0066cc',
      secondary_color: project.brand_colors?.secondary || '#ffffff',
      accent_color: project.brand_colors?.accent || '#000000',
    });
    setEditingProject(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !projectForm.brand_name.trim()) return;
    try {
      setSavingProject(true);
      await imagerProjectsService.updateProject(project.id, {
        brand_name: projectForm.brand_name.trim(),
        brand_description: projectForm.brand_description.trim() || undefined,
        brand_colors: {
          primary: projectForm.primary_color,
          secondary: projectForm.secondary_color,
          accent: projectForm.accent_color,
        },
      });
      await loadProject();
      setEditingProject(false);
    } catch (error) {
      console.error('Error updating project:', error);
      alert(t('dashboard.imager.result.updateProjectError'));
    } finally {
      setSavingProject(false);
    }
  };

  const handleEditAsset = async () => {
    if (!project || !editingAsset || !editPrompt.trim() || !user) return;

    try {
      setGenerating(true);
      const asset = await generateAssetService.generateAsset(
        {
          projectId: project.id,
          assetType: editingAsset.type,
          customPrompt: editPrompt,
          output_language: outputLanguage,
        },
        { ...project, output_language: outputLanguage }
      );

      let urlToSave = asset.url;
      if (asset.format !== 'mp4') {
        try {
          const blob = await resizeImageToBlob(asset.url, asset.width, asset.height);
          const filename = `${asset.id}.png`;
          urlToSave = await imagerProjectsService.uploadGeneratedImage(
            user.id,
            project.id,
            blob,
            filename
          );
        } catch (e) {
          console.warn('Redimensionnement ignoré (CORS ou réseau), asset conservé tel quel:', e);
        }
      }

      await imagerProjectsService.addGeneratedAsset(project.id, {
        ...asset,
        url: urlToSave,
      });
      await loadProject();
      setEditingAsset(null);
      setEditPrompt('');
    } catch (error) {
      console.error('Error editing asset:', error);
      alert(t('dashboard.imager.result.editAssetError'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">{t('dashboard.imager.result.notFound')}</p>
        </div>
      </DashboardLayout>
    );
  }

  const assetTypes = Object.keys(ASSET_DIMENSIONS) as AssetType[];

  const filteredAndSortedAssets = (() => {
    if (!project?.generated_assets?.length) return [];
    let list = [...project.generated_assets];
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filterType) list = list.filter((a) => a.type === filterType);
    if (filterDate !== 'all') {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const cutoff =
        filterDate === 'today' ? now - day
        : filterDate === 'week' ? now - 7 * day
        : now - 30 * day;
      list = list.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
    }
    return list;
  })();

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-start gap-2">
              <div className="relative">
                <div className="w-24 h-24 rounded-xl glass-panel p-2 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800/50">
                  {project.brand_logo_url ? (
                    <img
                      src={resolveMediaUrl(project.brand_logo_url)}
                      alt={project.brand_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                {project.brand_logo_url && (
                  <button
                    type="button"
                    onClick={() => setLogoLightboxUrl(resolveMediaUrl(project.brand_logo_url!))}
                    className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    title={t('dashboard.imager.zoomLogo')}
                    aria-label={t('dashboard.imager.zoomLogo')}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                )}
              </div>
              <label className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Upload size={16} />
                {project.brand_logo_url ? t('dashboard.imager.result.changeLogo') : t('dashboard.imager.result.uploadLogo')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="sr-only"
                />
              </label>
              {uploadingLogo && <span className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.imager.result.uploadingLogo')}</span>}
              {logoError && <span className="text-xs text-red-500">{logoError}</span>}
              {project.brand_logo_url && (
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                  {t('dashboard.imager.result.logoUsedFor')}
                </p>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {project.brand_name}
                </h1>
                <button
                  type="button"
                  onClick={openEditProject}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  title={t('dashboard.imager.result.editProject')}
                >
                  <Settings size={20} />
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {project.brand_description || t('dashboard.imager.result.projectFallback')}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex gap-2">
                  {Object.entries(project.brand_colors).slice(0, 4).map(([key, color]) => (
                    <div
                      key={key}
                      className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800"
                      style={{ backgroundColor: color }}
                      title={key}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {project.tone_of_voice}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles size={24} className="text-primary" />
              {t('dashboard.imager.result.generateTitle')}
            </h2>
            <span className="text-xs font-medium uppercase tracking-wide text-primary/90 bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-full">
              {t('dashboard.imager.result.grokImagineOnly')}
            </span>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-5 mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Type size={18} />
              {t('dashboard.imager.result.customizeTitle')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t('dashboard.imager.result.outputLanguageLabel')}
                </label>
                <select
                  value={outputLanguage}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOutputLanguage(v);
                    void persistOutputLanguage(v);
                  }}
                  className="w-full max-w-md px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {OUTPUT_LANG_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`dashboard.imager.result.outputLang.${code}`)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('dashboard.imager.result.outputLanguageHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t('dashboard.imager.result.customPromptLabel')}
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t('dashboard.imager.result.customPromptPh')}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('dashboard.imager.result.contextLabel')}
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleEnrichContext()}
                    disabled={enrichingContext || generating}
                    title={t('dashboard.imager.result.enrichContextTitle')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 dark:border-primary/50 dark:bg-primary/10"
                  >
                    {enrichingContext ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {enrichingContext ? t('dashboard.imager.result.enrichingContext') : t('dashboard.imager.result.enrichContext')}
                  </button>
                </div>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder={t('dashboard.imager.result.contextPh')}
                  rows={3}
                  className="w-full resize-y min-h-[5rem] px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('dashboard.imager.result.contextKeywordsHint')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('dashboard.imager.result.customizeHint')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
            {assetTypes.map((assetType) => {
              const Icon = assetTypeIcons[assetType];
              return (
                <button
                  key={assetType}
                  type="button"
                  onClick={() => handleGenerateAsset(assetType)}
                  disabled={generating}
                  style={brandTileStyle(project.brand_colors || {})}
                  className="flex w-full flex-col items-center gap-2 p-4 rounded-lg hover:shadow-lg hover:brightness-[1.03] dark:hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <Icon size={24} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm text-center text-gray-800 dark:text-gray-200">
                    {labelFor(assetType)}
                  </span>
                </button>
              );
            })}
          </div>
          {generating && (
            <div className="mt-4 text-center text-primary flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span>{t('dashboard.imager.result.generating')}</span>
            </div>
          )}
        </div>

        {project.generated_assets.length > 0 && (
          <div className="glass-panel rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('dashboard.imager.result.assetsTitleCount', {
                  filtered: filteredAndSortedAssets.length,
                  totalPart:
                    filteredAndSortedAssets.length !== project.generated_assets.length
                      ? ` / ${project.generated_assets.length}`
                      : '',
                })}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <LayoutGrid size={18} />
                  {t('dashboard.imager.result.columns')}
                </span>
                {([3, 6, 9] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setGridColumns(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      gridColumns === n
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Filter size={18} />
                  {t('dashboard.imager.result.filterType')}
                </span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType((e.target.value || '') as AssetType | '')}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{t('dashboard.imager.result.filterAllTypes')}</option>
                  {assetTypes.map((at) => (
                    <option key={at} value={at}>{labelFor(at)}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.imager.result.filterDateLabel')}</span>
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value as 'all' | 'today' | 'week' | 'month')}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">{t('dashboard.imager.result.filterAll')}</option>
                  <option value="today">{t('dashboard.imager.result.filterToday')}</option>
                  <option value="week">{t('dashboard.imager.result.filterWeek')}</option>
                  <option value="month">{t('dashboard.imager.result.filterMonth')}</option>
                </select>
              </div>
            </div>
            {filteredAndSortedAssets.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
                {t('dashboard.imager.result.filterNoMatch')}
              </p>
            ) : (
            <div className={`grid gap-6 items-start ${gridColumns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : gridColumns === 6 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9'}`}>
              {filteredAndSortedAssets.map((asset) => {
                const Icon = assetTypeIcons[asset.type];
                const { width: w, height: h } = getAssetDimensions(asset);
                return (
                  <div key={asset.id} className="group relative w-full min-w-0">
                    <div
                      className="relative w-full min-h-0 overflow-hidden rounded-lg bg-neutral-950 ring-1 ring-white/10"
                      style={{ aspectRatio: `${w} / ${h}` }}
                    >
                      {asset.format === 'mp4' ? (
                        <video
                          src={resolveMediaUrl(asset.url)}
                          className="absolute inset-0 h-full w-full object-contain"
                          controls
                          loop
                          muted
                          playsInline
                        />
                      ) : asset.thumbnailUrl || asset.url ? (
                        <img
                          src={resolveMediaUrl(asset.thumbnailUrl || asset.url)}
                          alt={labelFor(asset.type)}
                          className="absolute inset-0 block h-full w-full object-contain"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon size={48} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-primary" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {labelFor(asset.type)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {asset.format !== 'mp4' && (
                          <button
                            type="button"
                            onClick={() => handleAnimateAsset(asset)}
                            disabled={generating || animatingAssetId === asset.id}
                            className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all disabled:opacity-50"
                            title={t('dashboard.imager.result.animateTitle')}
                          >
                            {animatingAssetId === asset.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Video size={16} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setPreviewAsset(asset)}
                          className="p-2 bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/20 transition-all"
                          title={t('dashboard.imager.result.preview')}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAsset(asset)}
                          className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                          title={t('dashboard.imager.result.downloadDimensions')}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingAsset(asset);
                            setEditPrompt('');
                          }}
                          className="p-2 bg-green-500/10 text-green-600 rounded-lg hover:bg-green-500/20 transition-all"
                          title={t('dashboard.imager.result.edit')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 transition-all"
                          title={t('dashboard.imager.result.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {w} × {h}
                    </p>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {previewAsset && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewAsset(null)}
          >
            <div
              className="w-full max-w-[min(96rem,calc(100vw-2rem))] max-h-[90vh] relative flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="absolute -top-4 -right-4 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
                aria-label={t('dashboard.imager.result.closePreview')}
              >
                <X size={20} />
              </button>
              {previewAsset.format === 'mp4' ? (
                (() => {
                  const { width: pw, height: ph } = getAssetDimensions(previewAsset);
                  return (
                    <div
                      className="relative mx-auto overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10"
                      style={previewFrameStyle(pw, ph)}
                    >
                      <video
                        src={resolveMediaUrl(previewAsset.url)}
                        controls
                        autoPlay
                        loop
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const { width: pw, height: ph } = getAssetDimensions(previewAsset);
                  return (
                    <div
                      className="relative mx-auto overflow-hidden rounded-lg bg-neutral-950 shadow-2xl ring-1 ring-white/10"
                      style={previewFrameStyle(pw, ph)}
                    >
                      <img
                        src={resolveMediaUrl(previewAsset.url)}
                        alt={labelFor(previewAsset.type as AssetType)}
                        className="absolute inset-0 block h-full w-full object-contain"
                      />
                    </div>
                  );
                })()
              )}
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {labelFor(previewAsset.type as AssetType)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getAssetDimensions(previewAsset).width} × {getAssetDimensions(previewAsset).height}
                </p>
              </div>
            </div>
          </div>
        )}

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
              alt={project?.brand_name ?? ''}
              className="max-h-[min(85vh,900px)] max-w-[min(92vw,1200px)] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {editingAsset && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setEditingAsset(null);
              setEditPrompt('');
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('dashboard.imager.result.editModalTitle', { type: labelFor(editingAsset.type as AssetType) })}
              </h3>
              <div className="mb-4">
                {editingAsset.format === 'mp4' ? (
                  <video
                    src={resolveMediaUrl(editingAsset.url)}
                    controls
                    loop
                    muted
                    playsInline
                    className="w-full rounded-lg"
                  />
                ) : (
                  <img
                    src={resolveMediaUrl(editingAsset.thumbnailUrl || editingAsset.url)}
                    alt={labelFor(editingAsset.type as AssetType)}
                    className="w-full rounded-lg"
                  />
                )}
              </div>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder={t('dashboard.imager.result.editPlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={4}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleEditAsset}
                  disabled={generating || !editPrompt.trim()}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? t('dashboard.imager.result.generatingShort') : t('dashboard.imager.result.generateNewVersion')}
                </button>
                <button
                  onClick={() => {
                    setEditingAsset(null);
                    setEditPrompt('');
                  }}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('dashboard.imager.new.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {editingProject && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => !savingProject && setEditingProject(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings size={24} className="text-primary" />
                {t('dashboard.imager.result.editProjectTitle')}
              </h3>
              <form onSubmit={handleSaveProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('dashboard.imager.result.companyName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={projectForm.brand_name}
                    onChange={(e) => setProjectForm((f) => ({ ...f, brand_name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30"
                    placeholder={t('dashboard.imager.result.companyNamePh')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('dashboard.imager.result.descriptionField')}
                  </label>
                  <textarea
                    value={projectForm.brand_description}
                    onChange={(e) => setProjectForm((f) => ({ ...f, brand_description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder={t('dashboard.imager.result.descriptionPh')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dashboard.imager.result.colorsField')}
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.imager.result.colorPrimaryShort')}</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={projectForm.primary_color}
                          onChange={(e) => setProjectForm((f) => ({ ...f, primary_color: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={projectForm.primary_color}
                          onChange={(e) => setProjectForm((f) => ({ ...f, primary_color: e.target.value }))}
                          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.imager.result.colorSecondaryShort')}</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={projectForm.secondary_color}
                          onChange={(e) => setProjectForm((f) => ({ ...f, secondary_color: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={projectForm.secondary_color}
                          onChange={(e) => setProjectForm((f) => ({ ...f, secondary_color: e.target.value }))}
                          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.imager.result.colorAccentShort')}</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={projectForm.accent_color}
                          onChange={(e) => setProjectForm((f) => ({ ...f, accent_color: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                        />
                        <input
                          type="text"
                          value={projectForm.accent_color}
                          onChange={(e) => setProjectForm((f) => ({ ...f, accent_color: e.target.value }))}
                          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingProject || !projectForm.brand_name.trim()}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingProject ? t('dashboard.imager.result.savingProject') : t('dashboard.imager.result.saveProject')}
                  </button>
                  <button
                    type="button"
                    onClick={() => !savingProject && setEditingProject(false)}
                    disabled={savingProject}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    {t('dashboard.imager.new.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
