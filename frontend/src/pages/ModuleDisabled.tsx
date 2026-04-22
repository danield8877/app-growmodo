import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

export default function ModuleDisabled() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-white">{t('dashboard.moduleDisabled.title')}</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">{t('dashboard.moduleDisabled.body')}</p>
        <Link to="/dashboard" className="font-medium text-primary hover:underline">
          {t('dashboard.moduleDisabled.back')}
        </Link>
      </div>
    </DashboardLayout>
  );
}
