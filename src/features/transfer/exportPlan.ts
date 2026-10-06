import type { JSONContent } from '@tiptap/core';
import type { CellValue, Property } from '../../db/database';
import type { PageMeta } from '../../db/pages';
import { escapeText, toMarkdown } from '../../lib/markdown/serialize';
import type { ChildIndex, PageMap } from '../../lib/tree';

export interface ExportInput {
  pages: PageMap;
  /** Kinder-Index der nicht gelöschten Seiten */
  children: ChildIndex;
  docs: Record<string, JSONContent | null>;
  databases: Record<string, { properties: Property[]; values: Record<string, Record<string, CellValue>> }>;
}

export interface ExportPlan {
  files: { path: string; content: string }[];
  /** Bilder aus dem App-Ordner, die an `path` (relativ zum Exportziel) kopiert werden */
  assets: { name: string; path: string }[];
}

/** Dateiname ohne verbotene Zeichen, nie leer, höchstens 100 Zeichen. */
export function sanitizeName(title: string): string {
  const cleaned = title
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return (cleaned || 'Ohne Titel').slice(0, 100).trim();
}

const dirname = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** Relativer, URL-kodierter Link von einem Ordner zu einer Datei. */
export function relativeHref(fromDir: string, toFile: string): string {
  const from = fromDir ? fromDir.split('/') : [];
  const to = toFile.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].map(encodeURIComponent).join('/');
}

function formatValue(property: Property, value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  const name = (id: unknown) => property.options.find((o) => o.id === id)?.name ?? '';
  switch (property.type) {
    case 'select':
      return name(value);
    case 'multi_select':
      return (value as string[]).map(name).filter(Boolean).join(', ');
    case 'checkbox':
      return value === true ? '✓' : '';
    default:
      return String(value);
  }
}

/** Tabellenzelle: Markdown maskieren (inklusive "|"), Zeilenumbrüche entfernen. */
const cell = (text: string) => escapeText(text).replace(/\n/g, ' ');

function frontMatter(properties: Property[], values: Record<string, CellValue>): string {
  const lines = properties
    .filter((p) => values[p.id] !== undefined && values[p.id] !== null)
    .map((p) => {
      const value = values[p.id];
      if (p.type === 'multi_select') return `${JSON.stringify(p.name)}: ${JSON.stringify(formatValue(p, value).split(', ').filter(Boolean))}`;
      if (p.type === 'number' || p.type === 'checkbox') return `${JSON.stringify(p.name)}: ${String(value)}`;
      return `${JSON.stringify(p.name)}: ${JSON.stringify(formatValue(p, value))}`;
    });
  return lines.length ? `---\n${lines.join('\n')}\n---\n\n` : '';
}

/**
 * Plant den Markdown-Export: jede Seite wird zu "Titel.md", Unterseiten liegen im Ordner "Titel/",
 * Bilder in "assets/". Links zwischen exportierten Seiten werden zu relativen Markdown-Links.
 */
export function planExport(rootIds: string[], input: ExportInput): ExportPlan {
  const { pages, children, docs, databases } = input;
  const paths = new Map<string, string>();

  const assign = (ids: string[], dir: string) => {
    const used = new Set<string>();
    for (const id of ids) {
      const page = pages[id];
      if (!page || page.deletedAt !== null) continue;
      const base = sanitizeName(page.title);
      let name = base;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})`;
      used.add(name.toLowerCase());
      paths.set(id, dir ? `${dir}/${name}.md` : `${name}.md`);
      const kids = children.get(id) ?? [];
      if (kids.length) assign(kids, dir ? `${dir}/${name}` : name);
    }
  };
  assign(rootIds, '');

  const assets = new Map<string, string>();
  const files: ExportPlan['files'] = [];

  for (const [id, file] of paths) {
    const page = pages[id] as PageMeta;
    const dir = dirname(file);
    const up = dir ? '../'.repeat(dir.split('/').length) : '';
    const assetHref = (name: string) => {
      assets.set(name, `assets/${name}`);
      return `${up}assets/${name}`;
    };
    const ctx = {
      page: (pageId: string) => {
        const target = paths.get(pageId);
        return { title: pages[pageId]?.title.trim() || 'Ohne Titel', href: target ? relativeHref(dir, target) : null };
      },
      asset: assetHref,
    };

    let content = '';
    const parent = page.parentId ? pages[page.parentId] : undefined;
    if (parent?.type === 'database' && databases[parent.id]) {
      const db = databases[parent.id];
      content += frontMatter(db.properties, db.values[id] ?? {});
    }
    content += `# ${escapeText(page.title.trim() || 'Ohne Titel')}\n\n`;
    if (page.cover) content += `![](${assetHref(page.cover)})\n\n`;

    if (page.type === 'database') {
      const db = databases[id];
      const rows = children.get(id) ?? [];
      const props = db?.properties ?? [];
      content += `| Name | ${props.map((p) => cell(p.name)).join(' | ')} |\n`;
      content += `| --- |${props.map(() => ' --- |').join('')}\n`;
      for (const rowId of rows) {
        const link = ctx.page(rowId);
        const name = link.href ? `[${cell(link.title)}](${link.href})` : cell(link.title);
        content += `| ${name} | ${props.map((p) => cell(formatValue(p, db?.values[rowId]?.[p.id]))).join(' | ')} |\n`;
      }
    } else {
      const doc = docs[id];
      if (doc) content += toMarkdown(doc, ctx);
    }
    files.push({ path: file, content: content.replace(/\n+$/, '\n') });
  }

  return { files, assets: [...assets].map(([name, path]) => ({ name, path })) };
}
