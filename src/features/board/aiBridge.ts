import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { BoardBridge, BoardNote } from './active';
import type { BoardEl } from '../ai/edit/boardModel';

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
    snapshot() {
      const elements = live();
      const selectedIds = api.getAppState().selectedElementIds;
      const byId = new Map(elements.map((e) => [e.id, e]));
      const simple: BoardEl[] = elements.map((e) => {
        const textId = e.boundElements?.find((b) => b.type === 'text')?.id ?? null;
        const own = e.type === 'text' ? (e.originalText ?? e.text ?? '') : undefined;
        const bound = textId ? byId.get(textId) : undefined;
        return {
          id: e.id,
          type: e.type,
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
          backgroundColor: e.backgroundColor,
          text: own ?? (bound ? (bound.originalText ?? bound.text ?? '') : undefined),
          containerId: e.containerId ?? null,
          textId,
        };
      });
      // Ausgewählter Text in einem Post-it zählt als das Post-it.
      const selected = new Set<string>();
      for (const id of Object.keys(selectedIds)) {
        const el = byId.get(id);
        if (el) selected.add(el.type === 'text' && el.containerId ? el.containerId : el.id);
      }
      return { elements: simple, selected: [...selected] };
    },
    async applyEdits(edits, skeletons) {
      const created = skeletons.length ? await convert(skeletons) : [];
      const added = edits.add.length ? await convert(edits.add) : [];
      const texts = new Map(edits.texts.map((t) => [t.id, t.text]));
      const colors = new Map(edits.colors.map((c) => [c.id, c.color]));
      const deletes = new Set(edits.deletes);
      const grow = new Map(edits.grow.map((g) => [g.id, g.height]));
      const updated = (api.getSceneElementsIncludingDeleted() as readonly Element[]).map((el) => {
        if (deletes.has(el.id)) return newElementWith(el, { isDeleted: true });
        const text = texts.get(el.id);
        if (text !== undefined) return newElementWith(el as never, { text, originalText: text } as never) as Element;
        const color = colors.get(el.id);
        if (color) return newElementWith(el, { backgroundColor: color });
        const height = grow.get(el.id);
        if (height) return newElementWith(el, { height });
        return el;
      });
      // Geänderte Texte neu umbrechen und vermessen (Post-it-Breite bleibt).
      const chars = edits.texts.map((t) => t.text).join(' ');
      await document.fonts.load('16px Nunito', chars || 'a').catch(() => undefined);
      // Nur die geänderten Texte (samt ihrem Post-it) neu vermessen, alles andere bleibt unangetastet.
      const changedTexts = updated.filter((e) => texts.has(e.id));
      const owners = new Set(changedTexts.map((e) => e.containerId).filter(Boolean) as string[]);
      const subset = updated.filter((e) => texts.has(e.id) || owners.has(e.id));
      const remeasured = new Map(
        (restoreElements(subset, null, { refreshDimensions: true, repairBindings: true }) as unknown as Element[]).map((e) => [e.id, e]),
      );
      const measured = updated.map((e) => remeasured.get(e.id) ?? e);
      api.updateScene({ elements: [...measured, ...added, ...created], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      const touched = new Set([...texts.keys(), ...colors.keys()]);
      show([...measured.filter((e) => touched.has(e.id) && !e.isDeleted), ...added, ...created]);
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
