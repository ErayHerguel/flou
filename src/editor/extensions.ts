import { Extension, type Extensions } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { DragHandle } from './dragHandle';
import { ImageInput } from './imageInput';
import { LinkClick } from './linkClick';
import { Callout } from './nodes/callout';
import { CodeBlock } from './nodes/codeBlock';
import { Column, Columns } from './nodes/columns';
import { Comment } from './nodes/comment';
import { DatabaseBlock } from './nodes/databaseBlock';
import { FileBlock } from './nodes/file';
import { Image } from './nodes/image';
import { PageLink } from './nodes/pageLink';
import { PageRef } from './nodes/pageRef';
import { Toggle } from './nodes/toggle';
import { PageLinkSuggestion, SlashCommand } from './suggest/extensions';

interface ToolbarStorage {
  openLink: (() => void) | null;
  openComment: (() => void) | null;
}

declare module '@tiptap/core' {
  interface Storage {
    toolbar: ToolbarStorage;
  }
}

/** Verbindet ⇧⌘K mit der Link-Eingabe der schwebenden Leiste. */
const ToolbarShortcuts = Extension.create<object, ToolbarStorage>({
  name: 'toolbar',
  addStorage: () => ({ openLink: null, openComment: null }),
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => {
        if (this.editor.state.selection.empty || !this.storage.openComment) return false;
        this.storage.openComment();
        return true;
      },
      'Mod-Shift-k': () => {
        if (this.editor.state.selection.empty || !this.storage.openLink) return false;
        this.storage.openLink();
        return true;
      },
    };
  },
});

export function createExtensions(pageId: string): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      undoRedo: { depth: 500, newGroupDelay: 400 },
      link: { openOnClick: false, autolink: true, linkOnPaste: true },
      heading: { levels: [1, 2, 3] },
      dropcursor: { color: 'var(--c-accent)', width: 2 },
    }),
    CodeBlock,
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    Callout,
    Toggle,
    Image,
    FileBlock,
    Table.configure({ resizable: true, lastColumnResizable: false, cellMinWidth: 80 }),
    TableRow,
    TableHeader,
    TableCell,
    Columns,
    Column,
    Comment,
    DatabaseBlock,
    PageRef,
    PageLink,
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading' ? `Überschrift ${node.attrs.level}` : 'Tippe „/“ für Befehle oder „[[“ für Seitenlinks …',
    }),
    SlashCommand.configure({ pageId }),
    PageLinkSuggestion.configure({ pageId }),
    DragHandle,
    ImageInput,
    LinkClick,
    ToolbarShortcuts,
  ];
}
