import { useMemo } from 'react';
import type { DatabaseData } from '../../store/databases';
import { usePages } from '../../store/pages';
import type { Row } from './query';

const EMPTY: string[] = [];

/** Einträge einer Datenbank (lebende Unterseiten) mit ihren Werten. */
export function useRows(databaseId: string, data: DatabaseData | undefined): Row[] {
  const ids = usePages((s) => s.children.get(databaseId) ?? EMPTY);
  const pages = usePages((s) => s.pages);
  return useMemo(
    () =>
      ids.map((id) => {
        const page = pages[id];
        return { id, title: page.title, sortOrder: page.sortOrder, createdAt: page.createdAt, values: data?.values[id] ?? {} };
      }),
    [ids, pages, data?.values],
  );
}
