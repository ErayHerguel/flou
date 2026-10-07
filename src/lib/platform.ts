/** macOS oder Windows: steuert Kürzel (⌘ bzw. Strg), Fensterlayout und Systemfunktionen. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** ⌘-Klick auf dem Mac, Strg-Klick unter Windows. */
export const isModClick = (e: { metaKey: boolean; ctrlKey: boolean }) => (IS_MAC ? e.metaKey : e.ctrlKey);
