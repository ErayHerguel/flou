import { Database, FileText, Shapes } from 'lucide-react';
import type { PageMeta } from '../db/pages';

/** Emoji der Seite oder ein neutrales Standard-Icon. */
export function PageIcon({ page, size = 16 }: { page: Pick<PageMeta, 'icon' | 'type'>; size?: number }) {
  if (page.icon) {
    return (
      <span className="inline-flex shrink-0 items-center justify-center leading-none" style={{ fontSize: size, width: size + 2 }}>
        {page.icon}
      </span>
    );
  }
  const Icon = page.type === 'database' ? Database : page.type === 'board' ? Shapes : FileText;
  return <Icon size={size} className="shrink-0 text-faint" strokeWidth={1.75} />;
}

export const pageTitle = (page: Pick<PageMeta, 'title'> | undefined): string => page?.title.trim() || 'Ohne Titel';
