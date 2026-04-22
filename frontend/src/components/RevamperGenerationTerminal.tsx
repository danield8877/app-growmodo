import { useEffect, useMemo, useRef } from 'react';
import { Activity } from 'lucide-react';
import type { RevamperStreamProgress } from '../services/revamper/generate';

type Props = {
  lines: RevamperStreamProgress[];
  liveElapsedMs: number;
  active: boolean;
};

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export default function RevamperGenerationTerminal({ lines, liveElapsedMs, active }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length, liveElapsedMs]);

  const displayElapsed = useMemo(() => {
    if (lines.length === 0) return liveElapsedMs;
    const last = lines[lines.length - 1];
    return Math.max(liveElapsedMs, last.elapsedMs);
  }, [lines, liveElapsedMs]);

  if (!active && lines.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-emerald-500/35 bg-[#0a1628]/95 overflow-hidden shadow-[0_0_24px_rgba(16,185,129,0.12)] font-mono text-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-500/25 bg-emerald-950/40">
        <Activity className={`text-emerald-400 ${active ? 'animate-pulse' : ''}`} size={16} />
        <span className="text-emerald-300/90 font-semibold tracking-wide">revamperd — stream alive</span>
        <span className="ml-auto text-emerald-500/80 tabular-nums">{formatTime(displayElapsed)}</span>
      </div>
      <div className="max-h-64 overflow-y-auto px-3 py-2 space-y-1.5 text-[13px] leading-relaxed">
        {lines.length === 0 && active && (
          <div className="text-slate-500">
            <span className="text-cyan-400/90">{'>'}</span> connexion au pipeline…
          </div>
        )}
        {lines.map((l, i) => (
          <div key={`${l.step}-${l.elapsedMs}-${i}`} className="border-l-2 border-emerald-500/40 pl-2 -ml-0.5">
            <div className="text-slate-500 tabular-nums">
              +{(l.elapsedMs / 1000).toFixed(1)}s{' '}
              <span className="text-cyan-400/90">[{l.step}]</span>{' '}
              <span className="text-slate-200">{l.label}</span>
            </div>
            {l.detail && <div className="text-slate-400 pl-0 break-all">{l.detail}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
