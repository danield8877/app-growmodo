import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Mail, Send, Users, CheckCircle, XCircle, Clock, Loader2,
  AlertCircle, ArrowLeft, Sparkles, RefreshCw, Plus, Trash2, Save,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import EmailHtmlEditor from '../../components/emailer/EmailHtmlEditor';
import {
  getCampaign,
  generateCampaignEmail,
  sendCampaign as sendCampaignApi,
  testSmtp,
  updateCampaign,
  type EmailerCampaign,
  type CampaignStatus,
  type Contact,
  type EmailTemplate,
  type SendStats,
} from '../../services/emailer';

function parseContactsCsv(raw: string): Contact[] {
  const lines = raw.trim().split('\n').filter(Boolean);
  const results: Contact[] = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    const [email, name, siteUrl, company] = parts;
    if (!email?.includes('@')) continue;
    results.push({
      email,
      name: name || undefined,
      siteUrl: siteUrl || undefined,
      company: company || undefined,
    });
  }
  return results;
}

function normalizeContacts(raw: unknown): Contact[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    const o = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
    return {
      email: typeof o.email === 'string' ? o.email : '',
      name: typeof o.name === 'string' ? o.name : undefined,
      company: typeof o.company === 'string' ? o.company : undefined,
      siteUrl: typeof o.siteUrl === 'string' ? o.siteUrl : undefined,
    };
  });
}

function buildCleanedContacts(rows: Contact[]): Contact[] {
  return rows
    .map((c) => ({
      email: c.email?.trim() ?? '',
      name: c.name?.trim() || undefined,
      company: c.company?.trim() || undefined,
      siteUrl: c.siteUrl?.trim() || undefined,
    }))
    .filter((c) => c.email.includes('@'));
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  const configs: Record<CampaignStatus, { icon: React.ReactNode; label: string; className: string }> = {
    DRAFT:     { icon: <Clock size={13} />,        label: 'Brouillon',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    QUEUED:    { icon: <Clock size={13} />,        label: 'En attente', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    RUNNING:   { icon: <Loader2 size={13} className="animate-spin" />, label: 'En cours', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    DONE:      { icon: <CheckCircle size={13} />,  label: 'Envoyée',    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    FAILED:    { icon: <XCircle size={13} />,      label: 'Échouée',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    CANCELLED: { icon: <XCircle size={13} />,      label: 'Annulée',    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
  };
  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, className }: { label: string; value: string | number; icon: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-panel rounded-xl p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EmailerCampaign() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<EmailerCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [sendResult, setSendResult] = useState<SendStats | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftContacts, setDraftContacts] = useState<Contact[]>([]);
  const [draftLanguage, setDraftLanguage] = useState<'fr' | 'en'>('fr');
  const [draftTone, setDraftTone] = useState<'formal' | 'friendly' | 'bold'>('friendly');
  const [newContact, setNewContact] = useState<Contact>({ email: '' });
  const [contactImportMode, setContactImportMode] = useState<'manual' | 'csv'>('manual');
  const [csvText, setCsvText] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<EmailTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getCampaign(id);
      setCampaign(data);
      setDraftName(data.name);
      setDraftContacts(normalizeContacts(data.contacts));
      setDraftLanguage(data.ai_context?.language ?? 'fr');
      setDraftTone(data.ai_context?.tone ?? 'friendly');
      setTemplateDraft(data.template ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!id || !campaign) return;
    setGenerating(true);
    setActionError(null);
    try {
      const cleaned = buildCleanedContacts(draftContacts);
      const synced = await updateCampaign(id, {
        name: draftName.trim() || campaign.name,
        contacts: cleaned,
        ai_context: {
          ...campaign.ai_context,
          language: draftLanguage,
          tone: draftTone,
        },
      });
      setCampaign(synced);
      setDraftName(synced.name);
      setDraftContacts(normalizeContacts(synced.contacts));
      const result = await generateCampaignEmail(id, {
        language: draftLanguage,
        tone: draftTone,
        public_app_url: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      setCampaign(result.campaign);
      setTemplateDraft(result.campaign.template ?? null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!id || !campaign || metaLocked) return;
    setSavingTemplate(true);
    setActionError(null);
    try {
      const updated = await updateCampaign(id, {
        template: templateDraft ?? { subject: '', bodyHtml: '', bodyText: '' },
      });
      setCampaign(updated);
      setTemplateDraft(updated.template ?? null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Enregistrement du contenu impossible');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSend = async () => {
    if (!id || !campaign) return;
    const cleaned = buildCleanedContacts(draftContacts);
    const n = cleaned.length;
    if (n === 0) {
      setActionError('Ajoutez au moins un destinataire avec une adresse email valide.');
      return;
    }
    if (!confirm(`Envoyer cette campagne à ${n} prospect(s) ?`)) return;
    setSending(true);
    setActionError(null);
    try {
      const synced = await updateCampaign(id, {
        name: draftName.trim() || campaign.name,
        contacts: cleaned,
        ai_context: {
          ...campaign.ai_context,
          language: draftLanguage,
          tone: draftTone,
        },
      });
      setCampaign(synced);
      setDraftName(synced.name);
      setDraftContacts(normalizeContacts(synced.contacts));
      const result = await sendCampaignApi(id);
      setSendResult(result.stats);
      if (result.campaign) {
        setCampaign(result.campaign);
        setTemplateDraft(result.campaign.template ?? null);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur d\'envoi');
    } finally {
      setSending(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!id || !campaign) return;
    if (campaign.status === 'RUNNING') return;
    setSavingMeta(true);
    setActionError(null);
    try {
      const cleaned = buildCleanedContacts(draftContacts);
      const updated = await updateCampaign(id, {
        name: draftName.trim() || campaign.name,
        contacts: cleaned,
        ai_context: {
          ...campaign.ai_context,
          language: draftLanguage,
          tone: draftTone,
        },
      });
      setCampaign(updated);
      setDraftName(updated.name);
      setDraftContacts(normalizeContacts(updated.contacts));
      setTemplateDraft(updated.template ?? null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSavingMeta(false);
    }
  };

  const updateContactRow = (index: number, patch: Partial<Contact>) => {
    setDraftContacts((rows) => rows.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeContactRow = (index: number) => {
    setDraftContacts((rows) => rows.filter((_, i) => i !== index));
  };

  const addContactRow = () => {
    if (!newContact.email?.trim().includes('@')) return;
    setDraftContacts((rows) => [...rows, { ...newContact, email: newContact.email.trim() }]);
    setNewContact({ email: '' });
  };

  const importContactsCsv = () => {
    const parsed = parseContactsCsv(csvText);
    if (parsed.length === 0) {
      alert('Aucun email valide trouvé. Format : email,nom,siteUrl,entreprise');
      return;
    }
    setDraftContacts((rows) => [...rows, ...parsed]);
    setCsvText('');
    setContactImportMode('manual');
  };

  const handleTestSmtp = async () => {
    if (!id) return;
    setTestingSmtp(true);
    setActionError(null);
    try {
      const smtpCfg = campaign?.smtp_config ?? undefined;
      const result = await testSmtp(smtpCfg ? smtpCfg : undefined);
      if (result.ok) {
        alert(`Connexion SMTP réussie ! Expéditeur : ${result.from ?? '—'}`);
      } else {
        setActionError(result.error ?? 'Connexion SMTP échouée');
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur SMTP');
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !campaign) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl p-6">
          <div className="glass-panel rounded-xl p-8 text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-red-500" />
            <p className="text-gray-700 dark:text-gray-300">{error ?? 'Campagne introuvable'}</p>
            <Link to="/emailer" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
              <ArrowLeft size={16} /> Retour aux campagnes
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const template = templateDraft ?? campaign.template;
  const stats = campaign.stats;
  const canSend = campaign.status === 'DRAFT' || campaign.status === 'FAILED';
  const hasSent = campaign.status === 'DONE' || campaign.status === 'FAILED';
  const metaLocked = campaign.status === 'RUNNING';
  const prospectCount = draftContacts.filter((c) => c.email?.trim().includes('@')).length;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/emailer" className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-primary dark:text-gray-400 transition">
              <ArrowLeft size={15} /> Campagnes
            </Link>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              disabled={metaLocked}
              aria-label="Nom de la campagne"
              className="w-full max-w-2xl border-0 border-b border-transparent bg-transparent p-0 text-3xl font-bold text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
            />
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={campaign.status} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {campaign.sent_at
                  ? `Envoyée le ${new Date(campaign.sent_at).toLocaleDateString('fr-FR')}`
                  : `Créée le ${new Date(campaign.created_at).toLocaleDateString('fr-FR')}`}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestSmtp}
              disabled={testingSmtp}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition"
            >
              {testingSmtp ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              Test SMTP
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || campaign.status === 'RUNNING'}
              className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {template?.subject ? 'Regénérer' : 'Générer avec IA'}
            </button>
            {canSend && (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !template?.bodyHtml}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? 'Envoi en cours…' : 'Lancer l\'envoi'}
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
          </div>
        )}

        {/* No template warning */}
        {!template?.bodyHtml && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/30 dark:bg-yellow-900/10">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Aucun email généré. Cliquez sur "Générer avec IA" pour créer le contenu de votre email.
            </p>
          </div>
        )}

        {/* Stats */}
        {(stats || hasSent) && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total prospects" value={stats?.total ?? prospectCount} icon={<Users size={20} />} />
            <StatCard label="Envoyés" value={stats?.sent ?? 0} icon={<CheckCircle size={20} />} />
            <StatCard label="Échecs" value={stats?.failed ?? 0} icon={<XCircle size={20} />} />
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div className={`flex items-start gap-3 rounded-lg border p-4 ${sendResult.failed === 0 ? 'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10' : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-900/10'}`}>
            <RefreshCw size={18} className={`mt-0.5 shrink-0 ${sendResult.failed === 0 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
            <div className="text-sm">
              <p className={`font-medium ${sendResult.failed === 0 ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                {sendResult.sent} email{sendResult.sent > 1 ? 's' : ''} envoyé{sendResult.sent > 1 ? 's' : ''}
                {sendResult.failed > 0 && ` · ${sendResult.failed} échec${sendResult.failed > 1 ? 's' : ''}`}
              </p>
              {sendResult.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-red-600 dark:text-red-400">
                  {sendResult.errors.map((e, i) => (
                    <li key={i}>{e.email} — {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Email preview */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail size={18} /> Contenu de l'email
            </h2>
            {template?.subject || template?.bodyHtml ? (
              <div className="glass-panel rounded-xl overflow-hidden p-4 space-y-4">
                <EmailHtmlEditor
                  subject={template.subject ?? ''}
                  bodyHtml={template.bodyHtml ?? ''}
                  onChangeSubject={(subject) =>
                    setTemplateDraft((prev) => ({ ...(prev ?? template), subject }))
                  }
                  onChangeBody={(bodyHtml) =>
                    setTemplateDraft((prev) => ({
                      ...(prev ?? template),
                      bodyHtml,
                      bodyText: bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
                    }))
                  }
                  demoUrlHint={
                    campaign.revamper_project_id && typeof window !== 'undefined'
                      ? `${window.location.origin}/revamper/public/${campaign.revamper_project_id}`
                      : null
                  }
                  disabled={metaLocked}
                />
                <button
                  type="button"
                  onClick={() => void handleSaveTemplate()}
                  disabled={savingTemplate || metaLocked}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {savingTemplate ? 'Enregistrement…' : 'Enregistrer le contenu email'}
                </button>
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-8 text-center">
                <Sparkles size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">Aucun contenu généré</p>
              </div>
            )}
          </div>

          {/* Campagne & prospects (édition) */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={18} /> Campagne & prospects ({prospectCount})
            </h2>
            <div className="glass-panel rounded-xl p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Langue (génération IA)</label>
                  <select
                    value={draftLanguage}
                    onChange={(e) => setDraftLanguage(e.target.value as 'fr' | 'en')}
                    disabled={metaLocked}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Ton (génération IA)</label>
                  <select
                    value={draftTone}
                    onChange={(e) => setDraftTone(e.target.value as 'formal' | 'friendly' | 'bold')}
                    disabled={metaLocked}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                  >
                    <option value="formal">Formel</option>
                    <option value="friendly">Amical</option>
                    <option value="bold">Direct</option>
                  </select>
                </div>
              </div>

              {campaign.status === 'DONE' && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  Campagne déjà envoyée : les changements ici ne concernent pas les envois passés (utile pour corriger la liste ou dupliquer la campagne ailleurs).
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setContactImportMode('manual')}
                  disabled={metaLocked}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${contactImportMode === 'manual' ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'}`}
                >
                  Saisie manuelle
                </button>
                <button
                  type="button"
                  onClick={() => setContactImportMode('csv')}
                  disabled={metaLocked}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${contactImportMode === 'csv' ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'}`}
                >
                  Import CSV
                </button>
              </div>

              {contactImportMode === 'manual' ? (
                <div className="grid gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700 sm:grid-cols-2">
                  {[
                    { key: 'email', label: 'Email *', ph: 'contact@entreprise.fr', span: true },
                    { key: 'name', label: 'Prénom / Nom', ph: 'Jean Dupont' },
                    { key: 'company', label: 'Entreprise', ph: 'ACME SAS' },
                    { key: 'siteUrl', label: 'URL du site', ph: 'https://…', span: true },
                  ].map(({ key, label, ph, span }) => (
                    <div key={key} className={span ? 'sm:col-span-2' : ''}>
                      <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">{label}</label>
                      <input
                        type="text"
                        value={String(newContact[key as keyof Contact] ?? '')}
                        onChange={(e) => setNewContact({ ...newContact, [key]: e.target.value })}
                        placeholder={ph}
                        disabled={metaLocked}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={addContactRow}
                      disabled={metaLocked}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <Plus size={14} /> Ajouter ce prospect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Format : <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">email,nom,siteUrl,entreprise</code> (une ligne par prospect)
                  </p>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={5}
                    disabled={metaLocked}
                    placeholder="contact@exemple.fr,Jean Dupont,https://exemple.fr,ACME"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={importContactsCsv}
                    disabled={metaLocked}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    <Plus size={14} /> Importer
                  </button>
                </div>
              )}

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {draftContacts.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400">Aucun prospect — ajoutez au moins un email.</p>
                ) : (
                  draftContacts.map((c, i) => {
                    const errorEntry = stats?.errors?.find((e) => e.email === c.email);
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <div className="mb-2 grid gap-2 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="mb-0.5 block text-xs text-gray-500">Email *</label>
                            <input
                              type="email"
                              value={c.email}
                              onChange={(e) => updateContactRow(i, { email: e.target.value })}
                              disabled={metaLocked}
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-gray-500">Nom</label>
                            <input
                              type="text"
                              value={c.name ?? ''}
                              onChange={(e) => updateContactRow(i, { name: e.target.value })}
                              disabled={metaLocked}
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-gray-500">Entreprise</label>
                            <input
                              type="text"
                              value={c.company ?? ''}
                              onChange={(e) => updateContactRow(i, { company: e.target.value })}
                              disabled={metaLocked}
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-0.5 block text-xs text-gray-500">URL du site</label>
                            <input
                              type="text"
                              value={c.siteUrl ?? ''}
                              onChange={(e) => updateContactRow(i, { siteUrl: e.target.value })}
                              disabled={metaLocked}
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {hasSent && errorEntry && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={errorEntry.error}>
                              <XCircle size={14} /> Échec envoi
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeContactRow(i)}
                            disabled={metaLocked}
                            className="ml-auto text-red-500 hover:text-red-700 disabled:opacity-40"
                            aria-label="Supprimer ce prospect"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSaveMeta()}
                disabled={savingMeta || metaLocked}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
              >
                {savingMeta ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingMeta ? 'Enregistrement…' : 'Enregistrer nom, prospects et options IA'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
