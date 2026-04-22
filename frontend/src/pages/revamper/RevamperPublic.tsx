import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { getRevampPublic } from '../../services/revamper';
import type { RevamperProject } from '../../services/revamper';
import { absolutizeUploadsUrl, absolutizeUploadsUrls } from '../../services/revamper/assetUrls';
import { FONT_AWESOME_CDN, remapMaterialIconsToFontAwesome } from '../../services/revamper/iconsFallback';
import { getGoogleFontsFromCss, stripBrokenBlobUrls, PREVIEW_CORPORATE_FONT_OVERRIDE } from '../../services/revamper/previewFonts';

/** Data URI pour remplacer les images placeholder.pics (évite CORS en preview) */
const PLACEHOLDER_IMG_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='32' viewBox='0 0 120 32'%3E%3Crect fill='%23e5e7eb' width='120' height='32'/%3E%3C/svg%3E";

const FIXED_FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

/** Détecte si le backend a renvoyé le fallback "Code non disponible". */
function isCodeUnavailable(html: string | undefined): boolean {
  if (!html || typeof html !== 'string') return false;
  const t = html.trim();
  return t.includes('Code non disponible') && t.length < 400;
}

const MATERIAL_ICON_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Icons&display=swap" rel="stylesheet">';

const MATERIAL_ICON_FALLBACK_CSS = `
.material-icons{
  font-family:'Material Icons' !important;
  font-weight:normal;
  font-style:normal;
  font-size:24px;
  line-height:1;
  letter-spacing:normal;
  text-transform:none;
  display:inline-block;
  white-space:nowrap;
  word-wrap:normal;
  direction:ltr;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  -moz-osx-font-smoothing:grayscale;
  font-feature-settings:'liga';
}
.material-symbols-outlined,.material-symbols-rounded,.material-symbols-sharp{
  font-family:'Material Symbols Outlined' !important;
  font-weight:400;
  font-style:normal;
  font-size:24px;
  line-height:1;
  letter-spacing:normal;
  text-transform:none;
  display:inline-block;
  white-space:nowrap;
  word-wrap:normal;
  direction:ltr;
  -webkit-font-feature-settings:'liga';
  -webkit-font-smoothing:antialiased;
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
}`;

const FIXED_TYPOGRAPHY_CSS = `
html,body{
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif !important;
}
h1,h2,h3,h4,h5,h6,button,.btn,.cta,nav a,[class*="title"],[class*="heading"]{
  font-family:'Manrope','Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif !important;
}
${PREVIEW_CORPORATE_FONT_OVERRIDE}`;

function hasTailwindUtilityClasses(html: string): boolean {
  if (!html) return false;
  return /class\s*=\s*["'][^"']*\b(?:flex|grid|container|mx-auto|px-\d|py-\d|bg-[^\s"']+|text-[^\s"']+|font-[^\s"']+|rounded(?:-[^\s"']+)?)\b/i.test(
    html
  );
}

export default function RevamperPublic() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<RevamperProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = project?.status || 'DONE';
  const isQueuedOrRunning = status === 'QUEUED' || status === 'RUNNING';
  const isFailed = status === 'FAILED';
  const jobMeta = (project?.analysis as Record<string, unknown> | undefined)?.__job as
    | { label?: string; detail?: string; error?: string; updatedAt?: string }
    | undefined;
  const codeUnavailable = project ? isCodeUnavailable(project.html) : false;
  /** Mode Rapide (Grok) : une image seule, pas de code */
  const isRapideImageOnly =
    project?.analysis?.generatedImageUrl &&
    (!(project.html?.trim()) || isCodeUnavailable(project.html));

  const fullHtml = useMemo(() => {
    if (!project) return '';
    if (isQueuedOrRunning || isFailed) return '';
    if (isRapideImageOnly && project.analysis?.generatedImageUrl) {
      const imageUrl = absolutizeUploadsUrl(project.analysis.generatedImageUrl) || project.analysis.generatedImageUrl;
      return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${(project.title || 'Refonte').replace(/</g, '&lt;')}</title><style>html,body{margin:0;padding:0;min-height:100vh;background:#0f172a;display:flex;justify-content:center;align-items:center}</style></head><body><img src="${imageUrl.replace(/"/g, '&quot;')}" alt="Refonte" style="max-width:100%;height:auto;display:block" /></body></html>`;
    }
    if (codeUnavailable) return '';
    const html = project.html || '';
    const css = project.css || '';
    const js = project.js || '';
    const linkTags = (project as { linkTags?: string }).linkTags || '';
    const analysis = project.analysis;
    const lang = analysis?.lang || 'fr';
    const hasTailwindClasses = hasTailwindUtilityClasses(html || '');
    const tailwindCdn = hasTailwindClasses
      ? '<script src="https://cdn.tailwindcss.com"></script>'
      : '';
    const hasMaterialSymbols = html && (html.includes('material-symbols') || /class="[^"]*material-symbols[^"]*"/i.test(html));
    const hasMaterialIcons = html && (html.includes('material-icons') || /class="[^"]*material-icons[^"]*"/i.test(html));
    let googleFonts = FIXED_FONT_LINKS;
    if (hasMaterialSymbols || hasMaterialIcons) googleFonts += MATERIAL_ICON_LINKS;
    const primaryColor = analysis?.colors?.primary || '#ef4444';
    const secondaryColor = analysis?.colors?.secondary || '#dc2626';
    const tailwindConfig = hasTailwindClasses ? `
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              primary: '${primaryColor}',
              secondary: '${secondaryColor}',
              'dark-accent': '#0f172a',
              'deep-red': '#b91c1c',
              'background-dark': '#020617'
            }
          }
        }
      }
    </script>
  ` : '';
    const baseCss = css && css.trim() && css !== '/* no styles */'
      ? css
      : `body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }`;
    /** Fond sombre par défaut pour html/body (évite le flash blanc dans l’iframe) */
    const docBackground = 'html, body { background: #0f172a; margin: 0; padding: 0; min-height: 100vh; }';
    const linkTagsForPreview = css?.includes('/* === Feuille externe') ? '' : linkTags;
    let htmlNoPlaceholder = html.replace(
      /https:\/\/placeholder\.pics\/[^"'\s]*/g,
      PLACEHOLDER_IMG_DATA_URI
    );
    const iconFallback = remapMaterialIconsToFontAwesome(htmlNoPlaceholder);
    htmlNoPlaceholder = iconFallback.html;
    htmlNoPlaceholder = absolutizeUploadsUrls(htmlNoPlaceholder);
    htmlNoPlaceholder = stripBrokenBlobUrls(htmlNoPlaceholder, PLACEHOLDER_IMG_DATA_URI);
    const extraGoogleFonts = getGoogleFontsFromCss(css);
    return `<!DOCTYPE html><html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${project.title || 'Refonte'}</title>
${googleFonts}
${extraGoogleFonts}
${iconFallback.used ? FONT_AWESOME_CDN : ''}
${linkTagsForPreview}
${tailwindCdn}
${tailwindConfig}
<style>${docBackground}\n${FIXED_TYPOGRAPHY_CSS}\n${MATERIAL_ICON_FALLBACK_CSS}\n${baseCss}</style>
</head>
<body>${htmlNoPlaceholder}<script>${js}</script></body></html>`;
  }, [project, codeUnavailable, isRapideImageOnly, isQueuedOrRunning, isFailed]);

  useEffect(() => {
    if (id) {
      loadProject(id);
    } else {
      setError('ID de projet manquant.');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !isQueuedOrRunning) return;
    const t = setInterval(() => {
      void loadProject(id);
    }, 2500);
    return () => clearInterval(t);
  }, [id, isQueuedOrRunning]);

  /** Remplace le document par le HTML de la refonte (vraie page, pas iframe) */
  useEffect(() => {
    if (!fullHtml) return;
    document.open();
    document.write(fullHtml);
    document.close();
  }, [fullHtml]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      const data = await getRevampPublic(projectId);
      if (!data) {
        setError('Refonte introuvable.');
      } else {
        setProject(data);
      }
    } catch (err) {
      console.error('Error loading revamp:', err);
      setError('Impossible de charger la refonte.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Refonte introuvable</h1>
          <p className="text-gray-600">{error || 'Cette refonte n\'existe pas ou n\'est pas accessible.'}</p>
        </div>
      </div>
    );
  }

  if (isQueuedOrRunning) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-lg mx-auto p-8">
          <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {jobMeta?.label || (status === 'QUEUED' ? 'Refonte en file' : 'Refonte en cours')}
          </h1>
          <p className="text-gray-600">{jobMeta?.detail || 'Le projet est en traitement.'}</p>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Génération échouée</h1>
          <p className="text-gray-600">{jobMeta?.error || jobMeta?.detail || 'Aucun détail disponible.'}</p>
        </div>
      </div>
    );
  }

  // fullHtml prêt : l’effet ci‑dessus remplace le document par la refonte (plus de rendu React)
  if (codeUnavailable && !isRapideImageOnly) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="mx-auto mb-4 text-amber-500" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Code non disponible</h1>
          <p className="text-gray-600">
            Le code de cette refonte n’a pas pu être récupéré. La refonte existe mais le contenu généré n’est pas disponible. Vous pouvez relancer une nouvelle refonte.
          </p>
        </div>
      </div>
    );
  }

  // fullHtml prêt : l'effet remplace le document par la refonte
  if (fullHtml) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return null;
}
