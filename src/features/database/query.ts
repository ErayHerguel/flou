import {
  isEmptyValue,
  TAG_COLORS,
  TITLE_PROPERTY,
  type CellValue,
  type Filter,
  type FilterOperator,
  type Property,
  type PropertyType,
  type SelectOption,
  type Sort,
  type ViewConfig,
} from '../../db/database';
import { newId } from '../../lib/ids';

export interface Row {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: number;
  values: Record<string, CellValue>;
}

type FilterType = PropertyType | 'title';

export const OPERATORS: Record<FilterType, FilterOperator[]> = {
  title: ['contains', 'not_contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  text: ['contains', 'not_contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  url: ['contains', 'not_contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  number: ['is', 'is_not', 'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty'],
  select: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  multi_select: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  date: ['is', 'before', 'after', 'is_empty', 'is_not_empty'],
  checkbox: ['is_checked', 'is_unchecked'],
};

export const OPERATOR_LABEL: Record<FilterOperator, string> = {
  contains: 'enthält',
  not_contains: 'enthält nicht',
  is: 'ist',
  is_not: 'ist nicht',
  is_empty: 'ist leer',
  is_not_empty: 'ist nicht leer',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  before: 'vor',
  after: 'nach',
  is_checked: 'ist abgehakt',
  is_unchecked: 'ist nicht abgehakt',
};

/** Operatoren ohne Vergleichswert. */
export const UNARY: FilterOperator[] = ['is_empty', 'is_not_empty', 'is_checked', 'is_unchecked'];

export const filterType = (propertyId: string, props: Map<string, Property>): FilterType =>
  propertyId === TITLE_PROPERTY ? 'title' : (props.get(propertyId)?.type ?? 'text');

const valueOf = (row: Row, propertyId: string): CellValue =>
  propertyId === TITLE_PROPERTY ? row.title : (row.values[propertyId] ?? null);

export function matchesFilter(row: Row, filter: Filter, type: FilterType): boolean {
  const v = valueOf(row, filter.propertyId);
  const op = filter.operator;
  if (op === 'is_empty') return isEmptyValue(v);
  if (op === 'is_not_empty') return !isEmptyValue(v);
  if (op === 'is_checked') return v === true;
  if (op === 'is_unchecked') return v !== true;
  // Unvollständige Filter (noch kein Vergleichswert) schränken nicht ein.
  if (isEmptyValue(filter.value)) return true;

  switch (type) {
    case 'title':
    case 'text':
    case 'url': {
      const s = String(v ?? '').toLocaleLowerCase('de');
      const q = String(filter.value).toLocaleLowerCase('de');
      if (op === 'contains') return s.includes(q);
      if (op === 'not_contains') return !s.includes(q);
      if (op === 'is') return s === q;
      if (op === 'is_not') return s !== q;
      return true;
    }
    case 'number': {
      const target = Number(filter.value);
      if (typeof v !== 'number') return op === 'is_not';
      if (op === 'is') return v === target;
      if (op === 'is_not') return v !== target;
      if (op === 'gt') return v > target;
      if (op === 'lt') return v < target;
      if (op === 'gte') return v >= target;
      if (op === 'lte') return v <= target;
      return true;
    }
    case 'select':
      return op === 'is' ? v === filter.value : v !== filter.value;
    case 'multi_select': {
      const list = Array.isArray(v) ? v : [];
      const has = list.includes(String(filter.value));
      return op === 'contains' ? has : !has;
    }
    case 'date': {
      if (typeof v !== 'string' || !v) return false;
      const target = String(filter.value);
      if (op === 'is') return v === target;
      if (op === 'before') return v < target;
      if (op === 'after') return v > target;
      return true;
    }
    default:
      return true;
  }
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

function compareValues(a: CellValue, b: CellValue, type: FilterType, prop: Property | undefined): number {
  const optionIndex = (id: unknown) => prop?.options.findIndex((o) => o.id === id) ?? -1;
  switch (type) {
    case 'number':
      return (a as number) - (b as number);
    case 'checkbox':
      return Number(a === true) - Number(b === true);
    case 'select':
      return optionIndex(a) - optionIndex(b);
    case 'multi_select': {
      const first = (v: CellValue) => Math.min(...(v as string[]).map(optionIndex));
      return first(a) - first(b);
    }
    default:
      return collator.compare(String(a), String(b));
  }
}

function compareRows(sorts: Sort[], props: Map<string, Property>) {
  return (a: Row, b: Row): number => {
    for (const sort of sorts) {
      const type = filterType(sort.propertyId, props);
      const va = valueOf(a, sort.propertyId);
      const vb = valueOf(b, sort.propertyId);
      // Leere Werte stehen immer am Ende, unabhängig von der Richtung.
      const ea = type === 'checkbox' ? false : isEmptyValue(va);
      const eb = type === 'checkbox' ? false : isEmptyValue(vb);
      if (ea !== eb) return ea ? 1 : -1;
      if (ea && eb) continue;
      const result = compareValues(va, vb, type, props.get(sort.propertyId));
      if (result !== 0) return sort.direction === 'asc' ? result : -result;
    }
    return a.sortOrder - b.sortOrder || a.createdAt - b.createdAt;
  };
}

const isKnown = (propertyId: string, props: Map<string, Property>) => propertyId === TITLE_PROPERTY || props.has(propertyId);

/** Wendet Filter (UND-verknüpft) und Sortierung einer Ansicht an. */
export function applyView(rows: Row[], properties: Property[], config: Pick<ViewConfig, 'filters' | 'sorts'>): Row[] {
  const props = new Map(properties.map((p) => [p.id, p]));
  const filters = config.filters.filter((f) => isKnown(f.propertyId, props));
  const sorts = config.sorts.filter((s) => isKnown(s.propertyId, props));
  return rows
    .filter((row) => filters.every((f) => matchesFilter(row, f, filterType(f.propertyId, props))))
    .sort(compareRows(sorts, props));
}

export interface Group {
  option: SelectOption | null;
  rows: Row[];
}

/** Spalten eines Boards: zuerst "ohne Wert", dann alle Optionen in ihrer Reihenfolge. */
export function groupRows(rows: Row[], prop: Property): Group[] {
  const groups: Group[] = [{ option: null, rows: [] }, ...prop.options.map((option) => ({ option, rows: [] as Row[] }))];
  const byId = new Map(groups.slice(1).map((g) => [g.option!.id, g]));
  for (const row of rows) (byId.get(String(row.values[prop.id])) ?? groups[0]).rows.push(row);
  return groups;
}

// ---------- Typumwandlung ----------

const TRUTHY = new Set(['ja', 'yes', 'true', 'x', '1', 'wahr', '✓']);

function optionFor(name: string, options: SelectOption[]): SelectOption {
  const existing = options.find((o) => o.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
  if (existing) return existing;
  const created: SelectOption = { id: newId(), name, color: TAG_COLORS[options.length % TAG_COLORS.length] };
  options.push(created);
  return created;
}

function asText(value: CellValue, prop: Property): string {
  if (value === null) return '';
  const name = (id: string) => prop.options.find((o) => o.id === id)?.name ?? '';
  if (prop.type === 'select') return name(String(value));
  if (prop.type === 'multi_select') return (value as string[]).map(name).filter(Boolean).join(', ');
  if (prop.type === 'checkbox') return value === true ? 'Ja' : '';
  return String(value);
}

/**
 * Wandelt eine Property samt aller Werte in einen neuen Typ um. Werte werden so weit wie
 * möglich übernommen (z. B. Text → Auswahl legt passende Optionen an).
 */
export function convertProperty(
  prop: Property,
  toType: PropertyType,
  values: Record<string, CellValue>,
): { property: Property; values: Record<string, CellValue> } {
  const keepOptions = (toType === 'select' || toType === 'multi_select') && (prop.type === 'select' || prop.type === 'multi_select');
  const options: SelectOption[] = keepOptions ? [...prop.options] : [];
  const converted: Record<string, CellValue> = {};

  for (const [rowId, value] of Object.entries(values)) {
    if (isEmptyValue(value)) continue;
    let next: CellValue = null;
    if (prop.type === 'select' && toType === 'multi_select') next = [String(value)];
    else if (prop.type === 'multi_select' && toType === 'select') next = (value as string[])[0] ?? null;
    else {
      const text = asText(value, prop).trim();
      switch (toType) {
        case 'text':
        case 'url':
          next = text || null;
          break;
        case 'number': {
          const n = Number(text.replace(/\s/g, '').replace(',', '.'));
          next = text && Number.isFinite(n) ? n : null;
          break;
        }
        case 'checkbox':
          next = typeof value === 'number' ? value !== 0 : TRUTHY.has(text.toLowerCase());
          break;
        case 'date':
          next = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
          break;
        case 'select':
          next = text ? optionFor(text, options).id : null;
          break;
        case 'multi_select': {
          const names = text.split(',').map((s) => s.trim()).filter(Boolean);
          next = names.length ? [...new Set(names.map((n) => optionFor(n, options).id))] : null;
          break;
        }
      }
    }
    if (!isEmptyValue(next)) converted[rowId] = next;
  }

  return { property: { ...prop, type: toType, options }, values: converted };
}
