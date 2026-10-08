import { pageTitle } from '../components/PageIcon';
import { usePages } from '../store/pages';

/** SVG-Pfade aus lucide (ISC) für Node-Views, die ohne React gerendert werden. */
const ICONS = {
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  shapes: '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
} as const;

export function icon(name: keyof typeof ICONS, size = 16): SVGSVGElement {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return wrapper.firstElementChild as SVGSVGElement;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * Zeigt Icon und Titel einer Seite in `container` und hält sie aktuell, solange die Node-View lebt.
 * Liefert die Abmeldefunktion.
 */
export function bindPageChip(container: HTMLElement, pageId: () => string, withArrow = false): () => void {
  const render = () => {
    const page = usePages.getState().pages[pageId()];
    const missing = !page || page.deletedAt !== null;
    const iconEl = el('span', 'page-chip-icon');
    if (page?.icon) iconEl.textContent = page.icon;
    else iconEl.append(icon(page?.type === 'database' ? 'database' : page?.type === 'board' ? 'shapes' : 'file', 15));
    const titleEl = el('span', 'page-chip-title');
    titleEl.textContent = missing ? (page ? `${pageTitle(page)} (im Papierkorb)` : 'Gelöschte Seite') : pageTitle(page);
    container.replaceChildren(...(withArrow ? [iconEl, titleEl, icon('arrowUpRight', 12)] : [iconEl, titleEl]));
    container.classList.toggle('is-missing', missing);
  };
  render();
  return usePages.subscribe((state, prev) => {
    const id = pageId();
    if (state.pages[id] !== prev.pages[id]) render();
  });
}
