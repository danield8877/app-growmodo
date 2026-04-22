import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RubikCube from './RubikCube';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-100 dark:bg-[#0b0a0e] border-t border-gray-200 dark:border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <Link to="/" className="flex flex-col items-center md:items-start gap-2 group">
              <div className="w-[30px] h-[30px]">
                <RubikCube size={30} />
              </div>
              <span className="text-gray-900 dark:text-white text-sm font-bold tracking-tight font-display">{t('nav.brand')}</span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <a
                href="#revamp-url"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                {t('nav.revamp')}
              </a>
              <Link
                to="/imager/new"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                {t('nav.imager')}
              </Link>
              <Link
                to="/login"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                {t('nav.getStarted')}
              </Link>
            </nav>
          </div>

          <div className="border-t border-gray-200 dark:border-white/5 pt-8">
            <p className="text-gray-500 dark:text-gray-600 text-xs text-center">{t('internalLanding.footerNote')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
