import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCallback, useMemo, useState } from 'react';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { isSelfOrDescendant, type ChildIndex, type PageMap } from '../../lib/tree';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { TreeRow, type DropPosition } from './TreeRow';

type Row = { kind: 'page'; id: string; depth: number } | { kind: 'empty'; parentId: string; depth: number };

export interface DropTarget {
  id: string;
  position: DropPosition;
}

const ROOT_END = '__root_end__';

function flatten(children: ChildIndex, pages: PageMap, expanded: Record<string, true>): Row[] {
  const rows: Row[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const id of children.get(parentId) ?? []) {
      rows.push({ kind: 'page', id, depth });
      // Einträge einer Datenbank erscheinen nicht im Baum, sondern in der Datenbank selbst.
      if (!expanded[id] || pages[id]?.type !== 'page') continue;
      if (children.get(id)?.length) walk(id, depth + 1);
      else rows.push({ kind: 'empty', parentId: id, depth: depth + 1 });
    }
  };
  walk(null, 0);
  return rows;
}

export function PageTree() {
  const pages = usePages((s) => s.pages);
  const children = usePages((s) => s.children);
  const expanded = useUI((s) => s.expanded);
  const rows = useMemo(() => flatten(children, pages, expanded), [children, pages, expanded]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const computeTarget = useCallback(
    (e: DragMoveEvent): DropTarget | null => {
      const { over, active } = e;
      if (!over) return null;
      const overId = String(over.id);
      const dragged = String(active.id);
      if (overId === ROOT_END) return { id: ROOT_END, position: 'inside' };
      if (overId === dragged) return null;
      const overPage = pages[overId];
      if (!overPage) return null;
      const pointerY = (e.activatorEvent as PointerEvent).clientY + e.delta.y;
      const rel = (pointerY - over.rect.top) / over.rect.height;
      let position: DropPosition = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'inside';
      if (position === 'inside' && overPage.type === 'database') position = rel < 0.5 ? 'before' : 'after';
      const parentId = position === 'inside' ? overId : overPage.parentId;
      if (isSelfOrDescendant(pages, dragged, parentId)) return null;
      return { id: overId, position };
    },
    [pages],
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragMove = (e: DragMoveEvent) => setTarget(computeTarget(e));
  const reset = () => {
    setActiveId(null);
    setTarget(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const dragged = String(e.active.id);
    const drop = target;
    reset();
    if (!drop) return;
    const { move } = usePages.getState();
    const { setExpanded } = useUI.getState();
    if (drop.id === ROOT_END) {
      void move(dragged, null, Number.MAX_SAFE_INTEGER);
      return;
    }
    const over = pages[drop.id];
    const overHasVisibleChildren = expanded[drop.id] && (children.get(drop.id)?.length ?? 0) > 0;
    if (drop.position === 'inside' || (drop.position === 'after' && overHasVisibleChildren)) {
      // "Nach" einer aufgeklappten Seite heißt optisch: als erstes Kind.
      void move(dragged, drop.id, drop.position === 'inside' ? Number.MAX_SAFE_INTEGER : 0);
      setExpanded(drop.id, true);
      return;
    }
    const siblings = (children.get(over.parentId) ?? []).filter((id) => id !== dragged);
    const index = siblings.indexOf(drop.id) + (drop.position === 'after' ? 1 : 0);
    void move(dragged, over.parentId, index);
  };

  const dragged = activeId ? pages[activeId] : undefined;

  /** Pfeiltasten: hoch/runter wandern, rechts aufklappen bzw. ins Kind, links zuklappen bzw. zum Elternteil. */
  const onTreeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = (e.target as HTMLElement).closest<HTMLElement>('[data-tree-id]');
    if (!current || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    const id = current.dataset.treeId!;
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-tree-id]')];
    const index = all.indexOf(current);
    const focus = (el: HTMLElement | undefined) => el?.focus();
    const page = pages[id];
    const canExpand = page?.type === 'page';
    if (e.key === 'Escape') useUI.getState().requestFocus('editor');
    else if (e.key === 'ArrowDown') focus(all[index + 1]);
    else if (e.key === 'ArrowUp') focus(all[index - 1]);
    else if (e.key === 'ArrowRight') {
      if (canExpand && !expanded[id]) useUI.getState().setExpanded(id, true);
      else focus(all[index + 1]);
    } else if (e.key === 'ArrowLeft') {
      if (expanded[id]) useUI.getState().setExpanded(id, false);
      else if (page?.parentId) focus(all.find((el) => el.dataset.treeId === page.parentId));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div role="tree" className="flex flex-col" onKeyDown={onTreeKey}>
        {rows.map((row) =>
          row.kind === 'page' ? (
            <TreeRow
              key={row.id}
              id={row.id}
              depth={row.depth}
              drop={target?.id === row.id ? target.position : null}
              dimmed={activeId === row.id}
            />
          ) : (
            <div
              key={`empty-${row.parentId}`}
              className="flex h-7 items-center text-xs text-faint"
              style={{ paddingLeft: 30 + row.depth * 14 }}
            >
              Keine Unterseiten
            </div>
          ),
        )}
        {rows.length === 0 && <div className="px-2 py-1 text-xs text-faint">Noch keine Seiten</div>}
        <RootDropZone active={target?.id === ROOT_END} />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && (
          <div className="flex h-7 w-[220px] items-center gap-2 rounded-md bg-surface px-2 text-sm shadow-popover">
            <PageIcon page={dragged} />
            <span className="truncate">{pageTitle(dragged)}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function RootDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: ROOT_END });
  return (
    <div ref={setNodeRef} className="relative h-8">
      {active && <div className="absolute inset-x-1 top-0 h-0.5 rounded-full bg-accent" />}
    </div>
  );
}
