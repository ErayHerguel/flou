import { invoke } from '@tauri-apps/api/core';
import { getActiveEditor } from '../editor/active';
import { useDatabases } from '../store/databases';
import { usePages } from '../store/pages';
import { useUI, type Theme } from '../store/ui';
import { quitApp } from './lifecycle';

export type MenuSection = 'app' | 'file' | 'edit' | 'view' | 'go' | 'help';

export interface AppAction {
  id: string;
  label: string;
  group: 'Allgemein' | 'Seite' | 'Navigation' | 'Ansicht' | 'Bearbeiten';
  keys?: string;
  /** Kürzel nur über das native Menü auslösen (der Editor oder das System verarbeitet die Taste selbst). */
  menuOnly?: boolean;
  menu?: MenuSection;
  /** In der Befehlspalette ausblenden. */
  hideInPalette?: boolean;
  run(): unknown;
}

const currentPage = () => {
  const id = useUI.getState().currentId;
  return id ? (usePages.getState().pages[id] ?? null) : null;
};

export async function createPageAndOpen(parentId: string | null): Promise<void> {
  const id = await usePages.getState().create({ parentId });
  if (parentId) useUI.getState().setExpanded(parentId, true);
  useUI.getState().open(id);
  useUI.getState().requestFocus('title');
}

export async function createDatabaseAndOpen(parentId: string | null): Promise<void> {
  const id = await useDatabases.getState().createDatabase(parentId);
  if (parentId) useUI.getState().setExpanded(parentId, true);
  useUI.getState().open(id);
  useUI.getState().requestFocus('title');
}

function setTheme(theme: Theme) {
  useUI.getState().setTheme(theme);
}

/** Undo/Redo: im Editor über dessen Verlauf, in normalen Eingabefeldern über die WebView. */
function history(kind: 'undo' | 'redo') {
  const editor = getActiveEditor();
  if (editor && editor.view.hasFocus()) {
    editor.commands[kind]();
    return;
  }
  document.execCommand(kind);
}

export const actions: AppAction[] = [
  {
    id: 'page.new',
    label: 'Neue Seite',
    group: 'Seite',
    keys: 'Mod+N',
    menu: 'file',
    run: () => createPageAndOpen(null),
  },
  {
    id: 'page.newSub',
    label: 'Neue Unterseite',
    group: 'Seite',
    keys: 'Mod+Shift+N',
    menu: 'file',
    run: () => {
      const page = currentPage();
      return createPageAndOpen(page && page.type === 'page' ? page.id : null);
    },
  },
  {
    id: 'page.newDatabase',
    label: 'Neue Datenbank',
    group: 'Seite',
    keys: 'Mod+Alt+N',
    menu: 'file',
    run: () => createDatabaseAndOpen(null),
  },
  {
    id: 'page.rename',
    label: 'Seite umbenennen',
    group: 'Seite',
    keys: 'Mod+Shift+R',
    menu: 'file',
    run: () => useUI.getState().requestFocus('title'),
  },
  {
    id: 'page.fullWidth',
    label: 'Volle Breite umschalten',
    group: 'Ansicht',
    keys: 'Mod+Shift+\\',
    menu: 'view',
    run: () => {
      const page = currentPage();
      if (page) usePages.getState().update(page.id, { fullWidth: !page.fullWidth });
    },
  },
  {
    id: 'page.trash',
    label: 'Seite in den Papierkorb',
    group: 'Seite',
    keys: 'Mod+Shift+Backspace',
    menu: 'file',
    run: () => {
      const page = currentPage();
      if (page) return usePages.getState().trash(page.id);
    },
  },
  {
    id: 'trash.open',
    label: 'Papierkorb öffnen',
    group: 'Allgemein',
    menu: 'file',
    run: () => useUI.getState().setOverlay('trash'),
  },
  {
    id: 'edit.undo',
    label: 'Widerrufen',
    group: 'Bearbeiten',
    keys: 'Mod+Z',
    menuOnly: true,
    menu: 'edit',
    hideInPalette: true,
    run: () => history('undo'),
  },
  {
    id: 'edit.redo',
    label: 'Wiederholen',
    group: 'Bearbeiten',
    keys: 'Mod+Shift+Z',
    menuOnly: true,
    menu: 'edit',
    hideInPalette: true,
    run: () => history('redo'),
  },
  {
    id: 'view.sidebar',
    label: 'Seitenleiste ein-/ausblenden',
    group: 'Ansicht',
    keys: 'Mod+\\',
    menu: 'view',
    run: () => useUI.getState().toggleSidebar(),
  },
  {
    id: 'theme.light',
    label: 'Erscheinungsbild: Hell',
    group: 'Ansicht',
    menu: 'view',
    run: () => setTheme('light'),
  },
  {
    id: 'theme.dark',
    label: 'Erscheinungsbild: Dunkel',
    group: 'Ansicht',
    menu: 'view',
    run: () => setTheme('dark'),
  },
  {
    id: 'theme.system',
    label: 'Erscheinungsbild: System',
    group: 'Ansicht',
    menu: 'view',
    run: () => setTheme('system'),
  },
  {
    id: 'nav.back',
    label: 'Zurück',
    group: 'Navigation',
    keys: 'Mod+[',
    menu: 'go',
    run: () => useUI.getState().goBack(),
  },
  {
    id: 'nav.forward',
    label: 'Vorwärts',
    group: 'Navigation',
    keys: 'Mod+]',
    menu: 'go',
    run: () => useUI.getState().goForward(),
  },
  {
    id: 'app.dataFolder',
    label: 'Datenordner im Finder zeigen',
    group: 'Allgemein',
    menu: 'help',
    run: () => invoke('reveal_dir', { which: 'data' }),
  },
  {
    id: 'app.quit',
    label: 'Beenden',
    group: 'Allgemein',
    keys: 'Mod+Q',
    menu: 'app',
    hideInPalette: true,
    run: quitApp,
  },
];

export function actionById(id: string): AppAction {
  const action = actions.find((a) => a.id === id);
  if (!action) throw new Error(`Unbekannte Aktion ${id}`);
  return action;
}
