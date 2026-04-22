import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function CallToAction() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 dark:from-[#121118] to-primary/5 dark:to-primary/10 border-t border-gray-200 dark:border-white/5">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">{t('cta.title')}</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-10">{t('cta.subtitle')}</p>
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 rounded-lg silver-gradient-cta font-bold text-lg transition-all"
          >
            {t('cta.primary')}
          </button>
        </div>
      </div>
    </section>
  );
}
