import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard,
    FolderKanban,
    FileText,
    RefreshCw,
    Image,
    Mail,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sun,
    Moon,
  } from 'lucide-react';
import RubikCube from './RubikCube';
import LanguageSelector from './LanguageSelector';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebar } from './DashboardLayout';
export default function DashboardSidebar() {
  const { t } = useTranslation();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (mobileOpen && isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
  };

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard.sidebar.dashboard' as const },
    { path: '/revamper', icon: RefreshCw, labelKey: 'dashboard.sidebar.revamper' as const },
    { path: '/imager', icon: Image, labelKey: 'dashboard.sidebar.imager' as const },
    { path: '/emailer', icon: Mail, labelKey: 'dashboard.sidebar.emailer' as const },
  ];

  const disabledMenuItems = [
    { icon: FileText, labelKey: 'dashboard.sidebar.invoicer' as const },
    { icon: FolderKanban, labelKey: 'dashboard.sidebar.validator' as const },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  if (isMobile && !mobileOpen) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 z-50 glass-panel border-r border-neutral-200/80 transition-all duration-300 dark:border-white/10 ${
        isMobile ? 'top-14 bottom-0 w-64' : 'top-0 h-screen'
      } ${!isMobile && (collapsed ? 'w-20' : 'w-64')}`}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {!isMobile && (
          <div className="border-b border-neutral-200/80 p-6 dark:border-white/10">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 flex-shrink-0">
                <RubikCube size={40} enableHover={true} />
              </div>
              {!collapsed && (
                <span className="text-gray-900 dark:text-white text-xl font-bold tracking-tight font-display">Revamperr</span>
              )}
            </Link>
          </div>
        )}

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const label = t(item.labelKey);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                  active
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5'
                }`}
                title={collapsed && !isMobile ? label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {(!collapsed || isMobile) && (
                  <span className="font-medium">{label}</span>
                )}
              </Link>
            );
          })}

          {disabledMenuItems.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey);
            return (
              <div
                key={item.labelKey}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-4 py-3 text-gray-400 opacity-60 dark:text-gray-500"
                aria-disabled="true"
                title={collapsed && !isMobile ? label : undefined}
              >
                <Icon size={20} className="flex-shrink-0 opacity-70" />
                {(!collapsed || isMobile) && <span className="font-medium">{label}</span>}
              </div>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-neutral-200/80 p-4 dark:border-white/10">
          <div
            className={`mb-1 flex border-b border-neutral-200/80 pb-3 dark:border-white/10 ${
              collapsed && !isMobile ? 'flex-col items-center gap-2' : 'flex-row items-center justify-between gap-2'
            }`}
          >
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 glass-panel text-gray-600 transition hover:bg-gray-200 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
              aria-label={theme === 'light' ? t('dashboard.sidebar.themeAriaDark') : t('dashboard.sidebar.themeAriaLight')}
              title={theme === 'light' ? t('dashboard.sidebar.themeAriaDark') : t('dashboard.sidebar.themeAriaLight')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className={collapsed && !isMobile ? 'flex w-full justify-center' : 'flex min-w-0 flex-1 justify-end'}>
              <LanguageSelector compact menuAbove />
            </div>
          </div>

          <Link
            to="/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              location.pathname === '/settings'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5'
            }`}
            title={collapsed && !isMobile ? t('dashboard.sidebar.settings') : undefined}
          >
            <Settings size={20} className="flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="font-medium">{t('dashboard.sidebar.settings')}</span>}
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
            title={collapsed && !isMobile ? t('dashboard.sidebar.logout') : undefined}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="font-medium">{t('dashboard.sidebar.logout')}</span>}
          </button>

          {!isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
              title={collapsed ? t('dashboard.sidebar.expand') : t('dashboard.sidebar.collapse')}
            >
              {collapsed ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
