import { Modal } from '../../components/Modal';
import { useUI } from '../../store/ui';
import { actions } from '../actions';
import { formatCombo } from './keys';

/** Kürzel, die der Editor selbst verarbeitet (TipTap-Standards und eigene Erweiterungen). */
const EDITOR_SHORTCUTS: [string, string][] = [
  ['Slash-Menü', '/'],
  ['Seitenlink', '[['],
  ['Fett', 'Mod+B'],
  ['Kursiv', 'Mod+I'],
  ['Unterstrichen', 'Mod+U'],
  ['Durchgestrichen', 'Mod+Shift+S'],
  ['Code', 'Mod+E'],
  ['Hervorheben', 'Mod+Shift+H'],
  ['Link', 'Mod+Shift+K'],
  ['Überschrift 1–3', 'Mod+Alt+1'],
  ['Aufzählung', 'Mod+Shift+8'],
  ['Nummerierte Liste', 'Mod+Shift+7'],
  ['To-do-Liste', 'Mod+Shift+9'],
  ['Zitat', 'Mod+Shift+B'],
  ['Codeblock', 'Mod+Alt+C'],
  ['Block nach oben', 'Mod+Shift+ArrowUp'],
  ['Block nach unten', 'Mod+Shift+ArrowDown'],
  ['Einrücken / Ausrücken', 'Tab'],
];

const MARKDOWN: [string, string][] = [
  ['Überschrift', '# ## ###'],
  ['Aufzählung', '- oder *'],
  ['Nummerierung', '1.'],
  ['To-do', '[]'],
  ['Zitat', '>'],
  ['Codeblock', '```'],
  ['Trenner', '---'],
  ['Fett / Kursiv', '**x** *x*'],
  ['Hervorhebung', '==x=='],
];

function Row({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex h-7 items-center justify-between gap-4 text-sm">
      <span className="truncate text-muted">{label}</span>
      <kbd className="shrink-0 rounded-sm border border-border bg-bg px-1.5 font-sans text-xs text-text">{keys}</kbd>
    </div>
  );
}

export function ShortcutsDialog() {
  const close = () => useUI.getState().setOverlay(null);
  const groups = new Map<string, typeof actions>();
  for (const action of actions.filter((a) => a.keys)) groups.set(action.group, [...(groups.get(action.group) ?? []), action]);

  return (
    <Modal onClose={close} className="max-h-[80vh] w-[760px] overflow-y-auto p-6">
      <h2 className="mb-4 text-lg font-semibold">Tastenkürzel</h2>
      <div className="grid grid-cols-2 gap-x-10 gap-y-6">
        {[...groups].map(([group, list]) => (
          <section key={group}>
            <h3 className="mb-1 text-2xs font-medium tracking-wide text-faint uppercase">{group}</h3>
            {list.map((a) => (
              <Row key={a.id} label={a.label} keys={formatCombo(a.keys!)} />
            ))}
          </section>
        ))}
        <section>
          <h3 className="mb-1 text-2xs font-medium tracking-wide text-faint uppercase">Editor</h3>
          {EDITOR_SHORTCUTS.map(([label, keys]) => (
            <Row key={label} label={label} keys={keys.includes('+') || keys === 'Tab' ? formatCombo(keys) : keys} />
          ))}
        </section>
        <section>
          <h3 className="mb-1 text-2xs font-medium tracking-wide text-faint uppercase">Markdown beim Tippen</h3>
          {MARKDOWN.map(([label, keys]) => (
            <Row key={label} label={label} keys={keys} />
          ))}
        </section>
      </div>
    </Modal>
  );
}
