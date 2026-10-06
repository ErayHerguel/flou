import { ChevronLeft, ChevronRight, MoreHorizontal, MoveHorizontal, PanelLeft, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useState } from 'react';
import { IconButton } from '../../components/IconButton';
import { MenuList } from '../../components/MenuList';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { Popover, type Anchor } from '../../components/Popover';
import { useSaveStatus } from '../../db/saveQueue';
import { ancestorIds } from '../../lib/tree';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { actionById } from '../actions';
import { formatCombo } from '../shortcuts/keys';

/** Abstand für die Ampel-Knöpfe, wenn die Seitenleiste ausgeblendet ist. */
const TRAFFIC_LIGHT_INSET = 84;

export function TopBar({ pageId }: { pageId: string | null }) {
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const canBack = useUI((s) => s.back.length > 0);
  const canForward = useUI((s) => s.forward.length > 0);
  const pages = usePages((s) => s.pages);
  const page = pageId ? pages[pageId] : undefined;
  const crumbs = page ? [...ancestorIds(pages, page.id), page.id] : [];
  const [menu, setMenu] = useState<Anchor | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center gap-1 pr-3"
      style={{ paddingLeft: sidebarOpen ? 12 : TRAFFIC_LIGHT_INSET }}
    >
      {!sidebarOpen && (
        <IconButton
          icon={PanelLeft}
          label={`Seitenleiste einblenden (${formatCombo('Mod+\\')})`}
          onClick={() => useUI.getState().toggleSidebar()}
        />
      )}
      <IconButton icon={ChevronLeft} label={`Zurück (${formatCombo('Mod+[')})`} disabled={!canBack} onClick={() => useUI.getState().goBack()} />
      <IconButton icon={ChevronRight} label={`Vorwärts (${formatCombo('Mod+]')})`} disabled={!canForward} onClick={() => useUI.getState().goForward()} />

      <nav className="ml-1 flex min-w-0 items-center text-sm" aria-label="Pfad">
        {crumbs.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && <span className="px-0.5 text-faint">/</span>}
            <button
              onClick={() => useUI.getState().open(id)}
              className="flex h-7 min-w-0 max-w-[200px] items-center gap-1.5 rounded-md px-1.5 text-muted hover:bg-hover hover:text-text"
            >
              <PageIcon page={pages[id]} size={14} />
              <span className="truncate">{pageTitle(pages[id])}</span>
            </button>
          </Fragment>
        ))}
      </nav>

      <div data-tauri-drag-region className="h-full flex-1" />
      <SaveIndicator />
      {page && (
        <IconButton icon={MoreHorizontal} label="Seitenoptionen" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())} />
      )}
      {menu && page && (
        <Popover anchor={menu} onClose={closeMenu} placement="bottom-end">
          <MenuList
            onDone={closeMenu}
            items={[
              {
                label: page.fullWidth ? 'Normale Breite' : 'Volle Breite',
                icon: MoveHorizontal,
                hint: formatCombo(actionById('page.fullWidth').keys!),
                onSelect: () => void actionById('page.fullWidth').run(),
              },
              {
                label: 'In den Papierkorb',
                icon: Trash2,
                danger: true,
                hint: formatCombo(actionById('page.trash').keys!),
                onSelect: () => void usePages.getState().trash(page.id),
              },
            ]}
          />
        </Popover>
      )}
    </header>
  );
}

function SaveIndicator() {
  const { status, error } = useSaveStatus();
  if (status === 'error') {
    return (
      <span title={error ?? undefined} className="mr-2 text-xs text-danger">
        Nicht gespeichert – neuer Versuch läuft
      </span>
    );
  }
  if (status === 'saving') return <span className="mr-2 text-xs text-faint">Speichert …</span>;
  return null;
}
