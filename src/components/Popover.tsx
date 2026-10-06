import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';

export interface Anchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const pointAnchor = (x: number, y: number): Anchor => ({ left: x, top: y, right: x, bottom: y });

interface PopoverProps {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'right-start';
  className?: string;
}

const MARGIN = 8;

/** Schwebendes Panel an einem Anker; schließt bei Klick außerhalb und mit Escape. */
export function Popover({ anchor, onClose, children, placement = 'bottom-start', className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = placement === 'right-start' ? anchor.right + 4 : placement === 'bottom-end' ? anchor.right - w : anchor.left;
    let top = placement === 'right-start' ? anchor.top : anchor.bottom + 4;
    if (left + w > window.innerWidth - MARGIN) left = window.innerWidth - w - MARGIN;
    if (top + h > window.innerHeight - MARGIN) {
      top = placement === 'right-start' ? window.innerHeight - h - MARGIN : anchor.top - h - 4;
    }
    setPos({ left: Math.max(MARGIN, left), top: Math.max(MARGIN, top) });
  }, [anchor, placement]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className={cx('z-50 animate-pop-in rounded-lg bg-surface text-sm shadow-popover', className)}
    >
      {children}
    </div>,
    document.body,
  );
}
