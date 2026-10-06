import type { Editor, Range } from '@tiptap/core';
import {
  AlertCircle,
  ChevronRight,
  Code2,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { pickImage } from '../../lib/assets';
import { reportError } from '../../store/toast';
import { createSubpageBlock } from './subpage';

export interface SlashContext {
  pageId: string;
}

export interface SlashItem {
  id: string;
  title: string;
  description: string;
  group: 'Grundblöcke' | 'Medien' | 'Seiten';
  keywords: string[];
  icon: LucideIcon;
  run(editor: Editor, range: Range, ctx: SlashContext): void;
}

const block = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Normaler Absatz',
    group: 'Grundblöcke',
    keywords: ['absatz', 'paragraph', 'text', 'plain'],
    icon: Type,
    run: (editor, range) => block(editor, range).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map<SlashItem>((level) => ({
    id: `h${level}`,
    title: `Überschrift ${level}`,
    description: ['Große', 'Mittlere', 'Kleine'][level - 1] + ' Abschnittsüberschrift',
    group: 'Grundblöcke',
    keywords: [`h${level}`, 'heading', 'titel', '#'.repeat(level)],
    icon: [Heading1, Heading2, Heading3][level - 1],
    run: (editor, range) => block(editor, range).setNode('heading', { level }).run(),
  })),
  {
    id: 'bullet',
    title: 'Aufzählung',
    description: 'Einfache Liste mit Punkten',
    group: 'Grundblöcke',
    keywords: ['liste', 'bullet', 'ul', 'punkte'],
    icon: List,
    run: (editor, range) => block(editor, range).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    title: 'Nummerierte Liste',
    description: 'Liste mit Zahlen',
    group: 'Grundblöcke',
    keywords: ['nummer', 'ordered', 'ol', 'zahlen'],
    icon: ListOrdered,
    run: (editor, range) => block(editor, range).toggleOrderedList().run(),
  },
  {
    id: 'todo',
    title: 'To-do-Liste',
    description: 'Aufgaben zum Abhaken',
    group: 'Grundblöcke',
    keywords: ['todo', 'aufgabe', 'checkbox', 'task', 'check'],
    icon: ListChecks,
    run: (editor, range) => block(editor, range).toggleTaskList().run(),
  },
  {
    id: 'toggle',
    title: 'Toggle',
    description: 'Aufklappbarer Inhalt',
    group: 'Grundblöcke',
    keywords: ['aufklappen', 'details', 'collapse', 'toggle'],
    icon: ChevronRight,
    run: (editor, range) => block(editor, range).setParagraph().wrapIn('toggle').run(),
  },
  {
    id: 'quote',
    title: 'Zitat',
    description: 'Hervorgehobenes Zitat',
    group: 'Grundblöcke',
    keywords: ['quote', 'blockquote', 'zitat', '>'],
    icon: Quote,
    run: (editor, range) => block(editor, range).setParagraph().setBlockquote().run(),
  },
  {
    id: 'callout',
    title: 'Callout',
    description: 'Hinweis mit Icon',
    group: 'Grundblöcke',
    keywords: ['hinweis', 'callout', 'info', 'box', 'warnung'],
    icon: AlertCircle,
    run: (editor, range) => block(editor, range).setParagraph().wrapIn('callout').run(),
  },
  {
    id: 'code',
    title: 'Code',
    description: 'Codeblock mit Syntax-Highlighting',
    group: 'Grundblöcke',
    keywords: ['code', 'snippet', 'programm', '```'],
    icon: Code2,
    run: (editor, range) => block(editor, range).setCodeBlock().run(),
  },
  {
    id: 'divider',
    title: 'Trenner',
    description: 'Horizontale Linie',
    group: 'Grundblöcke',
    keywords: ['linie', 'divider', 'hr', 'trennlinie', '---'],
    icon: Minus,
    run: (editor, range) => block(editor, range).setHorizontalRule().run(),
  },
  {
    id: 'image',
    title: 'Bild',
    description: 'Bild von deinem Mac einfügen',
    group: 'Medien',
    keywords: ['bild', 'image', 'foto', 'picture', 'png', 'jpg'],
    icon: ImageIcon,
    run: (editor, range) => {
      block(editor, range).run();
      pickImage()
        .then((src) => {
          if (src) editor.chain().focus().insertContent({ type: 'image', attrs: { src } }).run();
        })
        .catch((err) => reportError('Bild konnte nicht eingefügt werden', err));
    },
  },
  {
    id: 'subpage',
    title: 'Unterseite',
    description: 'Neue Seite innerhalb dieser Seite',
    group: 'Seiten',
    keywords: ['seite', 'page', 'unterseite', 'subpage'],
    icon: FileText,
    run: (editor, range, ctx) => void createSubpageBlock(editor, range, ctx.pageId, 'page'),
  },
  {
    id: 'pageLink',
    title: 'Seitenlink',
    description: 'Auf eine andere Seite verweisen',
    group: 'Seiten',
    keywords: ['link', 'verweis', 'mention', '[['],
    icon: Link2,
    run: (editor, range) => block(editor, range).insertContent('[[').run(),
  },
];
