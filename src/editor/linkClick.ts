import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { openExternal } from '../lib/assets';
import { reportError } from '../store/toast';

/** ⌘-Klick auf einen Link öffnet ihn im Standardbrowser. */
export const LinkClick = Extension.create({
  name: 'linkClick',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('linkClick'),
        props: {
          handleClick(_view, _pos, event) {
            if (!event.metaKey) return false;
            const anchor = (event.target as HTMLElement).closest('a[href]');
            if (!anchor) return false;
            openExternal(anchor.getAttribute('href')!).catch((err) => reportError('Link konnte nicht geöffnet werden', err));
            return true;
          },
        },
      }),
    ];
  },
});
