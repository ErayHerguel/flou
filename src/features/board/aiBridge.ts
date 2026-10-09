import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { BoardBridge, BoardNote } from './active';

type Element = ExcalidrawElement & { containerId?: string | null; originalText?: string; text?: string };

/** Verbindet die KI mit einer Excalidraw-Zeichenfläche (siehe active.ts). */
export function createBridge(pageId: string, api: ExcalidrawImperativeAPI): BoardBridge {
  const live = () => api.getSceneElements() as readonly Element[];

  /**
   * Excalidraw misst Text beim Erzeugen. Ist Nunito noch nicht geladen (leeres Board), wird mit einer
   * schmaleren Ersatzschrift gemessen und der Text später abgeschnitten. Deshalb erst laden, dann messen.
   */
  const convert = async (skeletons: unknown[]) => {
    const chars = JSON.stringify(skeletons);
    await Promise.all([document.fonts.load('16px Nunito', chars), document.fonts.load('16px Nunito')]).catch(() => undefined);
    const created = convertToExcalidrawElements(skeletons as ExcalidrawElementSkeleton[], { regenerateIds: true });
    return restoreElements(created, null, { refreshDimensions: true, repairBindings: true }) as unknown as Element[];
  };

  const show = (elements: readonly ExcalidrawElement[]) => {
    if (elements.length) api.scrollToContent(elements, { fitToContent: true, animate: true });
  };

  return {
    pageId,
    bounds() {
      const elements = live();
      if (!elements.length) return null;
      return {
        minX: Math.min(...elements.map((e) => e.x)),
        minY: Math.min(...elements.map((e) => e.y)),
        maxX: Math.max(...elements.map((e) => e.x + e.width)),
        maxY: Math.max(...elements.map((e) => e.y + e.height)),
      };
    },
    async insert(skeletons) {
      const created = await convert(skeletons);
      api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), ...created], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      show(created);
    },
    selectedNotes() {
      const selected = api.getAppState().selectedElementIds;
      const elements = live();
      const byId = new Map(elements.map((e) => [e.id, e]));
      const ids = new Set<string>();
      for (const id of Object.keys(selected)) {
        const el = byId.get(id);
        if (!el) continue;
        // Ausgewählter Text in einem Post-it zählt als das Post-it.
        if (el.type === 'text' && el.containerId) ids.add(el.containerId);
        else if (el.boundElements?.some((b) => b.type === 'text')) ids.add(el.id);
      }
      const notes: BoardNote[] = [];
      for (const id of ids) {
        const container = byId.get(id);
        const textId = container?.boundElements?.find((b) => b.type === 'text')?.id;
        const textEl = textId ? byId.get(textId) : undefined;
        const value = (textEl?.originalText ?? textEl?.text ?? '').trim();
        if (container && value) notes.push({ id, text: value, width: container.width, height: container.height });
      }
      return notes;
    },
    async arrange(moves, skeletons) {
      const frames = await convert(skeletons);
      const elements = api.getSceneElementsIncludingDeleted() as readonly Element[];
      const target = new Map(moves.map((m) => [m.id, m]));
      // Gebundener Text wandert mit seinem Post-it.
      const textOwner = new Map<string, string>();
      for (const el of elements) if (el.type === 'text' && el.containerId && target.has(el.containerId)) textOwner.set(el.id, el.containerId);
      const updated = elements.map((el) => {
        const move = target.get(el.id);
        if (move) return newElementWith(el, { x: move.x, y: move.y, backgroundColor: move.color });
        const owner = textOwner.get(el.id);
        if (owner) {
          const container = elements.find((e) => e.id === owner)!;
          const m = target.get(owner)!;
          return newElementWith(el, { x: el.x + (m.x - container.x), y: el.y + (m.y - container.y) });
        }
        return el;
      });
      // Rahmen liegen ganz hinten, damit sie keine Post-its verdecken.
      api.updateScene({ elements: [...frames, ...updated], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      show([...frames, ...updated.filter((el) => target.has(el.id))]);
    },
  };
}
