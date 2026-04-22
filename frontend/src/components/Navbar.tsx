import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RubikCube from './RubikCube';
import LanguageSelector from './LanguageSelector';
import { useTheme } from '../contexts/ThemeContext';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      <div className="glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10">
                <RubikCube size={32} enableHover={true} className="sm:w-10 sm:h-10" />
              </div>
              <span className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold tracking-tight font-display">
                {t('nav.brand')}
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors"
                href="#revamp-url"
              >
                {t('nav.revamp')}
              </a>
              <Link
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors"
                to="/imager/new"
              >
                {t('nav.imager')}
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg glass-panel hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all border border-gray-300 dark:border-white/10"
                aria-label="Toggle theme"
                type="button"
              >
                {theme === 'light' ? <Moon size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Sun size={16} className="sm:w-[18px] sm:h-[18px]" />}
              </button>
              <LanguageSelector />
              <Link
                to="/login"
                className="hidden sm:flex px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg silver-gradient-cta text-xs sm:text-sm font-bold transition-all min-h-[44px] whitespace-nowrap"
              >
                {t('nav.getStarted')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
