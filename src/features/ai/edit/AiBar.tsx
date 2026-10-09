import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ArrowUp, FileText, FileUp, Loader2, Minus, Paperclip, Plus, RefreshCw, Sparkles, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageTitle } from '../../../components/PageIcon';
import { cx } from '../../../lib/cx';
import { fuzzyFilter } from '../../../lib/fuzzy';
import { usePages } from '../../../store/pages';
import { reportError } from '../../../store/toast';
import { useUI } from '../../../store/ui';
import { useActiveBoard } from '../../board/active';
import { useAiConfirm } from '../client';
import { formatUsd } from '../cost';
import {
  acceptAiBar,
  closeAiBar,
  boardToPage,
  clusterSelection,
  discardPreview,
  pageAttachment,
  runAiBar,
  stopAiBar,
  useAiBar,
  type Preview,
} from './session';

const PAGE_CHIPS = ['Fasse die Seite oben in Stichpunkten zusammen', 'Zieh alle Aufgaben als To-do-Liste ans Ende', 'Gliedere die Seite mit Überschriften', 'Mach den Text kürzer und klarer', 'Übersetze die Seite ins Englische'];
const DB_CHIPS = ['Fülle leere Felder sinnvoll aus', 'Vereinheitliche Schreibweisen', 'Ordne jedem Eintrag eine passende Kategorie zu', 'Ergänze fünf passende Einträge'];
const BOARD_CHIPS = ['Kürze alle Post-its auf das Wesentliche', 'Fasse doppelte Post-its zusammen', 'Ergänze fehlende Punkte in jeder Gruppe', 'Übersetze das Board ins Englische'];

const KIND_LABEL = { changed: 'Geändert', added: 'Neu', removed: 'Gelöscht', recolored: 'Neue Farbe' } as const;
const KIND_STYLE = {
  changed: 'bg-[var(--c-tag-blue-bg)] text-[var(--c-tag-blue-fg)]',
  added: 'bg-[var(--c-tag-green-bg)] text-[var(--c-tag-green-fg)]',
  removed: 'bg-[var(--c-tag-red-bg)] text-[var(--c-tag-red-fg)]',
  recolored: 'bg-[var(--c-tag-purple-bg)] text-[var(--c-tag-purple-fg)]',
} as const;

function short(text: string, n = 220): string {
  const t = text.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function PreviewList({ preview }: { preview: Preview }) {
  return (
    <div className="max-h-[42vh] space-y-2 overflow-y-auto px-4 py-3">
      {preview.summary && <p className="text-sm">{preview.summary}</p>}
      {preview.created && <div className="rounded-md bg-hover px-3 py-2 text-sm">{preview.created}</div>}
      {preview.changes.map((c, i) => (
        <div key={i} className="rounded-md border border-border px-3 py-2 text-xs">
          <span className={cx('mr-2 rounded px-1.5 py-0.5 font-medium', KIND_STYLE[c.kind])}>{KIND_LABEL[c.kind]}</span>
          {'color' in c && c.color && <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: c.color }} />}
          {c.before && (
            <div className={cx('mt-1.5 whitespace-pre-wrap text-faint', c.kind !== 'recolored' && 'line-through')}>{short(c.before)}</div>
          )}
          {c.after && <div className="mt-1.5 whitespace-pre-wrap">{short(c.after, 600)}</div>}
        </div>
      ))}
    </div>
  );
}

/** Kleine Seitensuche zum Anhängen einer Seite als Quelle */
function PagePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const pages = usePages((s) => s.pages);
  const currentId = useUI((s) => s.currentId);
  const [query, setQuery] = useState('');
  const list = useMemo(
    () =>
      fuzzyFilter(
        Object.values(pages).filter((p) => p.deletedAt === null && p.type === 'page' && p.id !== currentId),
        query,
        (p) => [pageTitle(p)],
      ).slice(0, 6),
    [pages, query, currentId],
  );
  return (
    <div className="border-t border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}
          placeholder="Seite als Quelle suchen …"
          className="h-7 min-w-0 flex-1 rounded-md bg-bg px-2 text-sm outline-none placeholder:text-faint"
        />
        <button onClick={onClose} aria-label="Schließen" className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover">
          <X size={13} />
        </button>
      </div>
      <div className="mt-1">
        {list.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} className="flex h-7 w-full items-center rounded-md px-2 text-left text-sm hover:bg-hover">
            <span className="truncate">{pageTitle(p)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AiBar() {
  const bar = useAiBar();
  const currentId = useUI((s) => s.currentId);
  const page = usePages((s) => (currentId ? s.pages[currentId] : undefined));
  const bridge = useActiveBoard((s) => s.bridge);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isBoard = page?.type === 'board';
  const isDb = page?.type === 'database';
  const selectedNotes = useMemo(() => (bar.open && isBoard && bridge ? bridge.selectedNotes().length : 0), [bar.open, isBoard, bridge, bar.status]);

  useEffect(() => {
    if (bar.open) inputRef.current?.focus();
  }, [bar.open, bar.status]);

  // Seitenwechsel beendet die Leiste (Vorschau und Anfrage gehören zur alten Seite).
  useEffect(() => {
    if (useAiBar.getState().open) closeAiBar();
  }, [currentId]);

  useEffect(() => {
    if (!bar.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useAiConfirm.getState().request) return;
      e.preventDefault();
      if (useAiBar.getState().status === 'running') stopAiBar();
      else closeAiBar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bar.open]);

  if (!bar.open || !page) return null;
  const running = bar.status === 'running';
  const previewing = bar.status === 'preview' && bar.preview;

  const attachPdf = async () => {
    try {
      const path = await open({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (typeof path !== 'string') return;
      const file = await invoke<{ name: string; data: string; size: number }>('ai_read_pdf', { path });
      useAiBar.setState((s) => ({ attachments: [...s.attachments, { kind: 'pdf', ...file }] }));
    } catch (err) {
      reportError('PDF', err);
    }
  };

  const attachPage = async (id: string) => {
    setPicking(false);
    try {
      const a = await pageAttachment(id);
      useAiBar.setState((s) => ({ attachments: [...s.attachments.filter((x) => !(x.kind === 'page' && x.id === id)), a] }));
    } catch (err) {
      reportError('Seite', err);
    }
  };

  const send = () => {
    if (running) return;
    void runAiBar();
  };
  const canSend = !!bar.instruction.trim() || bar.attachments.length > 0;
  const chips = isDb ? DB_CHIPS : isBoard ? BOARD_CHIPS : PAGE_CHIPS;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-[660px] max-w-full animate-pop-in flex-col rounded-xl bg-surface shadow-popover">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Sparkles size={15} className="text-accent" />
          <span className="text-sm font-medium">{isDb ? 'Datenbank mit KI' : isBoard ? 'Board mit KI' : 'Seite mit KI'}</span>
          {isBoard && selectedNotes > 0 && <span className="text-xs text-faint">bezieht sich auf die Auswahl</span>}
          <div className="flex-1" />
          {previewing && <span className="text-xs text-faint tabular-nums">{bar.preview!.note}</span>}
          <button onClick={closeAiBar} aria-label="Schließen" className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover">
            <X size={14} />
          </button>
        </div>

        {previewing && <PreviewList preview={bar.preview!} />}
        {bar.status === 'error' && <div className="px-4 py-3 text-sm text-danger">{bar.error}</div>}
        {running && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" />
            {bar.progress ? `Claude schreibt die Änderungen … (${bar.progress.toLocaleString('de-DE')} Zeichen)` : 'Claude liest und plant …'}
          </div>
        )}

        {previewing ? (
          <div className="flex items-center gap-2 border-t border-border px-4 py-2">
            <span className="text-xs text-faint">Kosten: {formatUsd(bar.preview!.cost)}</span>
            <div className="flex-1" />
            <button onClick={discardPreview} className="h-7 rounded-md border border-border px-2.5 text-xs hover:bg-hover">
              Verwerfen
            </button>
            <button onClick={() => void acceptAiBar()} title="⌘↩" className="h-7 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg">
              Übernehmen
            </button>
          </div>
        ) : (
          !running && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-3">
              {isBoard && selectedNotes >= 3 && (
                <button onClick={() => void clusterSelection()} className="h-7 rounded-full border border-accent bg-accent-soft px-3 text-xs">
                  {selectedNotes} markierte Post-its clustern
                </button>
              )}
              {isBoard && (
                <button onClick={() => void boardToPage()} className="h-7 rounded-full border border-border px-3 text-xs text-muted hover:bg-hover hover:text-text">
                  Als Seite zusammenfassen
                </button>
              )}
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    useAiBar.setState({ instruction: c });
                    send();
                  }}
                  className="h-7 rounded-full border border-border px-3 text-xs text-muted hover:bg-hover hover:text-text"
                >
                  {c}
                </button>
              ))}
            </div>
          )
        )}

        {bar.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3">
            {bar.attachments.map((a, i) => (
              <span key={i} className="flex h-7 items-center gap-1.5 rounded-md bg-hover px-2 text-xs">
                <FileText size={13} className="text-muted" />
                <span className="max-w-[220px] truncate">{a.kind === 'pdf' ? `${a.name}.pdf` : a.title}</span>
                <button
                  aria-label="Anhang entfernen"
                  onClick={() => useAiBar.setState((s) => ({ attachments: s.attachments.filter((_, j) => j !== i) }))}
                  className="text-faint hover:text-text"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {picking && <PagePicker onPick={(id) => void attachPage(id)} onClose={() => setPicking(false)} />}

        <div className="flex items-end gap-2 px-3 py-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={bar.instruction}
            onChange={(e) => useAiBar.setState({ instruction: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && previewing) {
                e.preventDefault();
                void acceptAiBar();
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) send();
              }
            }}
            placeholder={
              previewing
                ? 'Weiter verfeinern, z. B. „noch kürzer“ … (↩)'
                : isDb
                  ? 'Was soll Claude mit der Datenbank tun? z. B. „Lege aus der PDF alle Termine an“'
                  : isBoard
                  ? 'Was soll Claude mit dem Board tun? z. B. „Ergänze bei Education zwei Hebel“'
                  : 'Was soll Claude mit der Seite tun? z. B. „Mach aus der Liste eine Tabelle“'
            }
            className="max-h-32 min-h-[34px] min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-faint"
          />
          <button title="PDF anhängen" aria-label="PDF anhängen" onClick={() => void attachPdf()} className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover">
            <FileUp size={16} />
          </button>
          <button title="Seite als Quelle anhängen" aria-label="Seite anhängen" onClick={() => setPicking((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover">
            <Paperclip size={16} />
          </button>
          {!isBoard && !isDb && (
            <button
              title={bar.newPage ? 'Ergebnis als neue Unterseite' : 'Ergebnis in dieser Seite'}
              onClick={() => useAiBar.setState((s) => ({ newPage: !s.newPage }))}
              className={cx('flex h-8 items-center gap-1 rounded-md px-2 text-xs', bar.newPage ? 'bg-accent-soft text-text' : 'text-muted hover:bg-hover')}
            >
              {bar.newPage ? <Plus size={13} /> : <Minus size={13} />}
              {bar.newPage ? 'Neue Seite' : 'Diese Seite'}
            </button>
          )}
          {running ? (
            <button onClick={stopAiBar} aria-label="Stopp" className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-hover">
              <Square size={12} />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!canSend}
              aria-label={previewing ? 'Verfeinern' : 'Senden'}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg disabled:opacity-40"
            >
              {previewing ? <RefreshCw size={14} /> : <ArrowUp size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
