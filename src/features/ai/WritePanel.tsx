import { Loader2, RotateCcw, Sparkles, Square, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatUsd } from './cost';
import { actionLabel } from './write';
import { acceptWrite, discardWrite, isEmptyAnswer, retryWrite, sessionModelName, stopWrite, useWrite } from './writeSession';

/** Vorschau der Schreibhilfe unten im Fenster: Text entsteht live, dann übernehmen oder verwerfen. */
export function WritePanel() {
  const session = useWrite((s) => s.session);

  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (session.status === 'running' || session.status === 'preparing') stopWrite();
        else discardWrite();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && session.status === 'done') {
        e.preventDefault();
        acceptWrite();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [session]);

  if (!session || session.status === 'preparing') return null;
  const busy = session.status === 'running';
  const empty = session.status === 'done' && isEmptyAnswer(session.text);
  const primaryLabel = session.target === 'replace' ? 'Ersetzen' : 'Einfügen';

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-h-[55vh] w-[600px] max-w-full animate-pop-in flex-col rounded-lg bg-surface shadow-popover">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Sparkles size={15} className="text-accent" />
          <span className="text-sm font-medium">{actionLabel(session.action)}</span>
          {session.model && <span className="text-xs text-faint">{sessionModelName(session)}</span>}
          <div className="flex-1" />
          {busy && <Loader2 size={14} className="animate-spin text-faint" />}
          <button onClick={discardWrite} aria-label="Schließen" className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover">
            <X size={14} />
          </button>
        </div>
        <div className="min-h-[56px] overflow-y-auto px-4 py-3 text-sm whitespace-pre-wrap">
          {session.status === 'error' ? (
            <span className="text-danger">{session.error}</span>
          ) : empty ? (
            <span className="text-muted">Keine Aufgaben gefunden.</span>
          ) : (
            session.text || <span className="text-faint">Claude schreibt …</span>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span className="text-xs text-faint tabular-nums">
            {session.cost !== null ? `Kosten: ${formatUsd(session.cost)}` : busy ? 'läuft …' : ''}
          </span>
          <div className="flex-1" />
          {busy ? (
            <button onClick={stopWrite} className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:bg-hover">
              <Square size={11} /> Stopp
            </button>
          ) : (
            <>
              <button onClick={retryWrite} className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-hover">
                <RotateCcw size={12} /> Nochmal
              </button>
              <button onClick={discardWrite} className="h-7 rounded-md border border-border px-2.5 text-xs hover:bg-hover">
                Verwerfen
              </button>
              {session.status === 'done' && !empty && (
                <>
                  {(session.target === 'replace' || session.target === 'cursor') && (
                    <button onClick={() => acceptWrite('below')} className="h-7 rounded-md border border-border px-2.5 text-xs hover:bg-hover">
                      Darunter einfügen
                    </button>
                  )}
                  <button onClick={() => acceptWrite()} title="⌘↩" className="h-7 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg">
                    {primaryLabel}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
