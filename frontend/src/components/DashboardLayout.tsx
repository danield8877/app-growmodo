import { ReactNode, useState, createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardSidebar from './DashboardSidebar';
import { Menu, X } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      <div className="min-h-screen bg-neutral-100 font-display text-neutral-900 transition-colors dark:bg-[#121118] dark:text-[#e8e6ed]">
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-[#1c1b22]/95">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-neutral-700 transition hover:bg-neutral-200 dark:text-white dark:hover:bg-white/10"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              {t('dashboard.layout.mobileBrand')}
            </span>
            <div className="w-10" />
          </div>
        )}

        {mobileOpen && isMobile && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
        )}

        <DashboardSidebar />

        <div
          className={`min-h-screen transition-all duration-300 ${isMobile ? 'ml-0 pt-14' : collapsed ? 'ml-20' : 'ml-64'}`}
        >
          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
