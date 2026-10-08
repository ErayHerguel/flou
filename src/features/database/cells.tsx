import { Check } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Popover, type Anchor } from '../../components/Popover';
import { COMPUTED_TYPES, type CellValue, type Property, type SelectOption } from '../../db/database';
import { openExternal } from '../../lib/assets';
import { IS_MAC, isModClick } from '../../lib/platform';
import { cx } from '../../lib/cx';
import { pageTitle } from '../../components/PageIcon';
import { fuzzyFilter } from '../../lib/fuzzy';
import { useDatabases } from '../../store/databases';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { reportError } from '../../store/toast';
import { OptionTag } from './OptionTag';
import { computeRows } from './query';
import { SelectPopover } from './SelectPopover';
import { useCanEdit } from '../collab/sources';

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
function Cell({ property, value, onChange, variant }: CellProps) {
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
    case 'relation':
      return <RelationCell property={property} value={value} onChange={onChange} variant={variant} />;
    case 'rollup':
    case 'formula':
      return <ComputedCell value={value} variant={variant} />;
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
        title={IS_MAC ? '⌘-Klick öffnet den Link' : 'Strg-Klick öffnet den Link'}
        onClick={(e) => {
          if (!isModClick(e)) return;
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

function ComputedCell({ value, variant }: { value: CellValue; variant: CellProps['variant'] }) {
  const text = value === null ? '' : typeof value === 'boolean' ? (value ? '✓' : '') : typeof value === 'number' ? numberFormat.format(value) : String(value);
  if (variant === 'card') return text ? <div className="truncate text-xs text-muted">{text}</div> : null;
  return (
    <div className={cx(shell(variant), typeof value === 'number' && 'justify-end tabular-nums', text.startsWith('#Fehler') && 'text-danger')} title={text}>
      <span className="truncate">{text || (variant === 'panel' ? <span className="text-faint">Leer</span> : null)}</span>
    </div>
  );
}

function RelationCell({ property, value, onChange, variant }: CellProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const pages = usePages((s) => s.pages);
  const ids = (Array.isArray(value) ? value : []).filter((id) => pages[id] && pages[id].deletedAt === null);
  const chips = (
    <span className={cx('flex min-w-0 gap-1', variant === 'card' ? 'flex-wrap' : 'overflow-hidden')}>
      {ids.map((id) => (
        <span
          key={id}
          onClick={(e) => {
            e.stopPropagation();
            useUI.getState().open(id);
          }}
          className="truncate rounded-sm px-1 text-sm underline decoration-border-strong underline-offset-2 hover:bg-hover"
        >
          {pageTitle(pages[id])}
        </span>
      ))}
    </span>
  );
  if (variant === 'card') return ids.length ? chips : null;
  return (
    <>
      <div role="button" tabIndex={0} onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())} className={shell(variant)}>
        {ids.length ? chips : variant === 'panel' ? <span className="text-faint">Leer</span> : null}
      </div>
      {anchor && (
        <Popover anchor={anchor} onClose={close}>
          <RelationPicker property={property} selected={ids} onChange={onChange} />
        </Popover>
      )}
    </>
  );
}

function RelationPicker({ property, selected, onChange }: { property: Property; selected: string[]; onChange: (v: CellValue) => void }) {
  const [query, setQuery] = useState('');
  const target = property.config.targetDatabaseId;
  const rowIds = usePages((s) => (target ? s.children.get(target) : undefined));
  const pages = usePages((s) => s.pages);
  if (!target || !pages[target]) {
    return <div className="w-[260px] p-3 text-xs text-muted">Bitte zuerst in den Property-Einstellungen eine Ziel-Datenbank wählen.</div>;
  }
  const rows = fuzzyFilter((rowIds ?? []).map((id) => pages[id]), query, (p) => [p.title]).slice(0, 50);
  return (
    <div className="w-[280px] p-1">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`In „${pageTitle(pages[target])}“ suchen …`}
        className="mb-1 h-8 w-full rounded-md bg-bg px-2 text-sm outline-none placeholder:text-faint"
      />
      <div className="max-h-[260px] overflow-y-auto">
        {rows.length === 0 && <div className="px-2 py-1.5 text-xs text-faint">Keine Einträge</div>}
        {rows.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(selected.includes(p.id) ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-hover"
          >
            <span className="flex-1 truncate">{pageTitle(p)}</span>
            {selected.includes(p.id) && <Check size={14} className="text-accent" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Wert einer berechneten Property für einen einzelnen Eintrag. */
function useComputedValue(databaseId: string, rowId: string, property: Property): CellValue {
  const all = useDatabases((s) => s.data);
  const page = usePages((s) => s.pages[rowId]);
  const pages = usePages((s) => s.pages);
  return useMemo(() => {
    const data = all[databaseId];
    if (!data || !page) return null;
    const [row] = computeRows(
      [{ id: rowId, title: page.title, sortOrder: 0, createdAt: 0, values: data.values[rowId] ?? {} }],
      data.properties,
      { databases: all, titleOf: (id) => pages[id]?.title ?? '' },
    );
    return row.values[property.id] ?? null;
  }, [all, databaseId, rowId, page, pages, property.id]);
}

function ComputedBoundCell({ databaseId, rowId, property, variant }: { databaseId: string; rowId: string; property: Property; variant: CellProps['variant'] }) {
  return <ComputedCell value={useComputedValue(databaseId, rowId, property)} variant={variant} />;
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
  if (COMPUTED_TYPES.includes(property.type)) {
    return <ComputedBoundCell databaseId={databaseId} rowId={rowId} property={property} variant={variant} />;
  }
  return <StoredCell databaseId={databaseId} rowId={rowId} property={property} variant={variant} />;
}

function StoredCell({ databaseId, rowId, property, variant }: { databaseId: string; rowId: string; property: Property; variant: CellProps['variant'] }) {
  const value = useDatabases((s) => s.data[databaseId]?.values[rowId]?.[property.id] ?? null);
  const editable = useCanEdit(databaseId);
  const cell = (
    <Cell
      property={property}
      value={value}
      variant={variant}
      onChange={(next) => useDatabases.getState().setValue(databaseId, rowId, property.id, next)}
    />
  );
  // Nur lesen: Wert anzeigen, aber keine Bearbeitung öffnen.
  return editable ? cell : <div className="pointer-events-none contents">{cell}</div>;
}
