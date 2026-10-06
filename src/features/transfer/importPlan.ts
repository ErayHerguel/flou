import type { JSONContent } from '@tiptap/core';
import { fromMarkdown, stripFrontMatter } from '../../lib/markdown/parse';

export interface InFile {
  /** Pfad relativ zum gewählten Ordner mit "/" */
  rel: string;
  abs: string;
  content: string;
}

export interface ImportNode {
  key: string;
  id: string;
  parentKey: string | null;
  title: string;
  doc: JSONContent | null;
}

export interface ImportPlan {
  /** Eltern stehen immer vor ihren Kindern */
  nodes: ImportNode[];
  /** Absolute Bildpfade; im Dokument steht "import:<index>" als Platzhalter */
  images: string[];
}

export const IMAGE_PLACEHOLDER = 'import:';

const stripExt = (path: string) => path.replace(/\.(md|markdown)$/i, '');
/** Notion hängt beim Export eine 32-stellige ID an Datei- und Ordnernamen. */
const cleanTitle = (segment: string) => segment.replace(/\s[0-9a-f]{32}$/i, '').trim() || 'Ohne Titel';
const parentOf = (key: string) => (key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : null);

function normalize(segments: string[]): string[] | null {
  const out: string[] = [];
  for (const s of segments) {
    if (s === '' || s === '.') continue;
    if (s === '..') {
      if (!out.length) return null;
      out.pop();
    } else out.push(s);
  }
  return out;
}

function joinAbs(dir: string, relative: string): string {
  return [...dir.split('/'), ...relative.split('/')].reduce<string[]>((acc, s) => {
    if (s === '..') acc.pop();
    else if (s !== '.') acc.push(s);
    return acc;
  }, []).join('/');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Entfernt eine führende H1, wenn sie dem Seitentitel entspricht (so exportiert Flou selbst). */
function takeTitle(doc: JSONContent, fallback: string): { title: string; doc: JSONContent } {
  const first = doc.content?.[0];
  if (first?.type === 'heading' && first.attrs?.level === 1) {
    const text = (first.content ?? []).map((c) => c.text ?? '').join('').trim();
    if (text) {
      const rest = doc.content!.slice(1);
      return { title: text, doc: { ...doc, content: rest.length ? rest : [{ type: 'paragraph' }] } };
    }
  }
  return { title: fallback, doc };
}

/**
 * Baut aus Markdown-Dateien einen Seitenbaum: "A.md" und Ordner "A/" werden zu einer Seite A
 * mit Unterseiten. Relative Links und [[Titel]] werden zu Seitenlinks, lokale Bilder zu Platzhaltern.
 */
export function planImport(files: InFile[], newId: () => string, existingTitles: Map<string, string>): ImportPlan {
  const nodes = new Map<string, ImportNode>();
  const ensure = (key: string) => {
    let node = nodes.get(key);
    if (!node) {
      node = { key, id: newId(), parentKey: parentOf(key), title: cleanTitle(key.split('/').pop()!), doc: null };
      nodes.set(key, node);
      if (node.parentKey) ensure(node.parentKey);
    }
    return node;
  };
  const sources = new Map<string, InFile>();
  for (const file of files) {
    const key = stripExt(file.rel);
    ensure(key);
    sources.set(key, file);
  }

  // Erster Durchgang: Titel aus führender H1, damit [[Titel]] dateiübergreifend auflösbar ist.
  for (const [key, file] of sources) {
    const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(stripFrontMatter(file.content).trimStart().split('\n')[0] ?? '');
    if (heading) nodes.get(key)!.title = heading[1].trim();
  }

  // Titel für [[Links]]: importierte Seiten haben Vorrang vor bestehenden.
  const titles = new Map(existingTitles);
  for (const node of nodes.values()) titles.set(node.title.toLowerCase(), node.id);

  const images: string[] = [];
  for (const [key, file] of sources) {
    const node = nodes.get(key)!;
    const dir = parentOf(file.rel) ?? '';
    const absDir = file.abs.slice(0, file.abs.lastIndexOf('/'));
    const parsed = fromMarkdown(file.content, {
      resolvePage(target, kind) {
        if (kind === 'title') return titles.get(target.toLowerCase()) ?? null;
        const path = safeDecode(target.split('#')[0]);
        if (!/\.(md|markdown)$/i.test(path)) return null;
        const segments = normalize([...(dir ? dir.split('/') : []), ...path.split('/')]);
        return segments ? (nodes.get(stripExt(segments.join('/')))?.id ?? null) : null;
      },
      image(src) {
        images.push(joinAbs(absDir, safeDecode(src)));
        return `${IMAGE_PLACEHOLDER}${images.length - 1}`;
      },
    });
    const { title, doc } = takeTitle(parsed, node.title);
    node.title = title;
    node.doc = doc;
  }

  // Eltern vor Kindern, Geschwister alphabetisch (natürliche Sortierung)
  const collator = new Intl.Collator('de', { numeric: true });
  const ordered = [...nodes.values()].sort((a, b) => {
    const depth = a.key.split('/').length - b.key.split('/').length;
    return depth || collator.compare(a.key, b.key);
  });
  return { nodes: ordered, images };
}

/** Ersetzt Bild-Platzhalter; nicht importierbare Bilder werden entfernt. */
export function resolveImages(doc: JSONContent, imported: (string | null)[]): JSONContent {
  const walk = (node: JSONContent): JSONContent | null => {
    if (node.type === 'image') {
      const src = String(node.attrs?.src ?? '');
      if (!src.startsWith(IMAGE_PLACEHOLDER)) return node;
      const name = imported[Number(src.slice(IMAGE_PLACEHOLDER.length))];
      return name ? { ...node, attrs: { ...node.attrs, src: name } } : null;
    }
    if (!node.content) return node;
    const content = node.content.map(walk).filter((n): n is JSONContent => n !== null);
    return { ...node, content: content.length || node.type !== 'doc' ? content : [{ type: 'paragraph' }] };
  };
  return walk(doc) ?? { type: 'doc', content: [{ type: 'paragraph' }] };
}
