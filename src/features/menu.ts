import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { APP_NAME } from '../app.config';
import { actions, type AppAction, type MenuSection } from './actions';
import { toAccelerator } from './shortcuts/keys';

type Item = MenuItem | PredefinedMenuItem | Submenu;

const separator = () => PredefinedMenuItem.new({ item: 'Separator' });

const actionItem = (action: AppAction) =>
  MenuItem.new({
    id: action.id,
    text: action.label,
    accelerator: action.keys ? toAccelerator(action.keys) : undefined,
    action: () => void action.run(),
  });

async function section(section: MenuSection): Promise<Item[]> {
  return Promise.all(actions.filter((a) => a.menu === section).map(actionItem));
}

/** Baut das native macOS-Menü aus der Aktionsliste (eine Quelle für Menü, Kürzel und Palette). */
export async function installMenu(): Promise<void> {
  const appMenu = await Submenu.new({
    text: APP_NAME,
    items: [
      await PredefinedMenuItem.new({ item: { About: { name: APP_NAME } } }),
      await separator(),
      await PredefinedMenuItem.new({ item: 'Services' }),
      await separator(),
      await PredefinedMenuItem.new({ item: 'Hide', text: `${APP_NAME} ausblenden` }),
      await PredefinedMenuItem.new({ item: 'HideOthers', text: 'Andere ausblenden' }),
      await PredefinedMenuItem.new({ item: 'ShowAll', text: 'Alle einblenden' }),
      await separator(),
      ...(await section('app')),
    ],
  });
  const fileMenu = await Submenu.new({ text: 'Ablage', items: await section('file') });
  const [undo, redo, ...editRest] = await section('edit');
  const editMenu = await Submenu.new({
    text: 'Bearbeiten',
    items: [
      undo,
      redo,
      await separator(),
      await PredefinedMenuItem.new({ item: 'Cut', text: 'Ausschneiden' }),
      await PredefinedMenuItem.new({ item: 'Copy', text: 'Kopieren' }),
      await PredefinedMenuItem.new({ item: 'Paste', text: 'Einsetzen' }),
      await PredefinedMenuItem.new({ item: 'SelectAll', text: 'Alles auswählen' }),
      ...editRest,
    ],
  });
  const viewMenu = await Submenu.new({
    text: 'Darstellung',
    items: [...(await section('view')), await separator(), await PredefinedMenuItem.new({ item: 'Fullscreen', text: 'Vollbild' })],
  });
  const goMenu = await Submenu.new({ text: 'Gehe zu', items: await section('go') });
  const windowMenu = await Submenu.new({
    text: 'Fenster',
    items: [
      await PredefinedMenuItem.new({ item: 'Minimize', text: 'Im Dock ablegen' }),
      await PredefinedMenuItem.new({ item: 'Maximize', text: 'Zoomen' }),
      await separator(),
      await PredefinedMenuItem.new({ item: 'CloseWindow', text: 'Fenster schließen' }),
    ],
  });
  const helpMenu = await Submenu.new({ text: 'Hilfe', items: await section('help') });

  const menu = await Menu.new({ items: [appMenu, fileMenu, editMenu, viewMenu, goMenu, windowMenu, helpMenu] });
  await menu.setAsAppMenu();
}
