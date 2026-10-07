import { History, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { listVersions, loadVersion, type VersionInfo } from '../../db/content';
import { flush } from '../../db/saveQueue';
import { getActiveEditor } from '../../editor/active';
import { cx } from '../../lib/cx';
import { confirmDialog } from '../../store/confirm';
import { reportError, toast } from '../../store/toast';
import { useUI } from '../../store/ui';

const format = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Frühere Stände der Seite (höchstens einer je 10 Minuten, die letzten 50). */
export function VersionsDialog() {
  const pageId = useUI((s) => s.currentId);
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [selected, setSelected] = useState<VersionInfo | null>(null);
  const close = () => useUI.getState().setOverlay(null);

  useEffect(() => {
    if (!pageId) return;
    flush()
      .then(() => listVersions(pageId))
      .then((list) => {
        setVersions(list);
        setSelected(list[0] ?? null);
      })
      .catch((err) => reportError('Versionen konnten nicht geladen werden', err));
  }, [pageId]);

  const restore = async () => {
    const editor = getActiveEditor();
    if (!selected || !editor) return;
    const ok = await confirmDialog({
      title: 'Version wiederherstellen?',
      message: `Der Inhalt wird auf den Stand vom ${format.format(selected.createdAt)} gesetzt. Mit ⌘Z lässt sich das rückgängig machen.`,
      confirmLabel: 'Wiederherstellen',
    });
    if (!ok) return;
    try {
      editor.commands.setContent(await loadVersion(selected.id), { emitUpdate: true });
      close();
      toast('Version wiederhergestellt');
    } catch (err) {
      reportError('Wiederherstellen fehlgeschlagen', err);
    }
  };

  return (
    <Modal onClose={close} className="flex h-[70vh] w-[820px]">
      <div className="flex w-[260px] shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
          <History size={15} /> Versionsverlauf
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {versions?.length === 0 && <div className="p-3 text-xs text-faint">Noch keine Versionen. Sie entstehen beim Bearbeiten, höchstens eine je 10 Minuten.</div>}
          {versions?.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className={cx('flex w-full flex-col rounded-md px-3 py-2 text-left', selected?.id === v.id ? 'bg-active' : 'hover:bg-hover')}
            >
              <span className="text-sm">{format.format(v.createdAt)}</span>
              <span className="truncate text-xs text-faint">{v.text.split('\n').find(Boolean) ?? 'Leer'}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm whitespace-pre-wrap text-muted">{selected?.text || ''}</div>
        <div className="flex justify-end gap-2 border-t border-border p-3">
          <button onClick={close} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-hover">
            Schließen
          </button>
          <button
            disabled={!selected || !getActiveEditor()}
            onClick={() => void restore()}
            className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-40"
          >
            <RotateCcw size={14} /> Wiederherstellen
          </button>
        </div>
      </div>
    </Modal>
  );
}
