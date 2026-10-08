import { invoke } from '@tauri-apps/api/core';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useUI } from '../../store/ui';

/** Öffnet einen von jemand anderem geteilten Workspace (per Einladungslink) in einem eigenen Fenster. */
export function JoinDialog() {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = () => useUI.getState().setOverlay(null);

  const join = async () => {
    try {
      await invoke('open_shared', { url: link.trim() });
      close();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <Modal onClose={close} position="center" className="w-[480px] p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <LogIn size={16} className="text-muted" /> Geteilten Workspace öffnen
      </h2>
      <p className="mt-2 text-sm text-muted">
        Füge den Einladungslink ein, den du bekommen hast. Der Workspace öffnet sich in einem eigenen Fenster; deine eigenen Seiten bleiben
        getrennt davon.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          autoFocus
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError(null);
          }}
          placeholder="https://….trycloudflare.com/#join=…"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm outline-none focus:border-border-strong"
        />
        <button type="submit" disabled={!link.trim()} className="h-8 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-50">
          Öffnen
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Modal>
  );
}
