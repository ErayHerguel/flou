import { useState } from 'react';
import { pageTitle } from '../../components/PageIcon';
import { cx } from '../../lib/cx';
import { usePages } from '../../store/pages';

interface RowTitleProps {
  rowId: string;
  /** Von außen gewünschte Bearbeitung, z. B. direkt nach "Neu". */
  editing: boolean;
  onEditingDone: () => void;
  className?: string;
}

/** Titel eines Datenbank-Eintrags; Klick bearbeitet ihn direkt. */
export function RowTitle({ rowId, editing, onEditingDone, className }: RowTitleProps) {
  const page = usePages((s) => s.pages[rowId]);
  const [localEditing, setLocalEditing] = useState(false);
  if (!page) return null;
  const active = editing || localEditing;

  if (active) {
    const done = () => {
      setLocalEditing(false);
      onEditingDone();
    };
    return (
      <input
        autoFocus
        value={page.title}
        placeholder="Ohne Titel"
        onChange={(e) => usePages.getState().update(rowId, { title: e.target.value })}
        onBlur={done}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' || e.key === 'Escape') done();
        }}
        className={cx('h-8 min-w-0 bg-bg px-2 text-sm font-medium text-text outline-none ring-2 ring-accent-soft', className)}
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setLocalEditing(true);
      }}
      className={cx('flex h-8 min-w-0 items-center px-2 text-left text-sm font-medium', !page.title && 'text-faint', className)}
    >
      <span className="truncate">{page.icon ? `${page.icon} ` : ''}{pageTitle(page)}</span>
    </button>
  );
}
