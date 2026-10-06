import { describe, expect, it } from 'vitest';
import { planImport, resolveImages } from './importPlan';

let n = 0;
const id = () => `id${++n}`;

describe('Import-Planung', () => {
  it('baut den Seitenbaum aus Dateien und Ordnern', () => {
    n = 0;
    const plan = planImport(
      [
        { rel: 'Projekt.md', abs: '/x/Projekt.md', content: '# Projekt Alpha\n\nSiehe [Notiz](Projekt/Notiz%202.md)' },
        { rel: 'Projekt/Notiz 2.md', abs: '/x/Projekt/Notiz 2.md', content: 'Zurück zu [[Projekt Alpha]] ![Bild](../assets/a.png)\n\n![](../assets/b.png)' },
        { rel: 'Ordner ohne Datei/Kind 0123456789abcdef0123456789abcdef.md', abs: '/x/Ordner ohne Datei/Kind 0123456789abcdef0123456789abcdef.md', content: 'Text' },
      ],
      id,
      new Map(),
    );
    const byKey = Object.fromEntries(plan.nodes.map((node) => [node.key, node]));
    expect(plan.nodes.map((node) => node.title)).toEqual(['Ordner ohne Datei', 'Projekt Alpha', 'Kind', 'Notiz 2']);
    expect(byKey['Projekt/Notiz 2'].parentKey).toBe('Projekt');
    expect(byKey['Ordner ohne Datei'].doc).toBeNull();

    const projekt = byKey['Projekt'];
    expect(projekt.doc!.content![0].content!.find((c) => c.type === 'pageLink')!.attrs!.pageId).toBe(byKey['Projekt/Notiz 2'].id);
    const notiz = byKey['Projekt/Notiz 2'];
    expect(notiz.doc!.content![0].content!.find((c) => c.type === 'pageLink')!.attrs!.pageId).toBe(projekt.id);
    expect(plan.images).toEqual(['/x/assets/b.png']);
  });

  it('ersetzt Bild-Platzhalter und entfernt fehlgeschlagene Bilder', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'import:0', alt: '' } },
        { type: 'image', attrs: { src: 'import:1', alt: '' } },
      ],
    };
    expect(resolveImages(doc, ['hash.png', null])).toEqual({ type: 'doc', content: [{ type: 'image', attrs: { src: 'hash.png', alt: '' } }] });
    expect(resolveImages({ type: 'doc', content: [{ type: 'image', attrs: { src: 'import:0' } }] }, [null])).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
  });
});
