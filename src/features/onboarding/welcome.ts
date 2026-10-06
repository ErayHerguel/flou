import type { JSONContent } from '@tiptap/core';
import { APP_NAME } from '../../app.config';

const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const h = (level: number, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const li = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content: [p(...content)] });
const kbd = (t: string) => text(t, [{ type: 'code' }]);
const todo = (checked: boolean, ...content: JSONContent[]): JSONContent => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(...content)],
});

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
      h(2, 'Schreiben'),
      {
        type: 'taskList',
        content: [
          todo(true, text('Seite öffnen')),
          todo(false, text('Tippe '), kbd('/'), text(' für alle Blocktypen: Überschriften, Listen, Toggles, Code, Bilder …')),
          todo(false, text('Tippe '), kbd('[['), text(' und verlinke eine andere Seite. Verweise erscheinen dort unten als Backlinks.')),
          todo(false, text('Markdown funktioniert direkt: '), kbd('#'), text(', '), kbd('-'), text(', '), kbd('[]'), text(', '), kbd('>'), text(', '), kbd('```')),
          todo(false, text('Blöcke am Greifer links verschieben oder mit '), kbd('⇧⌘↑'), text(' / '), kbd('⇧⌘↓')),
        ],
      },
      {
        type: 'toggle',
        attrs: { open: false },
        content: [
          p(text('Text markieren für Formatierungen', [{ type: 'bold' }])),
          p(text('Fett, kursiv, durchgestrichen, '), text('Code', [{ type: 'code' }]), text(', '), text('Hervorhebung', [{ type: 'highlight' }]), text(' und Links. ⌘-Klick öffnet einen Link im Browser.')),
        ],
      },
      {
        type: 'callout',
        attrs: { icon: '💡' },
        content: [p(text('Diese Seite kannst du einfach löschen, wenn du sie nicht mehr brauchst.'))],
      },
    ],
  };
}
