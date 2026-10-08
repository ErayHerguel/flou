import { Copy, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Popover, type Anchor } from '../../../components/Popover';
import { pageTitle } from '../../../components/PageIcon';
import { usePages } from '../../../store/pages';
import { useUI } from '../../../store/ui';
import { grantSource, grantsOf, type Role } from '../access';
import { Avatar } from '../presence';
import { useHosting } from './hosting';
import { copyInvite } from './ShareDialog';

const LABEL: Record<Role, string> = { none: 'Kein Zugriff', read: 'Kann lesen', edit: 'Kann bearbeiten' };

/** „Teilen“ oben rechts: wer darf diese Seite (samt Unterseiten) sehen oder bearbeiten? */
export function PageShareButton({ pageId }: { pageId: string }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const shared = useHosting((s) => s.grants.some((g) => g.pageId === pageId && g.role !== 'none'));
  return (
    <>
      <button
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-hover hover:text-text"
      >
        <Users size={15} className={shared ? 'text-accent' : undefined} /> Teilen
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={close} placement="bottom-end">
          <PageSharePanel pageId={pageId} onClose={close} />
        </Popover>
      )}
    </>
  );
}

function PageSharePanel({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const pages = usePages((s) => s.pages);
  const allMembers = useHosting((s) => s.members);
  // Eigene Geräte sehen ohnehin alles; hier geht es um Personen.
  const members = useMemo(() => allMembers.filter((m) => m.kind === 'person'), [allMembers]);
  const grants = useHosting((s) => s.grants);
  const status = useHosting((s) => s.status);
  const live = useHosting((s) => s.live);
  const page = pages[pageId];
  if (!page) return null;

  const openDialog = () => {
    onClose();
    useUI.getState().setOverlay('share');
  };

  return (
    <div className="w-[380px] p-3">
      <div className="mb-2 truncate text-sm font-semibold">„{pageTitle(page)}“ teilen</div>
      {members.length === 0 ? (
        <p className="py-2 text-sm text-faint">Noch niemand eingeladen.</p>
      ) : (
        <div className="space-y-1">
          {members.map((member) => {
            const own = grantsOf(grants, member.id);
            const direct = own.get(pageId) ?? null;
            const inherited = page.parentId ? grantSource(pages, own, page.parentId) : null;
            const inheritLabel = inherited
              ? `Wie „${pageTitle(pages[inherited.pageId])}“: ${LABEL[inherited.role]}`
              : 'Kein Zugriff (nicht geteilt)';
            return (
              <div key={member.id} className="flex items-center gap-2">
                <Avatar person={member} />
                <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                <select
                  value={direct ?? 'inherit'}
                  onChange={(e) => {
                    const value = e.target.value;
                    void useHosting.getState().setRole(member.id, pageId, value === 'inherit' ? null : (value as Role));
                  }}
                  className="h-7 max-w-[190px] rounded-md border border-border bg-bg px-1 text-xs outline-none"
                  aria-label={`Zugriff für ${member.name}`}
                >
                  <option value="inherit">{inheritLabel}</option>
                  <option value="read">{LABEL.read}</option>
                  <option value="edit">{LABEL.edit}</option>
                  <option value="none">{LABEL.none}</option>
                </select>
                <button
                  onClick={() => void copyInvite(status, member)}
                  disabled={!status.url}
                  title={status.url ? 'Einladungslink kopieren' : 'Erst verfügbar, wenn das Teilen online ist'}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text disabled:opacity-40"
                >
                  <Copy size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs text-faint">
        <span className="flex-1">
          {live ? (status.phase === 'online' ? 'Teilen ist online.' : 'Teilen startet …') : 'Teilen ist aus.'} Unterseiten erben die Rechte.
        </span>
        <button onClick={openDialog} className="h-7 rounded-md px-2 text-xs font-medium text-accent hover:bg-hover">
          {members.length === 0 ? 'Person einladen …' : 'Verwalten …'}
        </button>
      </div>
    </div>
  );
}
