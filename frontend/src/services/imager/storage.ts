const BUCKET_PREFIX = '/uploads/imager/';

export const storageService = {
  /** Les fichiers sont sur le disque API sous `uploads/imager/` ; l’URL en base est un chemin `/uploads/...`. */
  async downloadAndUploadAsset(
    sourceUrl: string,
    _projectId: string,
    _assetType: string,
    _format: 'png' | 'mp4' | 'jpg' = 'png'
  ): Promise<string> {
    return sourceUrl;
  },

  /** Suppression disque non exposée par l’API publique pour l’instant. */
  async deleteAsset(url: string): Promise<void> {
    void url;
  },

  extractPathFromUrl(url: string): string | null {
    try {
      const index = url.indexOf(BUCKET_PREFIX);
      if (index === -1) return null;
      return url.substring(index + BUCKET_PREFIX.length);
    } catch {
      return null;
    }
  },
};
