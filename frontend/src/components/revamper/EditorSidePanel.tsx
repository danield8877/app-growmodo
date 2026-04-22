import { useState, useEffect, useRef } from 'react';
import { absolutizeUploadsUrl } from '../../services/revamper/assetUrls';
import { uploadRevamperEditorAsset } from '../../services/revamper';
import { Loader2 } from 'lucide-react';

export type RvpSelection = {
  id: string;
  tag: string;
  text: string;
  src: string;
  styles: { color: string; backgroundColor: string };
};

type TabId = 'text' | 'image' | 'colors' | 'layout';

type Props = {
  projectId: string;
  selected: RvpSelection | null;
  onPatch: (patch: Record<string, string | undefined>) => void;
};

function isTextTag(tag: string) {
  return /^(h[1-6]|p|span|a|button|section|div)$/.test(tag);
}

function rgbToHex(s: string): string {
  const t = s.trim();
  if (t.startsWith('#') && t.length >= 4) return t.slice(0, 7);
  const m = t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const r = Math.min(255, parseInt(m[1]!, 10));
    const g = Math.min(255, parseInt(m[2]!, 10));
    const b = Math.min(255, parseInt(m[3]!, 10));
    return (
      '#' +
      [r, g, b]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return '#1f2937';
}

function parseDisplayColor(s: string): string {
  return rgbToHex(s);
}

export default function EditorSidePanel({ projectId, selected, onPatch }: Props) {
  const [tab, setTab] = useState<TabId>('text');
  const [textDraft, setTextDraft] = useState('');
  const [imgDraft, setImgDraft] = useState('');
  const [textColor, setTextColor] = useState('#1f2937');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const tag = (selected?.tag || '').toLowerCase();
  const isImg = tag === 'img';

  useEffect(() => {
    if (selected) {
      setTextDraft(isImg ? '' : selected.text || '');
      setImgDraft(selected.src || '');
      setTextColor(parseDisplayColor(selected.styles?.color || 'rgb(31,41,55)'));
      setBgColor(parseDisplayColor(selected.styles?.backgroundColor || 'rgb(255,255,255)'));
      if (isImg) setTab('image');
      else if (isTextTag(tag)) setTab('text');
      else setTab('colors');
    } else {
      setTextDraft('');
      setImgDraft('');
    }
  }, [selected, isImg, tag]);

  const applyText = () => {
    onPatch({ text: textDraft });
  };

  const applyImg = () => {
    const u = imgDraft.trim();
    onPatch({ src: u });
  };

  const applyColors = () => {
    onPatch({ color: textColor, backgroundColor: bgColor });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const u = await uploadRevamperEditorAsset(projectId, f);
      const full = absolutizeUploadsUrl(u) ?? u;
      setImgDraft(full);
      onPatch({ src: u.startsWith('/uploads/') ? u : full });
    } catch (err) {
      console.error(err);
      window.alert((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!selected) {
    return (
      <div className="h-full p-4 text-sm text-gray-500 dark:text-gray-400">
        <p>Cliquez un bloc dans la page pour l’éditer (titres, paragraphes, images, sections…).</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'text', label: 'Texte', show: !isImg && isTextTag(tag) },
    { id: 'image', label: 'Image', show: isImg },
    { id: 'colors', label: 'Couleurs', show: true },
    { id: 'layout', label: 'Mise en page', show: !isImg },
  ];

  const showTabs = tabs.filter((x) => x.show);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-2 dark:border-white/10">
        {showTabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={
              'rounded-md px-3 py-1.5 text-sm ' +
              (tab === x.id
                ? 'bg-primary/20 text-primary'
                : 'text-gray-600 hover:bg-neutral-200 dark:text-gray-300 dark:hover:bg-white/5')
            }
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'text' && !isImg && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500">Contenu</label>
            <textarea
              className="h-40 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm text-gray-900 dark:border-white/20 dark:bg-black/30 dark:text-gray-100"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
            />
            <button
              type="button"
              onClick={applyText}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-white"
            >
              Appliquer le texte
            </button>
          </div>
        )}

        {tab === 'image' && isImg && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500">URL de l’image</label>
            <input
              className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm dark:border-white/20 dark:bg-black/30"
              value={imgDraft}
              onChange={(e) => setImgDraft(e.target.value)}
            />
            <button
              type="button"
              onClick={applyImg}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-white"
            >
              Appliquer l’URL
            </button>
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm dark:border-white/20"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : null}
                Téléverser une image
              </button>
            </div>
          </div>
        )}

        {tab === 'colors' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Couleur du texte</label>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Fond (inline)</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded"
              />
            </div>
            <button type="button" onClick={applyColors} className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-white">
              Appliquer les couleurs
            </button>
          </div>
        )}

        {tab === 'layout' && !isImg && (
          <div className="flex flex-wrap gap-2">
            <LayoutChip
              label="Moins de padding"
              onClick={() =>
                onPatch({
                  removeClass: 'p-3 p-4 p-5 p-6 p-8 p-10 p-12 py-4 py-6 py-8 px-4',
                  addClass: 'p-2',
                })
              }
            />
            <LayoutChip
              label="Plus de padding"
              onClick={() =>
                onPatch({
                  removeClass: 'p-2 p-3',
                  addClass: 'p-6',
                })
              }
            />
            <LayoutChip label="Centrer" onClick={() => onPatch({ addClass: 'mx-auto text-center' })} />
            <LayoutChip label="Texte plus grand" onClick={() => onPatch({ addClass: 'text-2xl' })} />
            <LayoutChip label="Texte plus petit" onClick={() => onPatch({ addClass: 'text-sm' })} />
            <LayoutChip label="Align. gauche" onClick={() => onPatch({ addClass: 'text-left' })} />
          </div>
        )}
      </div>
    </div>
  );
}

function LayoutChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-gray-800 dark:border-white/20 dark:bg-black/20 dark:text-gray-200"
    >
      {label}
    </button>
  );
}
