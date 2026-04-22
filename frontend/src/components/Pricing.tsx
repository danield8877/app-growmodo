import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function Pricing() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-white dark:bg-[#121118] relative overflow-hidden" id="pricing">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('pricing.title')} <span className="text-primary">{t('pricing.titleHighlight')}</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">{t('pricing.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-surface-dark p-8 flex flex-col hover:border-gray-300 dark:hover:border-white/10 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('pricing.freelancer.name')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{t('pricing.freelancer.price')}</span>
              <span className="text-gray-500">{t('pricing.freelancer.period')}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">{t('pricing.freelancer.description')}</p>
            <ul className="flex-1 space-y-4 mb-8">
              <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="text-green-400" size={18} />
                {t('pricing.freelancer.features.projects')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="text-green-400" size={18} />
                {t('pricing.freelancer.features.storage')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="text-green-400" size={18} />
                {t('pricing.freelancer.features.annotations')}
              </li>
            </ul>
            <button
              onClick={() => navigate('/register')}
              className="w-full py-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              {t('pricing.freelancer.cta')}
            </button>
          </div>

          <div className="rounded-2xl border-2 border-primary bg-gray-100 dark:bg-[#1a1a20] p-8 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-primary/20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {t('pricing.agency.badge')}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('pricing.agency.name')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{t('pricing.agency.price')}</span>
              <span className="text-gray-500">{t('pricing.agency.period')}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">{t('pricing.agency.description')}</p>
            <ul className="flex-1 space-y-4 mb-8">
              <li className="flex items-center gap-3 text-sm text-gray-900 dark:text-white font-medium">
                <CheckCircle className="text-primary" size={18} />
                {t('pricing.agency.features.projects')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-900 dark:text-white font-medium">
                <CheckCircle className="text-primary" size={18} />
                {t('pricing.agency.features.storage')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-900 dark:text-white font-medium">
                <CheckCircle className="text-primary" size={18} />
                {t('pricing.agency.features.clients')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-900 dark:text-white font-medium">
                <CheckCircle className="text-primary" size={18} />
                {t('pricing.agency.features.whiteLabel')}
              </li>
            </ul>
            <button
              onClick={() => navigate('/register')}
              className="w-full py-3 rounded-lg silver-gradient-cta font-bold transition-all"
            >
              {t('pricing.agency.cta')}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-surface-dark p-8 flex flex-col hover:border-gray-300 dark:hover:border-white/10 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('pricing.enterprise.name')}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{t('pricing.enterprise.price')}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">{t('pricing.enterprise.description')}</p>
            <ul className="flex-1 space-y-4 mb-8">
              <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="text-green-400" size={18} />
                {t('pricing.enterprise.features.unlimited')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="text-green-400" size={18} />
                {t('pricing.enterprise.features.security')}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="text-green-400" size={18} />
                {t('pricing.enterprise.features.manager')}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
