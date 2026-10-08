import type { BoardElement } from '../collab/sources';

/** Wie bei Excalidraw: die höhere Version gewinnt, bei Gleichstand die kleinere versionNonce. */
export function newer(incoming: BoardElement, current: BoardElement | undefined): boolean {
  if (!current) return true;
  if (incoming.version !== current.version) return incoming.version > current.version;
  return incoming.versionNonce < current.versionNonce;
}

/** Excalidraw sortiert über gebrochene Indizes (Zeichenketten, lexikografisch vergleichbar). */
export function ordered(elements: Iterable<BoardElement>): BoardElement[] {
  return [...elements].sort((a, b) => {
    const x = typeof a.index === 'string' ? a.index : '';
    const y = typeof b.index === 'string' ? b.index : '';
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
