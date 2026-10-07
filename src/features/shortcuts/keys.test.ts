import { describe, expect, it } from 'vitest';
import { formatCombo, matches, toAccelerator } from './keys';

const ev = (key: string, code: string, mods: Partial<Record<'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey', boolean>> = {}) => ({
  key,
  code,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  ...mods,
});

describe('Tastenkürzel', () => {
  it('erkennt Buchstaben über das erzeugte Zeichen', () => {
    expect(matches(ev('n', 'KeyN', { metaKey: true }), 'Mod+N', true)).toBe(true);
    expect(matches(ev('N', 'KeyN', { metaKey: true, shiftKey: true }), 'Mod+Shift+N', true)).toBe(true);
    expect(matches(ev('n', 'KeyN', { metaKey: true, shiftKey: true }), 'Mod+N', true)).toBe(false);
    expect(matches(ev('n', 'KeyN'), 'Mod+N', true)).toBe(false);
  });

  it('respektiert die deutsche Belegung (Z/Y)', () => {
    // Auf QWERTZ liegt Z physisch auf KeyY
    expect(matches(ev('z', 'KeyY', { metaKey: true }), 'Mod+Z', true)).toBe(true);
    expect(matches(ev('y', 'KeyZ', { metaKey: true }), 'Mod+Z', true)).toBe(false);
  });

  it('erkennt Satzzeichen über Zeichen oder physische Taste', () => {
    expect(matches(ev('\\', 'Backslash', { metaKey: true }), 'Mod+\\', true)).toBe(true);
    // Deutsch: Backslash entsteht mit ⌥⇧7
    expect(matches(ev('\\', 'Digit7', { metaKey: true, altKey: true, shiftKey: true }), 'Mod+\\', true)).toBe(true);
    expect(matches(ev('#', 'Backslash', { metaKey: true }), 'Mod+\\', true)).toBe(true);
    expect(matches(ev('/', 'Digit7', { metaKey: true, shiftKey: true }), 'Mod+/', true)).toBe(true);
  });

  it('nutzt bei ⌥ die physische Taste', () => {
    expect(matches(ev('~', 'KeyN', { metaKey: true, altKey: true }), 'Mod+Alt+N', true)).toBe(true);
  });

  it('formatiert für Anzeige und Menü', () => {
    expect(formatCombo('Mod+Shift+N', true)).toBe('⇧⌘N');
    expect(formatCombo('Mod+Shift+Backspace', true)).toBe('⇧⌘⌫');
    expect(toAccelerator('Mod+\\')).toBe('CmdOrCtrl+Backslash');
    expect(toAccelerator('Mod+Alt+N')).toBe('CmdOrCtrl+Alt+N');
  });
});

describe('Tastenkürzel unter Windows', () => {
  it('nutzt Strg statt ⌘', () => {
    expect(matches(ev('k', 'KeyK', { ctrlKey: true }), 'Mod+K', false)).toBe(true);
    expect(matches(ev('k', 'KeyK', { metaKey: true }), 'Mod+K', false)).toBe(false);
    expect(formatCombo('Mod+Shift+N', false)).toBe('Strg+Umschalt+N');
    expect(formatCombo('Mod+Shift+Backspace', false)).toBe('Strg+Umschalt+Rücktaste');
  });
});
