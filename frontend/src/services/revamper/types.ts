/** Résultat d'analyse d'un site (URL ou HTML) */
export interface RevamperAnalysis {
  lang: string;
  title: string;
  subject?: string;
  colors: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  logoUrl?: string | null;
  menuItems: { label: string; href: string }[];
  /** Extrait de texte pour le contenu (titres, paragraphes) */
  contentSnippets: string[];
  /** URL de l'image générée (mode Rapide / Grok uniquement) */
  generatedImageUrl?: string | null;
}

/** Page générée (refonte) */
export interface RevamperResult {
  analysis: RevamperAnalysis;
  html: string;
  css: string;
  js: string;
  /** Balises <link rel="stylesheet"> extraites du HTML source (pour la preview) */
  linkTags?: string;
  /** Mode Rapide (Grok) : URL de l'image unique générée (affichage image seule) */
  imageUrl?: string | null;
}
