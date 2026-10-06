import { Editor } from '../../editor/Editor';
import { DatabaseView } from '../database/DatabaseView';
import { PropertiesPanel } from '../database/PropertiesPanel';
import { cx } from '../../lib/cx';
import { usePages } from '../../store/pages';
import { Backlinks } from './Backlinks';
import { Cover } from './Cover';
import { PageHeader } from './PageHeader';

export function PageView({ id }: { id: string }) {
  const page = usePages((s) => s.pages[id]);
  const parentType = usePages((s) => (page?.parentId ? s.pages[page.parentId]?.type : undefined));
  if (!page || page.deletedAt !== null) return null;
  const isDatabase = page.type === 'database';
  const width = page.fullWidth
    ? 'max-w-none'
    : isDatabase
      ? 'max-w-[calc(var(--container-wide)+7rem)]'
      : 'max-w-[calc(var(--container-content)+7rem)]';

  return (
    <div className="h-full overflow-y-auto" data-scroll-container>
      <Cover page={page} />
      <div className={cx('mx-auto w-full px-14', isDatabase ? 'pb-24' : 'pb-[40vh]', width)}>
        <PageHeader page={page} />
        {isDatabase ? (
          <DatabaseView databaseId={id} />
        ) : (
          <>
            {parentType === 'database' && page.parentId && <PropertiesPanel databaseId={page.parentId} rowId={id} />}
            <div className="mt-4">
              <Editor key={id} pageId={id} />
            </div>
          </>
        )}
        <Backlinks pageId={id} />
      </div>
    </div>
  );
}
