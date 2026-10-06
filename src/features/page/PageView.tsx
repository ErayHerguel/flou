import { Editor } from '../../editor/Editor';
import { cx } from '../../lib/cx';
import { usePages } from '../../store/pages';
import { Backlinks } from './Backlinks';
import { Cover } from './Cover';
import { PageHeader } from './PageHeader';

export function PageView({ id }: { id: string }) {
  const page = usePages((s) => s.pages[id]);
  if (!page || page.deletedAt !== null) return null;

  return (
    <div className="h-full overflow-y-auto" data-scroll-container>
      <Cover page={page} />
      <div className={cx('mx-auto w-full px-14 pb-[40vh]', page.fullWidth ? 'max-w-none' : 'max-w-[calc(var(--container-content)+7rem)]')}>
        <PageHeader page={page} />
        <div className="mt-4">
          <Editor key={id} pageId={id} />
        </div>
        <Backlinks pageId={id} />
      </div>
    </div>
  );
}
