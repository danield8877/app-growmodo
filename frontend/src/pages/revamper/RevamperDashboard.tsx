import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { RefreshCw, Plus, Trash2, ExternalLink, Loader2, LayoutGrid } from 'lucide-react';
import { getRevamps, deleteRevamp, type RevamperProject } from '../../services/revamper';
import { absolutizeUploadsUrl } from '../../services/revamper/assetUrls';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '../../lib/dateLocale';

function thumbnailUrl(project: RevamperProject): string | null {
  const url = project.analysis?.generatedImageUrl;
  return url && typeof url === 'string' ? absolutizeUploadsUrl(url) : null;
}

function statusClass(status: RevamperProject['status']): string {
  if (status === 'QUEUED') return 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200';
  if (status === 'RUNNING') return 'border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-200';
  if (status === 'FAILED') return 'border-red-500/40 bg-red-500/15 text-red-800 dark:text-red-200';
  if (status === 'CANCELLED') return 'border-orange-500/40 bg-orange-500/15 text-orange-900 dark:text-orange-200';
  if (status === 'DRAFT') return 'border-gray-500/40 bg-gray-500/20 text-gray-800 dark:text-gray-200';
  return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
}

export default function RevamperDashboard() {
  const { t, i18n } = useTranslation();
  const [projects, setProjects] = useState<RevamperProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState<3 | 6 | 9>(3);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!projects.some((p) => p.status === 'QUEUED' || p.status === 'RUNNING')) return;
    const tmr = setInterval(() => {
      void loadProjects();
    }, 3000);
    return () => clearInterval(tmr);
  }, [projects]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getRevamps();
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error('Error loading revamps:', err);
      setError(t('dashboard.revamper.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const modeLabel = (project: RevamperProject) => {
    if (project.model_id === 'CLAUDE_ADVANCED') return t('dashboard.revamper.modeAdvanced');
    return project.model_id === 'GROK' ? t('dashboard.revamper.modeFast') : t('dashboard.revamper.modeExpert');
  };

  const statusLabel = (status: RevamperProject['status']) => {
    if (status === 'QUEUED') return t('dashboard.revamper.statusQueued');
    if (status === 'RUNNING') return t('dashboard.revamper.statusRunning');
    if (status === 'FAILED') return t('dashboard.revamper.statusFailed');
    if (status === 'CANCELLED') return t('dashboard.revamper.statusCancelled');
    if (status === 'DRAFT') return t('dashboard.revamper.statusDraft');
    return t('dashboard.revamper.statusDone');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('dashboard.revamper.deleteConfirm'))) return;
    try {
      await deleteRevamp(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting revamp:', err);
      alert(t('dashboard.revamper.deleteError'));
    }
  };

  const dateLocale = getDateLocale(i18n.language);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('dashboard.revamper.listTitle')}</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{t('dashboard.revamper.listSubtitle')}</p>
          </div>
          <Link
            to="/revamper/new"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold transition silver-gradient-cta"
          >
            <Plus size={20} />
            {t('dashboard.revamper.newRedesign')}
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        ) : error ? (
          <div className="glass-panel rounded-xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel rounded-xl border border-neutral-200/80 p-8 text-center dark:border-white/10">
            <RefreshCw className="mx-auto mb-4 text-primary" size={48} />
            <h2 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">{t('dashboard.revamper.emptyTitle')}</h2>
            <p className="mx-auto mb-6 max-w-md text-gray-600 dark:text-gray-400">{t('dashboard.revamper.emptyDesc')}</p>
            <Link to="/revamper/new" className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold silver-gradient-cta">
              <Plus size={18} />
              {t('dashboard.revamper.startRedesign')}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-500">{t('dashboard.revamper.columns')}</span>
              {([3, 6, 9] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGridColumns(n)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    gridColumns === n ? 'bg-primary text-white' : 'bg-neutral-200 text-gray-700 hover:bg-neutral-300 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div
              className={`grid gap-6 ${
                gridColumns === 3
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  : gridColumns === 6
                    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
                    : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9'
              }`}
            >
              {projects.map((project) => {
                const thumb = thumbnailUrl(project);
                return (
                  <div
                    key={project.id}
                    className="glass-panel flex flex-col overflow-hidden rounded-xl border border-neutral-200/80 transition hover:border-primary/30 dark:border-white/10"
                  >
                    <div className="flex aspect-video items-center justify-center overflow-hidden bg-theme-tertiary">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <LayoutGrid className="text-gray-600" size={48} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <h3 className="mb-1 truncate font-semibold text-neutral-900 dark:text-white">{project.title}</h3>
                      {project.source_url && (
                        <p className="mb-2 truncate text-xs text-gray-600 dark:text-gray-400">{project.source_url}</p>
                      )}
                      <div className="mt-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                        <span>
                          {formatDistanceToNow(new Date(project.created_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                        <span>·</span>
                        <span>{modeLabel(project)}</span>
                        {project.style_preference && (
                          <>
                            <span>·</span>
                            <span>{project.style_preference}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex items-center rounded border px-2 py-1 text-xs ${statusClass(project.status)}`}>
                          {statusLabel(project.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t border-neutral-200/80 p-3 dark:border-white/10">
                      <Link
                        to={`/revamper/result/${project.id}`}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/20 py-2 text-sm font-medium text-primary transition hover:bg-primary/30"
                      >
                        <ExternalLink size={14} />
                        {t('dashboard.revamper.view')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(project.id)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-red-500/10 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        title={t('dashboard.revamper.deleteTitle')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
