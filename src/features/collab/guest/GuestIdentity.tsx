import { Avatar } from '../presence';
import { useConnection } from './connection';
import { useGuest } from './session';

/** Unten in der Seitenleiste: wer ich bin und wessen Workspace das ist. */
export function GuestIdentity() {
  const me = useGuest((s) => s.me);
  const host = useGuest((s) => s.host);
  if (!me) return <div className="flex-1" />;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
      <Avatar person={me} size={22} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm text-text">{me.name}</div>
        {host && <div className="truncate text-2xs text-faint">Workspace von {host.name}</div>}
      </div>
    </div>
  );
}

/** Oben rechts: Hinweis, solange die Verbindung zum Gastgeber fehlt. */
export function ConnectionIndicator() {
  const status = useConnection((s) => s.status);
  if (status !== 'offline') return null;
  return <span className="mr-2 text-xs text-danger">Verbindung getrennt – verbinde neu …</span>;
}
