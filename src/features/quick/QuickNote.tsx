import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState } from 'react';
import { isModClick } from '../../lib/platform';
import { formatCombo } from '../shortcuts/keys';
import { useTheme } from '../useTheme';

/** Eigenes kleines Fenster (⌃⌥N): Text erfassen, das Hauptfenster legt ihn im Eingang ab. */
export function QuickNote() {
  const [text, setText] = useState('');
  useTheme();

  const close = () => void getCurrentWindow().close();
  const save = async () => {
    if (text.trim()) await emitTo('main', 'quick-note', text);
    close();
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <div data-tauri-drag-region className="flex h-9 shrink-0 items-center justify-center text-xs text-faint">
        Schnellnotiz
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Enter' && isModClick(e)) {
            e.preventDefault();
            void save();
          }
        }}
        placeholder="Was willst du festhalten? Die erste Zeile wird zum Titel."
        className="min-h-0 flex-1 resize-none bg-transparent px-5 text-base leading-relaxed text-text outline-none placeholder:text-faint"
      />
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-5 text-xs text-faint">
        <span>
          {formatCombo('Mod+Enter')} in den Eingang · esc schließen
        </span>
        <button onClick={() => void save()} className="h-7 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg">
          Speichern
        </button>
      </div>
    </div>
  );
}
