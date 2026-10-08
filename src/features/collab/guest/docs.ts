import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { decodeBinary, encodeBinary, type DocSnapshot } from '../protocol';
import { useCollab, type CollabUser, type DocBinding } from '../sources';
import { connection } from './connection';

/** Herkunft von Änderungen, die vom Gastgeber kommen (werden nicht zurückgeschickt). */
const REMOTE = Symbol('remote');

/**
 * Gemeinsames Seiten-Dokument als Gast: ein eigenes Y.Doc, das mit dem Gastgeber abgeglichen wird.
 * Nach einer Unterbrechung werden die eigenen Änderungen nachgereicht.
 */
export async function guestDoc(pageId: string, user: CollabUser): Promise<DocBinding> {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  let session: string | null = null;

  const apply = (snapshot: DocSnapshot) => {
    Y.applyUpdate(doc, decodeBinary(snapshot.update), REMOTE);
    if (snapshot.awareness) applyAwarenessUpdate(awareness, decodeBinary(snapshot.awareness), REMOTE);
  };

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE) connection.send({ t: 'doc.update', pageId, update: encodeBinary(update) });
  });
  awareness.on('update', ({ added, updated, removed }: Record<'added' | 'updated' | 'removed', number[]>, origin: unknown) => {
    if (origin === REMOTE) return;
    const changed = [...added, ...updated, ...removed].filter((id) => id === doc.clientID);
    if (changed.length) connection.send({ t: 'doc.awareness', pageId, update: encodeBinary(encodeAwarenessUpdate(awareness, changed)) });
  });

  const offMessages = connection.listen((message) => {
    if (message.t === 'doc.update' && message.pageId === pageId) Y.applyUpdate(doc, decodeBinary(message.update), REMOTE);
    else if (message.t === 'doc.awareness' && message.pageId === pageId) applyAwarenessUpdate(awareness, decodeBinary(message.update), REMOTE);
  });

  const offOpen = connection.onOpen(() => {
    connection
      .request<DocSnapshot>({ op: 'doc.open', pageId, clientId: doc.clientID })
      .then((snapshot) => {
        if (snapshot.session !== session) {
          // Der Gastgeber hat das Dokument neu aufgebaut: alle Editoren neu verbinden.
          useCollab.setState((s) => ({ epoch: s.epoch + 1 }));
          return;
        }
        apply(snapshot);
        const missing = Y.encodeStateAsUpdate(doc, decodeBinary(snapshot.sv));
        connection.send({ t: 'doc.update', pageId, update: encodeBinary(missing) });
        const local = awareness.getLocalState();
        if (local) awareness.setLocalState(local);
      })
      .catch((err) => console.error('Seite nach dem Neuverbinden', err));
  });

  try {
    const snapshot = await connection.request<DocSnapshot>({ op: 'doc.open', pageId, clientId: doc.clientID });
    session = snapshot.session;
    apply(snapshot);
  } catch (err) {
    offMessages();
    offOpen();
    doc.destroy();
    throw err;
  }

  let released = false;
  return {
    doc,
    awareness,
    user,
    release() {
      if (released) return;
      released = true;
      offMessages();
      offOpen();
      removeAwarenessStates(awareness, [doc.clientID], 'release');
      connection.send({ t: 'leave', kind: 'doc', id: pageId });
      awareness.destroy();
      doc.destroy();
    },
  };
}
