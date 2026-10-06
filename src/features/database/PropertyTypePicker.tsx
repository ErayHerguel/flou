import type { PropertyType } from '../../db/database';
import { PROPERTY_LABEL } from '../../store/databases';
import { PROPERTY_ICON, PROPERTY_TYPES } from './propertyIcons';

export function PropertyTypePicker({ onPick }: { onPick: (type: PropertyType) => void }) {
  return (
    <div className="w-[200px] p-1">
      <div className="px-2 pt-1 pb-0.5 text-2xs font-medium text-faint">Property-Typ</div>
      {PROPERTY_TYPES.map((type) => {
        const Icon = PROPERTY_ICON[type];
        return (
          <button
            key={type}
            onClick={() => onPick(type)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-hover"
          >
            <Icon size={14} className="text-muted" /> {PROPERTY_LABEL[type]}
          </button>
        );
      })}
    </div>
  );
}
