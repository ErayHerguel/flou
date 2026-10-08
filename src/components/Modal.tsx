import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Vertikale Position: oben für Paletten, mittig für Dialoge. */
  position?: 'top' | 'center';
}

export function Modal({ onClose, children, className, position = 'top' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-40 flex animate-fade-in justify-center bg-overlay px-4',
        position === 'top' ? 'items-start pt-[12vh]' : 'items-center',
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cx('max-w-[calc(100vw-24px)] animate-pop-in overflow-hidden rounded-lg bg-surface shadow-popover', className)}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
