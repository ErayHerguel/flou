import { loadBoard, saveBoard, sceneText, type StoredScene } from '../../db/boards';
import { flush, schedule } from '../../db/saveQueue';
import { importImageBlob } from '../../lib/assets';
import type { BoardElement, BoardSource } from '../collab/sources';
import { newer, ordered } from './elements';

/** Board ohne Zusammenarbeit: Änderungen werden direkt gebündelt in die Datenbank geschrieben. */
export const localBoard: BoardSource = async (pageId) => {
  const scene = await loadBoard(pageId);
  const elements = new Map(scene.elements.map((e) => [String(e.id), e as BoardElement]));
  let files = { ...scene.files };
  let background = scene.appState?.viewBackgroundColor ?? '#ffffff';
  const persist = () =>
    schedule(`board:${pageId}`, () => {
      const visible = ordered(elements.values()).filter((e) => !e.isDeleted);
      const stored: StoredScene = { elements: visible, files, appState: { viewBackgroundColor: background } };
      return saveBoard(pageId, stored, sceneText(visible), Date.now());
    });
  return {
    snapshot: { elements: ordered(elements.values()), files, background },
    change(changed, nextBackground) {
      for (const e of changed) if (newer(e, elements.get(e.id))) elements.set(e.id, e);
      background = nextBackground;
      persist();
    },
    storeImage: importImageBlob,
    addFiles(added) {
      files = { ...files, ...added };
      persist();
    },
    pointer: () => undefined,
    release: () => void flush(),
  };
};
