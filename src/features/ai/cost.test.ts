import { describe, expect, it } from 'vitest';
import { costOf, EMPTY_USAGE, estimateCost, formatRange, formatUsd } from './cost';

describe('Kosten', () => {
  it('rechnet Listenpreise', () => {
    // 1 Mio. Eingabe + 1 Mio. Ausgabe bei Opus: 4 $ + 20 $
    expect(costOf('claude-opus-5-5', { ...EMPTY_USAGE, inputTokens: 1e6, outputTokens: 1e6 })).toBeCloseTo(24);
    expect(costOf('claude-haiku-5-5', { ...EMPTY_USAGE, inputTokens: 20_000, outputTokens: 2_000 })).toBeCloseTo(0.003);
  });

  it('Haiku wird über 100 Tsd. Eingabe-Tokens teurer', () => {
    const cost = costOf('claude-haiku-5-5', { ...EMPTY_USAGE, inputTokens: 200_000, outputTokens: 10_000 });
    expect(cost).toBeCloseTo(0.1 + 0.025);
  });

  it('zählt Cache und Websuche', () => {
    const cost = costOf('claude-sonnet-5-5', { ...EMPTY_USAGE, cacheReadTokens: 1e6, webSearches: 3 });
    expect(cost).toBeCloseTo(0.2 + 0.03);
  });

  it('schätzt eine Spanne', () => {
    const e = estimateCost('claude-opus-5-5', 10_000, [1_000, 3_000]);
    expect(e.low).toBeCloseTo(0.06);
    expect(e.high).toBeCloseTo(0.1);
  });

  it('formatiert verständlich', () => {
    expect(formatUsd(0.0123)).toBe('0,012 $');
    expect(formatUsd(1.256)).toBe('1,26 $');
    expect(formatUsd(0.0004)).toBe('unter 0,001 $');
    expect(formatRange(0.06, 0.1)).toBe('0,060–0,10 $');
    expect(formatRange(0.0001, 0.0002)).toBe('ca. unter 0,001 $');
  });
});
