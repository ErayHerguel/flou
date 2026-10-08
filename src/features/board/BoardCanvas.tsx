import './assetPath';
import '@excalidraw/excalidraw/index.css';
import { convertToExcalidrawElements, Excalidraw, exportToBlob, exportToSvg, FONT_FAMILY, getSceneVersion, MainMenu } from '@excalidraw/excalidraw';
import type { ExcalidrawInitialDataState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { StickyNote } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { loadBoard, saveBoard, sceneText, type StoredScene } from '../../db/boards';
import { flush, schedule } from '../../db/saveQueue';
import { sanitizeName } from '../transfer/exportPlan';
import { usePages } from '../../store/pages';
import { reportError, toast } from '../../store/toast';
import { loadFiles, storeNewFiles } from './files';

/** Farben der Sticky Notes (wie FigJam: kräftig, aber nicht grell). */
const STICKY_COLORS = [
  { name: 'Gelb', color: '#fff3a3' },
  { name: 'Grün', color: '#c8f0c5' },
  { name: 'Blau', color: '#c7e3ff' },
  { name: 'Rosa', color: '#ffd1e0' },
  { name: 'Lila', color: '#e3d4ff' },
];

/** Sauberer Stil statt Handzeichnung: glatte Linien, Nunito, abgerundete Ecken. */
const CLEAN_DEFAULTS = {
  currentItemRoughness: 0,
  currentItemFontFamily: FONT_FAMILY.Nunito,
  currentItemRoundness: 'round' as const,
  currentItemStrokeWidth: 1,
};

export default function BoardCanvas({ pageId }: { pageId: string }) {
  const [initial, setInitial] = useState<ExcalidrawInitialDataState | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const stored = useRef<StoredScene | null>(null);
  const lastVersion = useRef(-1);

  useEffect(() => {
    let alive = true;
    (async () => {
      const scene = await loadBoard(pageId);
      const files = await loadFiles(scene);
      if (!alive) return;
      stored.current = scene;
      lastVersion.current = getSceneVersion(scene.elements as never);
      setInitial({
        elements: scene.elements as never,
        files: Object.fromEntries(files.map((f) => [f.id, f])),
        appState: { ...CLEAN_DEFAULTS, viewBackgroundColor: scene.appState?.viewBackgroundColor ?? '#ffffff' },
        scrollToContent: true,
      });
    })().catch((err) => reportError('Board konnte nicht geladen werden', err));
    return () => {
      alive = false;
      void flush();
    };
  }, [pageId]);

  const persist = () => {
    if (!api || !stored.current) return;
    const elements = api.getSceneElementsIncludingDeleted().filter((e) => !e.isDeleted);
    const appState = api.getAppState();
    const scene: StoredScene = {
      elements: elements as unknown as StoredScene['elements'],
      files: stored.current.files,
      appState: { viewBackgroundColor: appState.viewBackgroundColor },
    };
    stored.current = scene;
    schedule(`board:${pageId}`, () => saveBoard(pageId, scene, sceneText(scene.elements), Date.now()));
  };

  const onChange = () => {
    if (!api || !stored.current) return;
    const elements = api.getSceneElements();
    const version = getSceneVersion(elements);
    const files = api.getFiles();
    const newFiles = Object.keys(files).some((id) => !stored.current!.files[id]);
    if (version === lastVersion.current && !newFiles) return;
    lastVersion.current = version;
    if (newFiles) {
      storeNewFiles(files, stored.current.files)
        .then((mapping) => {
          if (stored.current) stored.current = { ...stored.current, files: mapping };
          persist();
        })
        .catch((err) => reportError('Bild konnte nicht gespeichert werden', err));
    } else persist();
  };

  const addSticky = (color: string) => {
    if (!api) return;
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    const cx = width / 2 / zoom.value - scrollX;
    const cy = height / 2 / zoom.value - scrollY;
    const offset = (api.getSceneElements().length % 6) * 16;
    const [sticky] = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x: cx - 100 + offset,
        y: cy - 100 + offset,
        width: 200,
        height: 200,
        backgroundColor: color,
        fillStyle: 'solid',
        strokeColor: 'transparent',
        strokeWidth: 1,
        roughness: 0,
        roundness: { type: 3 },
      },
    ]);
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), sticky],
      appState: { selectedElementIds: { [sticky.id]: true } },
    });
    api.setActiveTool({ type: 'selection' });
    toast('Doppelklick auf die Notiz, um zu schreiben');
  };

  const exportImage = async (format: 'png' | 'svg') => {
    if (!api) return;
    const title = usePages.getState().pages[pageId]?.title || 'Board';
    try {
      const path = await save({ defaultPath: `${sanitizeName(title)}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      const options = {
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false },
        files: api.getFiles(),
      };
      const blob =
        format === 'png'
          ? await exportToBlob({ ...options, mimeType: 'image/png', exportPadding: 24 })
          : new Blob([(await exportToSvg({ ...options, exportPadding: 24 })).outerHTML], { type: 'image/svg+xml' });
      await invoke('save_file', new Uint8Array(await blob.arrayBuffer()), { headers: { 'x-path': encodeURIComponent(path) } });
      toast(`Als ${format.toUpperCase()} exportiert`);
    } catch (err) {
      reportError('Export fehlgeschlagen', err);
    }
  };

  if (!initial) return null;

  return (
    <div className="flou-board h-full w-full">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initial}
        onChange={onChange}
        // Wie bei FigJam bleibt die Fläche hell, damit Sticky Notes ihre echten Farben zeigen.
        theme="light"
        langCode="de-DE"
        UIOptions={{
          canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false },
        }}
        renderTopRightUI={() => (
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1 shadow-popover">
            <StickyNote size={15} className="mx-1 text-muted" aria-hidden />
            {STICKY_COLORS.map((s) => (
              <button
                key={s.color}
                title={`Sticky Note (${s.name})`}
                aria-label={`Sticky Note ${s.name}`}
                onClick={() => addSticky(s.color)}
                className="h-6 w-6 rounded-sm border border-black/10 transition-transform hover:scale-110"
                style={{ background: s.color }}
              />
            ))}
          </div>
        )}
      >
        <MainMenu>
          <MainMenu.Item onSelect={() => void exportImage('png')}>Als PNG exportieren …</MainMenu.Item>
          <MainMenu.Item onSelect={() => void exportImage('svg')}>Als SVG exportieren …</MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.ClearCanvas />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
