import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, ExternalLink, Highlighter, Italic, Link2, Strikethrough, Underline, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { openExternal } from '../lib/assets';
import { cx } from '../lib/cx';
import { reportError } from '../store/toast';

interface MarkButton {
  mark: string;
  icon: LucideIcon;
  label: string;
  toggle: (editor: Editor) => boolean;
}

const MARKS: MarkButton[] = [
  { mark: 'bold', icon: Bold, label: 'Fett (⌘B)', toggle: (e) => e.chain().focus().toggleBold().run() },
  { mark: 'italic', icon: Italic, label: 'Kursiv (⌘I)', toggle: (e) => e.chain().focus().toggleItalic().run() },
  { mark: 'underline', icon: Underline, label: 'Unterstrichen (⌘U)', toggle: (e) => e.chain().focus().toggleUnderline().run() },
  { mark: 'strike', icon: Strikethrough, label: 'Durchgestrichen (⇧⌘S)', toggle: (e) => e.chain().focus().toggleStrike().run() },
  { mark: 'code', icon: Code, label: 'Code (⌘E)', toggle: (e) => e.chain().focus().toggleCode().run() },
  { mark: 'highlight', icon: Highlighter, label: 'Hervorheben (⇧⌘H)', toggle: (e) => e.chain().focus().toggleHighlight().run() },
];

type ShouldShow = NonNullable<React.ComponentProps<typeof BubbleMenu>['shouldShow']>;

const shouldShow: ShouldShow = ({ editor, state }) => {
  const { selection } = state;
  if (selection.empty || !editor.isEditable) return false;
  if (editor.isActive('codeBlock') || editor.isActive('image') || editor.isActive('pageRef')) return false;
  return state.doc.textBetween(selection.from, selection.to).length > 0;
};

/** Schwebende Leiste bei Textauswahl. ⇧⌘K öffnet direkt die Link-Eingabe. */
export function Toolbar({ editor }: { editor: Editor }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [linkMode, setLinkMode] = useState(false);
  const options = useMemo(() => ({ placement: 'top' as const, offset: 8, onHide: () => setLinkMode(false) }), []);

  useEffect(() => {
    const update = () => rerender();
    const openLink = () => setLinkMode(true);
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.storage.toolbar.openLink = openLink;
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.storage.toolbar.openLink = null;
    };
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      options={options}
      shouldShow={shouldShow}
      className="z-40"
    >
      <div className="flex items-center gap-0.5 rounded-lg bg-surface p-1 shadow-popover">
        {linkMode ? (
          <LinkInput editor={editor} onDone={() => setLinkMode(false)} />
        ) : (
          <>
            {MARKS.map(({ mark, icon: Icon, label, toggle }) => (
              <button
                key={mark}
                title={label}
                aria-label={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(editor)}
                className={cx(
                  'flex h-7 w-7 items-center justify-center rounded-md hover:bg-hover',
                  editor.isActive(mark) ? 'text-accent' : 'text-muted',
                )}
              >
                <Icon size={15} />
              </button>
            ))}
            <div className="mx-0.5 h-5 w-px bg-border" />
            <button
              title="Link (⇧⌘K)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setLinkMode(true)}
              className={cx(
                'flex h-7 items-center gap-1 rounded-md px-2 text-sm hover:bg-hover',
                editor.isActive('link') ? 'text-accent' : 'text-muted',
              )}
            >
              <Link2 size={15} /> Link
            </button>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function LinkInput({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const existing = String(editor.getAttributes('link').href ?? '');
  const [value, setValue] = useState(existing);

  const apply = () => {
    const href = value.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!href) chain.unsetLink().run();
    else chain.setLink({ href: /^[a-z]+:/i.test(href) ? href : `https://${href}` }).run();
    onDone();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
            editor.commands.focus();
          }
        }}
        placeholder="Link einfügen …"
        className="h-7 w-[240px] rounded-md bg-bg px-2 text-sm outline-none placeholder:text-faint"
      />
      {existing && (
        <button
          title="Im Browser öffnen"
          onClick={() => openExternal(existing).catch((err) => reportError('Link konnte nicht geöffnet werden', err))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover"
        >
          <ExternalLink size={14} />
        </button>
      )}
      <button onClick={apply} className="h-7 rounded-md bg-accent px-2 text-xs font-medium text-accent-fg">
        Übernehmen
      </button>
    </div>
  );
}
