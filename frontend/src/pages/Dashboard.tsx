import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { FolderKanban, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

export default function Dashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-primary dark:border-gray-700" />
            <p className="text-gray-600 dark:text-gray-400">{t('dashboard.home.loadingProfile')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const displayName = profile.full_name || t('dashboard.home.userFallback');

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <h2 className="gradient-text mb-2 text-4xl font-bold">
            {t('dashboard.home.welcome', { name: displayName })}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">{t('dashboard.home.subtitle')}</p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link
            to="/revamper"
            className="glass-panel group rounded-xl border border-neutral-200/80 p-8 transition hover:border-primary/40 dark:border-white/10"
          >
            <Sparkles className="mb-4 text-primary transition group-hover:scale-110" size={40} />
            <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">{t('dashboard.home.revamperTitle')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.home.revamperDesc')}</p>
          </Link>
          <Link
            to="/imager"
            className="glass-panel group rounded-xl border border-neutral-200/80 p-8 transition hover:border-primary/40 dark:border-white/10"
          >
            <ImageIcon className="mb-4 text-primary transition group-hover:scale-110" size={40} />
            <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">{t('dashboard.home.imagerTitle')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.home.imagerDesc')}</p>
          </Link>
        </div>

        <div className="glass-panel rounded-xl border border-neutral-200/80 p-8 dark:border-white/10">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-neutral-900 dark:text-white">
            <FolderKanban className="text-primary" size={24} />
            {t('dashboard.home.otherModulesTitle')}
          </h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t('dashboard.home.otherModulesDesc')}</p>
          <Link to="/settings" className="text-sm font-medium text-primary hover:underline">
            {t('dashboard.home.accountSettingsLink')}
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
