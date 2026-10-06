import { RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { trashRoots } from '../../lib/tree';
import { confirmDialog } from '../../store/confirm';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

export function TrashDialog() {
  const pages = usePages((s) => s.pages);
  const [query, setQuery] = useState('');
  const close = () => useUI.getState().setOverlay(null);
  const roots = useMemo(() => trashRoots(pages), [pages]);
  const visible = roots.filter((p) => pageTitle(p).toLowerCase().includes(query.trim().toLowerCase()));

  const restore = async (id: string) => {
    await usePages.getState().restore(id);
    useUI.getState().open(id);
    close();
  };

  const deleteForever = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Endgültig löschen?',
      message: `„${pageTitle(pages[id])}“ und alle Unterseiten werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (ok) await usePages.getState().deleteForever(id);
  };

  const emptyTrash = async () => {
    const ok = await confirmDialog({
      title: 'Papierkorb leeren?',
      message: `${roots.length} ${roots.length === 1 ? 'Seite wird' : 'Seiten werden'} samt Unterseiten dauerhaft gelöscht.`,
      confirmLabel: 'Papierkorb leeren',
      danger: true,
    });
    if (ok) await usePages.getState().emptyTrash();
  };

  return (
    <Modal onClose={close} className="flex max-h-[70vh] w-[520px] flex-col">
      <div className="border-b border-border p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Papierkorb durchsuchen …"
          className="h-8 w-full bg-transparent px-1 text-base outline-none placeholder:text-faint"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {visible.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-faint">{roots.length ? 'Keine Treffer' : 'Der Papierkorb ist leer'}</div>
        )}
        {visible.map((page) => (
          <div key={page.id} className="group flex h-10 items-center gap-2 rounded-md px-2 hover:bg-hover">
            <PageIcon page={page} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{pageTitle(page)}</div>
              <div className="text-2xs text-faint">Gelöscht am {dateFormat.format(page.deletedAt ?? 0)}</div>
            </div>
            <button
              onClick={() => void restore(page.id)}
              title="Wiederherstellen"
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-active hover:text-text"
            >
              <RotateCcw size={13} /> Wiederherstellen
            </button>
            <button
              onClick={() => void deleteForever(page.id)}
              title="Endgültig löschen"
              aria-label="Endgültig löschen"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-active hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      {roots.length > 0 && (
        <div className="flex justify-end border-t border-border p-2">
          <button onClick={() => void emptyTrash()} className="h-8 rounded-md px-3 text-sm text-danger hover:bg-hover">
            Papierkorb leeren
          </button>
        </div>
      )}
    </Modal>
  );
}
