import { ChevronsLeft, House, Monitor, Moon, Plus, Search, Sun, Trash2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { APP_NAME } from '../../app.config';
import logo from '../../assets/logo.svg';
import { IconButton } from '../../components/IconButton';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { usePages } from '../../store/pages';
import { cx } from '../../lib/cx';
import { useUI, type Theme } from '../../store/ui';
import { actionById } from '../actions';
import { formatCombo } from '../shortcuts/keys';
import { PageTree } from './PageTree';
import { Resizer } from './Resizer';

const THEME_ORDER: Theme[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<Theme, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABEL: Record<Theme, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' };

export function Sidebar() {
  const open = useUI((s) => s.sidebarOpen);
  const width = useUI((s) => s.sidebarWidth);
  const theme = useUI((s) => s.theme);
  const [resizing, setResizing] = useState(false);
  const ThemeIcon = THEME_ICON[theme];
  const newPage = actionById('page.new');
  const palette = actionById('palette.open');
  const homeId = useUI((s) => s.homeId);
  const favorites = useUI((s) => s.favorites);
  const currentId = useUI((s) => s.currentId);
  const pages = usePages((s) => s.pages);
  const liveFavorites = favorites.filter((id) => pages[id] && pages[id].deletedAt === null);
  const hasHome = Boolean(homeId && pages[homeId] && pages[homeId].deletedAt === null);

  return (
    <aside
      aria-hidden={!open}
      className={cx(
        'relative h-full shrink-0 bg-sidebar print:hidden',
        !resizing && 'transition-[width] duration-150',
        open && 'border-r border-border',
      )}
      style={{ width: open ? width : 0 }}
    >
      <div className={cx('flex h-full flex-col overflow-hidden', !open && 'invisible')} style={{ width }}>
        <div data-tauri-drag-region className="h-11 shrink-0" />
        <div className="group flex h-9 shrink-0 items-center gap-2 px-3">
          <img src={logo} alt="" className="h-5 w-5 rounded-[5px]" draggable={false} />
          <span className="flex-1 truncate text-sm font-semibold text-text">{APP_NAME}</span>
          <IconButton
            icon={ChevronsLeft}
            label={`Seitenleiste ausblenden (${formatCombo('Mod+\\')})`}
            onClick={() => useUI.getState().toggleSidebar()}
            className="opacity-0 group-hover:opacity-100"
          />
        </div>

        <div className="mt-1 flex flex-col px-2">
          <SidebarButton icon={Search} onClick={() => void palette.run()} hint={palette.keys && formatCombo(palette.keys)}>
            Suchen
          </SidebarButton>
          <SidebarButton icon={Plus} onClick={() => void newPage.run()} hint={newPage.keys && formatCombo(newPage.keys)}>
            Neue Seite
          </SidebarButton>
          {hasHome && (
            <SidebarButton icon={House} onClick={() => useUI.getState().open(homeId!)} hint={formatCombo('Mod+Shift+O')}>
              Startseite
            </SidebarButton>
          )}
        </div>

        {liveFavorites.length > 0 && (
          <>
            <div className="mt-4 mb-1 px-4 text-2xs font-medium tracking-wide text-faint uppercase">Favoriten</div>
            <div className="flex flex-col px-2">
              {liveFavorites.map((id) => (
                <button
                  key={id}
                  onClick={() => useUI.getState().open(id)}
                  className={cx(
                    'flex h-7 items-center gap-2 rounded-md px-2 text-sm',
                    currentId === id ? 'bg-active font-medium text-text' : 'text-muted hover:bg-hover',
                  )}
                >
                  <PageIcon page={pages[id]} />
                  <span className="truncate">{pageTitle(pages[id])}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 mb-1 px-4 text-2xs font-medium tracking-wide text-faint uppercase">Seiten</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <PageTree />
        </div>

        <div className="flex shrink-0 items-center gap-1 border-t border-border px-2 py-2">
          <SidebarButton icon={Trash2} onClick={() => useUI.getState().setOverlay('trash')} className="flex-1">
            Papierkorb
          </SidebarButton>
          <IconButton
            icon={ThemeIcon}
            label={`Erscheinungsbild: ${THEME_LABEL[theme]}`}
            onClick={() => {
              const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
              useUI.getState().setTheme(next);
            }}
          />
        </div>
      </div>
      {open && <Resizer onResizing={setResizing} />}
    </aside>
  );
}

interface SidebarButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  hint?: string;
  className?: string;
  children: ReactNode;
}

function SidebarButton({ icon: Icon, onClick, hint, className, children }: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cx('flex h-7 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-hover hover:text-text', className)}
    >
      <Icon size={15} className="shrink-0" />
      <span className="flex-1 truncate text-left">{children}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </button>
  );
}
