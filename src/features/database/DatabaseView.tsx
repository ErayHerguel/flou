import { ArrowUpDown, CalendarDays, Columns3, ListFilter, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Popover, type Anchor } from '../../components/Popover';
import type { CellValue, View } from '../../db/database';
import { cx } from '../../lib/cx';
import { useDatabases } from '../../store/databases';
import { reportError } from '../../store/toast';
import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GalleryView, ListView } from './GalleryView';
import { usePages } from '../../store/pages';
import { FilterMenu } from './FilterMenu';
import { applyView, computeRows } from './query';
import { SortMenu } from './SortMenu';
import { TableView } from './TableView';
import { useRows } from './useRows';
import { ViewTabs } from './ViewTabs';

type Panel = 'filter' | 'sort' | 'group' | 'date';

export function DatabaseView({ databaseId }: { databaseId: string }) {
  const all = useDatabases((s) => s.data);
  const data = all[databaseId];
  const pages = usePages((s) => s.pages);
  const [viewId, setViewId] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ kind: Panel; anchor: Anchor } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Neu angelegte Einträge bleiben sichtbar, auch wenn sie (noch) nicht zum Filter passen.
  const [pinned, setPinned] = useState<string[]>([]);
  const closePanel = useCallback(() => setPanel(null), []);

  useEffect(() => {
    useDatabases
      .getState()
      .load(databaseId)
      .catch((err) => reportError('Datenbank konnte nicht geladen werden', err));
  }, [databaseId]);

  // Ziel-Datenbanken von Relationen laden (für Rollups und Auswahl)
  const targets = (data?.properties ?? []).map((p) => p.config.targetDatabaseId).filter((id): id is string => Boolean(id));
  const missing = targets.filter((id) => !all[id] && pages[id]).join(',');
  useEffect(() => {
    for (const id of missing ? missing.split(',') : []) {
      useDatabases.getState().load(id).catch((err) => reportError('Verknüpfte Datenbank konnte nicht geladen werden', err));
    }
  }, [missing]);

  const view = data?.views.find((v) => v.id === viewId) ?? data?.views[0];
  const storedRows = useRows(databaseId, data);
  const allRows = useMemo(
    () => (data ? computeRows(storedRows, data.properties, { databases: all, titleOf: (id) => pages[id]?.title ?? '' }) : storedRows),
    [storedRows, data, all, pages],
  );
  const rows = useMemo(() => {
    if (!data || !view) return [];
    const visible = applyView(allRows, data.properties, view.config);
    const shown = new Set(visible.map((r) => r.id));
    return [...visible, ...allRows.filter((r) => pinned.includes(r.id) && !shown.has(r.id))];
  }, [allRows, data, view, pinned]);

  if (!data || !view) return null;

  const create = async (initial: Record<string, CellValue> = {}) => {
    const id = await useDatabases.getState().createRow(databaseId, initial);
    setPinned((p) => [...p, id]);
    setEditingId(id);
  };

  const toolbarButton = (kind: Panel, label: string, icon: ReactNode, count = 0) => (
    <button
      onClick={(e) => setPanel({ kind, anchor: e.currentTarget.getBoundingClientRect() })}
      className={cx(
        'flex h-7 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-hover',
        count > 0 ? 'text-accent' : 'text-muted',
      )}
    >
      {icon}
      {label}
      {count > 0 && <span className="text-xs">{count}</span>}
    </button>
  );

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 border-b border-border">
        <ViewTabs views={data.views} activeId={view.id} onSelect={setViewId} />
        <div className="flex-1" />
        {view.type === 'board' && toolbarButton('group', 'Gruppierung', <Columns3 size={14} />)}
        {view.type === 'calendar' && toolbarButton('date', 'Datum', <CalendarDays size={14} />)}
        {toolbarButton('filter', 'Filter', <ListFilter size={14} />, view.config.filters.length)}
        {toolbarButton('sort', 'Sortierung', <ArrowUpDown size={14} />, view.config.sorts.length)}
        <button
          onClick={() => void create()}
          className="mb-1 flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-sm font-medium text-accent-fg"
        >
          <Plus size={14} /> Neu
        </button>
      </div>

      {view.type === 'table' && (
        <TableView
          databaseId={databaseId}
          view={view}
          data={data}
          rows={rows}
          editingId={editingId}
          onEditingDone={() => setEditingId(null)}
          onCreate={() => void create()}
        />
      )}
      {view.type === 'board' && (
        <BoardView
          databaseId={databaseId}
          view={view}
          data={data}
          rows={rows}
          editingId={editingId}
          onEditingDone={() => setEditingId(null)}
          onCreate={(initial) => void create(initial)}
        />
      )}
      {view.type === 'calendar' && <CalendarView databaseId={databaseId} view={view} data={data} rows={rows} onCreate={(initial) => void create(initial)} />}
      {(view.type === 'gallery' || view.type === 'list') &&
        (() => {
          const Entries = view.type === 'gallery' ? GalleryView : ListView;
          return (
            <Entries
              databaseId={databaseId}
              view={view}
              data={data}
              rows={rows}
              editingId={editingId}
              onEditingDone={() => setEditingId(null)}
              onCreate={() => void create()}
            />
          );
        })()}
      <div className="mt-1 px-2 text-xs text-faint">
        {rows.length === allRows.length ? `${rows.length} Einträge` : `${rows.length} von ${allRows.length} Einträgen`}
      </div>

      {panel && (
        <Popover anchor={panel.anchor} onClose={closePanel} placement="bottom-end">
          {panel.kind === 'filter' && <FilterMenu view={view} properties={data.properties} />}
          {panel.kind === 'sort' && <SortMenu view={view} properties={data.properties} />}
          {panel.kind === 'group' && <GroupMenu view={view} type="select" onDone={closePanel} />}
          {panel.kind === 'date' && <GroupMenu view={view} type="date" onDone={closePanel} />}
        </Popover>
      )}
    </div>
  );
}

/** Wahl der Property für Board (Auswahl) bzw. Kalender (Datum). */
function GroupMenu({ view, type, onDone }: { view: View; type: 'select' | 'date'; onDone: () => void }) {
  const properties = useDatabases((s) => s.data[view.databaseId]?.properties ?? []).filter((p) => p.type === type);
  const key = type === 'select' ? 'groupBy' : 'dateBy';
  return (
    <div className="w-[220px] p-1">
      <div className="px-2 pt-1 pb-0.5 text-2xs font-medium text-faint">{type === 'select' ? 'Gruppieren nach' : 'Datum aus'}</div>
      {properties.length === 0 && (
        <div className="px-2 py-1.5 text-xs text-faint">{type === 'select' ? 'Keine Auswahl-Property vorhanden' : 'Keine Datums-Property vorhanden'}</div>
      )}
      {properties.map((p) => (
        <button
          key={p.id}
          onClick={() => {
            useDatabases.getState().updateView({ ...view, config: { ...view.config, [key]: p.id } });
            onDone();
          }}
          className={cx('flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-hover', p.id === view.config[key] && 'text-accent')}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
