import { beforeEach, describe, expect, it } from 'vitest';
import { createBoard } from '../features/board/create';
import { usePages } from '../store/pages';
import { freshDatabase } from '../test/setup';
import { loadBoard, saveBoard, sceneText } from './boards';
import { flush } from './saveQueue';
import { searchPages } from './search';

let driver: Awaited<ReturnType<typeof freshDatabase>>;
beforeEach(async () => {
  driver = await freshDatabase();
});

describe('Boards', () => {
  it('legt Boards an, bleibt nach dem Neuladen ein Board und speichert Szenen', async () => {
    const id = await createBoard(null);
    await flush();
    await usePages.getState().load();
    expect(usePages.getState().pages[id].type).toBe('board');
    const elements = [
      { id: 'a', type: 'rectangle', isDeleted: false },
      { id: 'b', type: 'text', text: 'Brainstorming Lösungen', isDeleted: false },
      { id: 'c', type: 'text', text: 'gelöscht', isDeleted: true },
    ];
    await driver.tx(saveBoard(id, { elements, files: { f1: { asset: 'x.png', mimeType: 'image/png' } } }, sceneText(elements), 1));
    const scene = await loadBoard(id);
    expect(scene.elements).toHaveLength(3);
    expect(scene.files.f1.asset).toBe('x.png');
    expect((await searchPages('brainstorming')).map((h) => h.id)).toEqual([id]);
    expect(await searchPages('gelöscht')).toEqual([]);
  });

  it('löscht das Board mit der Seite', async () => {
    const id = await createBoard(null);
    await usePages.getState().trash(id);
    await usePages.getState().deleteForever(id);
    expect(await driver.select('SELECT * FROM boards')).toEqual([]);
  });
});
