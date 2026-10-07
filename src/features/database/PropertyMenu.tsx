import { ArrowDown, ArrowUp, Check, EyeOff, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Property, PropertyType, RollupAggregate, View } from '../../db/database';
import { pageTitle } from '../../components/PageIcon';
import { FORMULA_FUNCTIONS, parseFormula } from '../../lib/formula';
import { usePages } from '../../store/pages';
import { cx } from '../../lib/cx';
import { confirmDialog } from '../../store/confirm';
import { PROPERTY_LABEL, useDatabases } from '../../store/databases';
import { PROPERTY_ICON, PROPERTY_TYPES } from './propertyIcons';

interface PropertyMenuProps {
  /** null = Titelspalte (nur Sortierung) */
  property: Property | null;
  view?: View;
  onClose: () => void;
}

const itemClass = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-hover';

export function PropertyMenu({ property, view, onClose }: PropertyMenuProps) {
  const [name, setName] = useState(property?.name ?? '');
  const store = useDatabases.getState();
  const propertyId = property?.id ?? '__title';

  const sortBy = (direction: 'asc' | 'desc') => {
    if (!view) return;
    store.updateView({
      ...view,
      config: { ...view.config, sorts: [{ propertyId, direction }, ...view.config.sorts.filter((s) => s.propertyId !== propertyId)] },
    });
    onClose();
  };

  const changeType = async (type: PropertyType) => {
    if (!property || type === property.type) return;
    const data = store.data[property.databaseId];
    const used = data && Object.values(data.values).some((row) => row[property.id] !== undefined);
    if (used) {
      const ok = await confirmDialog({
        title: `In ${PROPERTY_LABEL[type]} umwandeln?`,
        message: 'Vorhandene Werte werden so weit wie möglich übernommen. Was sich nicht umwandeln lässt, wird geleert.',
        confirmLabel: 'Umwandeln',
      });
      if (!ok) return;
    }
    await store.changePropertyType(property, type);
    onClose();
  };

  const remove = async () => {
    if (!property) return;
    onClose();
    const ok = await confirmDialog({
      title: `„${property.name}“ löschen?`,
      message: 'Die Property und alle ihre Werte werden aus der Datenbank entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok) await store.deleteProperty(property);
  };

  return (
    <div className="w-[260px] p-1">
      {property && (
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            store.updateProperty({ ...property, name: e.target.value });
          }}
          onKeyDown={(e) => e.key === 'Enter' && onClose()}
          className="mb-1 h-8 w-full rounded-md border border-border bg-bg px-2 text-sm outline-none focus:border-accent"
        />
      )}
      {property && <PropertySettings property={property} />}
      {view && (
        <>
          <button className={itemClass} onClick={() => sortBy('asc')}>
            <ArrowUp size={14} className="text-muted" /> Aufsteigend sortieren
          </button>
          <button className={itemClass} onClick={() => sortBy('desc')}>
            <ArrowDown size={14} className="text-muted" /> Absteigend sortieren
          </button>
          {property && (
            <button
              className={itemClass}
              onClick={() => {
                store.updateView({ ...view, config: { ...view.config, hidden: [...view.config.hidden, property.id] } });
                onClose();
              }}
            >
              <EyeOff size={14} className="text-muted" /> In dieser Ansicht ausblenden
            </button>
          )}
        </>
      )}
      {property && (
        <>
          <div className="mx-2 my-1 h-px bg-border" />
          <div className="px-2 pt-1 pb-0.5 text-2xs font-medium text-faint">Typ</div>
          {PROPERTY_TYPES.map((type) => {
            const Icon = PROPERTY_ICON[type];
            return (
              <button key={type} className={cx(itemClass, 'h-7')} onClick={() => void changeType(type)}>
                <Icon size={14} className="text-muted" />
                <span className="flex-1">{PROPERTY_LABEL[type]}</span>
                {type === property.type && <Check size={14} className="text-accent" />}
              </button>
            );
          })}
          <div className="mx-2 my-1 h-px bg-border" />
          <button className={cx(itemClass, 'text-danger')} onClick={() => void remove()}>
            <Trash2 size={14} /> Property löschen
          </button>
        </>
      )}
    </div>
  );
}

const AGGREGATES: [RollupAggregate, string][] = [
  ['count', 'Anzahl'],
  ['sum', 'Summe'],
  ['avg', 'Durchschnitt'],
  ['min', 'Minimum'],
  ['max', 'Maximum'],
  ['show', 'Werte anzeigen'],
];

const fieldClass = 'h-7 w-full rounded-md border border-border bg-bg px-1.5 text-xs outline-none focus:border-accent';

/** Einstellungen für Relation, Rollup und Formel. */
function PropertySettings({ property }: { property: Property }) {
  const store = useDatabases.getState();
  const pages = usePages((s) => s.pages);
  const data = useDatabases((s) => s.data[property.databaseId]);
  const relation = data?.properties.find((p) => p.id === property.config.relationPropertyId);
  const targetId = relation?.config.targetDatabaseId;
  const targetData = useDatabases((s) => (targetId ? s.data[targetId] : undefined));
  const [expression, setExpression] = useState(property.config.expression ?? '');
  useEffect(() => {
    if (targetId && !targetData) void store.load(targetId);
  }, [targetId, targetData, store]);
  const save = (config: Property['config']) => store.updateProperty({ ...property, config: { ...property.config, ...config } });

  if (property.type === 'relation') {
    const databases = Object.values(pages).filter((p) => p.type === 'database' && p.deletedAt === null);
    return (
      <div className="mb-1 px-2 py-1">
        <div className="mb-1 text-2xs font-medium text-faint">Verknüpft mit</div>
        <select
          value={property.config.targetDatabaseId ?? ''}
          onChange={(e) => {
            save({ targetDatabaseId: e.target.value || undefined });
            if (e.target.value) void store.load(e.target.value);
          }}
          className={fieldClass}
        >
          <option value="">Datenbank wählen …</option>
          {databases.map((d) => (
            <option key={d.id} value={d.id}>
              {pageTitle(d)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (property.type === 'rollup') {
    const relations = data?.properties.filter((p) => p.type === 'relation') ?? [];
    return (
      <div className="mb-1 flex flex-col gap-1 px-2 py-1">
        <div className="text-2xs font-medium text-faint">Über Relation</div>
        <select value={property.config.relationPropertyId ?? ''} onChange={(e) => save({ relationPropertyId: e.target.value || undefined })} className={fieldClass}>
          <option value="">{relations.length ? 'Relation wählen …' : 'Zuerst eine Relation anlegen'}</option>
          {relations.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={property.config.targetPropertyId ?? ''} onChange={(e) => save({ targetPropertyId: e.target.value || undefined })} className={fieldClass}>
          <option value="">Titel der Einträge</option>
          {(targetData?.properties ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={property.config.aggregate ?? 'count'} onChange={(e) => save({ aggregate: e.target.value as RollupAggregate })} className={fieldClass}>
          {AGGREGATES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (property.type === 'formula') {
    let error = '';
    try {
      if (expression.trim()) parseFormula(expression);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return (
      <div className="mb-1 px-2 py-1">
        <div className="mb-1 text-2xs font-medium text-faint">Formel</div>
        <textarea
          value={expression}
          rows={3}
          spellCheck={false}
          onChange={(e) => {
            setExpression(e.target.value);
            save({ expression: e.target.value });
          }}
          placeholder='z. B. prop("Preis") * prop("Menge")'
          className="w-full resize-none rounded-md border border-border bg-bg p-1.5 font-mono text-xs outline-none focus:border-accent"
        />
        <div className={error ? 'text-2xs text-danger' : 'text-2xs text-faint'}>
          {error || `prop("Name"), + - * / ^ == < && ||, ${FORMULA_FUNCTIONS.join(', ')}`}
        </div>
      </div>
    );
  }
  return null;
}
