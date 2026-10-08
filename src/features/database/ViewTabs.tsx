import { CalendarDays, LayoutGrid, List, PenLine, Plus, SquareKanban, Table2, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { MenuList } from '../../components/MenuList';
import { Popover, pointAnchor, type Anchor } from '../../components/Popover';
import type { View } from '../../db/database';
import { cx } from '../../lib/cx';
import { useDatabases, VIEW_LABEL } from '../../store/databases';

const VIEW_ICON = { table: Table2, board: SquareKanban, calendar: CalendarDays, gallery: LayoutGrid, list: List } as const;

export function ViewTabs({ views, activeId, onSelect }: { views: View[]; activeId: string; onSelect: (id: string) => void }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ view: View; anchor: Anchor } | null>(null);
  const [addAnchor, setAddAnchor] = useState<Anchor | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeAdd = useCallback(() => setAddAnchor(null), []);
  const store = useDatabases.getState();

  const add = async (type: View['type']) => {
    const databaseId = views[0].databaseId;
    onSelect(await store.addView(databaseId, type));
  };

  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden">
      {views.map((view) => {
        const Icon = VIEW_ICON[view.type];
        const active = view.id === activeId;
        return renaming === view.id ? (
          <input
            key={view.id}
            autoFocus
            defaultValue={view.name}
            onBlur={(e) => {
              store.updateView({ ...view, name: e.target.value.trim() || view.name });
              setRenaming(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setRenaming(null);
            }}
            className="h-7 w-[120px] rounded-md bg-bg px-2 text-sm outline-none ring-2 ring-accent-soft"
          />
        ) : (
          <button
            key={view.id}
            onClick={() => onSelect(view.id)}
            onDoubleClick={() => setRenaming(view.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ view, anchor: pointAnchor(e.clientX, e.clientY) });
            }}
            className={cx(
              'relative flex h-8 shrink-0 items-center gap-1.5 px-2 text-sm',
              active ? 'font-medium text-text' : 'text-muted hover:text-text',
            )}
          >
            <Icon size={14} />
            {view.name}
            {active && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-text" />}
          </button>
        );
      })}
      <button
        aria-label="Ansicht hinzufügen"
        onClick={(e) => setAddAnchor(e.currentTarget.getBoundingClientRect())}
        className="db-edit flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-muted"
      >
        <Plus size={14} />
      </button>

      {menu && (
        <Popover anchor={menu.anchor} onClose={closeMenu}>
          <MenuList
            onDone={closeMenu}
            items={[
              { label: 'Umbenennen', icon: PenLine, onSelect: () => setRenaming(menu.view.id) },
              ...(views.length > 1
                ? [{ label: 'Ansicht löschen', icon: Trash2, danger: true, onSelect: () => void store.deleteView(menu.view) }]
                : []),
            ]}
          />
        </Popover>
      )}
      {addAnchor && (
        <Popover anchor={addAnchor} onClose={closeAdd}>
          <MenuList
            onDone={closeAdd}
            items={(Object.keys(VIEW_ICON) as View['type'][]).map((type) => ({
              label: VIEW_LABEL[type],
              icon: VIEW_ICON[type],
              onSelect: () => void add(type),
            }))}
          />
        </Popover>
      )}
    </div>
  );
}
