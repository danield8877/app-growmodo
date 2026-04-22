export * from './types';
export { analyzeHtml } from './analyze';
export {
  generatePage,
  generateRevamp,
  generateRevampWithProgress,
  generateAdvancedRevampHtml,
} from './generate';
export type { RevamperStreamProgress } from './generate';
export {
  enqueueRevampJob,
  optimizeRevampPrompt,
  saveRevamp,
  getRevamps,
  getRevamp,
  deleteRevamp,
  fetchRevamperJobsDashboard,
  cancelQueuedRevampJob,
  updateRevampTitle,
  updateRevampCode,
  uploadRevamperEditorAsset,
  parsePastedCode,
  saveRevampFromCode,
  createRevampPendingForImage,
  getRevampPublic,
} from './storage';
export {
  REVAMP_BASE_INSTRUCTIONS_STORAGE_KEY,
  REVAMP_SUPPLEMENTARY_INSTRUCTIONS_SESSION_KEY,
  loadRevampBaseInstructions,
  saveRevampBaseInstructions,
  loadRevampSupplementaryInstructions,
  saveRevampSupplementaryInstructions,
  /** @deprecated préférer loadRevampBaseInstructions */
  loadRevampAdditionalInstructions,
  /** @deprecated préférer saveRevampBaseInstructions */
  saveRevampAdditionalInstructions,
} from './revampSettingsStorage';
export type {
  RevamperProject,
  RevamperJobStatus,
  RevamperJobMeta,
  RevamperQueueSnapshot,
  RevamperDashboardRow,
  RevamperSourceLang,
} from './storage';
export type { RevamperSectionId } from './generate';
export { REVAMPER_SECTION_IDS } from './generate';
