import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Plus, Trash2, Send, Clock, CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { listCampaigns, deleteCampaign, type EmailerCampaign, type CampaignStatus } from '../../services/emailer';

function StatusBadge({ status }: { status: CampaignStatus }) {
  const configs: Record<CampaignStatus, { icon: React.ReactNode; label: string; className: string }> = {
    DRAFT:     { icon: <Clock size={12} />,        label: 'Brouillon',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    QUEUED:    { icon: <Clock size={12} />,        label: 'En attente', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    RUNNING:   { icon: <Loader2 size={12} className="animate-spin" />, label: 'En cours', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    DONE:      { icon: <CheckCircle size={12} />,  label: 'Envoyée',    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    FAILED:    { icon: <XCircle size={12} />,      label: 'Échouée',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    CANCELLED: { icon: <XCircle size={12} />,      label: 'Annulée',    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
  };
  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}

export default function EmailerDashboard() {
  const [campaigns, setCampaigns] = useState<EmailerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listCampaigns();
      setCampaigns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer la campagne "${name}" ?`)) return;
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur de suppression');
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Emailerr</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Prospectez par email avec des campagnes générées par IA
            </p>
          </div>
          <Link
            to="/emailer/new"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold transition silver-gradient-cta"
          >
            <Plus size={20} />
            Nouvelle campagne
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="glass-panel rounded-xl p-6 text-center text-red-500">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="glass-panel rounded-xl py-16 text-center">
            <Mail size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Aucune campagne
            </h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Créez votre première campagne de prospection
            </p>
            <Link
              to="/emailer/new"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold silver-gradient-cta"
            >
              <Plus size={20} />
              Créer une campagne
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const stats = campaign.stats;
              const contactCount = Array.isArray(campaign.contacts) ? campaign.contacts.length : 0;
              return (
                <div key={campaign.id} className="glass-panel group rounded-xl p-6 transition-all hover:shadow-xl">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                      {campaign.name}
                    </h3>
                    <StatusBadge status={campaign.status} />
                  </div>

                  {/* Stats */}
                  <div className="mb-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={14} /> {contactCount} prospect{contactCount !== 1 ? 's' : ''}
                    </span>
                    {stats && (
                      <span className="flex items-center gap-1">
                        <Send size={14} /> {stats.sent}/{stats.total}
                      </span>
                    )}
                  </div>

                  {/* Progress bar when campaign has stats */}
                  {stats && stats.total > 0 && (
                    <div className="mb-4">
                      <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round((stats.sent / stats.total) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {Math.round((stats.sent / stats.total) * 100)}% envoyés
                        {stats.failed > 0 && ` · ${stats.failed} échec${stats.failed > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  )}

                  <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
                    {campaign.sent_at
                      ? `Envoyée le ${new Date(campaign.sent_at).toLocaleDateString('fr-FR')}`
                      : `Créée le ${new Date(campaign.created_at).toLocaleDateString('fr-FR')}`}
                  </p>

                  <div className="flex gap-2">
                    <Link
                      to={`/emailer/${campaign.id}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary transition-all hover:bg-primary/20"
                    >
                      <Mail size={15} />
                      Ouvrir
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(campaign.id, campaign.name)}
                      className="rounded-lg bg-red-500/10 px-4 py-2 text-red-600 transition-all hover:bg-red-500/20 dark:text-red-400"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
