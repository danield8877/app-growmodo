import { Pencil, RotateCcw, Users, LayoutDashboard, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Features() {
  const { t } = useTranslation();
  return (
    <section className="py-24 bg-gray-50 dark:bg-[#121118] relative" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('features.title')} <br />
            {t('features.titleLine2')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">{t('features.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)]">
          <div className="md:col-span-2 rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5 p-8 relative overflow-hidden group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
            <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="mb-8">
                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-surface-dark-lighter border border-gray-200 dark:border-white/10 flex items-center justify-center mb-4 text-gray-900 dark:text-white">
                  <Pencil size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('features.annotations.title')}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm">{t('features.annotations.description')}</p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-black/30 rounded-lg border border-gray-200 dark:border-white/10 p-4 backdrop-blur-sm relative">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded bg-gray-700 bg-cover" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=200')" }}></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-2 w-3/4 bg-gray-200 dark:bg-white/10 rounded"></div>
                    <div className="h-2 w-1/2 bg-gray-200 dark:bg-white/10 rounded"></div>
                  </div>
                </div>
                <div className="absolute top-6 left-16 w-6 h-6 bg-primary rounded-full border-2 border-white flex items-center justify-center shadow-lg transform -translate-x-1/2 -translate-y-1/2">
                  <MessageCircle size={10} className="text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5 p-8 relative overflow-hidden group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-surface-dark-lighter border border-gray-200 dark:border-white/10 flex items-center justify-center mb-4 text-gray-900 dark:text-white">
              <RotateCcw size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('features.versioning.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t('features.versioning.description')}</p>
            <div className="space-y-3 relative">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-white/10"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-6 h-6 rounded-full bg-primary border-4 border-white dark:border-surface-dark flex-shrink-0"></div>
                <div className="bg-gray-100 dark:bg-white/5 px-3 py-2 rounded border border-gray-200 dark:border-white/5 text-xs text-gray-900 dark:text-white w-full">V3 - Final.pdf</div>
              </div>
              <div className="flex items-center gap-3 relative z-10 opacity-50">
                <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 border-4 border-white dark:border-surface-dark flex-shrink-0"></div>
                <div className="bg-gray-100 dark:bg-white/5 px-3 py-2 rounded border border-gray-200 dark:border-white/5 text-xs text-gray-900 dark:text-white w-full">V2 - Draft.pdf</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5 p-8 relative overflow-hidden group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-surface-dark-lighter border border-gray-200 dark:border-white/10 flex items-center justify-center mb-4 text-gray-900 dark:text-white">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('features.sync.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t('features.sync.description')}</p>
            <div className="flex -space-x-3 justify-start mb-4">
              <img alt="Team member avatar" className="w-10 h-10 rounded-full border-2 border-surface-dark bg-gray-500" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" />
              <img alt="Team member avatar" className="w-10 h-10 rounded-full border-2 border-surface-dark bg-gray-500" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" />
              <img alt="Team member avatar" className="w-10 h-10 rounded-full border-2 border-surface-dark bg-gray-500" src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" />
              <div className="w-10 h-10 rounded-full border-2 border-white dark:border-surface-dark bg-gray-100 dark:bg-surface-dark-lighter flex items-center justify-center text-xs text-gray-900 dark:text-white font-bold">+5</div>
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5 p-8 relative overflow-hidden group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#121118] via-transparent to-transparent z-10"></div>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
            <div className="relative z-20 flex flex-row items-end justify-between h-full">
              <div className="max-w-md">
                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-surface-dark-lighter border border-gray-200 dark:border-white/10 flex items-center justify-center mb-4 text-gray-900 dark:text-white">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('features.dashboard.title')}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{t('features.dashboard.description')}</p>
              </div>
              <div className="hidden sm:flex items-end gap-2 h-24">
                <div className="w-8 bg-gray-200 dark:bg-white/10 rounded-t h-12 group-hover:h-16 transition-all duration-500"></div>
                <div className="w-8 bg-gray-200 dark:bg-white/10 rounded-t h-16 group-hover:h-20 transition-all duration-500 delay-75"></div>
                <div className="w-8 bg-primary rounded-t h-20 group-hover:h-24 transition-all duration-500 delay-100 shadow-[0_0_15px_rgba(51,13,242,0.5)]"></div>
                <div className="w-8 bg-gray-200 dark:bg-white/10 rounded-t h-14 group-hover:h-10 transition-all duration-500 delay-150"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
