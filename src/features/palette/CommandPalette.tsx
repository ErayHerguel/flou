import { CornerDownLeft, FileText, Plus, Search, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { MARK_END, MARK_START, searchPages, type SearchHit } from '../../db/search';
import { cx } from '../../lib/cx';
import { GUEST } from '../../lib/mode';
import { connection } from '../collab/guest/connection';
import { fuzzyFilter } from '../../lib/fuzzy';
import { usePages } from '../../store/pages';
import { reportError } from '../../store/toast';
import { useUI } from '../../store/ui';
import { availableActions as actions, type AppAction } from '../actions';
import { formatCombo } from '../shortcuts/keys';

type Item =
  | { kind: 'page'; id: string; snippet?: string; section: string }
  | { kind: 'action'; action: AppAction; section: string }
  | { kind: 'create'; title: string; section: string };

const paletteActions = actions.filter((a) => !a.hideInPalette);

/** Hebt Treffer im Snippet hervor, ohne HTML zu interpretieren. */
function Snippet({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const start = rest.indexOf(MARK_START);
    if (start === -1) {
      parts.push(rest);
      break;
    }
    const end = rest.indexOf(MARK_END, start);
    parts.push(rest.slice(0, start));
    parts.push(
      <mark key={key++} className="rounded-sm bg-mark text-text">
        {rest.slice(start + 1, end === -1 ? undefined : end)}
      </mark>,
    );
    rest = end === -1 ? '' : rest.slice(end + 1);
  }
  return <span className="block truncate text-xs text-faint">{parts}</span>;
}

/**
 * Befehlspalette (Mod+K): Seiten nach Titel (fuzzy) und Volltext (FTS5) finden, Aktionen ausführen, Seiten anlegen.
 * "&gt;" am Anfang zeigt nur Aktionen.
 */
export function CommandPalette({ mode }: { mode: 'palette' | 'search' }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pages = usePages((s) => s.pages);
  const close = () => useUI.getState().setOverlay(null);

  const actionMode = query.startsWith('>');
  const q = (actionMode ? query.slice(1) : query).trim();

  useEffect(() => {
    if (actionMode || !q) {
      setHits([]);
      setElapsed(null);
      return;
    }
    let alive = true;
    const started = performance.now();
    (GUEST ? connection.request<SearchHit[]>({ op: 'search', query: q }) : searchPages(q, 20))
      .then((result) => {
        if (!alive) return;
        setHits(result);
        setElapsed(performance.now() - started);
      })
      .catch((err) => reportError('Suche fehlgeschlagen', err));
    return () => {
      alive = false;
    };
  }, [q, actionMode]);

  const items = useMemo<Item[]>(() => {
    const live = Object.values(pages).filter((p) => p.deletedAt === null);
    const actionItems = (list: AppAction[]): Item[] => list.map((action) => ({ kind: 'action', action, section: 'Aktionen' }));
    if (actionMode) return actionItems(fuzzyFilter(paletteActions, q, (a) => [a.label, a.group]));
    if (!q) {
      const recent = [...live].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
      return [...recent.map<Item>((p) => ({ kind: 'page', id: p.id, section: 'Zuletzt bearbeitet' })), ...actionItems(paletteActions.slice(0, 6))];
    }
    const byTitle = fuzzyFilter(live, q, (p) => [p.title]).slice(0, 8);
    const titleIds = new Set(byTitle.map((p) => p.id));
    const snippets = new Map(hits.map((h) => [h.id, h.snippet]));
    const titleItems: Item[] = byTitle.map((p) => ({ kind: 'page', id: p.id, snippet: snippets.get(p.id), section: 'Seiten' }));
    const textItems: Item[] = hits
      .filter((h) => !titleIds.has(h.id) && pages[h.id])
      .slice(0, 10)
      .map((h) => ({ kind: 'page', id: h.id, snippet: h.snippet, section: 'Im Inhalt gefunden' }));
    // Gäste legen keine Seiten auf oberster Ebene an.
    const create: Item[] = GUEST ? [] : [{ kind: 'create', title: q, section: 'Neu' }];
    const actionMatches = actionItems(fuzzyFilter(paletteActions, q, (a) => [a.label]).slice(0, 4));
    return mode === 'search'
      ? [...textItems, ...titleItems, ...create]
      : [...titleItems, ...textItems, ...actionMatches, ...create];
  }, [pages, hits, q, actionMode, mode]);

  useEffect(() => setActive(0), [items.length, q]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = async (item: Item) => {
    close();
    if (item.kind === 'page') useUI.getState().open(item.id);
    else if (item.kind === 'action') await item.action.run();
    else {
      const id = await usePages.getState().create({ title: item.title });
      useUI.getState().open(id);
      useUI.getState().requestFocus('editor');
    }
  };

  return (
    <Modal onClose={close} className="flex max-h-[60vh] w-[620px] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search size={16} className="shrink-0 text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setActive((i) => (items.length ? (i + step + items.length) % items.length : 0));
            } else if (e.key === 'Enter' && items[active]) {
              e.preventDefault();
              void run(items[active]);
            }
          }}
          placeholder={mode === 'search' ? 'Volltext durchsuchen …' : 'Seite suchen, Befehl ausführen („>“ nur Befehle) …'}
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.map((item, i) => {
          const showSection = i === 0 || items[i - 1].section !== item.section;
          return (
            <div key={`${item.kind}:${item.kind === 'page' ? item.id : item.kind === 'action' ? item.action.id : item.title}`}>
              {showSection && <div className="px-2.5 pt-2 pb-1 text-2xs font-medium text-faint">{item.section}</div>}
              <button
                data-active={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => void run(item)}
                className={cx('flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left', i === active && 'bg-hover')}
              >
                {item.kind === 'page' && (
                  <>
                    <PageIcon page={pages[item.id]} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{pageTitle(pages[item.id])}</span>
                      {item.snippet && <Snippet text={item.snippet} />}
                    </span>
                  </>
                )}
                {item.kind === 'action' && (
                  <>
                    <Zap size={15} className="shrink-0 text-faint" />
                    <span className="flex-1 truncate text-sm">{item.action.label}</span>
                    {item.action.keys && <kbd className="font-sans text-xs text-faint">{formatCombo(item.action.keys)}</kbd>}
                  </>
                )}
                {item.kind === 'create' && (
                  <>
                    <Plus size={15} className="shrink-0 text-faint" />
                    <span className="flex-1 truncate text-sm">
                      Neue Seite „{item.title}“
                    </span>
                    <FileText size={14} className="text-faint" />
                  </>
                )}
                {i === active && <CornerDownLeft size={13} className="shrink-0 text-faint" />}
              </button>
            </div>
          );
        })}
        {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-faint">Keine Treffer</div>}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-2xs text-faint">
        <span>↑↓ auswählen · ↩ öffnen · esc schließen</span>
        {elapsed !== null && <span>Volltextsuche in {elapsed < 1 ? '<1' : Math.round(elapsed)} ms</span>}
      </div>
    </Modal>
  );
}
