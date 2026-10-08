import type { JSONContent } from '@tiptap/core';
import { insertBoard, loadBoard, saveBoard, sceneText, type StoredScene } from '../db/boards';
import { loadDocs, saveContent } from '../db/content';
import {
  insertProperty,
  insertView,
  loadSchema,
  loadValues,
  setSearchProps,
  setValue,
  type CellValue,
  type Property,
  type View,
} from '../db/database';
import type { Statement } from '../db/driver';
import { insertPage, type PageMeta } from '../db/pages';
import { flush } from '../db/saveQueue';
import { collectLinkTargets, jsonText } from '../lib/doc';
import { newId } from '../lib/ids';
import { buildChildIndex, type PageMap } from '../lib/tree';
import { rowSearchText } from '../store/databases';
import { usePages } from '../store/pages';

/** Ersetzt Verweise (Seitenlinks, Unterseiten, eingebettete Boards und Datenbanken) auf kopierte Seiten. */
export function remapDoc(doc: JSONContent, ids: ReadonlyMap<string, string>): JSONContent {
  const walk = (node: JSONContent): JSONContent => {
    let attrs = node.attrs;
    for (const key of ['pageId', 'databaseId']) {
      const value = attrs?.[key];
      if (typeof value === 'string' && ids.has(value)) attrs = { ...attrs, [key]: ids.get(value) };
    }
    return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content: node.content.map(walk) } : {}) };
  };
  return walk(doc);
}

interface SourceDatabase {
  properties: Property[];
  views: View[];
  values: Record<string, Record<string, CellValue>>;
}

/** Schema, Ansichten und Werte einer Datenbank mit neuen IDs. Verweise innerhalb der Kopie zeigen auf die Kopie. */
export function remapDatabase(
  source: SourceDatabase,
  ids: ReadonlyMap<string, string>,
  props: ReadonlyMap<string, string>,
): SourceDatabase {
  const page = (id: string) => ids.get(id) ?? id;
  const prop = (id: string) => props.get(id) ?? id;
  const optional = (id: string | null) => (id === null ? null : prop(id));
  const properties = source.properties.map((p) => ({
    ...p,
    id: prop(p.id),
    databaseId: page(p.databaseId),
    config: {
      ...p.config,
      ...(p.config.targetDatabaseId ? { targetDatabaseId: page(p.config.targetDatabaseId) } : {}),
      ...(p.config.relationPropertyId ? { relationPropertyId: prop(p.config.relationPropertyId) } : {}),
      ...(p.config.targetPropertyId ? { targetPropertyId: prop(p.config.targetPropertyId) } : {}),
    },
  }));
  const views = source.views.map((v) => ({
    ...v,
    id: newId(),
    databaseId: page(v.databaseId),
    config: {
      ...v.config,
      filters: v.config.filters.map((f) => ({ ...f, id: newId(), propertyId: prop(f.propertyId) })),
      sorts: v.config.sorts.map((s) => ({ ...s, propertyId: prop(s.propertyId) })),
      hidden: v.config.hidden.map(prop),
      widths: Object.fromEntries(Object.entries(v.config.widths).map(([id, w]) => [prop(id), w])),
      groupBy: optional(v.config.groupBy),
      dateBy: optional(v.config.dateBy),
    },
  }));
  const relations = new Set(source.properties.filter((p) => p.type === 'relation').map((p) => p.id));
  const values: SourceDatabase['values'] = {};
  for (const [rowId, row] of Object.entries(source.values)) {
    const copy: Record<string, CellValue> = {};
    for (const [propertyId, value] of Object.entries(row)) {
      copy[prop(propertyId)] = relations.has(propertyId) && Array.isArray(value) ? value.map(page) : value;
    }
    values[page(rowId)] = copy;
  }
  return { properties, views, values };
}

export interface DuplicateOptions {
  /** Ziel; ohne Angabe neben dem Original */
  parentId?: string | null;
  index?: number;
  /** Titel der Kopie; ohne Angabe „… (Kopie)“ */
  title?: string;
}

/**
 * Kopiert eine Seite samt Unterseiten: Inhalte, Boards und Datenbanken mit Einträgen und Werten.
 * Alles in einer Transaktion. Liefert die ID der Kopie.
 */
export async function duplicatePage(id: string, options: DuplicateOptions = {}): Promise<string> {
  await flush();
  const { pages, children } = usePages.getState();
  const root = pages[id];
  if (!root) throw new Error('Seite nicht gefunden');

  // Teilbaum in Breitensuche (Eltern vor Kindern), ohne Papierkorb.
  const order: PageMeta[] = [];
  const queue = [root];
  while (queue.length) {
    const page = queue.shift()!;
    order.push(page);
    for (const child of children.get(page.id) ?? []) if (pages[child]?.deletedAt === null) queue.push(pages[child]);
  }

  const ids = new Map(order.map((p) => [p.id, newId()]));
  // Erst alles laden, dann in einer einzigen Transaktion schreiben: entweder die ganze Kopie oder nichts.
  const docs = await loadDocs(order.filter((p) => p.type === 'page').map((p) => p.id));
  const scenes = new Map<string, StoredScene>();
  const databases = new Map<string, SourceDatabase>();
  for (const page of order) {
    if (page.type === 'board') scenes.set(page.id, await loadBoard(page.id));
    if (page.type === 'database') {
      const [schema, values] = await Promise.all([loadSchema(page.id), loadValues(page.id)]);
      databases.set(page.id, { ...schema, values });
    }
  }
  const props = new Map([...databases.values()].flatMap((d) => d.properties.map((p) => [p.id, newId()] as const)));

  const parentId = options.parentId !== undefined ? options.parentId : root.parentId;
  const siblings = children.get(parentId) ?? [];
  const index = options.index ?? (root.parentId === parentId ? siblings.indexOf(id) + 1 : siblings.length);
  const now = Date.now();
  const copies: PageMeta[] = [];

  const copyId = await usePages.getState().create({
    parentId,
    type: root.type,
    title: options.title ?? `${root.title || 'Ohne Titel'} (Kopie)`,
    icon: root.icon,
    index,
    extra: (copy) => {
      ids.set(root.id, copy.id);
      const statements: Statement[] = [];
      for (const page of order.slice(1)) {
        const meta: PageMeta = { ...page, id: ids.get(page.id)!, parentId: ids.get(page.parentId!)!, createdAt: now, updatedAt: now };
        copies.push(meta);
        statements.push(insertPage(meta));
      }
      for (const page of order) {
        const target = ids.get(page.id)!;
        const doc = docs[page.id];
        if (doc) {
          const json = remapDoc(doc, ids);
          statements.push(...saveContent(target, json, jsonText(json), collectLinkTargets(json, target), now));
        }
        const scene = scenes.get(page.id);
        if (scene) statements.push(insertBoard(target, now), ...saveBoard(target, scene, sceneText(scene.elements), now));
        const source = databases.get(page.id);
        if (source) {
          const db = remapDatabase(source, ids, props);
          statements.push(...db.properties.map(insertProperty), ...db.views.map(insertView));
          for (const [rowId, row] of Object.entries(db.values)) {
            for (const [propertyId, value] of Object.entries(row)) statements.push(setValue(rowId, propertyId, value));
            statements.push(setSearchProps(rowId, rowSearchText(db, rowId)));
          }
        }
      }
      return statements;
    },
  });

  // Unterseiten in den Seitenbaum übernehmen (sie sind bereits gespeichert).
  const merged: PageMap = { ...usePages.getState().pages };
  for (const copy of copies) merged[copy.id] = copy;
  usePages.setState({ pages: merged, children: buildChildIndex(merged) });
  return copyId;
}
