import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { MenuList } from '../../components/MenuList';
import { Popover, pointAnchor, type Anchor } from '../../components/Popover';
import { TITLE_PROPERTY, type Property, type PropertyType, type View } from '../../db/database';
import { useDatabases, type DatabaseData } from '../../store/databases';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { BoundCell } from './cells';
import { PROPERTY_ICON, TITLE_ICON } from './propertyIcons';
import { PropertyTypePicker } from './PropertyTypePicker';
import { PropertyMenu } from './PropertyMenu';
import type { Row } from './query';
import { RowTitle } from './RowTitle';

const TITLE_WIDTH = 280;
const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 80;

interface TableViewProps {
  databaseId: string;
  view: View;
  data: DatabaseData;
  rows: Row[];
  editingId: string | null;
  onEditingDone: () => void;
  onCreate: () => void;
}

export function TableView({ databaseId, view, data, rows, editingId, onEditingDone, onCreate }: TableViewProps) {
  const properties = data.properties.filter((p) => !view.config.hidden.includes(p.id));
  const [widths, setWidths] = useState(view.config.widths);
  const [menu, setMenu] = useState<{ property: Property | null; anchor: Anchor } | null>(null);
  const [addAnchor, setAddAnchor] = useState<Anchor | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; anchor: Anchor } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeAdd = useCallback(() => setAddAnchor(null), []);
  const closeRowMenu = useCallback(() => setRowMenu(null), []);

  useEffect(() => setWidths(view.config.widths), [view.config.widths]);
  const widthOf = (id: string) => widths[id] ?? (id === TITLE_PROPERTY ? TITLE_WIDTH : DEFAULT_WIDTH);
  const total = widthOf(TITLE_PROPERTY) + properties.reduce((sum, p) => sum + widthOf(p.id), 0) + 40;

  const startResize = (id: string, event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widthOf(id);
    let latest = widths;
    const onMove = (e: MouseEvent) => {
      latest = { ...latest, [id]: Math.max(MIN_WIDTH, Math.round(startWidth + e.clientX - startX)) };
      setWidths(latest);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      useDatabases.getState().updateView({ ...view, config: { ...view.config, widths: latest } });
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const addProperty = async (type: PropertyType) => {
    setAddAnchor(null);
    await useDatabases.getState().addProperty(databaseId, type);
  };

  const header = (id: string, label: string, Icon: typeof TITLE_ICON, property: Property | null) => (
    <div key={id} className="relative shrink-0 border-r border-border" style={{ width: widthOf(id) }}>
      <button
        onClick={(e) => setMenu({ property, anchor: e.currentTarget.getBoundingClientRect() })}
        className="flex h-8 w-full items-center gap-1.5 px-2 text-left hover:bg-hover"
      >
        <Icon size={13} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <div
        role="separator"
        onMouseDown={(e) => startResize(id, e)}
        className="absolute inset-y-0 -right-[3px] z-10 w-[5px] cursor-col-resize hover:bg-accent"
      />
    </div>
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: total }}>
        <div className="flex border-y border-border text-xs text-muted">
          {header(TITLE_PROPERTY, 'Name', TITLE_ICON, null)}
          {properties.map((p) => header(p.id, p.name, PROPERTY_ICON[p.type], p))}
          <button
            aria-label="Property hinzufügen"
            onClick={(e) => setAddAnchor(e.currentTarget.getBoundingClientRect())}
            className="flex h-8 w-10 shrink-0 items-center justify-center hover:bg-hover"
          >
            <Plus size={14} />
          </button>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            onContextMenu={(e) => {
              e.preventDefault();
              setRowMenu({ rowId: row.id, anchor: pointAnchor(e.clientX, e.clientY) });
            }}
            className="group flex border-b border-border"
          >
            <div className="flex shrink-0 items-center border-r border-border" style={{ width: widthOf(TITLE_PROPERTY) }}>
              <RowTitle rowId={row.id} editing={editingId === row.id} onEditingDone={onEditingDone} className="flex-1" />
              <button
                onClick={() => useUI.getState().open(row.id)}
                className="mr-1 flex h-6 shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-1.5 text-2xs text-muted opacity-0 hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
              >
                <ArrowUpRight size={12} /> Öffnen
              </button>
            </div>
            {properties.map((p) => (
              <div key={p.id} className="flex shrink-0 items-center border-r border-border" style={{ width: widthOf(p.id) }}>
                <BoundCell databaseId={databaseId} rowId={row.id} property={p} variant="table" />
              </div>
            ))}
          </div>
        ))}

        <button onClick={onCreate} className="flex h-8 w-full items-center gap-1.5 px-2 text-sm text-faint hover:bg-hover hover:text-muted">
          <Plus size={14} /> Neu
        </button>
      </div>

      {menu && (
        <Popover anchor={menu.anchor} onClose={closeMenu}>
          <PropertyMenu property={menu.property} view={view} onClose={closeMenu} />
        </Popover>
      )}
      {addAnchor && (
        <Popover anchor={addAnchor} onClose={closeAdd} placement="bottom-end">
          <PropertyTypePicker onPick={(type) => void addProperty(type)} />
        </Popover>
      )}
      {rowMenu && (
        <Popover anchor={rowMenu.anchor} onClose={closeRowMenu}>
          <MenuList
            onDone={closeRowMenu}
            items={[
              { label: 'Öffnen', icon: ArrowUpRight, onSelect: () => useUI.getState().open(rowMenu.rowId) },
              { label: 'Löschen', icon: Trash2, danger: true, onSelect: () => void usePages.getState().trash(rowMenu.rowId) },
            ]}
          />
        </Popover>
      )}
    </div>
  );
}
