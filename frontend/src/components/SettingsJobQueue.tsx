import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, XCircle, Trash2, ExternalLink } from 'lucide-react';
import {
  fetchRevamperJobsDashboard,
  cancelQueuedRevampJob,
  deleteRevamp,
  type RevamperDashboardRow,
  type RevamperQueueSnapshot,
} from '../services/revamper';

export default function SettingsJobQueue() {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<RevamperQueueSnapshot | null>(null);
  const [projects, setProjects] = useState<RevamperDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchRevamperJobsDashboard();
      setQueue(data.queue);
      setProjects(data.projects);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!projects.some((p) => p.status === 'QUEUED' || p.status === 'RUNNING')) return;
    const tmr = setInterval(() => void load(), 4000);
    return () => clearInterval(tmr);
  }, [projects, load]);

  const statusLabel = (status: RevamperDashboardRow['status']) => {
    if (status === 'QUEUED') return t('dashboard.revamper.statusQueued');
    if (status === 'RUNNING') return t('dashboard.revamper.statusRunning');
    if (status === 'FAILED') return t('dashboard.revamper.statusFailed');
    if (status === 'CANCELLED') return t('dashboard.revamper.statusCancelled');
    if (status === 'DRAFT') return t('dashboard.revamper.statusDraft');
    return t('dashboard.revamper.statusDone');
  };

  const jobDetail = (p: RevamperDashboardRow) => {
    const meta = p.analysis?.__job;
    if (!meta?.label && !meta?.detail) return '—';
    return [meta.label, meta.detail].filter(Boolean).join(' · ');
  };

  const handleCancel = async (id: string) => {
    setActionId(id);
    try {
      const res = await cancelQueuedRevampJob(id);
      setQueue(res.queue);
      await load();
    } catch (e) {
      console.error(e);
      alert(t('dashboard.settings.jobsErrorCancel'));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('dashboard.revamper.deleteConfirm'))) return;
    setActionId(id);
    try {
      await deleteRevamp(id);
      setProjects((prev) => prev.filter((x) => x.id !== id));
      await load();
    } catch (e) {
      console.error(e);
      alert(t('dashboard.settings.jobsErrorDelete'));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTitle')}</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">{t('dashboard.settings.jobsSubtitle')}</p>

      {queue && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.settings.workersTitle')}</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
              {queue.activeWorkers} / {queue.maxConcurrency}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.settings.workersActive')}</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{queue.activeWorkers}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.settings.workersMax')}</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{queue.maxConcurrency}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.settings.workersPerUser')}</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white">{queue.maxPerUser}</div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-800 dark:text-gray-200">{t('dashboard.settings.queuePendingLabel')}:</span>{' '}
          {queue?.pendingOrder.length ? queue.pendingOrder.join(' → ') : '—'}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-800 dark:text-gray-200">{t('dashboard.settings.queueRunningLabel')}:</span>{' '}
          {queue?.runningIds.length ? queue.runningIds.join(', ') : '—'}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t('dashboard.settings.jobsRefresh')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTableProject')}</th>
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTableUrl')}</th>
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTableStatus')}</th>
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTablePosition')}</th>
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTableJob')}</th>
              <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('dashboard.settings.jobsTableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin opacity-60" />
                  {t('dashboard.settings.jobsLoading')}
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {t('dashboard.settings.jobsEmpty')}
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.title}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-600 dark:text-gray-400" title={p.source_url ?? ''}>
                    {p.source_url ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-gray-800">{statusLabel(p.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.status === 'QUEUED' && p.queue_position != null
                      ? t('dashboard.settings.jobsPosition', { n: p.queue_position })
                      : p.is_running || p.status === 'RUNNING'
                        ? '—'
                        : '—'}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-gray-600 dark:text-gray-400" title={jobDetail(p)}>
                    {jobDetail(p)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/revamper/result/${p.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t('dashboard.settings.jobsOpen')}
                      </Link>
                      {p.status === 'QUEUED' && (
                        <button
                          type="button"
                          disabled={actionId === p.id}
                          onClick={() => void handleCancel(p.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t('dashboard.settings.jobsCancelQueue')}
                        </button>
                      )}
                      {p.status === 'RUNNING' && (
                        <span className="text-xs text-gray-500">{t('dashboard.settings.jobsRunningHint')}</span>
                      )}
                      <button
                        type="button"
                        disabled={actionId === p.id}
                        onClick={() => void handleDelete(p.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-500/20 dark:text-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('dashboard.settings.jobsDelete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
