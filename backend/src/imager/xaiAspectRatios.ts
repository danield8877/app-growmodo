/** Ratios supportés par POST /v1/images/edits (doc xAI). */
export type XaiImageAspectRatio =
  | '1:1'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | '2:3'
  | '3:2'
  | '9:19.5'
  | '19.5:9'
  | '9:20'
  | '20:9'
  | '1:2'
  | '2:1'
  | 'auto';

const XAI_LANDSCAPE_RATIOS: { ar: XaiImageAspectRatio; val: number }[] = [
  { ar: '16:9', val: 16 / 9 },
  { ar: '3:2', val: 3 / 2 },
  { ar: '2:1', val: 2 },
  { ar: '19.5:9', val: 19.5 / 9 },
  { ar: '20:9', val: 20 / 9 },
];

const XAI_PORTRAIT_RATIOS: { ar: XaiImageAspectRatio; val: number }[] = [
  { ar: '9:16', val: 9 / 16 },
  { ar: '2:3', val: 2 / 3 },
  { ar: '3:4', val: 3 / 4 },
  { ar: '9:20', val: 9 / 20 },
  { ar: '9:19.5', val: 9 / 19.5 },
];

/**
 * Ratio API le plus proche des dimensions cibles.
 * Très panoramique (ex. bannière) : `20:9` puis Sharp `cover` vers le px exact.
 */
export function xaiAspectRatioFromDimensions(width: number, height: number): XaiImageAspectRatio {
  const r = width / height;
  if (Math.abs(r - 1) < 0.06) return '1:1';
  if (r > 1) {
    if (r >= 2.25) return '20:9';
    let best = XAI_LANDSCAPE_RATIOS[0];
    let bestDiff = Math.abs(r - best.val);
    for (const c of XAI_LANDSCAPE_RATIOS) {
      const d = Math.abs(r - c.val);
      if (d < bestDiff) {
        best = c;
        bestDiff = d;
      }
    }
    return best.ar;
  }
  let best = XAI_PORTRAIT_RATIOS[0];
  let bestDiff = Math.abs(r - best.val);
  for (const c of XAI_PORTRAIT_RATIOS) {
    const d = Math.abs(r - c.val);
    if (d < bestDiff) {
      best = c;
      bestDiff = d;
    }
  }
  return best.ar;
}
