import { create } from 'zustand';
import { useUI } from '../../store/ui';
import type { Person } from './protocol';

/** Wer gerade verbunden ist; `me` ist die eigene Kennung ('host' beim Gastgeber). */
export const usePresence = create<{ people: Person[]; me: string | null }>(() => ({ people: [], me: null }));

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export function Avatar({ person, size = 24 }: { person: Pick<Person, 'name' | 'color'>; size?: number }) {
  return (
    <span
      title={person.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-bg"
      style={{ background: person.color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(person.name)}
    </span>
  );
}

/** Wer außer mir gerade dieselbe Seite offen hat. */
export function PagePresence() {
  const currentId = useUI((s) => s.currentId);
  const people = usePresence((s) => s.people);
  const me = usePresence((s) => s.me);
  const here = people.filter((p) => p.id !== me && currentId !== null && p.pageId === currentId);
  if (!here.length) return null;
  return (
    <div className="mr-1 flex -space-x-1.5" aria-label={`Auch hier: ${here.map((p) => p.name).join(', ')}`}>
      {here.slice(0, 5).map((p) => (
        <Avatar key={p.id} person={p} />
      ))}
      {here.length > 5 && <span className="ml-2 self-center text-xs text-muted">+{here.length - 5}</span>}
    </div>
  );
}
