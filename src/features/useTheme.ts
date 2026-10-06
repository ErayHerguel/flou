import { useEffect } from 'react';
import { useUI } from '../store/ui';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Setzt die .dark-Klasse passend zu Einstellung und System. */
export function useTheme(): void {
  const theme = useUI((s) => s.theme);
  useEffect(() => {
    const query = darkQuery();
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && query.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);
}
