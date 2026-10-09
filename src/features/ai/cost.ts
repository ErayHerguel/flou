import { modelInfo, WEB_SEARCH_USD } from './models';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
}

export const EMPTY_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 };

/** Kosten einer Anfrage in US-Dollar nach Listenpreis. */
export function costOf(model: string, usage: Usage): number {
  const m = modelInfo(model);
  const prompt = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const long = m.longContext && prompt > m.longContext.above ? m.longContext : null;
  const input = long ? long.input : m.input;
  const output = long ? long.output : m.output;
  const scale = input / m.input;
  return (
    (usage.inputTokens * input +
      usage.outputTokens * output +
      usage.cacheReadTokens * m.cacheRead * scale +
      usage.cacheWriteTokens * m.cacheWrite * scale) /
      1_000_000 +
    usage.webSearches * WEB_SEARCH_USD
  );
}

export interface Estimate {
  model: string;
  inputTokens: number;
  low: number;
  high: number;
}

/** Spanne der Kosten bei bekannter Eingabe und geschätzter Ausgabe (inkl. Denken des Modells). */
export function estimateCost(model: string, inputTokens: number, output: [number, number], searches: [number, number] = [0, 0]): Estimate {
  const at = (out: number, s: number) =>
    costOf(model, { ...emptyUsage(), inputTokens, outputTokens: out, webSearches: s });
  return { model, inputTokens, low: at(output[0], searches[0]), high: at(output[1], searches[1]) };
}

function emptyUsage(): Usage {
  return { ...EMPTY_USAGE };
}

const usd = (digits: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** „0,012 $“, „1,25 $“, „unter 0,001 $“ */
export function formatUsd(value: number): string {
  if (value <= 0) return '0 $';
  if (value < 0.001) return 'unter 0,001 $';
  if (value < 0.1) return `${usd(3).format(value)} $`;
  return `${usd(2).format(value)} $`;
}

/** „0,01–0,03 $“ oder ein einzelner Wert, wenn beide Enden gleich aussehen. */
export function formatRange(low: number, high: number): string {
  const a = formatUsd(low);
  const b = formatUsd(high);
  if (a === b) return `ca. ${a}`;
  return `${a.replace(' $', '')}–${b}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n / 1000)} Tsd.`;
}
