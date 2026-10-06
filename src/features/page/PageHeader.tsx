import { Smile } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Popover, type Anchor } from '../../components/Popover';
import type { PageMeta } from '../../db/pages';
import { getActiveEditor } from '../../editor/active';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { EmojiPicker } from './EmojiPicker';

export function PageHeader({ page }: { page: PageMeta }) {
  const [iconPicker, setIconPicker] = useState<Anchor | null>(null);
  const closePicker = useCallback(() => setIconPicker(null), []);
  const update = usePages((s) => s.update);

  const pickIcon = (emoji: string | null) => {
    update(page.id, { icon: emoji });
    setIconPicker(null);
  };

  return (
    <div className="group/header pt-16">
      {page.icon && (
        <button
          onClick={(e) => setIconPicker(e.currentTarget.getBoundingClientRect())}
          className="-ml-1 mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-lg text-[56px] leading-none hover:bg-hover"
          aria-label="Icon ändern"
        >
          {page.icon}
        </button>
      )}
      <div className="flex h-7 items-center gap-1 opacity-0 transition-opacity group-hover/header:opacity-100 focus-within:opacity-100">
        {!page.icon && (
          <button
            onClick={(e) => setIconPicker(e.currentTarget.getBoundingClientRect())}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-faint hover:bg-hover hover:text-muted"
          >
            <Smile size={15} /> Icon hinzufügen
          </button>
        )}
      </div>
      <TitleInput page={page} />
      {iconPicker && (
        <Popover anchor={iconPicker} onClose={closePicker}>
          <EmojiPicker onPick={pickIcon} onRemove={page.icon ? () => pickIcon(null) : undefined} />
        </Popover>
      )}
    </div>
  );
}

function TitleInput({ page }: { page: PageMeta }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const update = usePages((s) => s.update);
  const pendingFocus = useUI((s) => s.pendingFocus);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [page.title, page.fullWidth]);

  useEffect(() => {
    if (!useUI.getState().consumeFocus(page.id, 'title')) return;
    const el = ref.current;
    el?.focus();
    el?.select();
  }, [pendingFocus, page.id]);

  const toEditor = () => getActiveEditor()?.commands.focus('start');

  return (
    <textarea
      ref={ref}
      rows={1}
      value={page.title}
      placeholder="Ohne Titel"
      spellCheck={false}
      onChange={(e) => update(page.id, { title: e.target.value.replace(/\n/g, ' ') })}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          toEditor();
        } else if (e.key === 'ArrowDown' && atEnd) {
          e.preventDefault();
          toEditor();
        }
      }}
      className="mt-1 block w-full resize-none overflow-hidden bg-transparent text-title font-bold tracking-tight text-text outline-none placeholder:text-faint"
    />
  );
}
