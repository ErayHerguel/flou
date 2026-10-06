import { X } from 'lucide-react';
import { cx } from '../lib/cx';
import { dismissToast, useToasts } from '../store/toast';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex max-w-[520px] animate-pop-in items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-popover',
            t.kind === 'error' ? 'bg-danger text-accent-fg' : 'bg-surface text-text',
          )}
        >
          <span>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Schließen" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
