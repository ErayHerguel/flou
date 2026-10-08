import { reportError } from '../../../store/toast';
import { uploadImage } from './uploads';
import type { BoardSnapshot } from '../protocol';
import type { BoardElement, BoardSource } from '../sources';
import { connection } from './connection';

/** Board als Gast: Änderungen gehen an den Gastgeber, der sie an alle verteilt. */
export const guestBoard: BoardSource = async (pageId, events) => {
  const snapshot = await connection.request<BoardSnapshot>({ op: 'board.open', pageId, subscribe: true });
  /** Eigene Änderungen, um sie nach einer Unterbrechung erneut zu senden (der Gastgeber nimmt nur Neueres). */
  const mine = new Map<string, BoardElement>();

  const offMessages = connection.listen((message) => {
    if (!('pageId' in message) || message.pageId !== pageId) return;
    if (message.t === 'board.update') events.elements(message.elements as BoardElement[]);
    else if (message.t === 'board.files') events.files(message.files);
    else if (message.t === 'board.pointer') events.pointer(message);
    else if (message.t === 'board.leave') events.leave(message.person);
  });

  const offOpen = connection.onOpen(() => {
    connection
      .request<BoardSnapshot>({ op: 'board.open', pageId, subscribe: true })
      .then((fresh) => {
        events.elements(fresh.elements as BoardElement[]);
        events.files(fresh.files);
        if (mine.size) connection.send({ t: 'board.update', pageId, elements: [...mine.values()] });
      })
      .catch((err) => console.error('Board nach dem Neuverbinden', err));
  });

  return {
    snapshot: { elements: snapshot.elements as BoardElement[], files: snapshot.files, background: snapshot.background },
    change(changed) {
      if (!changed.length) return;
      for (const e of changed) mine.set(e.id, e);
      connection.send({ t: 'board.update', pageId, elements: changed });
    },
    storeImage: uploadImage,
    addFiles(files) {
      connection.request({ op: 'board.files', pageId, files }).catch((err) => reportError('Bild konnte nicht geteilt werden', err));
    },
    pointer(x, y, tool, button) {
      connection.send({ t: 'board.pointer', pageId, x, y, tool, button });
    },
    release() {
      offMessages();
      offOpen();
      connection.send({ t: 'leave', kind: 'board', id: pageId });
    },
  };
};
