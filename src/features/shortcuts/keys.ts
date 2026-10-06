/**
 * Tastenkürzel im Format "Mod+Shift+K". Mod ist auf dem Mac ⌘.
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

export function parseCombo(spec: string): Combo {
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

export function matches(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>, spec: string): boolean {
  const combo = parseCombo(spec);
  if (e.metaKey !== combo.mod || e.ctrlKey) return false;

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

/** Darstellung für Menüs und Übersicht, z. B. "⌥⌘N". */
export function formatCombo(spec: string): string {
  const c = parseCombo(spec);
  const key = DISPLAY[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return `${c.alt ? '⌥' : ''}${c.shift ? '⇧' : ''}${c.mod ? '⌘' : ''}${key}`;
}

/** Accelerator-String für das native Menü (muda). */
export function toAccelerator(spec: string): string {
  const c = parseCombo(spec);
  const key = SYMBOL_CODES[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return [c.mod && 'CmdOrCtrl', c.shift && 'Shift', c.alt && 'Alt', key].filter(Boolean).join('+');
}
