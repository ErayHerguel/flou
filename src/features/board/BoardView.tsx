import { lazy, Suspense } from 'react';

// Excalidraw ist groß: erst laden, wenn ein Board geöffnet wird (Kaltstart bleibt schnell).
const BoardCanvas = lazy(() => import('./BoardCanvas'));

export function BoardView({ pageId }: { pageId: string }) {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-faint">Board wird geladen …</div>}>
      <BoardCanvas pageId={pageId} />
    </Suspense>
  );
}
