/** Consignes principales — persistantes (localStorage). */
export const REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY = 'revamperr_revamp_base_instructions';

/** @deprecated Ancienne clé unique — migrée vers REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY au chargement. */
const REVAMP_LEGACY_ADDITIONAL_INSTRUCTIONS_KEY = 'revamperr_revamp_additional_instructions';

/** Consignes complémentaires — par onglet (sessionStorage), pas mélangées aux bases. */
export const REVAMP_SUPPLEMENTARY_INSTRUCTIONS_SESSION_KEY = 'revamperr_revamp_supplementary_session';

function migrateLegacyBaseIfNeeded(): void {
  try {
    const current = localStorage.getItem(REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY);
    if (current != null && current !== '') return;
    const legacy = localStorage.getItem(REVAMP_LEGACY_ADDITIONAL_INSTRUCTIONS_KEY);
    if (legacy != null && legacy.trim()) {
      localStorage.setItem(REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY, legacy);
    }
  } catch {
    /* ignore */
  }
}

export function loadRevampBaseInstructions(): string {
  try {
    migrateLegacyBaseIfNeeded();
    return localStorage.getItem(REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveRevampBaseInstructions(value: string): void {
  try {
    localStorage.setItem(REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function loadRevampSupplementaryInstructions(): string {
  try {
    return sessionStorage.getItem(REVAMP_SUPPLEMENTARY_INSTRUCTIONS_SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveRevampSupplementaryInstructions(value: string): void {
  try {
    sessionStorage.setItem(REVAMP_SUPPLEMENTARY_INSTRUCTIONS_SESSION_KEY, value);
  } catch {
    /* ignore */
  }
}

/** @deprecated Utiliser loadRevampBaseInstructions — alias pour rétrocompat. */
export function loadRevampAdditionalInstructions(): string {
  return loadRevampBaseInstructions();
}

/** @deprecated Utiliser saveRevampBaseInstructions */
export function saveRevampAdditionalInstructions(value: string): void {
  saveRevampBaseInstructions(value);
}
