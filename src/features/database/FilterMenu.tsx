import { Plus, X } from 'lucide-react';
import { TITLE_PROPERTY, type CellValue, type Filter, type FilterOperator, type Property, type View } from '../../db/database';
import { newId } from '../../lib/ids';
import { useDatabases } from '../../store/databases';
import { formatDate } from './cells';
import { filterType, OPERATOR_LABEL, OPERATORS, UNARY } from './query';

const selectClass = 'h-7 min-w-0 rounded-md border border-border bg-bg px-1.5 text-xs outline-none focus:border-accent';

function ValueInput({ filter, property, onChange }: { filter: Filter; property?: Property; onChange: (value: CellValue) => void }) {
  if (UNARY.includes(filter.operator)) return null;
  const type = property?.type ?? 'text';
  if (type === 'select' || type === 'multi_select') {
    return (
      <select value={String(filter.value ?? '')} onChange={(e) => onChange(e.target.value || null)} className={`${selectClass} flex-1`}>
        <option value="">Option wählen …</option>
        {property!.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
      value={filter.value === null ? '' : String(filter.value)}
      title={type === 'date' && typeof filter.value === 'string' ? formatDate(filter.value) : undefined}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === '' ? null : type === 'number' ? Number(raw) : raw);
      }}
      placeholder="Wert"
      className={`${selectClass} flex-1 px-2`}
    />
  );
}

/** Filter einer Ansicht (alle Bedingungen müssen zutreffen). */
export function FilterMenu({ view, properties }: { view: View; properties: Property[] }) {
  const props = new Map(properties.map((p) => [p.id, p]));
  const save = (filters: Filter[]) => useDatabases.getState().updateView({ ...view, config: { ...view.config, filters } });
  const update = (id: string, patch: Partial<Filter>) => save(view.config.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const columns = [{ id: TITLE_PROPERTY, name: 'Name' }, ...properties];

  return (
    <div className="w-[460px] p-2">
      {view.config.filters.length === 0 && <div className="px-1 pb-2 text-xs text-faint">Keine Filter in dieser Ansicht</div>}
      {view.config.filters.map((filter, i) => {
        const operators = OPERATORS[filterType(filter.propertyId, props)];
        return (
          <div key={filter.id} className="mb-1.5 flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-right text-xs text-faint">{i === 0 ? 'Wo' : 'und'}</span>
            <select
              value={filter.propertyId}
              onChange={(e) => {
                const propertyId = e.target.value;
                const operator: FilterOperator = OPERATORS[filterType(propertyId, props)][0];
                update(filter.id, { propertyId, operator, value: null });
              }}
              className={`${selectClass} w-[120px]`}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filter.operator}
              onChange={(e) => update(filter.id, { operator: e.target.value as FilterOperator })}
              className={`${selectClass} w-[118px]`}
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABEL[op]}
                </option>
              ))}
            </select>
            <ValueInput filter={filter} property={props.get(filter.propertyId)} onChange={(value) => update(filter.id, { value })} />
            <button
              aria-label="Filter entfernen"
              onClick={() => save(view.config.filters.filter((f) => f.id !== filter.id))}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <button
        onClick={() =>
          save([...view.config.filters, { id: newId(), propertyId: TITLE_PROPERTY, operator: 'contains', value: null }])
        }
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-hover"
      >
        <Plus size={13} /> Filter hinzufügen
      </button>
    </div>
  );
}
