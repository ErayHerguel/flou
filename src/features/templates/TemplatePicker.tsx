import { FileText, LayoutTemplate } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { usePages } from '../../store/pages';
import { reportError } from '../../store/toast';
import { useUI } from '../../store/ui';
import { specialId } from './special';
import { createFromTemplate, ensureTemplates, templateList } from './templates';

interface Target {
  parentId: string | null;
  /** Statt die neue Seite zu öffnen, z. B. einen Verweis im Editor einfügen */
  onCreated?: (id: string) => void;
}

let target: Target = { parentId: null };

/** Öffnet die Auswahl; beim ersten Mal entstehen die mitgelieferten Vorlagen. */
export function openTemplatePicker(next: Target = { parentId: null }): void {
  target = next;
  ensureTemplates()
    .then(() => useUI.getState().setOverlay('templates'))
    .catch((err) => reportError('Vorlagen konnten nicht geladen werden', err));
}

const KIND = { page: 'Seite', database: 'Datenbank', board: 'Board' } as const;

export function TemplatePicker() {
  usePages((s) => s.pages);
  const templates = templateList();
  const close = () => useUI.getState().setOverlay(null);

  const pick = async (id: string) => {
    close();
    try {
      const created = await createFromTemplate(id, target.parentId);
      if (target.onCreated) target.onCreated(created);
      else {
        if (target.parentId) useUI.getState().setExpanded(target.parentId, true);
        useUI.getState().open(created);
        useUI.getState().requestFocus('title');
      }
    } catch (err) {
      reportError('Seite aus Vorlage konnte nicht angelegt werden', err);
    }
  };

  const editTemplates = () => {
    const root = specialId('templates');
    close();
    if (root) useUI.getState().open(root);
  };

  return (
    <Modal onClose={close} className="flex max-h-[70vh] w-[560px] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <LayoutTemplate size={16} className="text-muted" />
        <h2 className="flex-1 text-sm font-semibold">Neu aus Vorlage</h2>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto p-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => void pick(t.id)}
            className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-left hover:bg-hover"
          >
            <PageIcon page={t} size={18} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{pageTitle(t)}</span>
              <span className="block text-2xs text-faint">{KIND[t.type]}</span>
            </span>
          </button>
        ))}
        {templates.length === 0 && (
          <p className="col-span-2 flex items-center gap-2 py-6 text-sm text-faint">
            <FileText size={15} /> Noch keine Vorlagen. Lege Seiten unter „Vorlagen“ an oder speichere eine Seite als Vorlage.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-2xs text-faint">
        <span>Jede Seite unter „Vorlagen“ ist eine Vorlage, auch Datenbanken und Boards.</span>
        <button onClick={editTemplates} className="h-7 rounded-md px-2 text-xs font-medium text-accent hover:bg-hover">
          Vorlagen bearbeiten
        </button>
      </div>
    </Modal>
  );
}
