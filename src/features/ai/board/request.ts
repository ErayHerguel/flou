import type { AiRequest } from '../client';
import { CLUSTER_SCHEMA, type ClusterPlan } from './plan';

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
