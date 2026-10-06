import { ArrowDown, ArrowUp, Check, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Property, PropertyType, View } from '../../db/database';
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
    <div className="w-[240px] p-1">
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
