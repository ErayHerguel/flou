import { IS_MAC } from '../../lib/platform';

/**
 * Tastenkürzel im Format "Mod+Shift+K". Mod ist auf dem Mac ⌘, unter Windows Strg.
 * Satzzeichen werden über das erzeugte Zeichen ODER die physische Taste erkannt, damit
 * Kürzel wie ⌘\ oder ⌘/ auch mit deutscher Tastaturbelegung funktionieren.
 */
export interface Combo {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

const SYMBOL_CODES: Record<string, string> = {
  '\\': 'Backslash',
  '/': 'Slash',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  ',': 'Comma',
  '.': 'Period',
};

const DISPLAY: Record<string, string> = {
  Backspace: '⌫',
  Enter: '↩',
  Escape: 'esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Tab: '⇥',
  ' ': 'Leertaste',
};

function parseCombo(spec: string): Combo {
  const parts = spec.split('+');
  // "Mod++" wäre mehrdeutig; Plus wird hier nicht verwendet.
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  return {
    mod: mods.has('Mod'),
    shift: mods.has('Shift'),
    alt: mods.has('Alt'),
    key: key.length === 1 ? key.toLowerCase() : key,
  };
}

export function matches(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
  spec: string,
  mac = IS_MAC,
): boolean {
  const combo = parseCombo(spec);
  const mod = mac ? e.metaKey : e.ctrlKey;
  const other = mac ? e.ctrlKey : e.metaKey;
  if (mod !== combo.mod || other) return false;

  const symbolCode = SYMBOL_CODES[combo.key];
  if (symbolCode) {
    // Auf manchen Layouts braucht das Zeichen selbst Shift/Alt; dann zählt das erzeugte Zeichen.
    if (e.key === combo.key) return true;
    return e.code === symbolCode && e.shiftKey === combo.shift && e.altKey === combo.alt;
  }

  if (e.shiftKey !== combo.shift || e.altKey !== combo.alt) return false;
  if (/^[a-z]$/.test(combo.key)) {
    // Mit ⌥ liefert macOS Sonderzeichen in e.key, daher dort die physische Taste.
    return combo.alt ? e.code === `Key${combo.key.toUpperCase()}` : e.key.toLowerCase() === combo.key;
  }
  if (/^[0-9]$/.test(combo.key)) return e.code === `Digit${combo.key}`;
  return e.key === combo.key;
}

const DISPLAY_WINDOWS: Record<string, string> = {
  Backspace: 'Rücktaste',
  Enter: 'Eingabe',
  Escape: 'Esc',
  Tab: 'Tab',
};

/** Darstellung für Menüs und Übersicht, z. B. "⌥⌘N" bzw. "Strg+Alt+N". */
export function formatCombo(spec: string, mac = IS_MAC): string {
  const c = parseCombo(spec);
  const raw = c.key.length === 1 ? c.key.toUpperCase() : c.key;
  if (!mac) {
    const key = DISPLAY_WINDOWS[c.key] ?? DISPLAY[c.key] ?? raw;
    return [c.mod && 'Strg', c.shift && 'Umschalt', c.alt && 'Alt', key].filter(Boolean).join('+');
  }
  const key = DISPLAY[c.key] ?? raw;
  return `${c.alt ? '⌥' : ''}${c.shift ? '⇧' : ''}${c.mod ? '⌘' : ''}${key}`;
}

/** Accelerator-String für das native Menü (muda). */
export function toAccelerator(spec: string): string {
  const c = parseCombo(spec);
  const key = SYMBOL_CODES[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return [c.mod && 'CmdOrCtrl', c.shift && 'Shift', c.alt && 'Alt', key].filter(Boolean).join('+');
}
