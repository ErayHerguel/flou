import { useEffect } from 'react';
import { availableActions as actions } from '../actions';
import { matches } from './keys';

/**
 * Globale Tastenkürzel. Das native Menü kennt dieselben Kürzel; wer die Taste zuerst bekommt,
 * führt die Aktion aus und verhindert die zweite Ausführung (preventDefault).
 */
export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const action = actions.find((a) => a.keys && !a.menuOnly && matches(e, a.keys));
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      void action.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
