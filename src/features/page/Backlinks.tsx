import { ArrowUpLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { loadBacklinks } from '../../db/links';
import { useSaveStatus } from '../../db/saveQueue';
import { usePages } from '../../store/pages';
import { reportError } from '../../store/toast';
import { useUI } from '../../store/ui';

/** Liste aller Seiten, die per [[Link]] auf diese Seite verweisen. */
export function Backlinks({ pageId }: { pageId: string }) {
  const [ids, setIds] = useState<string[]>([]);
  const status = useSaveStatus((s) => s.status);
  const pages = usePages((s) => s.pages);

  useEffect(() => {
    if (status !== 'idle') return;
    let alive = true;
    loadBacklinks(pageId)
      .then((result) => alive && setIds(result))
      .catch((err) => reportError('Backlinks konnten nicht geladen werden', err));
    return () => {
      alive = false;
    };
  }, [pageId, status]);

  const live = ids.filter((id) => pages[id] && pages[id].deletedAt === null);
  if (live.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-faint">
        <ArrowUpLeft size={13} />
        {live.length === 1 ? '1 Seite verweist hierher' : `${live.length} Seiten verweisen hierher`}
      </h3>
      <div className="flex flex-col">
        {live.map((id) => (
          <button
            key={id}
            onClick={() => useUI.getState().open(id)}
            className="-mx-2 flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted hover:bg-hover hover:text-text"
          >
            <PageIcon page={pages[id]} size={15} />
            <span className="truncate">{pageTitle(pages[id])}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
