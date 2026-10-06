import { Shuffle, Trash2 } from 'lucide-react';
import { EMOJI_GROUPS } from './emojis';

const ALL = [...new Set(EMOJI_GROUPS.flatMap((g) => g.emojis))];

export function EmojiPicker({ onPick, onRemove }: { onPick: (emoji: string) => void; onRemove?: () => void }) {
  return (
    <div className="w-[332px]">
      <div className="flex items-center justify-end gap-1 border-b border-border px-2 py-1.5">
        <button
          onClick={() => onPick(ALL[Math.floor(Math.random() * ALL.length)])}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-hover"
        >
          <Shuffle size={13} /> Zufällig
        </button>
        {onRemove && (
          <button onClick={onRemove} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-hover">
            <Trash2 size={13} /> Entfernen
          </button>
        )}
      </div>
      <div className="max-h-[300px] overflow-y-auto p-2">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.name} className="mb-2">
            <div className="px-1 pb-1 text-2xs font-medium text-faint">{group.name}</div>
            <div className="grid grid-cols-8">
              {group.emojis.map((emoji) => (
                <button
                  key={group.name + emoji}
                  onClick={() => onPick(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-hover"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
