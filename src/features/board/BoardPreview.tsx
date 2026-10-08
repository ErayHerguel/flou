import { useEffect, useState } from 'react';
import { loadBoard } from '../../db/boards';
import { loadFiles } from './files';

/** Statische SVG-Vorschau eines Boards (für die Einbettung in Seiten). */
export function BoardPreview({ pageId }: { pageId: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const scene = await loadBoard(pageId);
      const elements = scene.elements.filter((e) => !e.isDeleted);
      if (elements.length === 0) {
        if (alive) setEmpty(true);
        return;
      }
      await import('./assetPath');
      const { exportToSvg } = await import('@excalidraw/excalidraw');
      const files = await loadFiles(scene);
      const node = await exportToSvg({
        elements: elements as never,
        appState: { exportBackground: false, viewBackgroundColor: 'transparent', exportWithDarkMode: false },
        files: Object.fromEntries(files.map((f) => [f.id, f])),
        exportPadding: 16,
      });
      if (alive) setSvg(node.outerHTML);
    })().catch(() => alive && setEmpty(true));
    return () => {
      alive = false;
    };
  }, [pageId]);

  if (empty) return <div className="py-8 text-center text-sm text-faint">Leeres Board – zum Bearbeiten öffnen</div>;
  if (!svg) return <div className="h-40" />;
  // Das SVG stammt aus Excalidraws eigenem Export der lokalen Szene.
  return <div className="board-preview" dangerouslySetInnerHTML={{ __html: svg }} />;
}
