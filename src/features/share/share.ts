import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { loadDocs } from '../../db/content';
import { loadSchema, loadValues } from '../../db/database';
import { flush } from '../../db/saveQueue';
import { usePages } from '../../store/pages';
import { reportError, toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { planExport, type ExportInput } from '../transfer/exportPlan';

/** Druckdialog von macOS; dort lässt sich die Seite auch „Als PDF sichern“. */
export async function printPage(): Promise<void> {
  try {
    await flush();
    await invoke('print_page');
  } catch (err) {
    reportError('Drucken fehlgeschlagen', err);
  }
}

/** Kopiert die aktuelle Seite als Markdown. Links auf andere Seiten werden zu [[Titel]]. */
export async function copyPageMarkdown(): Promise<void> {
  const id = useUI.getState().currentId;
  if (!id) return;
  try {
    await flush();
    const { pages, children } = usePages.getState();
    const page = pages[id];
    const databases: ExportInput['databases'] = {};
    // Nur bei Datenbanken die Einträge einbeziehen (für die Tabelle), sonst bleibt die Seite allein.
    const scoped = new Map<string | null, string[]>();
    if (page.type === 'database') {
      scoped.set(id, children.get(id) ?? []);
      const [schema, values] = await Promise.all([loadSchema(id), loadValues(id)]);
      databases[id] = { properties: schema.properties, values };
    }
    if (page.parentId && pages[page.parentId]?.type === 'database') {
      const [schema, values] = await Promise.all([loadSchema(page.parentId), loadValues(page.parentId)]);
      databases[page.parentId] = { properties: schema.properties, values };
    }
    const plan = planExport([id], { pages, children: scoped, docs: await loadDocs([id]), databases });
    await writeText(plan.files[0]?.content ?? '');
    toast('Als Markdown kopiert');
  } catch (err) {
    reportError('Kopieren fehlgeschlagen', err);
  }
}
