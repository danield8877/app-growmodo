import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { ArrowLeft, ExternalLink, Code, Eye, Loader2, Pencil } from 'lucide-react';
import { getRevamp } from '../../services/revamper';
import type { RevamperJobStatus, RevamperResult, RevamperProject } from '../../services/revamper';
import { absolutizeUploadsUrl } from '../../services/revamper/assetUrls';
import { buildRevamperPreviewDocument } from '../../services/revamper/buildPreviewDocument';
import html2canvas from 'html2canvas';

/** Détecte si le backend a renvoyé le fallback "Code non disponible" (pas de code récupéré). */
function isCodeUnavailable(html: string | undefined): boolean {
  if (!html || typeof html !== 'string') return false;
  const t = html.trim();
  return t.includes('Code non disponible') && t.length < 400;
}

type Tab = 'html' | 'css' | 'js' | 'preview' | 'image';

export default function RevamperResult() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state?: { result: RevamperResult } };
  const [tab, setTab] = useState<Tab>('preview');
  const [project, setProject] = useState<RevamperProject | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const result = project || state?.result;
  const status: RevamperJobStatus = (project?.status as RevamperJobStatus) || 'DONE';
  const isQueuedOrRunning = status === 'QUEUED' || status === 'RUNNING';
  const isFailed = status === 'FAILED';
  const jobMeta = (project?.analysis as Record<string, unknown> | undefined)?.__job as
    | { label?: string; detail?: string; error?: string; elapsedMs?: number; updatedAt?: string }
    | undefined;
  const jobLogs = (
    (project?.analysis as Record<string, unknown> | undefined)?.__jobLogs as
      | Array<{ at?: string; label?: string; detail?: string; status?: string }>
      | undefined
  ) ?? [];
  const codeUnavailable = result ? isCodeUnavailable(project ? project.html : result.html) : false;
  const fullHtml = useMemo(() => {
    if (!result || codeUnavailable) return '';
    const html = project ? project.html : result.html;
    const css = project ? project.css : result.css;
    const js = project ? project.js : result.js;
    const analysis = project ? project.analysis : result.analysis;
    const linkTags =
      (project ? (project as { linkTags?: string }).linkTags : (result as { linkTags?: string }).linkTags) ||
      ((analysis as { revamperFontLinks?: string })?.revamperFontLinks);
    return buildRevamperPreviewDocument({
      html: html || '',
      css: css || '',
      js: js || '',
      analysis: analysis as RevamperProject['analysis'],
      linkTags,
    });
  }, [result, project, codeUnavailable]);

  useEffect(() => {
    if (id) {
      loadProject(id);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !isQueuedOrRunning) return;
    const t = setInterval(() => {
      void loadProject(id);
    }, 2500);
    return () => clearInterval(t);
  }, [id, isQueuedOrRunning]);

  useEffect(() => {
    setScreenshotDataUrl(null);
  }, [fullHtml, codeUnavailable]);

  const captureScreenshot = useCallback(() => {
    const iframe = previewIframeRef.current;
    if (!iframe?.contentDocument?.body || !fullHtml) return;
    html2canvas(iframe.contentDocument.body, {
      useCORS: true,
      allowTaint: true,
      scale: 1,
      logging: false,
    })
      .then((canvas) => {
        setScreenshotDataUrl(canvas.toDataURL('image/png'));
      })
      .catch(() => {});
  }, [fullHtml]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      const data = await getRevamp(projectId);
      if (!data) {
        setError(t('dashboard.revamper.result.notFound'));
      } else {
        setProject(data);
      }
    } catch (err) {
      console.error('Error loading revamp:', err);
      setError(t('dashboard.revamper.result.loadError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  if (error || (!project && !state?.result)) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl py-16 text-center">
          <p className="mb-4 text-gray-600 dark:text-gray-400">
            {error || t('dashboard.revamper.result.noResult')}
          </p>
          <Link to="/revamper/new" className="text-primary hover:underline">
            {t('dashboard.revamper.result.newRedesign')}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const res = result!;
  const html = project ? project.html : res.html;
  const css = project ? project.css : res.css;
  const js = project ? project.js : res.js;
  const analysis = project ? project.analysis : res.analysis;

  const publicUrl = id ? `${window.location.origin}/revamper/public/${id}` : null;

  const handleOpenPublic = () => {
    if (publicUrl) {
      window.open(publicUrl, '_blank');
    }
  };

  const handleCopyUrl = async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
    }
  };

  const backendImageUrl = absolutizeUploadsUrl(analysis?.generatedImageUrl ?? null) ?? undefined;
  const hasRealCode = !!(html?.trim() && !isCodeUnavailable(html));
  const mainImageUrl = hasRealCode && screenshotDataUrl ? screenshotDataUrl : backendImageUrl;
  const tabs: { id: Tab; label: string; icon: typeof Code }[] = [
    { id: 'preview', label: t('dashboard.revamper.result.tabPreview'), icon: Eye },
    ...(mainImageUrl ? [{ id: 'image' as Tab, label: t('dashboard.revamper.result.tabImage'), icon: Eye }] : []),
    { id: 'html', label: 'HTML', icon: Code },
    { id: 'css', label: 'CSS', icon: Code },
    { id: 'js', label: 'JS', icon: Code },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {isQueuedOrRunning && (
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-blue-900 dark:text-blue-100">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 size={16} className="animate-spin" />
              {jobMeta?.label || (status === 'QUEUED' ? t('dashboard.revamper.result.queued') : t('dashboard.revamper.result.running'))}
            </div>
            {jobMeta?.detail && <div className="mt-1 text-sm text-blue-800/90 dark:text-blue-200/90">{jobMeta.detail}</div>}
            <div className="mt-2 text-xs text-blue-800/80 dark:text-blue-200/70">
              {t('dashboard.revamper.result.statusLine')} {status}
              {jobMeta?.updatedAt
                ? ` · ${t('dashboard.revamper.result.updated')} ${new Date(jobMeta.updatedAt).toLocaleTimeString(i18n.language)}`
                : ''}
            </div>
          </div>
        )}
        {isFailed && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-800 dark:text-red-200">
            {t('dashboard.revamper.result.failed')}{' '}
            {jobMeta?.error || jobMeta?.detail || t('dashboard.revamper.result.noDetail')}
          </div>
        )}
        {(isQueuedOrRunning || isFailed || jobLogs.length > 0) && (
          <div className="mb-4 rounded-lg border border-neutral-200/80 bg-neutral-100/80 p-3 dark:border-white/10 dark:bg-black/30">
            <div className="mb-2 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('dashboard.revamper.result.logsTitle')}</div>
            <div className="max-h-48 space-y-1 overflow-auto font-mono text-xs text-neutral-800 dark:text-gray-200">
              {jobLogs.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-500">{t('dashboard.revamper.result.noLogs')}</div>
              ) : (
                jobLogs.map((l, i) => (
                  <div key={`${l.at || 't'}-${i}`}>
                    <span className="text-gray-500">
                      [{l.at ? new Date(l.at).toLocaleTimeString() : '--:--:--'}]
                    </span>{' '}
                    <span className="text-blue-300">{l.status || 'INFO'}</span>{' '}
                    <span>{l.label || 'step'}</span>
                    {l.detail ? <span className="text-gray-400"> — {l.detail}</span> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/revamper"
            className="inline-flex items-center gap-2 text-gray-600 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft size={20} />
            {t('dashboard.revamper.result.back')}
          </Link>
          <div className="flex items-center gap-2">
            {id && hasRealCode && !codeUnavailable && (
              <Link
                to={`/revamper/edit/${id}`}
                className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-primary transition hover:bg-primary/20"
              >
                <Pencil size={18} />
                Éditer
              </Link>
            )}
            {publicUrl && (
              <button
                type="button"
                onClick={handleOpenPublic}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition hover:bg-primary/90"
              >
                <ExternalLink size={18} />
                {t('dashboard.revamper.result.viewLive')}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>
        )}

        <div className="glass-panel overflow-hidden rounded-xl border border-neutral-200/80 dark:border-white/10">
          <div className="flex border-b border-neutral-200/80 dark:border-white/10">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition ${
                  tab === id
                    ? 'border-b-2 border-primary bg-primary/20 text-primary'
                    : 'text-gray-600 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-[500px] bg-theme-tertiary relative">
            {!codeUnavailable && fullHtml && (
              <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden>
                <iframe
                  ref={previewIframeRef}
                  srcDoc={fullHtml}
                  sandbox="allow-scripts allow-same-origin"
                  title="Capture"
                  className="w-[1200px] h-[800px] border-0"
                  style={{ backgroundColor: '#0f172a' }}
                  onLoad={captureScreenshot}
                />
              </div>
            )}
            {tab === 'preview' && codeUnavailable && (
              <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
                <Code className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-gray-200">{t('dashboard.revamper.result.codeUnavailableTitle')}</h3>
                <p className="max-w-md text-gray-600 dark:text-gray-400">{t('dashboard.revamper.result.codeUnavailableDesc')}</p>
              </div>
            )}
            {tab === 'preview' && !codeUnavailable && fullHtml && (
              <iframe
                srcDoc={fullHtml}
                sandbox="allow-scripts allow-same-origin"
                title={t('dashboard.revamper.result.previewTitle')}
                className="h-[600px] w-full border-0"
                style={{ backgroundColor: '#0f172a' }}
              />
            )}
            {tab === 'image' && mainImageUrl && (
              <div className="flex min-h-[500px] items-center justify-center bg-theme-tertiary p-4">
                <img
                  src={mainImageUrl}
                  alt={hasRealCode ? t('dashboard.revamper.result.captureAlt') : t('dashboard.revamper.result.thumbAlt')}
                  className="max-h-[600px] max-w-full object-contain"
                />
              </div>
            )}
            {tab === 'html' && (
              <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap p-4 font-mono text-sm text-neutral-800 dark:text-gray-300">{html}</pre>
            )}
            {tab === 'css' && (
              <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap p-4 font-mono text-sm text-neutral-800 dark:text-gray-300">{css}</pre>
            )}
            {tab === 'js' && (
              <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap p-4 font-mono text-sm text-neutral-800 dark:text-gray-300">{js}</pre>
            )}
          </div>
        </div>

        {analysis && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            {t('dashboard.revamper.result.analysisLine', {
              lang: String(analysis.lang ?? ''),
              title: String(analysis.title ?? ''),
              menuPart:
                (analysis.menuItems?.length ?? 0) > 0
                  ? t('dashboard.revamper.result.analysisMenuSuffix', { count: analysis.menuItems!.length })
                  : '',
            })}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
