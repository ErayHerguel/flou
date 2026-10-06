import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { importImageBlob } from '../lib/assets';
import { reportError } from '../store/toast';

const imageFiles = (data: DataTransfer | null): File[] =>
  data ? [...data.files].filter((file) => file.type.startsWith('image/')) : [];

async function insertImages(editor: Editor, files: File[], pos: number) {
  try {
    const names = await Promise.all(files.map((file) => importImageBlob(file, file.name)));
    if (editor.isDestroyed) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        pos,
        names.map((src) => ({ type: 'image', attrs: { src } })),
      )
      .run();
  } catch (err) {
    reportError('Bild konnte nicht eingefügt werden', err);
  }
}

/** Bilder aus Zwischenablage oder Finder werden in den App-Ordner kopiert und eingefügt. */
export const ImageInput = Extension.create({
  name: 'imageInput',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('imageInput'),
        props: {
          handlePaste(view, event) {
            const files = imageFiles(event.clipboardData);
            if (files.length === 0) return false;
            event.preventDefault();
            void insertImages(editor, files, view.state.selection.from);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved) return false;
            const files = imageFiles(event.dataTransfer);
            if (files.length === 0) return false;
            event.preventDefault();
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
            void insertImages(editor, files, pos);
            return true;
          },
        },
      }),
    ];
  },
});
