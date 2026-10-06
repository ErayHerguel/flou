/**
 * Kleine Fuzzy-Suche: Zeichen der Anfrage müssen in Reihenfolge vorkommen.
 * Bonus für Treffer am Wortanfang und für zusammenhängende Treffer. null = kein Treffer.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = normalize(query);
  if (!q) return 0;
  const t = normalize(text);
  const direct = t.indexOf(q);
  if (direct !== -1) return 1000 - direct * 2 - (t.length - q.length) * 0.1 + (isWordStart(t, direct) ? 200 : 0);

  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    score += found === prev + 1 ? 15 : 1;
    if (isWordStart(t, found)) score += 10;
    prev = found;
    ti = found + 1;
  }
  return score - t.length * 0.05;
}

/** Sortiert nach bestem Treffer über alle Suchtexte eines Eintrags. */
export function fuzzyFilter<T>(items: T[], query: string, texts: (item: T) => string[]): T[] {
  if (!query.trim()) return items;
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    let best: number | null = null;
    for (const text of texts(item)) {
      const s = fuzzyScore(query, text);
      if (s !== null && (best === null || s > best)) best = s;
    }
    if (best !== null) scored.push({ item, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .trim();
}

function isWordStart(text: string, index: number): boolean {
  return index === 0 || /[\s\-_/.]/.test(text[index - 1]);
}
