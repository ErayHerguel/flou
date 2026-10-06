import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';

export interface MenuEntry {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  danger?: boolean;
  onSelect: () => void;
}

/** Tastaturbedienbare Liste für Kontext- und Dropdown-Menüs. */
export function MenuList({ items, onDone }: { items: MenuEntry[]; onDone: () => void }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (i + step + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        items[active]?.onSelect();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [items, active, onDone]);

  return (
    <div className="min-w-[200px] p-1" role="menu">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            role="menuitem"
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              item.onSelect();
              onDone();
            }}
            className={cx(
              'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left',
              i === active && 'bg-hover',
              item.danger ? 'text-danger' : 'text-text',
            )}
          >
            {Icon && <Icon size={15} className={item.danger ? '' : 'text-muted'} />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint && <span className="text-xs text-faint">{item.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
