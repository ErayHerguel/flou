import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FileText, Loader2, Shapes, Sparkles, Square, Type } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { Modal } from '../../../components/Modal';
import { pageTitle } from '../../../components/PageIcon';
import { loadDoc } from '../../../db/content';
import { cx } from '../../../lib/cx';
import { fuzzyFilter } from '../../../lib/fuzzy';
import { usePages } from '../../../store/pages';
import { reportError, toast } from '../../../store/toast';
import { useUI } from '../../../store/ui';
import { createBoard } from '../../board/create';
import { waitForBoard, type BoardNote } from '../../board/active';
import { AiCancelled, askAi, costNote } from '../client';
import { toAiMarkdown } from '../markdown';
import { layoutBoard, layoutClusters } from './layout';
import { normalizePlan, type BoardLayout, type BoardPlan, type ClusterPlan } from './plan';
import { boardRequest, clusterRequest, repairClusters, type BoardSource } from './request';

interface BoardAiState {
  pageId: string | null;
  /** Vorauswahl: diese Seite als Quelle */
  sourcePageId: string | null;
}

const useBoardAi = create<BoardAiState>(() => ({ pageId: null, sourcePageId: null }));

export function openBoardAi(pageId: string, sourcePageId: string | null = null): void {
  useBoardAi.setState({ pageId, sourcePageId });
}

/** Neues Board unter der aktuellen Seite anlegen und direkt mit deren Inhalt füllen. */
export async function pageToBoard(pageId: string): Promise<void> {
  try {
    const boardId = await createBoard(pageId);
    useUI.getState().setExpanded(pageId, true);
    useUI.getState().open(boardId);
    openBoardAi(boardId, pageId);
  } catch (err) {
    reportError('Board konnte nicht angelegt werden', err);
  }
}

type SourceKind = 'pdf' | 'page' | 'text';
type Mode = 'create' | 'cluster';

const FORMATS: { id: BoardLayout | 'auto'; label: string }[] = [
  { id: 'auto', label: 'Automatisch' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'clusters', label: 'Cluster' },
  { id: 'flow', label: 'Ablauf' },
];

const SOURCES: { id: SourceKind; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'page', label: 'Seite', icon: Shapes },
  { id: 'text', label: 'Text', icon: Type },
];

export function BoardAiDialog() {
  const pageId = useBoardAi((s) => s.pageId);
  const sourcePageId = useBoardAi((s) => s.sourcePageId);
  if (!pageId) return null;
  return <Dialog key={pageId} pageId={pageId} initialSourcePage={sourcePageId} />;
}

function Dialog({ pageId, initialSourcePage }: { pageId: string; initialSourcePage: string | null }) {
  const pages = usePages((s) => s.pages);
  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [mode, setMode] = useState<Mode>('create');
  const [kind, setKind] = useState<SourceKind>(initialSourcePage ? 'page' : 'pdf');
  const [pdf, setPdf] = useState<Extract<BoardSource, { kind: 'pdf' }> | null>(null);
  const [sourcePage, setSourcePage] = useState<string | null>(initialSourcePage);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [format, setFormat] = useState<BoardLayout | 'auto'>('auto');
  const [focus, setFocus] = useState('');
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    waitForBoard(pageId, 3_000)
      .then((bridge) => {
        const selected = bridge.selectedNotes();
        setNotes(selected);
        if (selected.length >= 3 && !initialSourcePage) setMode('cluster');
      })
      .catch(() => undefined);
  }, [pageId, initialSourcePage]);

  const close = () => {
    controller.current?.abort();
    useBoardAi.setState({ pageId: null, sourcePageId: null });
  };

  const candidates = useMemo(() => {
    const live = Object.values(pages).filter((p) => p.deletedAt === null && p.type === 'page' && p.id !== pageId);
    return fuzzyFilter(live, query, (p) => [pageTitle(p)]).slice(0, 7);
  }, [pages, query, pageId]);

  const pickPdf = async () => {
    try {
      const path = await open({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (typeof path !== 'string') return;
      const file = await invoke<{ name: string; data: string; size: number }>('ai_read_pdf', { path });
      setPdf({ kind: 'pdf', ...file });
    } catch (err) {
      reportError('PDF', err);
    }
  };

  const buildSource = async (): Promise<BoardSource | null> => {
    if (kind === 'pdf') return pdf;
    if (kind === 'text') return text.trim() ? { kind: 'text', text: text.trim() } : null;
    if (!sourcePage) return null;
    const doc = await loadDoc(sourcePage);
    const markdown = doc ? toAiMarkdown(doc) : '';
    if (!markdown.trim()) throw new Error('Die gewählte Seite ist leer.');
    return { kind: 'page', title: pageTitle(pages[sourcePage]), markdown };
  };

  const ready = mode === 'cluster' ? notes.length >= 3 : kind === 'pdf' ? !!pdf : kind === 'page' ? !!sourcePage : !!text.trim();

  const start = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    try {
      if (mode === 'cluster') await runCluster(pageId, notes, focus, abort.signal);
      else {
        const source = await buildSource();
        if (!source) return;
        await runBoard(pageId, source, format, focus, abort.signal);
      }
      useBoardAi.setState({ pageId: null, sourcePageId: null });
    } catch (err) {
      if (!(err instanceof AiCancelled)) reportError('KI-Board', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal onClose={close} position="center" className="w-[520px] p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-accent" />
        <h2 className="text-base font-semibold">Board mit KI</h2>
      </div>

      {notes.length >= 3 && (
        <div className="mt-4 flex gap-1.5">
          {(['create', 'cluster'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx('h-8 flex-1 rounded-md border text-sm', mode === m ? 'border-accent bg-accent-soft' : 'border-border text-muted hover:bg-hover')}
            >
              {m === 'create' ? 'Neuen Inhalt erstellen' : `${notes.length} Post-its clustern`}
            </button>
          ))}
        </div>
      )}

      {mode === 'cluster' ? (
        <p className="mt-4 text-sm text-muted">
          Claude gruppiert die ausgewählten Post-its nach Themen, gibt jeder Gruppe eine Überschrift und ordnet sie neu an. Mit ⌘Z
          machst du das rückgängig.
        </p>
      ) : (
        <>
          <div className="mt-4 flex gap-1.5">
            {SOURCES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setKind(id)}
                className={cx(
                  'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-sm',
                  kind === id ? 'border-accent bg-accent-soft' : 'border-border text-muted hover:bg-hover',
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="mt-3 min-h-[120px]">
            {kind === 'pdf' && (
              <div className="flex items-center gap-2">
                <button onClick={() => void pickPdf()} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-hover">
                  PDF wählen …
                </button>
                <span className="truncate text-sm text-muted">
                  {pdf ? `${pdf.name} · ${(pdf.size / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : 'Noch keine Datei gewählt'}
                </span>
              </div>
            )}
            {kind === 'page' && (
              <div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Seite suchen …"
                  className="h-8 w-full rounded-md border border-border bg-bg px-2 text-sm outline-none focus:border-border-strong"
                />
                <div className="mt-1.5 max-h-[160px] overflow-y-auto">
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSourcePage(p.id)}
                      className={cx('flex h-8 w-full items-center rounded-md px-2 text-left text-sm', sourcePage === p.id ? 'bg-accent-soft' : 'hover:bg-hover')}
                    >
                      <span className="truncate">{pageTitle(p)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {kind === 'text' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Notizen, Interview-Mitschrift, Ideen … hier einfügen"
                className="w-full resize-none rounded-md border border-border bg-bg p-2 text-sm outline-none focus:border-border-strong"
              />
            )}
          </div>
          <div className="mt-2">
            <div className="mb-1.5 text-xs font-medium text-faint">Format</div>
            <div className="flex gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cx('h-8 flex-1 rounded-md border text-sm', format === f.id ? 'border-accent bg-accent-soft' : 'border-border text-muted hover:bg-hover')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <input
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder={mode === 'cluster' ? 'Wonach gruppieren? (optional)' : 'Worauf soll Claude achten? (optional)'}
        className="mt-4 h-8 w-full rounded-md border border-border bg-bg px-2 text-sm outline-none focus:border-border-strong"
      />

      <div className="mt-5 flex items-center justify-end gap-2">
        {running && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-muted">
            <Loader2 size={13} className="animate-spin" /> Claude arbeitet …
          </span>
        )}
        {running ? (
          <button onClick={() => controller.current?.abort()} className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-hover">
            <Square size={11} /> Stopp
          </button>
        ) : (
          <button onClick={close} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-hover">
            Abbrechen
          </button>
        )}
        <button
          onClick={() => void start()}
          disabled={!ready || running}
          className="h-8 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {mode === 'cluster' ? 'Clustern' : 'Board erstellen'}
        </button>
      </div>
      <p className="mt-3 text-xs text-faint">Vor dem Start siehst du die geschätzten Kosten.</p>
    </Modal>
  );
}

/** Freie Fläche rechts neben dem vorhandenen Inhalt */
function origin(bounds: { maxX: number; minY: number } | null) {
  return bounds ? { x: Math.round(bounds.maxX + 200), y: Math.round(bounds.minY) } : { x: 0, y: 0 };
}

async function runBoard(pageId: string, source: BoardSource, format: BoardLayout | 'auto', focus: string, signal: AbortSignal): Promise<void> {
  const result = await askAi(boardRequest(source, format, focus), { signal });
  if (!result) return;
  let plan: BoardPlan;
  try {
    plan = normalizePlan(JSON.parse(result.text) as BoardPlan);
  } catch {
    throw new Error('Die Antwort war unvollständig. Versuch es noch einmal.');
  }
  const bridge = await waitForBoard(pageId);
  const { elements } = layoutBoard(plan, origin(bridge.bounds()));
  if (!elements.length) throw new Error('Claude hat keinen verwertbaren Inhalt gefunden.');
  bridge.insert(elements);
  toast(`Board erstellt · ${costNote(result)}`);
}

async function runCluster(pageId: string, notes: BoardNote[], focus: string, signal: AbortSignal): Promise<void> {
  const result = await askAi(clusterRequest(notes.map((n) => n.text), focus), { signal });
  if (!result) return;
  let plan: ClusterPlan;
  try {
    plan = repairClusters(JSON.parse(result.text) as ClusterPlan, notes.length);
  } catch {
    throw new Error('Die Antwort war unvollständig. Versuch es noch einmal.');
  }
  const bridge = await waitForBoard(pageId);
  const size = Math.max(...notes.map((n) => Math.max(n.width, n.height)));
  const { headers, positions } = layoutClusters(plan.groups, origin(bridge.bounds()), size);
  const moves = notes.flatMap((n, i) => {
    const p = positions.get(i);
    return p ? [{ id: n.id, ...p }] : [];
  });
  bridge.arrange(moves, headers);
  toast(`${plan.groups.length} Gruppen · ${costNote(result)}`);
}
