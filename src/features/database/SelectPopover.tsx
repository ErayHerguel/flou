import { Check, Palette, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TAG_COLORS, type Property, type SelectOption } from '../../db/database';
import { fuzzyFilter } from '../../lib/fuzzy';
import { newId } from '../../lib/ids';
import { cx } from '../../lib/cx';
import { confirmDialog } from '../../store/confirm';
import { nextColor, useDatabases } from '../../store/databases';
import { OptionTag } from './OptionTag';

interface SelectPopoverProps {
  property: Property;
  selected: string[];
  onChange: (selected: string[]) => void;
  onClose: () => void;
}

/** Auswahl- und Mehrfachauswahl-Editor: suchen, auswählen, neue Option per Enter anlegen. */
export function SelectPopover({ property, selected, onChange, onClose }: SelectPopoverProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const multi = property.type === 'multi_select';
  const options = useMemo(() => fuzzyFilter(property.options, query, (o) => [o.name]), [property.options, query]);
  const exact = property.options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim() !== '' && !exact;
  const total = options.length + (canCreate ? 1 : 0);

  const choose = (option: SelectOption) => {
    if (multi) {
      onChange(selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
      setQuery('');
    } else {
      onChange(selected[0] === option.id ? [] : [option.id]);
      onClose();
    }
  };

  const createOption = () => {
    const option: SelectOption = { id: newId(), name: query.trim(), color: nextColor(property.options.length) };
    useDatabases.getState().updateProperty({ ...property, options: [...property.options, option] });
    onChange(multi ? [...selected, option.id] : [option.id]);
    setQuery('');
    if (!multi) onClose();
  };

  const cycleColor = (option: SelectOption) => {
    const color = TAG_COLORS[(TAG_COLORS.indexOf(option.color) + 1) % TAG_COLORS.length];
    useDatabases.getState().updateProperty({ ...property, options: property.options.map((o) => (o.id === option.id ? { ...o, color } : o)) });
  };

  const removeOption = async (option: SelectOption) => {
    const ok = await confirmDialog({
      title: 'Option löschen?',
      message: `„${option.name}“ wird aus allen Einträgen entfernt.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok) await useDatabases.getState().deleteOption(property, option.id);
  };

  const selectedOptions = selected.map((id) => property.options.find((o) => o.id === id)).filter((o): o is SelectOption => Boolean(o));

  return (
    <div className="w-[280px] p-1">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 pb-1.5 pt-1">
        {selectedOptions.map((o) => (
          <OptionTag key={o.id} option={o} />
        ))}
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => (total ? (i + (e.key === 'ArrowDown' ? 1 : -1) + total) % total : 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (active < options.length) choose(options[active]);
              else if (canCreate) createOption();
            } else if (e.key === 'Backspace' && !query && multi && selected.length) {
              onChange(selected.slice(0, -1));
            }
          }}
          placeholder={property.options.length ? 'Suchen oder anlegen …' : 'Option anlegen …'}
          className="h-6 min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      <div className="max-h-[260px] overflow-y-auto py-1">
        {options.map((option, i) => (
          <div
            key={option.id}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(option)}
            className={cx('group flex h-8 items-center gap-2 rounded-md px-2', i === active && 'bg-hover')}
          >
            <OptionTag option={option} className="min-w-0" />
            <span className="flex-1" />
            <button
              title="Farbe wechseln"
              onClick={(e) => {
                e.stopPropagation();
                cycleColor(option);
              }}
              className="hidden h-6 w-6 items-center justify-center rounded-sm text-faint hover:bg-active hover:text-muted group-hover:flex"
            >
              <Palette size={13} />
            </button>
            <button
              title="Option löschen"
              onClick={(e) => {
                e.stopPropagation();
                void removeOption(option);
              }}
              className="hidden h-6 w-6 items-center justify-center rounded-sm text-faint hover:bg-active hover:text-danger group-hover:flex"
            >
              <Trash2 size={13} />
            </button>
            {selected.includes(option.id) && <Check size={14} className="text-accent" />}
          </div>
        ))}
        {canCreate && (
          <div
            onMouseEnter={() => setActive(options.length)}
            onClick={createOption}
            className={cx('flex h-8 items-center gap-2 rounded-md px-2 text-sm', active === options.length && 'bg-hover')}
          >
            <Plus size={14} className="text-muted" />
            <span className="text-muted">Anlegen</span>
            <OptionTag option={{ id: 'new', name: query.trim(), color: nextColor(property.options.length) }} />
          </div>
        )}
        {total === 0 && <div className="px-2 py-1.5 text-xs text-faint">Tippe, um eine Option anzulegen</div>}
      </div>
    </div>
  );
}
