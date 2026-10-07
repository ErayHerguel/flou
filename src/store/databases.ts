import { create } from 'zustand';
import {
  deleteProperty,
  deleteView,
  emptyConfig,
  insertProperty,
  insertView,
  loadSchema,
  loadValues,
  setSearchProps,
  setValue,
  TAG_COLORS,
  updateProperty,
  updateView,
  type CellValue,
  type Property,
  type PropertyType,
  type View,
  type ViewType,
} from '../db/database';
import type { Statement } from '../db/driver';
import { commit, schedule } from '../db/saveQueue';
import { convertProperty, valueText } from '../features/database/query';
import { newId } from '../lib/ids';
import { usePages } from './pages';
import { reportError } from './toast';

export interface DatabaseData {
  properties: Property[];
  views: View[];
  /** Eintrag → Property → Wert */
  values: Record<string, Record<string, CellValue>>;
}

export const PROPERTY_LABEL: Record<PropertyType, string> = {
  text: 'Text',
  number: 'Zahl',
  select: 'Auswahl',
  multi_select: 'Mehrfachauswahl',
  date: 'Datum',
  checkbox: 'Checkbox',
  url: 'URL',
  relation: 'Relation',
  rollup: 'Rollup',
  formula: 'Formel',
};

export const VIEW_LABEL: Record<ViewType, string> = {
  table: 'Tabelle',
  board: 'Board',
  calendar: 'Kalender',
  gallery: 'Galerie',
  list: 'Liste',
};

const titleOf = (pageId: string) => usePages.getState().pages[pageId]?.title ?? '';

/** Suchtext aller gespeicherten Werte eines Eintrags. */
export function rowSearchText(data: Pick<DatabaseData, 'properties' | 'values'>, rowId: string): string {
  return data.properties
    .map((p) => valueText(p, data.values[rowId]?.[p.id], titleOf))
    .filter(Boolean)
    .join(' ');
}

/** Standard-Schema einer neuen Datenbank: Status, Tags, Datum sowie Tabellen- und Board-Ansicht. */
function defaultSchema(databaseId: string): Pick<DatabaseData, 'properties' | 'views'> {
  const status: Property = {
    id: newId(),
    databaseId,
    name: 'Status',
    type: 'select',
    sortOrder: 0,
    config: {},
    options: [
      { id: newId(), name: 'Offen', color: 'gray' },
      { id: newId(), name: 'In Arbeit', color: 'blue' },
      { id: newId(), name: 'Erledigt', color: 'green' },
    ],
  };
  const tags: Property = { id: newId(), databaseId, name: 'Tags', type: 'multi_select', options: [], config: {}, sortOrder: 1 };
  const date: Property = { id: newId(), databaseId, name: 'Datum', type: 'date', options: [], config: {}, sortOrder: 2 };
  return {
    properties: [status, tags, date],
    views: [
      { id: newId(), databaseId, name: VIEW_LABEL.table, type: 'table', config: emptyConfig(), sortOrder: 0 },
      { id: newId(), databaseId, name: VIEW_LABEL.board, type: 'board', config: { ...emptyConfig(), groupBy: status.id }, sortOrder: 1 },
    ],
  };
}

interface DatabasesState {
  data: Record<string, DatabaseData>;
  load(databaseId: string): Promise<void>;
  createDatabase(parentId: string | null): Promise<string>;
  createRow(databaseId: string, initial?: Record<string, CellValue>, index?: number): Promise<string>;
  setValue(databaseId: string, rowId: string, propertyId: string, value: CellValue): void;
  addProperty(databaseId: string, type: PropertyType): Promise<string>;
  /** Name und Optionen ändern (gebündelt gespeichert). */
  updateProperty(property: Property): void;
  changePropertyType(property: Property, type: PropertyType): Promise<void>;
  /** Entfernt eine Auswahloption und alle Werte, die auf sie zeigen. */
  deleteOption(property: Property, optionId: string): Promise<void>;
  deleteProperty(property: Property): Promise<void>;
  addView(databaseId: string, type: ViewType): Promise<string>;
  updateView(view: View): void;
  deleteView(view: View): Promise<void>;
}

export const useDatabases = create<DatabasesState>((set, get) => {
  /** Hält die Werte-Spalte der Volltextsuche für die genannten Einträge aktuell (gebündelt gespeichert). */
  const reindex = (databaseId: string, rowIds: string[]) => {
    for (const rowId of rowIds) {
      schedule(`props:${rowId}`, () => {
        const data = get().data[databaseId];
        return data ? [setSearchProps(rowId, rowSearchText(data, rowId))] : [];
      });
    }
  };

  const patch = (databaseId: string, fn: (d: DatabaseData) => DatabaseData) =>
    set((s) => (s.data[databaseId] ? { data: { ...s.data, [databaseId]: fn(s.data[databaseId]) } } : s));

  async function mutate(databaseId: string, fn: (d: DatabaseData) => DatabaseData, statements: Statement[], context: string) {
    const previous = get().data[databaseId];
    patch(databaseId, fn);
    try {
      await commit(statements);
    } catch (err) {
      if (previous) set((s) => ({ data: { ...s.data, [databaseId]: previous } }));
      reportError(context, err);
      throw err;
    }
  }

  return {
    data: {},

    async load(databaseId) {
      const [schema, values] = await Promise.all([loadSchema(databaseId), loadValues(databaseId)]);
      set((s) => ({ data: { ...s.data, [databaseId]: { ...schema, values } } }));
    },

    async createDatabase(parentId) {
      let schema: Pick<DatabaseData, 'properties' | 'views'> | null = null;
      const id = await usePages.getState().create({
        parentId,
        type: 'database',
        extra: (page) => {
          schema = defaultSchema(page.id);
          return [...schema.properties.map(insertProperty), ...schema.views.map(insertView)];
        },
      });
      if (schema) set((s) => ({ data: { ...s.data, [id]: { ...schema!, values: {} } } }));
      return id;
    },

    async createRow(databaseId, initial = {}, index) {
      const id = await usePages.getState().create({
        parentId: databaseId,
        index,
        extra: (page) => Object.entries(initial).map(([propertyId, value]) => setValue(page.id, propertyId, value)),
      });
      patch(databaseId, (d) => ({ ...d, values: { ...d.values, [id]: { ...initial } } }));
      reindex(databaseId, [id]);
      return id;
    },

    setValue(databaseId, rowId, propertyId, value) {
      patch(databaseId, (d) => ({ ...d, values: { ...d.values, [rowId]: { ...d.values[rowId], [propertyId]: value } } }));
      schedule(`value:${rowId}:${propertyId}`, () => {
        const current = get().data[databaseId]?.values[rowId]?.[propertyId] ?? null;
        return [setValue(rowId, propertyId, current)];
      });
      reindex(databaseId, [rowId]);
    },

    async addProperty(databaseId, type) {
      const data = get().data[databaseId];
      const property: Property = {
        id: newId(),
        databaseId,
        name: PROPERTY_LABEL[type],
        type,
        options: [],
        config: type === 'rollup' ? { aggregate: 'count' } : {},
        sortOrder: data ? Math.max(-1, ...data.properties.map((p) => p.sortOrder)) + 1 : 0,
      };
      await mutate(databaseId, (d) => ({ ...d, properties: [...d.properties, property] }), [insertProperty(property)], 'Property anlegen');
      return property.id;
    },

    updateProperty(property) {
      patch(property.databaseId, (d) => ({ ...d, properties: d.properties.map((p) => (p.id === property.id ? property : p)) }));
      reindex(property.databaseId, Object.keys(get().data[property.databaseId]?.values ?? {}));
      schedule(`property:${property.id}`, () => {
        const current = get().data[property.databaseId]?.properties.find((p) => p.id === property.id);
        return current ? [updateProperty(current)] : [];
      });
    },

    async changePropertyType(property, type) {
      const data = get().data[property.databaseId];
      if (!data || property.type === type) return;
      const before: Record<string, CellValue> = {};
      for (const [rowId, row] of Object.entries(data.values)) if (row[property.id] !== undefined) before[rowId] = row[property.id];
      const converted = convertProperty(property, type, before);
      const statements: Statement[] = [
        updateProperty(converted.property),
        ...Object.keys(before).map((rowId) => setValue(rowId, property.id, converted.values[rowId] ?? null)),
      ];
      await mutate(
        property.databaseId,
        (d) => {
          const values = { ...d.values };
          for (const rowId of Object.keys(before)) {
            const row = { ...values[rowId] };
            if (converted.values[rowId] === undefined) delete row[property.id];
            else row[property.id] = converted.values[rowId];
            values[rowId] = row;
          }
          return { ...d, values, properties: d.properties.map((p) => (p.id === property.id ? converted.property : p)) };
        },
        statements,
        'Typ ändern',
      );
      reindex(property.databaseId, Object.keys(before));
    },

    async deleteOption(property, optionId) {
      const data = get().data[property.databaseId];
      if (!data) return;
      const next: Property = { ...property, options: property.options.filter((o) => o.id !== optionId) };
      const changed: Record<string, CellValue> = {};
      for (const [rowId, row] of Object.entries(data.values)) {
        const value = row[property.id];
        if (value === optionId) changed[rowId] = null;
        else if (Array.isArray(value) && value.includes(optionId)) changed[rowId] = value.filter((id) => id !== optionId);
      }
      await mutate(
        property.databaseId,
        (d) => {
          const values = { ...d.values };
          for (const [rowId, value] of Object.entries(changed)) values[rowId] = { ...values[rowId], [property.id]: value };
          return { ...d, values, properties: d.properties.map((p) => (p.id === property.id ? next : p)) };
        },
        [updateProperty(next), ...Object.entries(changed).map(([rowId, value]) => setValue(rowId, property.id, value))],
        'Option löschen',
      );
      reindex(property.databaseId, Object.keys(changed));
    },

    async deleteProperty(property) {
      const data = get().data[property.databaseId];
      if (!data) return;
      // Filter, Sortierungen und Gruppierungen auf die Property entfernen und mitspeichern.
      const touched: View[] = [];
      const views = data.views.map((v) => {
        const config = {
          ...v.config,
          filters: v.config.filters.filter((f) => f.propertyId !== property.id),
          sorts: v.config.sorts.filter((s) => s.propertyId !== property.id),
          hidden: v.config.hidden.filter((id) => id !== property.id),
          groupBy: v.config.groupBy === property.id ? null : v.config.groupBy,
        };
        const changed =
          config.filters.length !== v.config.filters.length ||
          config.sorts.length !== v.config.sorts.length ||
          config.hidden.length !== v.config.hidden.length ||
          config.groupBy !== v.config.groupBy;
        if (!changed) return v;
        const next = { ...v, config };
        touched.push(next);
        return next;
      });
      await mutate(
        property.databaseId,
        (d) => ({ ...d, views, properties: d.properties.filter((p) => p.id !== property.id) }),
        [deleteProperty(property.id), ...touched.map(updateView)],
        'Property löschen',
      );
      reindex(property.databaseId, Object.keys(data.values));
    },

    async addView(databaseId, type) {
      const data = get().data[databaseId];
      const groupBy = type === 'board' ? (data?.properties.find((p) => p.type === 'select')?.id ?? null) : null;
      const dateBy = type === 'calendar' ? (data?.properties.find((p) => p.type === 'date')?.id ?? null) : null;
      const view: View = {
        id: newId(),
        databaseId,
        name: VIEW_LABEL[type],
        type,
        config: { ...emptyConfig(), groupBy, dateBy },
        sortOrder: data ? Math.max(-1, ...data.views.map((v) => v.sortOrder)) + 1 : 0,
      };
      await mutate(databaseId, (d) => ({ ...d, views: [...d.views, view] }), [insertView(view)], 'Ansicht anlegen');
      return view.id;
    },

    updateView(view) {
      patch(view.databaseId, (d) => ({ ...d, views: d.views.map((v) => (v.id === view.id ? view : v)) }));
      schedule(`view:${view.id}`, () => {
        const current = get().data[view.databaseId]?.views.find((v) => v.id === view.id);
        return current ? [updateView(current)] : [];
      });
    },

    async deleteView(view) {
      const data = get().data[view.databaseId];
      if (!data || data.views.length <= 1) return;
      await mutate(view.databaseId, (d) => ({ ...d, views: d.views.filter((v) => v.id !== view.id) }), [deleteView(view.id)], 'Ansicht löschen');
    },
  };
});

/** Nächste freie Farbe für eine neue Option. */
export const nextColor = (count: number) => TAG_COLORS[count % TAG_COLORS.length];
