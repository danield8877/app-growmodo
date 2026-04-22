import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Users, Sparkles, Send, ChevronRight, ChevronLeft,
  Plus, Trash2, Loader2, CheckCircle, AlertCircle, RefreshCw,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import EmailHtmlEditor from '../../components/emailer/EmailHtmlEditor';
import {
  createCampaign, updateCampaign, generateCampaignEmail, testSmtp,
  type Contact, type SmtpConfig, type EmailTemplate,
} from '../../services/emailer';
import { apiJson } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevamperProject {
  id: string;
  title: string;
  source_url: string | null;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseContactsCsv(raw: string): Contact[] {
  const lines = raw.trim().split('\n').filter(Boolean);
  const results: Contact[] = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    const [email, name, siteUrl, company] = parts;
    if (!email?.includes('@')) continue;
    results.push({ email, name: name || undefined, siteUrl: siteUrl || undefined, company: company || undefined });
  }
  return results;
}

// ── Step components ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  const labels = ['Config SMTP', 'Prospects', 'Contenu IA', 'Envoi'];
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              i + 1 < step
                ? 'bg-primary text-white'
                : i + 1 === step
                ? 'bg-primary/20 text-primary border-2 border-primary'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {i + 1 < step ? <CheckCircle size={16} /> : i + 1}
          </div>
          {!('window' in {} && false) && (
            <span className={`hidden text-sm sm:inline ${i + 1 === step ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {labels[i]}
            </span>
          )}
          {i < total - 1 && <div className="h-px w-6 bg-gray-300 dark:bg-gray-600" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: SMTP config ───────────────────────────────────────────────────────

function Step1Smtp({
  campaignName, setCampaignName,
  useGlobalSmtp, setUseGlobalSmtp,
  smtp, setSmtp,
  onTest, testStatus,
}: {
  campaignName: string; setCampaignName: (v: string) => void;
  useGlobalSmtp: boolean; setUseGlobalSmtp: (v: boolean) => void;
  smtp: Partial<SmtpConfig>; setSmtp: (v: Partial<SmtpConfig>) => void;
  onTest: () => void; testStatus: 'idle' | 'loading' | 'ok' | 'error'; testError?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Nom de la campagne *
        </label>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Ex : Prospection PME Paris — Avril 2026"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Compte email expéditeur
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={useGlobalSmtp}
            onChange={(e) => setUseGlobalSmtp(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Utiliser le compte SMTP configuré dans <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">.env</code>
          </span>
        </label>

        {!useGlobalSmtp && (
          <div className="grid gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700 sm:grid-cols-2">
            {[
              { key: 'host', label: 'Serveur SMTP', placeholder: 'smtp.gmail.com' },
              { key: 'port', label: 'Port', placeholder: '587', type: 'number' },
              { key: 'user', label: 'Email expéditeur', placeholder: 'toi@gmail.com', span: true },
              { key: 'pass', label: 'Mot de passe (app)', placeholder: '••••••••••••', type: 'password', span: true },
              { key: 'from', label: 'Nom affiché', placeholder: 'Agence Revamperr <toi@gmail.com>', span: true },
            ].map(({ key, label, placeholder, type, span }) => (
              <div key={key} className={span ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
                <input
                  type={type ?? 'text'}
                  value={String(smtp[key as keyof SmtpConfig] ?? '')}
                  onChange={(e) => setSmtp({ ...smtp, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            ))}

            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={onTest}
                disabled={testStatus === 'loading'}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {testStatus === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                Tester la connexion SMTP
              </button>
              {testStatus === 'ok' && <p className="mt-1 text-xs text-green-600 dark:text-green-400">Connexion SMTP réussie !</p>}
              {testStatus === 'error' && <p className="mt-1 text-xs text-red-500">Échec de connexion. Vérifiez vos identifiants.</p>}
            </div>
          </div>
        )}

        {useGlobalSmtp && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Le SMTP global (configuré dans <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">SMTP_HOST / SMTP_USER / SMTP_PASS</code> du serveur) sera utilisé pour l'envoi.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Contacts ──────────────────────────────────────────────────────────

function Step2Contacts({ contacts, setContacts }: { contacts: Contact[]; setContacts: (c: Contact[]) => void }) {
  const [csvText, setCsvText] = useState('');
  const [mode, setMode] = useState<'manual' | 'csv'>('manual');
  const [newContact, setNewContact] = useState<Contact>({ email: '' });

  const addContact = () => {
    if (!newContact.email.includes('@')) return;
    setContacts([...contacts, { ...newContact }]);
    setNewContact({ email: '' });
  };

  const removeContact = (i: number) => setContacts(contacts.filter((_, idx) => idx !== i));

  const importCsv = () => {
    const parsed = parseContactsCsv(csvText);
    if (parsed.length === 0) { alert('Aucun email valide trouvé. Format attendu : email,nom,siteUrl,entreprise'); return; }
    setContacts([...contacts, ...parsed]);
    setCsvText('');
    setMode('manual');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === 'manual' ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
          Saisie manuelle
        </button>
        <button
          type="button"
          onClick={() => setMode('csv')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === 'csv' ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
          Import CSV
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="grid gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700 sm:grid-cols-2">
          {[
            { key: 'email', label: 'Email *', placeholder: 'contact@entreprise.fr', span: true },
            { key: 'name', label: 'Prénom / Nom', placeholder: 'Jean Dupont' },
            { key: 'company', label: 'Entreprise', placeholder: 'ACME SAS' },
            { key: 'siteUrl', label: 'URL de leur site', placeholder: 'https://entreprise.fr', span: true },
          ].map(({ key, label, placeholder, span }) => (
            <div key={key} className={span ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
              <input
                type="text"
                value={String(newContact[key as keyof Contact] ?? '')}
                onChange={(e) => setNewContact({ ...newContact, [key]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && key === 'siteUrl' && addContact()}
                placeholder={placeholder}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={addContact}
              className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition"
            >
              <Plus size={15} /> Ajouter ce prospect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Format CSV : <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">email,nom,siteUrl,entreprise</code> (une ligne par prospect)
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder="contact@example.com,Jean Dupont,https://example.com,ACME SAS&#10;autre@test.fr,Marie Martin,https://test.fr,Test Corp"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="button"
            onClick={importCsv}
            className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition"
          >
            <Plus size={15} /> Importer ces prospects
          </button>
        </div>
      )}

      {/* Contacts list */}
      {contacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {contacts.length} prospect{contacts.length > 1 ? 's' : ''} ajouté{contacts.length > 1 ? 's' : ''}
          </p>
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {contacts.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">{c.email}</span>
                  {c.name && <span className="ml-2 text-gray-500 dark:text-gray-400">— {c.name}</span>}
                  {c.siteUrl && <span className="ml-2 text-xs text-gray-400">{c.siteUrl}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  className="ml-2 shrink-0 text-red-400 hover:text-red-600 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: AI Generation ─────────────────────────────────────────────────────

function Step3Ai({
  revamperProjects,
  selectedProjectId, setSelectedProjectId,
  language, setLanguage,
  tone, setTone,
  template, setTemplate,
  generating, onGenerate,
}: {
  revamperProjects: RevamperProject[];
  selectedProjectId: string | null; setSelectedProjectId: (v: string | null) => void;
  language: 'fr' | 'en'; setLanguage: (v: 'fr' | 'en') => void;
  tone: 'formal' | 'friendly' | 'bold'; setTone: (v: 'formal' | 'friendly' | 'bold') => void;
  template: EmailTemplate | null;
  setTemplate: (t: EmailTemplate | null) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  const tones = [
    { value: 'formal', label: 'Professionnel' },
    { value: 'friendly', label: 'Chaleureux' },
    { value: 'bold', label: 'Percutant' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Revamper project */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Lier un projet Revamper (optionnel)
        </label>
        <select
          value={selectedProjectId ?? ''}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">— Aucun projet lié —</option>
          {revamperProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.title} {p.source_url ? `(${p.source_url})` : ''}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Liez un projet pour que l’email contienne le lien vers la maquette publique (/revamper/public/…) et les infos d’analyse.
        </p>
      </div>

      {/* Language & Tone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Langue</label>
          <div className="flex gap-2">
            {(['fr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${language === l ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Ton de l'email</label>
          <div className="flex gap-2">
            {tones.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTone(value)}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${tone === value ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
      >
        {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
        {generating ? 'Génération en cours…' : template ? 'Regénérer avec l\'IA' : 'Générer l\'email avec l\'IA'}
      </button>

      {/* Éditeur WYSIWYG */}
      {template && (
        <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle size={16} /> Email généré — modifiable
          </div>
          <EmailHtmlEditor
            subject={template.subject ?? ''}
            bodyHtml={template.bodyHtml ?? ''}
            onChangeSubject={(subject) => setTemplate({ ...template, subject })}
            onChangeBody={(bodyHtml) =>
              setTemplate({
                ...template,
                bodyHtml,
                bodyText: bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
              })
            }
            demoUrlHint={
              selectedProjectId && typeof window !== 'undefined'
                ? `${window.location.origin}/revamper/public/${selectedProjectId}`
                : null
            }
          />
        </div>
      )}
    </div>
  );
}

// ── Step 4: Summary & confirm ─────────────────────────────────────────────────

function Step4Summary({
  campaignName, contactCount, template,
}: {
  campaignName: string; contactCount: number; template: EmailTemplate | null;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
        {[
          { label: 'Nom de la campagne', value: campaignName },
          { label: 'Nombre de prospects', value: `${contactCount} destinataire${contactCount > 1 ? 's' : ''}` },
          { label: 'Objet de l\'email', value: template?.subject ?? '(non généré)' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between px-4 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-xs">{value}</span>
          </div>
        ))}
      </div>

      {!template?.bodyHtml && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/30 dark:bg-yellow-900/10">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Aucun email n'a été généré. La campagne sera créée en brouillon — vous pourrez générer et envoyer depuis la page de détail.
          </p>
        </div>
      )}

      {template?.bodyHtml && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
          <Send size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            La campagne sera créée. Vous pourrez lancer l'envoi depuis la page de détail, ou envoyer un email test d'abord.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function EmailerNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  // Step 1
  const [campaignName, setCampaignName] = useState('');
  const [useGlobalSmtp, setUseGlobalSmtp] = useState(true);
  const [smtp, setSmtp] = useState<Partial<SmtpConfig>>({ port: 587 });
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  // Step 2
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Step 3
  const [revamperProjects, setRevamperProjects] = useState<RevamperProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [tone, setTone] = useState<'formal' | 'friendly' | 'bold'>('friendly');
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Step 4
  const [saving, setSaving] = useState(false);

  const loadRevamperProjects = async () => {
    if (projectsLoaded) return;
    try {
      const data = await apiJson<RevamperProject[]>('/api/revamper');
      setRevamperProjects(data.filter((p) => p.status === 'DONE'));
      setProjectsLoaded(true);
    } catch { /* silently fail */ }
  };

  const handleTestSmtp = async () => {
    setSmtpTestStatus('loading');
    try {
      const res = await testSmtp(useGlobalSmtp ? undefined : (smtp as SmtpConfig));
      setSmtpTestStatus(res.ok ? 'ok' : 'error');
    } catch {
      setSmtpTestStatus('error');
    }
  };

  const nextStep = async () => {
    if (step === 1 && !campaignName.trim()) { alert('Veuillez saisir un nom de campagne.'); return; }
    if (step === 2 && contacts.length === 0) { alert('Ajoutez au moins un prospect.'); return; }
    if (step === 2) await loadRevamperProjects();
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const ensureCampaign = async (): Promise<string> => {
    const payload = {
      name: campaignName,
      contacts,
      smtp_config: useGlobalSmtp ? null : (smtp as SmtpConfig),
      revamper_project_id: selectedProjectId,
      ai_context: { language, tone },
      ...(template ? { template } : {}),
    };
    if (campaignId) {
      await updateCampaign(campaignId, payload);
      return campaignId;
    }
    const campaign = await createCampaign(payload);
    setCampaignId(campaign.id);
    return campaign.id;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const cid = await ensureCampaign();
      const result = await generateCampaignEmail(cid, {
        language,
        tone,
        public_app_url: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      setTemplate(result.generated);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const cid = await ensureCampaign();
      navigate(`/emailer/${cid}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur de création');
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-8 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Nouvelle campagne</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Créez une campagne de prospection email générée par IA
          </p>
        </div>

        <StepIndicator step={step} total={TOTAL_STEPS} />

        {/* Step panels */}
        <div className="glass-panel rounded-xl p-6">
          <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            {step === 1 && <><Settings size={20} /> Compte email</>}
            {step === 2 && <><Users size={20} /> Prospects</>}
            {step === 3 && <><Sparkles size={20} /> Contenu IA</>}
            {step === 4 && <><Send size={20} /> Récapitulatif</>}
          </h2>

          {step === 1 && (
            <Step1Smtp
              campaignName={campaignName} setCampaignName={setCampaignName}
              useGlobalSmtp={useGlobalSmtp} setUseGlobalSmtp={setUseGlobalSmtp}
              smtp={smtp} setSmtp={setSmtp}
              onTest={handleTestSmtp} testStatus={smtpTestStatus}
            />
          )}
          {step === 2 && (
            <Step2Contacts contacts={contacts} setContacts={setContacts} />
          )}
          {step === 3 && (
            <Step3Ai
              revamperProjects={revamperProjects}
              selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId}
              language={language} setLanguage={setLanguage}
              tone={tone} setTone={setTone}
              template={template}
              setTemplate={setTemplate}
              generating={generating}
              onGenerate={handleGenerate}
            />
          )}
          {step === 4 && (
            <Step4Summary
              campaignName={campaignName}
              contactCount={contacts.length}
              template={template}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition"
          >
            <ChevronLeft size={18} /> Précédent
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Suivant <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Créer la campagne
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
