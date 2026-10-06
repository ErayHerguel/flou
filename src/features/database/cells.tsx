import { useCallback, useState, type ReactNode } from 'react';
import { Popover, type Anchor } from '../../components/Popover';
import type { CellValue, Property, SelectOption } from '../../db/database';
import { openExternal } from '../../lib/assets';
import { cx } from '../../lib/cx';
import { useDatabases } from '../../store/databases';
import { reportError } from '../../store/toast';
import { OptionTag } from './OptionTag';
import { SelectPopover } from './SelectPopover';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

export function formatDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? dateFormat.format(new Date(y, m - 1, d)) : value;
}

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 10 });

interface CellProps {
  property: Property;
  value: CellValue;
  onChange: (value: CellValue) => void;
  /** table: kompakte Zelle · panel: Eigenschaftsliste einer Seite · card: Anzeige auf der Board-Karte */
  variant: 'table' | 'panel' | 'card';
}

const shell = (variant: CellProps['variant']) =>
  cx('flex min-h-8 w-full min-w-0 items-center text-left text-sm', variant === 'panel' ? 'rounded-md px-2 hover:bg-hover' : 'px-2');

/** Editor bzw. Anzeige eines Property-Werts, passend zum Typ. */
export function Cell({ property, value, onChange, variant }: CellProps) {
  switch (property.type) {
    case 'checkbox':
      return (
        <div className={shell(variant)}>
          <input
            type="checkbox"
            aria-label={property.name}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={variant === 'card'}
            className="h-4 w-4 accent-[var(--c-accent)]"
          />
        </div>
      );
    case 'select':
    case 'multi_select':
      return <SelectCell property={property} value={value} onChange={onChange} variant={variant} />;
    case 'date':
      return <TextLikeCell property={property} value={value} onChange={onChange} variant={variant} inputType="date" />;
    default:
      return <TextLikeCell property={property} value={value} onChange={onChange} variant={variant} />;
  }
}

function parseInput(property: Property, raw: string): CellValue {
  const text = raw.trim();
  if (!text) return null;
  if (property.type === 'number') {
    const n = Number(text.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return text;
}

function display(property: Property, value: CellValue): ReactNode {
  if (value === null || value === '') return null;
  if (property.type === 'number' && typeof value === 'number') return numberFormat.format(value);
  if (property.type === 'date' && typeof value === 'string') return formatDate(value);
  if (property.type === 'url') {
    return (
      <span
        className="truncate underline decoration-border-strong underline-offset-2"
        title="⌘-Klick öffnet den Link"
        onClick={(e) => {
          if (!e.metaKey) return;
          e.stopPropagation();
          const href = /^[a-z]+:/i.test(String(value)) ? String(value) : `https://${value}`;
          openExternal(href).catch((err) => reportError('Link konnte nicht geöffnet werden', err));
        }}
      >
        {String(value)}
      </span>
    );
  }
  return <span className="truncate">{String(value)}</span>;
}

function TextLikeCell({ property, value, onChange, variant, inputType = 'text' }: CellProps & { inputType?: 'text' | 'date' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (variant === 'card') {
    const shown = display(property, value);
    return shown ? <div className="truncate text-xs text-muted">{shown}</div> : null;
  }

  if (editing) {
    const commit = () => {
      setEditing(false);
      const next = parseInput(property, draft);
      if (next !== value) onChange(next);
    };
    return (
      <input
        autoFocus
        type={inputType}
        value={draft}
        inputMode={property.type === 'number' ? 'decimal' : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          if (inputType === 'date') onChange(e.target.value || null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={cx(
          'h-8 w-full min-w-0 rounded-md bg-bg px-2 text-sm text-text outline-none ring-2 ring-accent-soft',
          property.type === 'number' && 'text-right tabular-nums',
        )}
      />
    );
  }

  const shown = display(property, value);
  return (
    <button
      onClick={() => {
        setDraft(value === null ? '' : String(value));
        setEditing(true);
      }}
      className={cx(shell(variant), property.type === 'number' && 'justify-end tabular-nums')}
    >
      {shown ?? (variant === 'panel' ? <span className="text-faint">Leer</span> : null)}
    </button>
  );
}

function SelectCell({ property, value, onChange, variant }: CellProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const options = ids.map((id) => property.options.find((o) => o.id === id)).filter((o): o is SelectOption => Boolean(o));

  const tags = (
    <span className={cx('flex min-w-0 gap-1', variant === 'card' ? 'flex-wrap' : 'overflow-hidden')}>
      {options.map((o) => (
        <OptionTag key={o.id} option={o} />
      ))}
    </span>
  );
  if (variant === 'card') return options.length ? tags : null;

  return (
    <>
      <button onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())} className={shell(variant)}>
        {options.length ? tags : variant === 'panel' ? <span className="text-faint">Leer</span> : null}
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={close}>
          <SelectPopover
            property={property}
            selected={ids}
            onClose={close}
            onChange={(next) => onChange(property.type === 'multi_select' ? next : (next[0] ?? null))}
          />
        </Popover>
      )}
    </>
  );
}

/** Verbindet eine Zelle mit dem Datenbank-Store. */
export function BoundCell({
  databaseId,
  rowId,
  property,
  variant,
}: {
  databaseId: string;
  rowId: string;
  property: Property;
  variant: CellProps['variant'];
}) {
  const value = useDatabases((s) => s.data[databaseId]?.values[rowId]?.[property.id] ?? null);
  return (
    <Cell
      property={property}
      value={value}
      variant={variant}
      onChange={(next) => useDatabases.getState().setValue(databaseId, rowId, property.id, next)}
    />
  );
}
