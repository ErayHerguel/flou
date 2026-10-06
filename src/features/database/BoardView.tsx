import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { pageTitle } from '../../components/PageIcon';
import type { CellValue, Property, View } from '../../db/database';
import { cx } from '../../lib/cx';
import { useDatabases, type DatabaseData } from '../../store/databases';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { BoundCell } from './cells';
import { OptionTag } from './OptionTag';
import { groupRows, type Row } from './query';
import { RowTitle } from './RowTitle';

interface BoardViewProps {
  databaseId: string;
  view: View;
  data: DatabaseData;
  rows: Row[];
  editingId: string | null;
  onEditingDone: () => void;
  onCreate: (initial: Record<string, CellValue>) => void;
}

const NONE = '__none__';
const columnId = (optionId: string | null) => `column:${optionId ?? NONE}`;

export function BoardView({ databaseId, view, data, rows, editingId, onEditingDone, onCreate }: BoardViewProps) {
  const groupBy = data.properties.find((p) => p.id === view.config.groupBy && p.type === 'select');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragging, setDragging] = useState<string | null>(null);

  if (!groupBy) {
    return <GroupByHint databaseId={databaseId} view={view} data={data} />;
  }

  const groups = groupRows(rows, groupBy);
  const cardProps = data.properties.filter((p) => p.id !== groupBy.id && !view.config.hidden.includes(p.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const rowId = String(active.id);
    const overId = String(over.id);
    let optionId: string | null;
    let beforeRow: string | null = null;
    if (overId.startsWith('column:')) {
      const raw = overId.slice('column:'.length);
      optionId = raw === NONE ? null : raw;
    } else {
      beforeRow = overId.slice('card:'.length);
      if (beforeRow === rowId) return;
      const target = rows.find((r) => r.id === beforeRow);
      const value = target?.values[groupBy.id];
      optionId = typeof value === 'string' && groupBy.options.some((o) => o.id === value) ? value : null;
    }
    useDatabases.getState().setValue(databaseId, rowId, groupBy.id, optionId);
    // Manuelle Reihenfolge: vor der Zielkarte einordnen (wirkt, solange keine Sortierung aktiv ist).
    if (beforeRow) {
      const siblings = (usePages.getState().children.get(databaseId) ?? []).filter((id) => id !== rowId);
      void usePages.getState().move(rowId, databaseId, siblings.indexOf(beforeRow));
    }
  };

  const draggedPage = dragging ? usePages.getState().pages[dragging] : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setDragging(String(active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {groups.map((group) => (
          <Column key={group.option?.id ?? NONE} id={columnId(group.option?.id ?? null)}>
            <div className="mb-2 flex h-7 items-center gap-2 px-1">
              {group.option ? <OptionTag option={group.option} /> : <span className="text-xs text-muted">Ohne {groupBy.name}</span>}
              <span className="text-xs text-faint">{group.rows.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.rows.map((row) => (
                <Card key={row.id} row={row} dimmed={dragging === row.id}>
                  <RowTitle rowId={row.id} editing={editingId === row.id} onEditingDone={onEditingDone} className="-mx-2 w-[calc(100%+16px)]" />
                  {cardProps.map((p) => (
                    <div key={p.id} className="-mx-2">
                      <BoundCell databaseId={databaseId} rowId={row.id} property={p} variant="card" />
                    </div>
                  ))}
                </Card>
              ))}
            </div>
            <button
              onClick={() => onCreate({ [groupBy.id]: group.option?.id ?? null })}
              className="mt-1 flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-sm text-faint hover:bg-hover hover:text-muted"
            >
              <Plus size={14} /> Neu
            </button>
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {draggedPage && (
          <div className="w-[248px] rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium shadow-popover">
            {pageTitle(draggedPage)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cx('w-[264px] shrink-0 rounded-lg p-1.5 transition-colors', isOver ? 'bg-accent-soft' : 'bg-hover/60')}>
      {children}
    </div>
  );
}

function Card({ row, dimmed, children }: { row: Row; dimmed: boolean; children: React.ReactNode }) {
  const drag = useDraggable({ id: row.id });
  const drop = useDroppable({ id: `card:${row.id}` });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      {...drag.attributes}
      className={cx(
        'group relative flex flex-col gap-0.5 rounded-md border border-border bg-bg px-2 py-1 shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
        dimmed && 'opacity-40',
        drop.isOver && !dimmed && 'before:absolute before:inset-x-0 before:-top-1 before:h-0.5 before:rounded-full before:bg-accent',
      )}
    >
      {children}
      <button
        aria-label="Seite öffnen"
        title="Seite öffnen"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => useUI.getState().open(row.id)}
        className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-muted opacity-0 hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
      >
        <ArrowUpRight size={13} />
      </button>
    </div>
  );
}

function GroupByHint({ databaseId, view, data }: { databaseId: string; view: View; data: DatabaseData }) {
  const selects = data.properties.filter((p: Property) => p.type === 'select');
  const store = useDatabases.getState();
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-8 text-center text-sm text-muted">
      <p>Ein Board gruppiert Einträge nach einer Auswahl-Property.</p>
      <div className="mt-3 flex justify-center gap-2">
        {selects.map((p) => (
          <button
            key={p.id}
            onClick={() => store.updateView({ ...view, config: { ...view.config, groupBy: p.id } })}
            className="h-8 rounded-md border border-border px-3 hover:bg-hover"
          >
            Nach „{p.name}“ gruppieren
          </button>
        ))}
        {selects.length === 0 && (
          <button
            onClick={async () => {
              const id = await store.addProperty(databaseId, 'select');
              const current = useDatabases.getState().data[databaseId]?.views.find((v) => v.id === view.id) ?? view;
              store.updateView({ ...current, config: { ...current.config, groupBy: id } });
            }}
            className="h-8 rounded-md bg-accent px-3 font-medium text-accent-fg"
          >
            Auswahl-Property anlegen
          </button>
        )}
      </div>
    </div>
  );
}
