import { Plus, X } from 'lucide-react';
import { TITLE_PROPERTY, type Property, type Sort, type View } from '../../db/database';
import { useDatabases } from '../../store/databases';

const selectClass = 'h-7 min-w-0 rounded-md border border-border bg-bg px-1.5 text-xs outline-none focus:border-accent';

/** Mehrstufige Sortierung einer Ansicht. */
export function SortMenu({ view, properties }: { view: View; properties: Property[] }) {
  const save = (sorts: Sort[]) => useDatabases.getState().updateView({ ...view, config: { ...view.config, sorts } });
  const columns = [{ id: TITLE_PROPERTY, name: 'Name' }, ...properties];
  const unused = columns.filter((c) => !view.config.sorts.some((s) => s.propertyId === c.id));

  return (
    <div className="w-[340px] p-2">
      {view.config.sorts.length === 0 && <div className="px-1 pb-2 text-xs text-faint">Manuelle Reihenfolge</div>}
      {view.config.sorts.map((sort, i) => (
        <div key={sort.propertyId} className="mb-1.5 flex items-center gap-1.5">
          <select
            value={sort.propertyId}
            onChange={(e) => save(view.config.sorts.map((s, j) => (j === i ? { ...s, propertyId: e.target.value } : s)))}
            className={`${selectClass} flex-1`}
          >
            {columns
              .filter((c) => c.id === sort.propertyId || unused.includes(c))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            value={sort.direction}
            onChange={(e) =>
              save(view.config.sorts.map((s, j) => (j === i ? { ...s, direction: e.target.value as Sort['direction'] } : s)))
            }
            className={`${selectClass} w-[120px]`}
          >
            <option value="asc">Aufsteigend</option>
            <option value="desc">Absteigend</option>
          </select>
          <button
            aria-label="Sortierung entfernen"
            onClick={() => save(view.config.sorts.filter((_, j) => j !== i))}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-text"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {unused.length > 0 && (
        <button
          onClick={() => save([...view.config.sorts, { propertyId: unused[0].id, direction: 'asc' }])}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-hover"
        >
          <Plus size={13} /> Sortierung hinzufügen
        </button>
      )}
    </div>
  );
}
