import { describe, expect, it } from 'vitest';
import { buildModel, colorName, describeBoard, planEdits, validBoardOps, type BoardEl, type BoardOp } from './boardModel';

const note = (id: string, x: number, y: number, text: string, bg = '#fff3a3'): BoardEl[] => [
  { id, type: 'rectangle', x, y, width: 160, height: 160, backgroundColor: bg, text, textId: `${id}-t` },
  { id: `${id}-t`, type: 'text', x: x + 10, y: y + 60, width: 140, height: 20, backgroundColor: 'transparent', text, containerId: id },
];

const elements: BoardEl[] = [
  { id: 'title', type: 'text', x: 0, y: -80, width: 300, height: 40, backgroundColor: 'transparent', text: 'Design Briefs' },
  { id: 'frame', type: 'rectangle', x: 0, y: 0, width: 372, height: 400, backgroundColor: '#f8f9fa' },
  { id: 'ftitle', type: 'text', x: 20, y: 20, width: 200, height: 26, backgroundColor: 'transparent', text: 'Automotive' },
  ...note('a', 20, 62, 'Pendeln stresst'),
  ...note('b', 192, 62, 'Zu viele Screens', '#ffd1e0'),
  ...note('c', 20, 234, 'Stau'),
  ...note('free', 600, 0, 'Lose Notiz'),
];

describe('Board für die KI', () => {
  const model = buildModel(elements);

  it('erkennt Post-its, Gruppen und Überschriften', () => {
    expect(model.notes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'free']);
    expect(model.groupOf.get('a')).toBe('frame');
    expect(model.groupOf.has('free')).toBe(false);
    expect(model.titleOf.get('frame')?.text).toBe('Automotive');
    const text = describeBoard(model, null);
    expect(text).toContain('<gruppe id="g1" titel="Automotive"');
    expect(text).toContain('farbe="pink">Zu viele Screens');
    expect(text).toContain('<text id="t1">Design Briefs</text>');
  });

  it('ordnet Farben den Post-it-Farben zu', () => {
    expect(colorName('#ffd1e0')).toBe('pink');
    expect(colorName('#ffec99')).toBe('yellow');
    expect(colorName('#000000')).toBe('andere');
  });

  it('setzt neue Post-its in die freie Lücke der Gruppe und lässt den Rahmen wachsen', () => {
    const ops: BoardOp[] = [
      { op: 'add', target: 'g1', text: 'Neu 1', color: '' },
      { op: 'add', target: 'g1', text: 'Neu 2', color: 'green' },
    ];
    const edits = planEdits(validBoardOps(ops, model, null), model, elements);
    expect(edits.add.map((s) => [s.x, s.y])).toEqual([
      [192, 234],
      [20, 406],
    ]);
    expect(edits.grow).toEqual([{ id: 'frame', height: 406 + 160 + 20 }]);
  });

  it('ändert Texte über den gebundenen Text, löscht samt Text, benennt Gruppen um', () => {
    const ops: BoardOp[] = [
      { op: 'edit', target: model.short.get('a')!, text: 'Pendeln ist Stress', color: '' },
      { op: 'delete', target: model.short.get('free')!, text: '', color: '' },
      { op: 'edit', target: 'g1', text: 'Automotive UX', color: '' },
      { op: 'recolor', target: model.short.get('c')!, text: '', color: 'blue' },
      { op: 'edit', target: 'n99', text: 'gibt es nicht', color: '' },
    ];
    const valid = validBoardOps(ops, model, null);
    expect(valid).toHaveLength(4);
    const edits = planEdits(valid, model, elements);
    expect(edits.texts).toEqual([
      { id: 'a-t', text: 'Pendeln ist Stress' },
      { id: 'ftitle', text: 'Automotive UX' },
    ]);
    expect(edits.deletes.sort()).toEqual(['free', 'free-t']);
    expect(edits.colors).toEqual([{ id: 'c', color: '#c7e3ff' }]);
  });

  it('beschränkt Änderungen auf die Auswahl', () => {
    const focus = new Set(['a']);
    expect(describeBoard(model, focus)).not.toContain('Lose Notiz');
    const ops: BoardOp[] = [{ op: 'delete', target: model.short.get('free')!, text: '', color: '' }];
    expect(validBoardOps(ops, model, focus)).toEqual([]);
  });
});
