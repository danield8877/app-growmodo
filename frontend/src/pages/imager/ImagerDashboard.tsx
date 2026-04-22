import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ensureGuestSession, getAccessToken, getGuestToken, resolveMediaUrl } from '../../lib/api';
import { Plus, Palette, Trash2, ExternalLink } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { imagerProjectsService, type ImagerProject } from '../../services/imager';

export default function ImagerDashboard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ImagerProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    void loadProjects();
  }, [authLoading, user?.id]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      if (!getAccessToken() && !getGuestToken()) {
        await ensureGuestSession();
      }
      const data = await imagerProjectsService.getMyProjects(user?.id ?? '');
      setProjects(data);
    } catch (error) {
      console.error('Error loading imager projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm(t('dashboard.imager.deleteProjectConfirm'))) return;
    try {
      await imagerProjectsService.deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(t('dashboard.imager.deleteError'));
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.imager.listTitle')}</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{t('dashboard.imager.listSubtitle')}</p>
          </div>
          <Link
            to="/imager/new"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold transition silver-gradient-cta"
          >
            <Plus size={20} />
            {t('dashboard.imager.newProject')}
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel rounded-xl py-12 text-center">
            <Palette size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">{t('dashboard.imager.emptyTitle')}</h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">{t('dashboard.imager.emptyDesc')}</p>
            <Link to="/imager/new" className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold silver-gradient-cta">
              <Plus size={20} />
              {t('dashboard.imager.createProject')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="glass-panel group rounded-xl p-6 transition-all hover:shadow-xl">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{project.brand_name}</h3>
                    <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                      {project.brand_description || t('dashboard.imager.noDescription')}
                    </p>
                  </div>
                  {project.brand_logo_url && (
                    <img
                      src={resolveMediaUrl(project.brand_logo_url)}
                      alt={project.brand_name}
                      className="ml-3 h-12 w-12 rounded-lg object-contain"
                    />
                  )}
                </div>

                <div className="mb-4 flex gap-2">
                  {Object.entries(project.brand_colors)
                    .slice(0, 3)
                    .map(([key, color]) => (
                      <div
                        key={key}
                        className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-800"
                        style={{ backgroundColor: color }}
                        title={key}
                      />
                    ))}
                </div>

                <div className="mb-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{t('dashboard.imager.assetsGenerated', { count: project.generated_assets.length })}</span>
                  <span className="capitalize">{project.tone_of_voice}</span>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/imager/${project.id}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-primary transition-all hover:bg-primary/20"
                  >
                    <ExternalLink size={16} />
                    {t('dashboard.imager.open')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(project.id)}
                    className="rounded-lg bg-red-500/10 px-4 py-2 text-red-600 transition-all hover:bg-red-500/20 dark:text-red-400"
                    title={t('dashboard.imager.deleteProjectConfirm')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
