/**
 * Modelle und Listenpreise der Claude-API (US-Dollar pro 1 Mio. Tokens, Stand Oktober 2026).
 * Maßgeblich ist die Abrechnung in der Anthropic-Konsole; hier wird nur nachgerechnet.
 */

export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';

export interface ModelInfo {
  id: ModelId;
  name: string;
  short: string;
  hint: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Ab dieser Eingabegröße gelten höhere Preise (nur Haiku). */
  longContext?: { above: number; input: number; output: number };
  /** Lehnt das Modell eine Anfrage ab, übernimmt serverseitig ein anderes (nicht bei Haiku). */
  fallback: boolean;
}

export const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    short: 'Opus',
    hint: 'Beste Qualität, für Boards und Recherche',
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 5,
    fallback: true,
  },
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    short: 'Sonnet',
    hint: 'Schnell und gut, halber Preis',
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
    fallback: true,
  },
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    short: 'Haiku',
    hint: 'Sehr günstig, für kurze Texte',
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    longContext: { above: 100_000, input: 0.5, output: 2.5 },
    fallback: false,
  },
];

export const DEFAULT_MODEL: ModelId = 'claude-opus-5-5';
/** Websuche: 10 $ pro 1000 Suchen */
export const WEB_SEARCH_USD = 0.01;

export function modelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function isModelId(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}
