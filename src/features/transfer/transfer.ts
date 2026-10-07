import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { APP_NAME } from '../../app.config';
import { loadDocs, saveContent } from '../../db/content';
import { loadSchema, loadValues } from '../../db/database';
import { insertPage, type PageMeta } from '../../db/pages';
import { commit, flush } from '../../db/saveQueue';
import { importImageFile } from '../../lib/assets';
import { collectLinkTargets, jsonText } from '../../lib/doc';
import { newId } from '../../lib/ids';
import { descendantIds } from '../../lib/tree';
import { usePages } from '../../store/pages';
import { reportError, toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { planExport, sanitizeName, type ExportInput } from './exportPlan';
import { planImport, resolveImages, type InFile } from './importPlan';

async function exportPages(rootIds: string[], targetDir: string): Promise<void> {
  await flush();
  const { pages, children } = usePages.getState();
  const ids = [...new Set(rootIds.flatMap((id) => [id, ...descendantIds(pages, id)]))].filter((id) => pages[id]?.deletedAt === null);
  const databases: ExportInput['databases'] = {};
  for (const id of ids.filter((pid) => pages[pid].type === 'database')) {
    const [schema, values] = await Promise.all([loadSchema(id), loadValues(id)]);
    databases[id] = { properties: schema.properties, values };
  }
  const plan = planExport(rootIds, { pages, children, docs: await loadDocs(ids), databases });
  await invoke('export_write', { root: targetDir, files: plan.files, assets: plan.assets });
  toast(`${plan.files.length} ${plan.files.length === 1 ? 'Seite' : 'Seiten'} exportiert`);
  await invoke('reveal_path', { path: `${targetDir}/${plan.files[0]?.path ?? ''}` });
}

const pickFolder = (title: string) => open({ directory: true, multiple: false, title }) as Promise<string | null>;

export async function exportCurrentPage(): Promise<void> {
  const id = useUI.getState().currentId;
  if (!id) return;
  try {
    const dir = await pickFolder('Zielordner für den Export wählen');
    if (dir) await exportPages([id], dir);
  } catch (err) {
    reportError('Export fehlgeschlagen', err);
  }
}

export async function exportWorkspace(): Promise<void> {
  try {
    const dir = await pickFolder('Zielordner für den Workspace-Export wählen');
    if (!dir) return;
    const roots = usePages.getState().children.get(null) ?? [];
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
    await exportPages(roots, `${dir}/${sanitizeName(`${APP_NAME} Export ${stamp}`)}`);
  } catch (err) {
    reportError('Export fehlgeschlagen', err);
  }
}

/** Importiert Markdown-Dateien als Seiten, alles in einer Transaktion. */
export async function importEntries(files: InFile[], containerTitle: string | null): Promise<void> {
  if (files.length === 0) {
    toast('Keine Markdown-Dateien gefunden');
    return;
  }
  await flush();
  const { pages, children } = usePages.getState();
  const existing = new Map<string, string>();
  for (const page of Object.values(pages)) if (page.deletedAt === null) existing.set(page.title.trim().toLowerCase(), page.id);

  const plan = planImport(files, newId, existing);
  // Bilder nacheinander importieren (schont die Platte bei großen Ordnern)
  const imported: (string | null)[] = [];
  for (const path of plan.images) imported.push(await importImageFile(path).catch(() => null));

  const now = Date.now();
  const containerId = containerTitle ? newId() : null;
  const rootSiblings = children.get(null)?.length ?? 0;
  const order = new Map<string | null, number>();
  const next = (parent: string | null) => {
    const value = order.get(parent) ?? 0;
    order.set(parent, value + 1);
    return value;
  };
  const meta = (id: string, parentId: string | null, title: string, sortOrder: number): PageMeta => ({
    id,
    parentId,
    type: 'page',
    title,
    icon: null,
    cover: null,
    fullWidth: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  const inserts = containerId ? [insertPage(meta(containerId, null, containerTitle!, rootSiblings))] : [];
  const contents = [];
  const idByKey = new Map(plan.nodes.map((n) => [n.key, n.id]));
  for (const node of plan.nodes) {
    const parentId = node.parentKey ? idByKey.get(node.parentKey)! : containerId;
    const sortOrder = parentId === null ? rootSiblings + next(null) : next(parentId);
    inserts.push(insertPage(meta(node.id, parentId, node.title, sortOrder)));
    if (node.doc) {
      const doc = resolveImages(node.doc, imported);
      contents.push(...saveContent(node.id, doc, jsonText(doc), collectLinkTargets(doc, node.id), now));
    }
  }
  // Erst alle Seiten, dann Inhalte: Links zwischen importierten Seiten finden ihr Ziel.
  await commit([...inserts, ...contents]);
  await usePages.getState().load();
  const first = containerId ?? plan.nodes.find((n) => n.parentKey === null)?.id;
  if (first) useUI.getState().open(first);
  const failed = imported.filter((name) => name === null).length;
  toast(`${plan.nodes.length} ${plan.nodes.length === 1 ? 'Seite' : 'Seiten'} importiert${failed ? `, ${failed} Bilder fehlten` : ''}`);
}

export async function importMarkdownFiles(): Promise<void> {
  try {
    const selected = await open({ multiple: true, directory: false, filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (paths.length === 0) return;
    await importEntries(await invoke<InFile[]>('import_read', { paths }), null);
  } catch (err) {
    reportError('Import fehlgeschlagen', err);
  }
}

export async function importFolder(): Promise<void> {
  try {
    const dir = await pickFolder('Ordner mit Markdown-Dateien wählen');
    if (!dir) return;
    const name = dir.split(/[\\/]/).filter(Boolean).pop() ?? 'Import';
    await importEntries(await invoke<InFile[]>('import_read', { paths: [dir] }), name);
  } catch (err) {
    reportError('Import fehlgeschlagen', err);
  }
}

export async function backupNow(): Promise<void> {
  try {
    await flush();
    const path = await invoke<string>('backup_now');
    toast('Backup erstellt');
    await invoke('reveal_path', { path });
  } catch (err) {
    reportError('Backup fehlgeschlagen', err);
  }
}

