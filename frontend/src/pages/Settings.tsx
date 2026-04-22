import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { User, CreditCard, FileText, Mail, Save, Crown, Cpu, Send } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import SettingsJobQueue from '../components/SettingsJobQueue';
import {
  getSmtpSettings,
  saveSmtpSettings,
  sendSmtpTestEmail,
  testSmtpSettings,
} from '../services/smtpSettings';

export default function Settings() {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'billing' | 'jobs' | 'smtp'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHasSavedPass, setSmtpHasSavedPass] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpSendTestLoading, setSmtpSendTestLoading] = useState(false);
  const [smtpTestToEmail, setSmtpTestToEmail] = useState('');
  const [smtpFetched, setSmtpFetched] = useState(false);

  const [localProfile, setLocalProfile] = useState({
    full_name: '',
    company_name: '',
    role: 'client' as 'client' | 'professional',
  });

  useEffect(() => {
    if (profile) {
      setLocalProfile({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        role: profile.role || 'client',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab !== 'smtp' || !user) {
      setSmtpFetched(false);
      return;
    }
    let cancelled = false;
    setSmtpFetched(false);
    (async () => {
      setSmtpLoading(true);
      try {
        const s = await getSmtpSettings();
        if (cancelled) return;
        setSmtpHost(s.host);
        setSmtpPort(s.port);
        setSmtpUser(s.user);
        setSmtpFrom(s.from);
        setSmtpHasSavedPass(s.has_password);
        setSmtpPass('');
        setSmtpTestToEmail((prev) => prev || user.email || '');
      } catch {
        if (!cancelled) setMessage({ type: 'error', text: t('dashboard.settings.smtpLoadError') });
      } finally {
        if (!cancelled) {
          setSmtpLoading(false);
          setSmtpFetched(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user, t]);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSmtpLoading(true);
    setMessage(null);
    try {
      await saveSmtpSettings({
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        from: smtpFrom.trim(),
        pass: smtpPass.trim() || undefined,
      });
      setSmtpHasSavedPass(smtpHasSavedPass || Boolean(smtpPass.trim()));
      setSmtpPass('');
      setMessage({ type: 'success', text: t('dashboard.settings.smtpSaveSuccess') });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('dashboard.settings.smtpSaveError'),
      });
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!user) return;
    setSmtpTestLoading(true);
    setMessage(null);
    try {
      const useSaved = !smtpPass.trim() && smtpHasSavedPass;
      const r = await testSmtpSettings({
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        from: smtpFrom.trim(),
        pass: smtpPass.trim() || undefined,
        use_saved_password: useSaved,
      });
      if (r.ok) {
        setMessage({
          type: 'success',
          text: t('dashboard.settings.smtpTestSuccess', { from: r.from ?? '—' }),
        });
      } else {
        setMessage({ type: 'error', text: r.error ?? t('dashboard.settings.smtpTestError') });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('dashboard.settings.smtpTestError'),
      });
    } finally {
      setSmtpTestLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!user) return;
    const to = smtpTestToEmail.trim();
    if (!to) {
      setMessage({ type: 'error', text: t('dashboard.settings.smtpSendTestToRequired') });
      return;
    }
    setSmtpSendTestLoading(true);
    setMessage(null);
    try {
      const useSaved = !smtpPass.trim() && smtpHasSavedPass;
      const r = await sendSmtpTestEmail({
        to,
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        from: smtpFrom.trim(),
        pass: smtpPass.trim() || undefined,
        use_saved_password: useSaved,
      });
      if (r.ok) {
        setMessage({ type: 'success', text: t('dashboard.settings.smtpSendTestSuccess') });
      } else {
        setMessage({ type: 'error', text: r.error ?? t('dashboard.settings.smtpSendTestError') });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('dashboard.settings.smtpSendTestError'),
      });
    } finally {
      setSmtpSendTestLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await updateProfile({ full_name: localProfile.full_name });
      if (error) throw error;
      setMessage({ type: 'success', text: t('dashboard.settings.successProfile') });
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('dashboard.settings.errorProfile'),
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: t('dashboard.settings.tabProfile'), icon: User },
    { id: 'subscription' as const, label: t('dashboard.settings.tabSubscription'), icon: Crown },
    { id: 'billing' as const, label: t('dashboard.settings.tabBilling'), icon: FileText },
    { id: 'smtp' as const, label: t('dashboard.settings.tabSmtp'), icon: Send },
    { id: 'jobs' as const, label: t('dashboard.settings.tabJobs'), icon: Cpu },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.subtitle')}</p>
          </div>

          <div className="flex gap-6">
            <div className="w-64 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                      activeTab === tab.id
                        ? 'border border-primary/30 bg-primary/20 text-primary'
                        : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1">
              <div className="glass-panel rounded-xl p-8">
                {message && (
                  <div
                    className={`mb-6 rounded-lg p-4 ${
                      message.type === 'success'
                        ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {activeTab === 'profile' && (
                  <form onSubmit={handleSaveProfile}>
                    <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.profileTitle')}</h2>

                    <div className="space-y-6">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.settings.email')}</label>
                        <div className="flex items-center gap-3 rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-800">
                          <Mail size={20} className="text-gray-400" />
                          <span className="text-gray-900 dark:text-white">{user?.email}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{t('dashboard.settings.emailReadonly')}</p>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.settings.fullName')}</label>
                        <input
                          type="text"
                          value={localProfile.full_name}
                          onChange={(e) => setLocalProfile({ ...localProfile, full_name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          placeholder={t('dashboard.settings.fullNamePlaceholder')}
                          required
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                          {t('dashboard.settings.rolePrefix')}{' '}
                          <strong className="text-gray-800 dark:text-white">{localProfile.role}</strong> {t('dashboard.settings.roleSuffix')}
                        </p>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('dashboard.settings.company')} <span className="text-gray-400">{t('dashboard.settings.companyNote')}</span>
                        </label>
                        <input
                          type="text"
                          value={localProfile.company_name}
                          onChange={(e) => setLocalProfile({ ...localProfile, company_name: e.target.value })}
                          disabled
                          className="w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-gray-500 dark:border-gray-700 dark:bg-gray-900"
                          placeholder="—"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save size={20} />
                        {loading ? t('dashboard.settings.saving') : t('dashboard.settings.save')}
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === 'subscription' && (
                  <div>
                    <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.subscriptionTitle')}</h2>

                    <div className="space-y-6">
                      <div className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                        <div className="mb-4 flex items-center gap-3">
                          <Crown size={32} className="text-primary" />
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.planFree')}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.settings.planCurrent')}</p>
                          </div>
                        </div>

                        <div className="mb-6 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.projects')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">3 / 3</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.storage')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">5 GB</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.collaborators')}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{t('dashboard.settings.unlimited')}</span>
                          </div>
                        </div>

                        <button type="button" className="w-full rounded-lg bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90">
                          {t('dashboard.settings.upgradePremium')}
                        </button>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-lg border border-gray-300 p-6 dark:border-gray-700">
                          <h4 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.settings.planPremium')}</h4>
                          <div className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
                            29€<span className="text-lg text-gray-500">{t('dashboard.settings.perMonth')}</span>
                          </div>
                          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <li>✓ {t('dashboard.settings.featUnlimitedProjects')}</li>
                            <li>✓ {t('dashboard.settings.featStorage100')}</li>
                            <li>✓ {t('dashboard.settings.featBranding')}</li>
                            <li>✓ {t('dashboard.settings.featSupport')}</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border border-gray-300 p-6 dark:border-gray-700">
                          <h4 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.settings.planEnterprise')}</h4>
                          <div className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.custom')}</div>
                          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <li>✓ {t('dashboard.settings.featAllPremium')}</li>
                            <li>✓ {t('dashboard.settings.featStorageUnlimited')}</li>
                            <li>✓ {t('dashboard.settings.featSso')}</li>
                            <li>✓ {t('dashboard.settings.featDedicated')}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'billing' && (
                  <div>
                    <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.billingTitle')}</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.paymentMethods')}</h3>
                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                          <CreditCard size={48} className="mx-auto mb-4 text-gray-400" />
                          <p className="mb-4 text-gray-600 dark:text-gray-400">{t('dashboard.settings.noPayment')}</p>
                          <button type="button" className="rounded-lg bg-primary px-6 py-2 text-white transition-colors hover:bg-primary/90">
                            {t('dashboard.settings.addCard')}
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.invoiceHistory')}</h3>
                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                          <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.noInvoices')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'smtp' && (
                  <div>
                    <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                      {t('dashboard.settings.smtpTitle')}
                    </h2>
                    <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('dashboard.settings.smtpIntro')}</p>

                    {!user ? (
                      <p className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.smtpLoginRequired')}</p>
                    ) : !smtpFetched || smtpLoading ? (
                      <p className="text-gray-600 dark:text-gray-400">{t('dashboard.settings.smtpLoading')}</p>
                    ) : (
                      <form onSubmit={handleSaveSmtp} className="max-w-xl space-y-4">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('dashboard.settings.smtpHost')}
                          </label>
                          <input
                            type="text"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            placeholder="smtp.example.com"
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('dashboard.settings.smtpPort')}
                          </label>
                          <input
                            type="number"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                            min={1}
                            max={65535}
                            className="w-full max-w-[120px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('dashboard.settings.smtpUser')}
                          </label>
                          <input
                            type="text"
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            autoComplete="username"
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('dashboard.settings.smtpPass')}
                          </label>
                          <input
                            type="password"
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            autoComplete="current-password"
                            placeholder={
                              smtpHasSavedPass
                                ? t('dashboard.settings.smtpPassPlaceholderSaved')
                                : t('dashboard.settings.smtpPassPlaceholder')
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                          {smtpHasSavedPass && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {t('dashboard.settings.smtpPassHint')}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('dashboard.settings.smtpFrom')}
                          </label>
                          <input
                            type="text"
                            value={smtpFrom}
                            onChange={(e) => setSmtpFrom(e.target.value)}
                            placeholder="Agence &lt;contact@domaine.com&gt;"
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div className="flex flex-wrap gap-3 pt-2">
                          <button
                            type="submit"
                            disabled={smtpLoading}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-white transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Save size={18} />
                            {smtpLoading ? t('dashboard.settings.saving') : t('dashboard.settings.smtpSave')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTestSmtp()}
                            disabled={smtpTestLoading || smtpLoading || smtpSendTestLoading}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-gray-900 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-white dark:hover:bg-white/5"
                          >
                            <Send size={18} />
                            {smtpTestLoading ? t('dashboard.settings.smtpTesting') : t('dashboard.settings.smtpTest')}
                          </button>
                        </div>
                        <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('dashboard.settings.smtpSendTestSection')}
                          </p>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1">
                              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('dashboard.settings.smtpTestToLabel')}
                              </label>
                              <input
                                type="email"
                                value={smtpTestToEmail}
                                onChange={(e) => setSmtpTestToEmail(e.target.value)}
                                placeholder={t('dashboard.settings.smtpTestToPlaceholder')}
                                autoComplete="email"
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleSendTestEmail()}
                              disabled={smtpSendTestLoading || smtpLoading || smtpTestLoading}
                              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-5 py-2.5 text-primary transition hover:bg-primary/15 disabled:opacity-50 dark:text-white"
                            >
                              <Mail size={18} />
                              {smtpSendTestLoading
                                ? t('dashboard.settings.smtpSendTestSending')
                                : t('dashboard.settings.smtpSendTestEmail')}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {activeTab === 'jobs' && <SettingsJobQueue />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
