import { waitForBoard, type BoardNote } from '../../board/active';
import { layoutClusters } from '../board/layout';
import type { ClusterPlan } from '../board/plan';
import { clusterRequest, repairClusters } from '../board/request';
import { askAi, type AiResult } from '../client';

/** Freie Fläche rechts neben dem vorhandenen Inhalt */
export function freeOrigin(bounds: { maxX: number; minY: number } | null) {
  return bounds ? { x: Math.round(bounds.maxX + 200), y: Math.round(bounds.minY) } : { x: 0, y: 0 };
}

/** Ausgewählte Post-its nach Themen gruppieren und neu anordnen. */
export async function clusterNotes(
  pageId: string,
  notes: BoardNote[],
  focus: string,
  signal: AbortSignal,
  onStart: () => void,
): Promise<{ result: AiResult; groups: number } | null> {
  const result = await askAi(clusterRequest(notes.map((n) => n.text), focus), { signal, onStart });
  if (!result) return null;
  let plan: ClusterPlan;
  try {
    plan = repairClusters(JSON.parse(result.text) as ClusterPlan, notes.length);
  } catch {
    throw new Error('Die Antwort war unvollständig. Versuch es noch einmal.');
  }
  const bridge = await waitForBoard(pageId);
  const size = Math.max(...notes.map((n) => Math.max(n.width, n.height)));
  const { headers, positions } = layoutClusters(plan.groups, freeOrigin(bridge.bounds()), size);
  const moves = notes.flatMap((n, i) => {
    const p = positions.get(i);
    return p ? [{ id: n.id, ...p }] : [];
  });
  await bridge.arrange(moves, headers);
  return { result, groups: plan.groups.length };
}
