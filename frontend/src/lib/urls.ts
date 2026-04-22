/**
 * Génère un slug à partir d'un texte (pour URLs lisibles).
 * Ex: "Mon Super Projet" → "mon-super-projet"
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Retourne le chemin d'un projet avec identifiant court (8 car.) et slug optionnel.
 * - projectPath(id) → "/projects/a5c38df3"
 * - projectPath(id, "Mon Projet") → "/projects/a5c38df3/mon-projet"
 * shortId peut être fourni (ex. project.short_id) ou déduit des 8 premiers caractères de projectId.
 */
export function projectPath(
  projectId: string,
  projectName?: string | null,
  shortId?: string | null
): string {
  const sid = shortId ?? (projectId.length >= 8 ? projectId.slice(0, 8) : projectId);
  const base = `/projects/${sid}`;
  if (!projectName || !slugify(projectName)) return base;
  return `${base}/${slugify(projectName)}`;
}
