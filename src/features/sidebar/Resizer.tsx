import { useState } from 'react';
import { cx } from '../../lib/cx';
import { useUI } from '../../store/ui';

/** Ziehbare rechte Kante der Seitenleiste; Doppelklick setzt die Breite zurück. */
export function Resizer({ onResizing }: { onResizing: (active: boolean) => void }) {
  const [active, setActive] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = useUI.getState().sidebarWidth;
    setActive(true);
    onResizing(true);
    const onMove = (ev: MouseEvent) => useUI.getState().setSidebarWidth(startWidth + ev.clientX - startX);
    const onUp = () => {
      setActive(false);
      onResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onDoubleClick={() => useUI.getState().setSidebarWidth(260)}
      className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
    >
      <div
        className={cx(
          'mx-auto h-full w-0.5 transition-colors',
          active ? 'bg-accent' : 'bg-transparent group-hover:bg-border-strong',
        )}
      />
    </div>
  );
}
