import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol';

const parse = (v: unknown) => parseClientMessage(JSON.stringify(v));

describe('Nachrichten von Gästen', () => {
  it('nimmt gültige Anfragen an', () => {
    expect(parse({ t: 'req', id: 1, req: { op: 'page.update', id: 'p1', patch: { title: 'Neu' } } })).toEqual({
      t: 'req',
      id: 1,
      req: { op: 'page.update', id: 'p1', patch: { title: 'Neu' } },
    });
    expect(parse({ t: 'doc.update', pageId: 'p1', update: 'AQID' })).not.toBeNull();
  });

  it('verwirft falsche Typen und unbekannte Felder', () => {
    expect(parseClientMessage('kein json')).toBeNull();
    expect(parse({ t: 'req', id: 1, req: { op: 'page.update', id: 'p1', patch: { deletedAt: 1 } } })).toBeNull();
    expect(parse({ t: 'req', id: 1, req: { op: 'page.update', id: 'p1', patch: { title: 5 } } })).toBeNull();
    expect(parse({ t: 'req', id: -1, req: { op: 'hello' } })).toBeNull();
    expect(parse({ t: 'req', id: 1, req: { op: 'db.call', databaseId: 'd', method: 'dropTable', args: [] } })).toBeNull();
    expect(parse({ t: 'doc.update', pageId: 'p1', update: 'nicht base64!' })).toBeNull();
    expect(parse({ t: 'board.update', pageId: 'b', elements: [{ id: 'e' }] })).toBeNull();
    expect(parse({ t: 'unbekannt' })).toBeNull();
  });

  it('erlaubt die oberste Ebene als Ziel (Rechte prüft der Hub)', () => {
    expect(parse({ t: 'req', id: 3, req: { op: 'page.create', parentId: null, type: 'board' } })).not.toBeNull();
    expect(parse({ t: 'req', id: 4, req: { op: 'page.move', id: 'p1', parentId: null, index: 0 } })).not.toBeNull();
  });

  it('setzt Standardwerte für optionale Felder', () => {
    expect(parse({ t: 'req', id: 2, req: { op: 'page.create', parentId: 'p1', type: 'page' } })).toEqual({
      t: 'req',
      id: 2,
      req: { op: 'page.create', parentId: 'p1', type: 'page', title: '', index: null },
    });
  });
});
