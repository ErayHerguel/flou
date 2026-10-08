import { useSyncExternalStore } from 'react';

/** Schmaler Bildschirm (Handy, sehr schmales Fenster): Seitenleiste als Ausklappmenü. */
const QUERY = '(max-width: 767px)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

export const isNarrow = () => window.matchMedia(QUERY).matches;

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, isNarrow, () => false);
}
