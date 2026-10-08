import { insertBoard } from '../../db/boards';
import { usePages } from '../../store/pages';

/** Legt ein leeres Board an (als Unterseite von `parentId` oder auf oberster Ebene). */
export function createBoard(parentId: string | null): Promise<string> {
  return usePages.getState().create({ parentId, type: 'board', extra: (page) => [insertBoard(page.id, page.createdAt)] });
}
