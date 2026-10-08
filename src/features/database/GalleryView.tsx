import { ArrowUpRight, FileText, Plus } from 'lucide-react';
import type { View } from '../../db/database';
import { assetUrl } from '../../lib/assets';
import { cx } from '../../lib/cx';
import type { DatabaseData } from '../../store/databases';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { BoundCell } from './cells';
import type { Row } from './query';
import { RowTitle } from './RowTitle';

interface EntriesProps {
  databaseId: string;
  view: View;
  data: DatabaseData;
  rows: Row[];
  editingId: string | null;
  onEditingDone: () => void;
  onCreate: () => void;
}

const visibleProps = (data: DatabaseData, view: View) => data.properties.filter((p) => !view.config.hidden.includes(p.id));

function OpenButton({ id, className }: { id: string; className?: string }) {
  return (
    <button
      aria-label="Seite öffnen"
      title="Seite öffnen"
      onClick={() => useUI.getState().open(id)}
      className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted opacity-0 hover:bg-hover hover:text-text group-hover:opacity-100 focus-visible:opacity-100', className)}
    >
      <ArrowUpRight size={13} />
    </button>
  );
}

/** Karten im Raster, mit Titelbild der Seite. */
export function GalleryView({ databaseId, view, data, rows, editingId, onEditingDone, onCreate }: EntriesProps) {
  const pages = usePages((s) => s.pages);
  const props = visibleProps(data, view);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 pb-2">
      {rows.map((row) => {
        const cover = pages[row.id]?.cover;
        return (
          <div key={row.id} className="group relative overflow-hidden rounded-lg border border-border bg-bg">
            {cover ? (
              <img src={assetUrl(cover)} alt="" draggable={false} className="h-28 w-full object-cover" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-hover/60 text-faint">
                <FileText size={22} strokeWidth={1.5} />
              </div>
            )}
            <div className="flex flex-col gap-0.5 p-2">
              <RowTitle rowId={row.id} editing={editingId === row.id} onEditingDone={onEditingDone} className="-mx-2" />
              {props.map((p) => (
                <div key={p.id} className="-mx-2">
                  <BoundCell databaseId={databaseId} rowId={row.id} property={p} variant="card" />
                </div>
              ))}
            </div>
            <OpenButton id={row.id} className="absolute top-2 right-2 border border-border bg-surface" />
          </div>
        );
      })}
      <button onClick={onCreate} className="db-edit flex min-h-[160px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-sm text-faint hover:bg-hover hover:text-muted">
        <Plus size={14} /> Neu
      </button>
    </div>
  );
}

/** Kompakte Liste: Titel links, Werte rechts. */
export function ListView({ databaseId, view, data, rows, editingId, onEditingDone, onCreate }: EntriesProps) {
  const pages = usePages((s) => s.pages);
  const props = visibleProps(data, view);
  return (
    <div className="flex flex-col pb-2">
      {rows.map((row) => (
        <div key={row.id} className="group flex min-h-9 items-center gap-2 border-b border-border">
          <span className="w-5 shrink-0 text-center">{pages[row.id]?.icon ?? <FileText size={15} className="inline text-faint" />}</span>
          <RowTitle rowId={row.id} editing={editingId === row.id} onEditingDone={onEditingDone} className="min-w-0 flex-1" />
          <div className="flex max-w-[60%] shrink-0 items-center gap-3 overflow-hidden">
            {props.map((p) => (
              <BoundCell key={p.id} databaseId={databaseId} rowId={row.id} property={p} variant="card" />
            ))}
          </div>
          <OpenButton id={row.id} />
        </div>
      ))}
      <button onClick={onCreate} className="db-edit flex h-8 w-full items-center gap-1.5 px-2 text-sm text-faint hover:bg-hover hover:text-muted">
        <Plus size={14} /> Neu
      </button>
    </div>
  );
}
