import { describe, expect, it } from 'vitest';
import { runFormula } from './formula';

const props: Record<string, number | string | boolean | null> = { Preis: 12.5, Menge: 3, Name: 'Äpfel', Fertig: true, Datum: '2026-10-06' };
const run = (src: string) => runFormula(src, (n) => props[n] ?? null);

describe('Formeln', () => {
  it('rechnet mit Vorrang und Klammern', () => {
    expect(run('prop("Preis") * prop("Menge") + 1')).toBe(38.5);
    expect(run('(1 + 2) * 3 ^ 2')).toBe(27);
    expect(run('-2 + 10 % 4')).toBe(0);
    expect(run('1 / 0')).toBeNull();
  });

  it('verarbeitet Text, Vergleiche und Logik', () => {
    expect(run('prop("Name") + " kaufen"')).toBe('Äpfel kaufen');
    expect(run('if(prop("Fertig") && prop("Menge") >= 3, "ok", "offen")')).toBe('ok');
    expect(run('!prop("Fertig") || contains(prop("Name"), "äpf")')).toBe(true);
    expect(run('upper(concat("a", 1, true))')).toBe('A1TRUE');
  });

  it('kennt Zahlen- und Datumsfunktionen', () => {
    expect(run('round(2.345, 2)')).toBe(2.35);
    expect(run('max(1, prop("Menge"), 2)')).toBe(3);
    expect(run('dateAdd(prop("Datum"), 30)')).toBe('2026-11-05');
    expect(run('dateBetween("2026-12-24", prop("Datum"))')).toBe(79);
  });

  it('meldet Fehler statt abzustürzen', () => {
    expect(run('1 +')).toBeInstanceOf(Error);
    expect(run('foo(1)')).toBeInstanceOf(Error);
    expect(run('prop(1)')).toBeInstanceOf(Error);
    expect(run('')).toBeNull();
  });
});
