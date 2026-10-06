import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface SuggestionListHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}

export interface SuggestionListProps<T> {
  items: T[];
  command: (item: T) => void;
  renderItem: (item: T, active: boolean) => ReactNode;
  itemKey: (item: T) => string;
  group?: (item: T) => string | undefined;
  empty: string;
}

/** Tastaturbedienbare Vorschlagsliste für Slash-Menü und Seitenlinks. */
function SuggestionListInner<T>(
  { items, command, renderItem, itemKey, group, empty }: SuggestionListProps<T>,
  ref: React.ForwardedRef<SuggestionListHandle>,
) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [items]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (event.key === 'ArrowDown') {
        setActive((i) => (items.length ? (i + 1) % items.length : 0));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active];
        if (!item) return false;
        command(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div ref={listRef} className="max-h-[320px] w-[300px] overflow-y-auto rounded-lg bg-surface p-1 text-sm shadow-popover">
      {items.length === 0 && <div className="px-2 py-1.5 text-faint">{empty}</div>}
      {items.map((item, i) => {
        const label = group?.(item);
        const showLabel = label && (i === 0 || group?.(items[i - 1]) !== label);
        return (
          <div key={itemKey(item)}>
            {showLabel && <div className="px-2 pt-2 pb-1 text-2xs font-medium text-faint">{label}</div>}
            <button
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command(item)}
              className={cx('flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-left', i === active && 'bg-hover')}
            >
              {renderItem(item, i === active)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const SuggestionList = forwardRef(SuggestionListInner) as <T>(
  props: SuggestionListProps<T> & { ref?: React.Ref<SuggestionListHandle> },
) => ReturnType<typeof SuggestionListInner>;
