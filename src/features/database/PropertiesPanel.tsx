import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Popover, type Anchor } from '../../components/Popover';
import type { Property, PropertyType } from '../../db/database';
import { useDatabases } from '../../store/databases';
import { reportError } from '../../store/toast';
import { BoundCell } from './cells';
import { PROPERTY_ICON } from './propertyIcons';
import { PropertyTypePicker } from './PropertyTypePicker';
import { PropertyMenu } from './PropertyMenu';

/** Eigenschaften eines Datenbank-Eintrags oberhalb seines Seiteninhalts. */
export function PropertiesPanel({ databaseId, rowId }: { databaseId: string; rowId: string }) {
  const data = useDatabases((s) => s.data[databaseId]);
  const [menu, setMenu] = useState<{ property: Property; anchor: Anchor } | null>(null);
  const [addAnchor, setAddAnchor] = useState<Anchor | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeAdd = useCallback(() => setAddAnchor(null), []);

  useEffect(() => {
    if (useDatabases.getState().data[databaseId]) return;
    useDatabases
      .getState()
      .load(databaseId)
      .catch((err) => reportError('Datenbank konnte nicht geladen werden', err));
  }, [databaseId]);

  if (!data) return null;

  const add = async (type: PropertyType) => {
    setAddAnchor(null);
    await useDatabases.getState().addProperty(databaseId, type);
  };

  return (
    <div className="mt-4 border-b border-border pb-3">
      {data.properties.map((property) => {
        const Icon = PROPERTY_ICON[property.type];
        return (
          <div key={property.id} className="flex min-h-8 items-start gap-2">
            <button
              onClick={(e) => setMenu({ property, anchor: e.currentTarget.getBoundingClientRect() })}
              className="flex h-8 w-[160px] shrink-0 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-hover"
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{property.name}</span>
            </button>
            <div className="min-w-0 flex-1">
              <BoundCell databaseId={databaseId} rowId={rowId} property={property} variant="panel" />
            </div>
          </div>
        );
      })}
      <button
        onClick={(e) => setAddAnchor(e.currentTarget.getBoundingClientRect())}
        className="mt-1 flex h-8 items-center gap-2 rounded-md px-2 text-sm text-faint hover:bg-hover hover:text-muted"
      >
        <Plus size={14} /> Property hinzufügen
      </button>

      {menu && (
        <Popover anchor={menu.anchor} onClose={closeMenu}>
          <PropertyMenu property={menu.property} onClose={closeMenu} />
        </Popover>
      )}
      {addAnchor && (
        <Popover anchor={addAnchor} onClose={closeAdd}>
          <PropertyTypePicker onPick={(type) => void add(type)} />
        </Popover>
      )}
    </div>
  );
}
