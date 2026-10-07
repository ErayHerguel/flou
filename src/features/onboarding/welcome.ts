import type { JSONContent } from '@tiptap/core';
import { APP_NAME } from '../../app.config';
import { formatCombo } from '../shortcuts/keys';

const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const h = (level: number, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const li = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content: [p(...content)] });
const kbd = (t: string) => text(t, [{ type: 'code' }]);
/** Kürzel im Stil des Systems (⌘ auf dem Mac, Strg unter Windows). */
const key = (spec: string) => kbd(formatCombo(spec));
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
          li(key('Mod+K'), text(' öffnet die Befehlspalette: Seiten finden, Volltext durchsuchen, Aktionen ausführen.')),
          li(key('Mod+N'), text(' legt eine neue Seite an, '), key('Mod+Shift+N'), text(' eine Unterseite, '), key('Mod+Alt+N'), text(' eine Datenbank.')),
          li(key('Mod+/'), text(' zeigt alle Tastenkürzel.')),
          li(text('Seiten in der Seitenleiste per Drag-and-drop sortieren und verschachteln.')),
          li(key('Mod+\\'), text(' blendet die Seitenleiste ein und aus.')),
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
          todo(false, text('Blöcke am Greifer links verschieben oder mit '), key('Mod+Shift+ArrowUp'), text(' / '), key('Mod+Shift+ArrowDown')),
        ],
      },
      {
        type: 'toggle',
        attrs: { open: false },
        content: [
          p(text('Text markieren für Formatierungen', [{ type: 'bold' }])),
          p(text('Fett, kursiv, durchgestrichen, '), text('Code', [{ type: 'code' }]), text(', '), text('Hervorhebung', [{ type: 'highlight' }]), text(' und Links. Mit gedrückter Befehlstaste (Mac) bzw. Strg (Windows) öffnet ein Klick einen Link im Browser.')),
        ],
      },
      h(2, 'Deine Daten'),
      p(
        text('Jede Seite lässt sich als Markdown exportieren ('),
        key('Mod+Shift+E'),
        text('), ebenso der ganze Workspace. Markdown-Dateien und -Ordner kannst du importieren. Einmal täglich legt die App ein Backup an und behält die letzten sieben.'),
      ),
      {
        type: 'callout',
        attrs: { icon: '💡' },
        content: [p(text('Diese Seite kannst du einfach löschen, wenn du sie nicht mehr brauchst.'))],
      },
    ],
  };
}
