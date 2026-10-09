import { describe, expect, it } from 'vitest';
import { asInsertable, cleanAnswer, fromAiMarkdown } from './markdown';
import { pageRequest, rewriteRequest } from './write';

describe('Schreibhilfe', () => {
  it('baut eine günstige Anfrage mit Ausgabe-Spanne', () => {
    const req = rewriteRequest('shorten', 'Ein recht langer Satz, der gekürzt werden soll.');
    expect(req.feature).toBe('rewrite');
    expect(req.effort).toBe('low');
    expect(req.output[0]).toBeLessThan(req.output[1]);
    expect(String(req.messages[0].content)).toContain('<text>');
  });

  it('nimmt eigene Anweisungen', () => {
    const req = rewriteRequest('custom', 'Hallo', 'Mach daraus ein Gedicht');
    expect(String(req.messages[0].content)).toContain('Mach daraus ein Gedicht');
    expect(req.title).toContain('Gedicht');
  });

  it('Seitenaktionen haben eigene Kostenkategorien', () => {
    expect(pageRequest('summarize', '# A', 'A').feature).toBe('summarize');
    expect(pageRequest('tasks', '# A', 'A').feature).toBe('tasks');
  });

  it('entfernt einen Code-Zaun um die ganze Antwort', () => {
    expect(cleanAnswer('```markdown\n- a\n- b\n```')).toBe('- a\n- b');
    expect(cleanAnswer('  Text  ')).toBe('Text');
  });

  it('setzt einen einzelnen Absatz inline ein', () => {
    const content = fromAiMarkdown('Nur **ein** Satz.');
    expect(asInsertable(content).every((n) => n.type === 'text')).toBe(true);
    const list = fromAiMarkdown('- [ ] Aufgabe\n- [ ] Noch eine');
    expect(asInsertable(list)[0].type).toBe('taskList');
  });
});
