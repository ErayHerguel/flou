import { useEffect, useRef } from 'react';
import { cx } from '../lib/cx';
import { useConfirm } from '../store/confirm';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const request = useConfirm((s) => s.request);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, [request]);

  if (!request) return null;
  return (
    <Modal onClose={() => request.resolve(false)} position="center" className="w-[400px] p-5">
      <h2 className="text-base font-semibold">{request.title}</h2>
      <p className="mt-2 text-sm text-muted">{request.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={() => request.resolve(false)}
          className="h-8 rounded-md border border-border px-3 text-sm hover:bg-hover"
        >
          Abbrechen
        </button>
        <button
          ref={confirmRef}
          onClick={() => request.resolve(true)}
          className={cx(
            'h-8 rounded-md px-3 text-sm font-medium text-accent-fg',
            request.danger ? 'bg-danger' : 'bg-accent',
          )}
        >
          {request.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
