import type { AiRequest, Content } from '../client';
import { BOARD_SCHEMA, CLUSTER_SCHEMA, type BoardLayout, type BoardPlan, type ClusterPlan } from './plan';

export type BoardSource =
  | { kind: 'pdf'; name: string; data: string; size: number }
  | { kind: 'page'; title: string; markdown: string }
  | { kind: 'text'; text: string };

const SYSTEM_BOARD = `Du gestaltest Inhalte für ein digitales Whiteboard in der Notiz-App flou (Stil wie Miro): Post-its in einer Matrix, in Gruppen oder als Ablauf.
Regeln:
- Ein Post-it = ein Gedanke, höchstens etwa 60 Zeichen, Stichwortstil, ohne Einleitung.
- Wähle das Layout: "matrix", wenn mehrere gleichartige Dinge nach denselben Kriterien verglichen werden (Zeilen = Dinge, Spalten = Kriterien); "clusters", wenn Themen gesammelt und gruppiert werden; "flow", wenn es um Schritte oder einen Ablauf geht.
- Matrix: 2 bis 6 Spalten, höchstens 8 Zeilen, je Zelle 1 bis 4 Post-its. rows[].cells hat genau so viele Einträge wie columns, in derselben Reihenfolge. sublabel = kurze Unterzeile oder leer. badge = kurze Kennzahl oder Bewertung (z. B. "8,5/10") oder leer. highlight = true höchstens für eine besonders empfohlene Zeile.
- Clusters: 3 bis 8 Gruppen mit je 2 bis 8 Post-its und kurzen, treffenden Überschriften.
- Flow: 3 bis 10 Schritte.
- takeaways: 0 bis 4 wichtigste Erkenntnisse.
- Felder, die das gewählte Layout nicht nutzt, bleiben leer ([] bzw. "").
- Farben: je Spalte bzw. Gruppe eine, benachbarte unterschiedlich.
- Nimm Fakten nur aus der Quelle, erfinde nichts. Schreib in der Sprache der Quelle.`;

const LAYOUT_HINT: Record<BoardLayout, string> = {
  matrix: 'Verwende das Layout "matrix".',
  clusters: 'Verwende das Layout "clusters".',
  flow: 'Verwende das Layout "flow".',
};

export function boardRequest(source: BoardSource, layout: BoardLayout | 'auto', focus: string): AiRequest {
  const task = [
    'Erstelle aus der Quelle ein übersichtliches Board.',
    layout === 'auto' ? '' : LAYOUT_HINT[layout],
    focus.trim() ? `Worauf du besonders achten sollst: ${focus.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  let content: Content;
  if (source.kind === 'pdf') {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: source.data }, title: source.name },
      { type: 'text', text: task },
    ];
  } else {
    const body = source.kind === 'page' ? `<quelle titel="${source.title.replace(/"/g, "'")}">\n${source.markdown}\n</quelle>` : `<quelle>\n${source.text}\n</quelle>`;
    content = `${body}\n\n${task}`;
  }
  return {
    feature: 'board',
    title: source.kind === 'pdf' ? `Board aus „${source.name}“` : source.kind === 'page' ? `Board aus „${source.title}“` : 'Board aus Text',
    system: SYSTEM_BOARD,
    messages: [{ role: 'user', content }],
    maxTokens: 32_000,
    effort: 'medium',
    output: [2_500, 9_000],
    schema: BOARD_SCHEMA,
    mock: () => JSON.stringify(MOCK_PLAN),
  };
}

export function clusterRequest(notes: string[], focus: string): AiRequest {
  const list = notes.map((n, i) => `[${i}] ${n.replace(/\s+/g, ' ')}`).join('\n');
  return {
    feature: 'cluster',
    title: `${notes.length} Post-its clustern`,
    system:
      'Du hilfst beim Affinity Mapping auf einem digitalen Whiteboard. Gruppiere Post-its nach Themen in 2 bis 8 Gruppen mit kurzen, treffenden Überschriften (höchstens 4 Wörter). Jede Nummer kommt genau einmal vor. Benachbarte Gruppen bekommen unterschiedliche Farben. Schreib in der Sprache der Post-its.',
    messages: [{ role: 'user', content: `<postits>\n${list}\n</postits>${focus.trim() ? `\n\nGruppiere nach: ${focus.trim()}` : ''}` }],
    maxTokens: 8_000,
    effort: 'low',
    output: [300 + notes.length * 8, 1_500 + notes.length * 20],
    schema: CLUSTER_SCHEMA,
    mock: () =>
      JSON.stringify({
        groups: [
          { label: 'Gruppe A', color: 'yellow', notes: notes.map((_, i) => i).filter((i) => i % 2 === 0) },
          { label: 'Gruppe B', color: 'blue', notes: notes.map((_, i) => i).filter((i) => i % 2 === 1) },
        ],
      } satisfies ClusterPlan),
  };
}

/** Jede Notiz genau einmal; fehlende landen in „Sonstiges“. */
export function repairClusters(plan: ClusterPlan, count: number): ClusterPlan {
  const seen = new Set<number>();
  const groups = plan.groups
    .map((g) => ({ ...g, notes: g.notes.filter((n) => Number.isInteger(n) && n >= 0 && n < count && !seen.has(n) && seen.add(n)) }))
    .filter((g) => g.notes.length);
  const missing = Array.from({ length: count }, (_, i) => i).filter((i) => !seen.has(i));
  if (missing.length) groups.push({ label: 'Sonstiges', color: 'gray', notes: missing });
  return { groups };
}

const MOCK_PLAN: BoardPlan = {
  title: 'Simuliertes Board',
  subtitle: 'Testmodus: so sieht ein KI-Board aus',
  layout: 'matrix',
  columns: [
    { label: 'Problem', color: 'yellow' },
    { label: 'Pain Points', color: 'pink' },
    { label: 'Hebel', color: 'green' },
  ],
  rows: [
    {
      label: 'Option A',
      sublabel: 'Erste Variante',
      badge: '8/10',
      highlight: true,
      cells: [['Pendeln ist stressig', 'Zu viele Screens'], ['16 Ankunft unklar'], ['Ehrliche Ankunftszeit', 'Abschalt-Ritual']],
    },
    { label: 'Option B', sublabel: 'Zweite Variante', badge: '6/10', highlight: false, cells: [['Museen wirken steif'], ['20 Allein langweilig'], ['Für Gruppen gestalten']] },
  ],
  groups: [],
  steps: [],
  takeaways: ['Option A passt am besten', 'Testen braucht einen Simulator'],
};
