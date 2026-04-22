import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import EditorSidePanel, { type RvpSelection } from '../../components/revamper/EditorSidePanel';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { getRevamp, updateRevampCode, parsePastedCode, type RevamperProject } from '../../services/revamper';
import { buildRevamperPreviewDocument } from '../../services/revamper/buildPreviewDocument';
import { EDITOR_BRIDGE_SCRIPT } from '../../revamper/editorBridge';


export default function RevamperEditor() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<RevamperProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RvpSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const p = await getRevamp(id);
      if (!p) {
        setError('Projet introuvable');
        setProject(null);
        return;
      }
      setProject(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const srcDoc = useMemo(() => {
    if (!project) return '';
    const linkTags = (project as { linkTags?: string }).linkTags;
    return buildRevamperPreviewDocument({
      html: project.html || '',
      css: project.css || '',
      js: project.js || '',
      analysis: project.analysis,
      linkTags,
      editorBridgeScript: EDITOR_BRIDGE_SCRIPT,
    });
  }, [project]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as MsgSelect | MsgSerialize;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'rvp:select') {
        setSelected({
          id: d.id,
          tag: d.tag,
          text: d.text,
          src: d.src,
          styles: d.styles,
        });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const postToFrame = (msg: { type: string; id?: string; patch?: Record<string, string> }) => {
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.postMessage(msg, '*');
    }
  };

  const onPatch = (patch: Record<string, string | undefined>) => {
    if (!selected) return;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) clean[k] = v;
    }
    postToFrame({ type: 'rvp:update', id: selected.id, patch: clean });
  };

  const handleSave = async () => {
    if (!id || !project) return;
    setSaving(true);
    try {
      const rid = `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const html = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => {
          window.removeEventListener('message', onOne);
          reject(new Error('Délai de sérialisation dépassé'));
        }, 15_000);
        const onOne = (e: MessageEvent) => {
          const d = e.data as { type?: string; html?: string; rid?: string };
          if (d?.type === 'rvp:serialize:result' && d.rid === rid && typeof d.html === 'string') {
            clearTimeout(t);
            window.removeEventListener('message', onOne);
            resolve(d.html);
          }
        };
        window.addEventListener('message', onOne);
        iframeRef.current?.contentWindow?.postMessage({ type: 'rvp:serialize', rid }, '*');
      });
      const parts = parsePastedCode(html);
      const scr = (parts.js || '')
        .split(/\n\n/)
        .filter(
          (chunk) => chunk && !chunk.includes('__rvpBridgeInstalled') && !chunk.includes('__rvpBridge')
        );
      const js = scr.join('\n\n').trim() || '// no script';
      await updateRevampCode(id, { html: parts.html, css: parts.css, js });
      const fresh = await getRevamp(id);
      if (fresh) setProject(fresh);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-md py-16 text-center text-gray-600">
          {error || 'Projet introuvable'}
          <div className="mt-4">
            <Link to="/revamper" className="text-primary">
              Retour
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center justify-between">
        <Link
          to={`/revamper/result/${encodeURIComponent(id!)}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft size={20} />
          Retour au résultat
        </Link>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Enregistrer
        </button>
      </div>
      <div className="flex h-[min(80vh,900px)] min-h-[480px] flex-col gap-3 lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 dark:border-white/10">
          <iframe
            ref={iframeRef}
            title="Éditeur"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full min-h-[400px] border-0"
            style={{ backgroundColor: '#0f172a' }}
          />
        </div>
        <div className="w-full shrink-0 overflow-hidden rounded-xl border border-neutral-200 dark:border-white/10 lg:w-[360px]">
          <div className="border-b border-neutral-200 px-3 py-2 text-sm font-medium dark:border-white/10">Panneau</div>
          <EditorSidePanel projectId={id!} selected={selected} onPatch={onPatch} />
        </div>
      </div>
    </DashboardLayout>
  );
}
