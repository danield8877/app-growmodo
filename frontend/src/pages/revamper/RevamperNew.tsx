import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { ArrowLeft, Send, Loader2, Globe, Code, Wand2 } from 'lucide-react';
import {
  enqueueRevampJob,
  generateAdvancedRevampHtml,
  saveRevampFromCode,
  parsePastedCode,
  REVAMPER_SECTION_IDS,
  loadRevampBaseInstructions,
  saveRevampBaseInstructions,
  loadRevampSupplementaryInstructions,
  saveRevampSupplementaryInstructions,
  optimizeRevampPrompt,
  type RevamperSectionId,
  type RevamperSourceLang,
} from '../../services/revamper';
import { getAuthBearerToken } from '../../lib/api';

const STYLE_OPTIONS = [
  'Moderne',
  'Minimaliste',
  'Corporate',
  'Creatif',
  'Luxe',
  'Élégant',
  'Tech',
  'Brutalist',
  'Vintage',
  'Playful',
] as const;

type InputMode = 'url' | 'code';

export default function RevamperNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');

  useEffect(() => {
    const raw = searchParams.get('url');
    if (!raw?.trim()) return;
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded.trim()) setUrl(decoded.trim());
    } catch {
      setUrl(raw.trim());
    }
  }, [searchParams]);
  const [codeInput, setCodeInput] = useState('');
  const [stylePreference, setStylePreference] = useState<string>('');
  const [sections, setSections] = useState<RevamperSectionId[]>([]);
  const [baseInstructions, setBaseInstructions] = useState(() => loadRevampBaseInstructions());
  const [supplementaryInstructions, setSupplementaryInstructions] = useState(() =>
    loadRevampSupplementaryInstructions()
  );
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [enableI18n, setEnableI18n] = useState(false);
  const [sourceLang, setSourceLang] = useState<RevamperSourceLang>('en');
  const [loading, setLoading] = useState(false);
  const [optimizingInstructions, setOptimizingInstructions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (id: RevamperSectionId) => {
    setSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSubmitUrl = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      if (isAdvancedMode) {
        const token = getAuthBearerToken();
        const html = await generateAdvancedRevampHtml(url.trim(), token);
        const parsed = parsePastedCode(html);
        const host = (() => {
          try {
            return new URL(url.trim()).hostname.replace(/^www\./, '');
          } catch {
            return 'site';
          }
        })();
        const savedProject = await saveRevampFromCode(
          parsed,
          t('dashboard.revamper.new.advancedProjectTitle', { host }),
          { modelId: 'CLAUDE_ADVANCED', sourceUrl: url.trim() }
        );
        navigate(`/revamper/result/${savedProject.id}`);
        return;
      }

      const project = await enqueueRevampJob({
        url: url.trim(),
        stylePreference: stylePreference || undefined,
        sections: sections.length ? sections : undefined,
        baseInstructions: baseInstructions.trim() || undefined,
        supplementaryInstructions: supplementaryInstructions.trim() || undefined,
        enableI18n,
        sourceLang: enableI18n ? sourceLang : undefined,
      });
      navigate(`/revamper/result/${project.id}`);
    } catch (err) {
      console.error('Revamper error:', err);
      setError(err instanceof Error ? err.message : t('dashboard.revamper.new.errorQueue'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!codeInput.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { html, css, js } = parsePastedCode(codeInput.trim());
      const savedProject = await saveRevampFromCode({ html, css, js });
      navigate(`/revamper/result/${savedProject.id}`);
    } catch (err) {
      console.error('Revamper code error:', err);
      setError(err instanceof Error ? err.message : t('dashboard.revamper.new.saveCodeError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (inputMode === 'url') handleSubmitUrl();
    else handleSubmitCode();
  };

  const handleOptimizeBaseInstructions = async () => {
    const raw = baseInstructions.trim();
    if (!raw) {
      setError(t('dashboard.revamper.new.optimizeWandEmpty'));
      return;
    }
    setError(null);
    setOptimizingInstructions(true);
    try {
      const out = await optimizeRevampPrompt(raw);
      setBaseInstructions(out);
      saveRevampBaseInstructions(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.revamper.new.optimizeWandError'));
    } finally {
      setOptimizingInstructions(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <Link
          to="/revamper"
          className="mb-6 inline-flex items-center gap-2 text-gray-600 transition hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft size={20} />
          {t('dashboard.revamper.new.back')}
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">{t('dashboard.revamper.new.title')}</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">{t('dashboard.revamper.new.description')}</p>

        <div className="glass-panel mb-6 rounded-xl border border-neutral-200/80 p-6 dark:border-white/10">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setInputMode('url')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition ${
                inputMode === 'url' ? 'border border-primary/30 bg-primary/20 text-primary' : 'text-gray-600 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              <Globe size={18} />
              {t('dashboard.revamper.new.tabUrl')}
            </button>
            <button
              type="button"
              onClick={() => setInputMode('code')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition ${
                inputMode === 'code' ? 'border border-primary/30 bg-primary/20 text-primary' : 'text-gray-600 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              <Code size={18} />
              {t('dashboard.revamper.new.tabCode')}
            </button>
          </div>

          {inputMode === 'url' && (
            <>
              <div className="mb-4 rounded-lg border border-neutral-200/80 bg-theme-tertiary/40 p-3 dark:border-white/10">
                <label className="inline-flex cursor-pointer select-none items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={isAdvancedMode}
                    onChange={(e) => setIsAdvancedMode(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="text-sm text-neutral-800 dark:text-gray-200">{t('dashboard.revamper.new.advancedCheck')}</span>
                </label>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  {isAdvancedMode ? t('dashboard.revamper.new.helpClaude') : t('dashboard.revamper.new.helpStitch')}
                </p>
              </div>

              {!isAdvancedMode && (
                <div className="mb-4 rounded-lg border border-neutral-200/80 bg-theme-tertiary/40 p-3 dark:border-white/10">
                  <label className="inline-flex cursor-pointer select-none items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={enableI18n}
                      onChange={(e) => setEnableI18n(e.target.checked)}
                      disabled={loading}
                    />
                    <span className="text-sm text-neutral-800 dark:text-gray-200">
                      Switcher multi-langue (EN / FR / DE / ES / IT)
                    </span>
                  </label>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Ajoute un sélecteur de langue (4 drapeaux) + traduit toutes les chaînes via Claude Opus.
                    Le HTML exporté reste auto-contenu (dictionnaire inline, pas d'appel réseau).
                  </p>
                  {enableI18n && (
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs text-gray-500 dark:text-gray-500" htmlFor="revamp-i18n-src">
                        Langue source du contenu généré :
                      </label>
                      <select
                        id="revamp-i18n-src"
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value as RevamperSourceLang)}
                        disabled={loading}
                        className="rounded-md border border-neutral-200/80 bg-theme-tertiary px-2 py-1 text-xs text-neutral-900 focus:ring-2 focus:ring-primary dark:border-white/10 dark:text-white"
                      >
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="es">Español</option>
                        <option value="it">Italiano</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div className="mb-4 flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('dashboard.revamper.new.placeholderUrl')}
                  className="flex-1 rounded-lg border border-neutral-200/80 bg-theme-tertiary px-4 py-3 text-neutral-900 placeholder-gray-500 focus:ring-2 focus:ring-primary dark:border-white/10 dark:text-white"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !url.trim()}
                  className="flex items-center gap-2 rounded-lg px-5 py-3 font-semibold transition disabled:opacity-50 silver-gradient-cta"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  {loading
                    ? isAdvancedMode
                      ? t('dashboard.revamper.new.generatingAdvanced')
                      : t('dashboard.revamper.new.queueing')
                    : t('dashboard.revamper.new.generate')}
                </button>
              </div>
            </>
          )}

          {inputMode === 'code' && (
            <>
              <textarea
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={t('dashboard.revamper.new.codePlaceholder')}
                rows={10}
                className="mb-4 w-full resize-y rounded-lg border border-neutral-200/80 bg-theme-tertiary px-4 py-3 font-mono text-sm text-neutral-900 placeholder-gray-500 focus:ring-2 focus:ring-primary dark:border-white/10 dark:text-white"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !codeInput.trim()}
                className="flex items-center gap-2 rounded-lg px-5 py-3 font-semibold transition disabled:opacity-50 silver-gradient-cta"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                {t('dashboard.revamper.new.saveAsRedesign')}
              </button>
            </>
          )}

          {!loading && inputMode !== 'code' && !isAdvancedMode && (
            <>
              <div className="mb-4 mt-6">
                <span className="mb-2 block text-sm text-gray-500 dark:text-gray-500">{t('dashboard.revamper.new.styleLabel')}</span>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setStylePreference(stylePreference === style ? '' : style)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        stylePreference === style
                          ? 'border border-primary/30 bg-primary/20 text-primary'
                          : 'border border-transparent text-gray-600 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-white/5'
                      }`}
                    >
                      {t(`dashboard.revamper.styles.${style}` as const)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-2 block text-sm text-gray-500 dark:text-gray-500">{t('dashboard.revamper.new.sectionsLabel')}</span>
                <div className="flex flex-wrap gap-2">
                  {REVAMPER_SECTION_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleSection(id)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        sections.includes(id)
                          ? 'border border-primary/30 bg-primary/20 text-primary'
                          : 'border border-transparent text-gray-600 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-white/5'
                      }`}
                    >
                      {t(`dashboard.revamper.sections.${id}` as const)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 space-y-6">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm text-gray-500 dark:text-gray-500" htmlFor="revamp-base">
                      {t('dashboard.revamper.new.baseInstructionsLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleOptimizeBaseInstructions()}
                      disabled={loading || optimizingInstructions || !baseInstructions.trim()}
                      title={t('dashboard.revamper.new.optimizeWandAria')}
                      className="inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {optimizingInstructions ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Wand2 size={14} />
                      )}
                      {optimizingInstructions
                        ? t('dashboard.revamper.new.optimizeWandLoading')
                        : t('dashboard.revamper.new.optimizeWand')}
                    </button>
                  </div>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-500">
                    {t('dashboard.revamper.new.baseInstructionsHelp')}
                  </p>
                  <textarea
                    id="revamp-base"
                    value={baseInstructions}
                    onChange={(e) => setBaseInstructions(e.target.value)}
                    onBlur={() => saveRevampBaseInstructions(baseInstructions)}
                    placeholder={t('dashboard.revamper.new.baseInstructionsPlaceholder')}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-neutral-200/80 bg-theme-tertiary px-4 py-3 text-sm text-neutral-900 placeholder-gray-500 focus:ring-2 focus:ring-primary dark:border-white/10 dark:text-white"
                    disabled={loading || optimizingInstructions}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm text-gray-500 dark:text-gray-500"
                    htmlFor="revamp-supplementary"
                  >
                    {t('dashboard.revamper.new.supplementaryInstructionsLabel')}
                  </label>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-500">
                    {t('dashboard.revamper.new.supplementaryInstructionsHelp')}
                  </p>
                  <textarea
                    id="revamp-supplementary"
                    value={supplementaryInstructions}
                    onChange={(e) => setSupplementaryInstructions(e.target.value)}
                    onBlur={() => saveRevampSupplementaryInstructions(supplementaryInstructions)}
                    placeholder={t('dashboard.revamper.new.supplementaryInstructionsPlaceholder')}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-neutral-200/80 bg-theme-tertiary px-4 py-3 text-sm text-neutral-900 placeholder-gray-500 focus:ring-2 focus:ring-primary dark:border-white/10 dark:text-white"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
