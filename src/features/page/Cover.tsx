import { ImageIcon, Trash2 } from 'lucide-react';
import type { PageMeta } from '../../db/pages';
import { assetUrl, pickImage } from '../../lib/assets';
import { usePages } from '../../store/pages';
import { reportError } from '../../store/toast';
import { cx } from '../../lib/cx';
import { useCanEdit } from '../collab/sources';

export async function chooseCover(pageId: string): Promise<void> {
  try {
    const name = await pickImage();
    if (name) usePages.getState().update(pageId, { cover: name });
  } catch (err) {
    reportError('Titelbild konnte nicht gesetzt werden', err);
  }
}

export function Cover({ page }: { page: PageMeta }) {
  const editable = useCanEdit(page.id);
  if (!page.cover) return null;
  return (
    <div className="group relative h-[30vh] max-h-[280px] min-h-[160px] w-full overflow-hidden bg-hover">
      <img src={assetUrl(page.cover)} alt="" draggable={false} className="h-full w-full object-cover" />
      <div className={cx('absolute right-4 bottom-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100', !editable && 'hidden')}>
        <button
          onClick={() => void chooseCover(page.id)}
          className="flex h-7 items-center gap-1.5 rounded-md bg-surface/90 px-2 text-xs text-muted shadow-popover hover:text-text"
        >
          <ImageIcon size={13} /> Ändern
        </button>
        <button
          onClick={() => usePages.getState().update(page.id, { cover: null })}
          className="flex h-7 items-center gap-1.5 rounded-md bg-surface/90 px-2 text-xs text-muted shadow-popover hover:text-text"
        >
          <Trash2 size={13} /> Entfernen
        </button>
      </div>
    </div>
  );
}
