import type { JSONContent } from '@tiptap/core';
import { APP_NAME } from '../../app.config';

const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const h = (level: number, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const li = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content: [p(...content)] });
const kbd = (t: string) => text(t, [{ type: 'code' }]);

/** Inhalt der Willkommensseite beim allerersten Start. */
export function welcomeDoc(): JSONContent {
  return {
    type: 'doc',
    content: [
      p(text(`${APP_NAME} speichert alles lokal auf deinem Mac. Kein Konto, keine Cloud, kein Speichern-Knopf.`)),
      h(2, 'Erste Schritte'),
      {
        type: 'bulletList',
        content: [
          li(kbd('⌘N'), text(' legt eine neue Seite an, '), kbd('⇧⌘N'), text(' eine Unterseite.')),
          li(text('Seiten in der Seitenleiste per Drag-and-drop sortieren und verschachteln.')),
          li(kbd('⌘\\'), text(' blendet die Seitenleiste ein und aus.')),
          li(text('Gelöschte Seiten landen im Papierkorb und lassen sich wiederherstellen.')),
        ],
      },
      p(text('Diese Seite kannst du einfach löschen, wenn du sie nicht mehr brauchst.', [{ type: 'italic' }])),
    ],
  };
}
