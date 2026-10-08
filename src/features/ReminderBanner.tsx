import { BellRing, X } from 'lucide-react';
import { useUI } from '../store/ui';
import { dismissReminders, useReminders, ymd } from './reminders';

/** Hinweis unten rechts: heute fällige Einträge, ein Klick öffnet sie. */
export function ReminderBanner() {
  const due = useReminders((s) => s.due);
  const dismissed = useReminders((s) => s.dismissed);
  if (!due.length || dismissed === ymd(new Date())) return null;
  return (
    <div className="animate-pop-in rounded-lg border border-border bg-surface p-3 shadow-popover">
      <div className="mb-1.5 flex items-center gap-2">
        <BellRing size={15} className="text-accent" />
        <span className="flex-1 text-sm font-semibold">Heute fällig</span>
        <button aria-label="Für heute ausblenden" onClick={dismissReminders} className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col">
        {due.slice(0, 6).map((d) => (
          <button
            key={`${d.pageId}:${d.propertyId}`}
            onClick={() => useUI.getState().open(d.pageId)}
            className="flex h-8 items-center gap-2 rounded-md px-1.5 text-left text-sm hover:bg-hover"
          >
            <span className="min-w-0 flex-1 truncate">{d.title || 'Ohne Titel'}</span>
            <span className="shrink-0 text-2xs text-faint">{d.name}</span>
          </button>
        ))}
        {due.length > 6 && <span className="px-1.5 pt-1 text-2xs text-faint">und {due.length - 6} weitere</span>}
      </div>
    </div>
  );
}
