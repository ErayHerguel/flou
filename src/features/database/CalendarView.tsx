import { DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { pageTitle } from '../../components/PageIcon';
import type { CellValue, View } from '../../db/database';
import { cx } from '../../lib/cx';
import { useDatabases, type DatabaseData } from '../../store/databases';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import type { Row } from './query';
import { useCanEdit } from '../collab/sources';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface CalendarViewProps {
  databaseId: string;
  view: View;
  data: DatabaseData;
  rows: Row[];
  onCreate: (initial: Record<string, CellValue>) => void;
}

/** Monatskalender nach einer Datums-Property; Einträge lassen sich auf andere Tage ziehen. */
export function CalendarView({ databaseId, view, data, rows, onCreate }: CalendarViewProps) {
  const dateProp = data.properties.find((p) => p.id === view.config.dateBy && p.type === 'date');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const editable = useCanEdit(databaseId);

  if (!dateProp) {
    const dates = data.properties.filter((p) => p.type === 'date');
    const store = useDatabases.getState();
    return (
      <div className="rounded-lg border border-dashed border-border-strong px-6 py-8 text-center text-sm text-muted">
        <p>Der Kalender ordnet Einträge nach einer Datums-Property.</p>
        <div className="mt-3 flex justify-center gap-2">
          {dates.map((p) => (
            <button key={p.id} onClick={() => store.updateView({ ...view, config: { ...view.config, dateBy: p.id } })} className="h-8 rounded-md border border-border px-3 hover:bg-hover">
              Nach „{p.name}“
            </button>
          ))}
          {dates.length === 0 && (
            <button
              onClick={async () => {
                const id = await store.addProperty(databaseId, 'date');
                const current = useDatabases.getState().data[databaseId]?.views.find((v) => v.id === view.id) ?? view;
                store.updateView({ ...current, config: { ...current.config, dateBy: id } });
              }}
              className="h-8 rounded-md bg-accent px-3 font-medium text-accent-fg"
            >
              Datums-Property anlegen
            </button>
          )}
        </div>
      </div>
    );
  }

  const offset = (month.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i));
  const byDay = new Map<string, Row[]>();
  const undated: Row[] = [];
  for (const row of rows) {
    const value = row.values[dateProp.id];
    if (typeof value === 'string' && value) byDay.set(value, [...(byDay.get(value) ?? []), row]);
    else undated.push(row);
  }
  const today = iso(new Date());
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    useDatabases.getState().setValue(databaseId, String(active.id), dateProp.id, String(over.id).slice('day:'.length));
  };

  return (
    <DndContext sensors={editable ? sensors : []} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <div className="mb-2 flex items-center gap-1">
        <span className="mr-auto text-base font-semibold">{monthFormat.format(month)}</span>
        <button aria-label="Voriger Monat" onClick={() => shift(-1)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover">
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          className="h-7 rounded-md px-2 text-sm text-muted hover:bg-hover"
        >
          Heute
        </button>
        <button aria-label="Nächster Monat" onClick={() => shift(1)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 border-t border-l border-border text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-r border-b border-border px-2 py-1 text-right text-xs text-faint">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = iso(day);
          return (
            <Day key={key} id={`day:${key}`} muted={day.getMonth() !== month.getMonth()}>
              <div className="flex items-center justify-between">
                <button
                  aria-label="Eintrag an diesem Tag anlegen"
                  onClick={() => onCreate({ [dateProp.id]: key })}
                  className="db-edit flex h-5 w-5 items-center justify-center rounded-sm text-faint opacity-0 hover:bg-hover group-hover:opacity-100"
                >
                  <Plus size={13} />
                </button>
                <span className={cx('flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs', key === today ? 'bg-accent font-medium text-accent-fg' : 'text-muted')}>
                  {day.getDate()}
                </span>
              </div>
              {(byDay.get(key) ?? []).map((row) => (
                <Entry key={row.id} row={row} />
              ))}
            </Day>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-faint">
          Ohne Datum:
          {undated.map((row) => (
            <Entry key={row.id} row={row} />
          ))}
        </div>
      )}
    </DndContext>
  );
}

function Day({ id, muted, children }: { id: string; muted: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cx('group flex min-h-[96px] flex-col gap-0.5 border-r border-b border-border p-1', muted && 'bg-hover/40', isOver && 'bg-accent-soft')}>
      {children}
    </div>
  );
}

function Entry({ row }: { row: Row }) {
  const page = usePages((s) => s.pages[row.id]);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: row.id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => useUI.getState().open(row.id)}
      className={cx('truncate rounded-sm border border-border bg-bg px-1.5 py-0.5 text-left text-xs shadow-[0_1px_1px_rgb(0_0_0/0.04)] hover:bg-hover', isDragging && 'opacity-40')}
    >
      {page?.icon ? `${page.icon} ` : ''}
      {pageTitle(page)}
    </button>
  );
}
