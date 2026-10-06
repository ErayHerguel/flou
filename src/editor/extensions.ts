import type { Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';

export function createExtensions(): Extensions {
  return [
    StarterKit.configure({
      undoRedo: { depth: 500, newGroupDelay: 400 },
      link: { openOnClick: false, autolink: true, linkOnPaste: true },
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? `Überschrift ${node.attrs.level}` : 'Schreib etwas …'),
    }),
  ];
}
