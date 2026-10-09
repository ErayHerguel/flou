import type { BoardPlan, NoteColor } from './plan';

/**
 * Rechnet aus einem Board-Plan ein aufgeräumtes Layout im Stil digitaler Whiteboards (Miro/FigJam):
 * Post-its mit gebundenem Text, Nunito, glatte Kanten. Ergebnis sind Excalidraw-Skelette,
 * die das Board per convertToExcalidrawElements in echte Elemente umwandelt (Text wird dort gemessen).
 */

export type Skeleton =
  | {
      type: 'rectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      backgroundColor: string;
      strokeColor: string;
      strokeWidth: number;
      fillStyle: 'solid';
      roughness: 0;
      roundness: { type: 3 };
      label?: { text: string; fontSize: number; fontFamily: number; textAlign: 'center' | 'left'; verticalAlign: 'middle' | 'top'; strokeColor?: string };
    }
  | { type: 'text'; x: number; y: number; text: string; fontSize: number; fontFamily: number; strokeColor: string }
  | {
      type: 'arrow';
      x: number;
      y: number;
      width: number;
      height: number;
      points: [number, number][];
      strokeColor: string;
      strokeWidth: number;
      roughness: 0;
      endArrowhead: 'arrow';
    };

export const NOTE_FILL: Record<NoteColor, string> = {
  yellow: '#fff3a3',
  pink: '#ffd1e0',
  green: '#c8f0c5',
  blue: '#c7e3ff',
  orange: '#ffd8a8',
  purple: '#e3d4ff',
  gray: '#e9ecef',
};

const NUNITO = 6;
const DARK = '#1e1e1e';
const MUTED = '#495057';
const FAINT = '#868e96';
const FRAME = '#f8f9fa';
const FRAME_STROKE = '#dee2e6';
const ACCENT = '#2f6fde';

const S = 160; // Post-it
const G = 12; // Abstand zwischen Post-its
const P = 20; // Innenabstand
const CELL = 2 * S + G;
const LABEL_W = 260;
const GAP = 32;

/** Bricht Text an Wortgrenzen um (Excalidraw misst, aber umbricht freie Texte nicht selbst). */
export function wrap(text: string, maxChars: number): string {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > maxChars) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

const text = (x: number, y: number, value: string, fontSize: number, strokeColor = DARK): Skeleton => ({
  type: 'text',
  x,
  y,
  text: value,
  fontSize,
  fontFamily: NUNITO,
  strokeColor,
});

const rect = (x: number, y: number, width: number, height: number, backgroundColor: string, strokeColor = 'transparent', strokeWidth = 1): Skeleton & { type: 'rectangle' } => ({
  type: 'rectangle',
  x,
  y,
  width,
  height,
  backgroundColor,
  strokeColor,
  strokeWidth,
  fillStyle: 'solid',
  roughness: 0,
  roundness: { type: 3 },
});

/** Post-it mit zentriertem Text; lange Texte bekommen etwas kleinere Schrift. */
function note(x: number, y: number, value: string, color: NoteColor, width = S, height = S): Skeleton {
  const fontSize = value.length > 70 ? 14 : 16;
  return { ...rect(x, y, width, height, NOTE_FILL[color]), label: { text: value, fontSize, fontFamily: NUNITO, textAlign: 'center', verticalAlign: 'middle' } };
}

const linesOf = (value: string) => value.split('\n').length;

/** Raster aus Post-its (2 Spalten), gibt die belegte Höhe zurück. */
function noteGrid(out: Skeleton[], x: number, y: number, notes: string[], color: NoteColor, columns = 2): number {
  notes.forEach((n, i) => out.push(note(x + (i % columns) * (S + G), y + Math.floor(i / columns) * (S + G), n, color)));
  const rows = Math.max(1, Math.ceil(notes.length / columns));
  return rows * S + (rows - 1) * G;
}

function header(out: Skeleton[], plan: BoardPlan, x: number, y: number): number {
  let h = 0;
  if (plan.title) {
    out.push(text(x, y, plan.title, 36));
    h += 52;
  }
  if (plan.subtitle) {
    out.push(text(x, y + h, wrap(plan.subtitle, 110), 18, MUTED));
    h += linesOf(wrap(plan.subtitle, 110)) * 24 + 6;
  }
  return h ? h + 24 : 0;
}

function matrix(out: Skeleton[], plan: BoardPlan, x: number, y: number): number {
  const colX = plan.columns.map((_, i) => x + P + LABEL_W + GAP + i * (CELL + GAP));
  const width = (colX.at(-1) ?? x + P + LABEL_W) + CELL + P - x;
  plan.columns.forEach((c, i) => {
    out.push(rect(colX[i], y + 3, 18, 18, NOTE_FILL[c.color]));
    out.push(text(colX[i] + 26, y, c.label, 18));
  });
  let cy = y + 40;
  for (const row of plan.rows) {
    const rows = Math.max(1, ...row.cells.map((c) => Math.ceil(c.length / 2)));
    const inner = rows * S + (rows - 1) * G;
    const h = inner + 2 * P;
    out.push(rect(x, cy, width, h, FRAME, FRAME_STROKE));
    out.push(rect(x + P, cy + P, LABEL_W, inner, '#ffffff', row.highlight ? ACCENT : FRAME_STROKE, row.highlight ? 2 : 1));
    const name = wrap(row.label, 20);
    out.push(text(x + P + 18, cy + P + 16, name, 20));
    if (row.sublabel) out.push(text(x + P + 18, cy + P + 22 + linesOf(name) * 25, wrap(row.sublabel, 30), 14, FAINT));
    if (row.badge) out.push(text(x + P + 18, cy + P + inner - 56, row.badge, 32, row.highlight ? ACCENT : DARK));
    row.cells.forEach((cell, i) => noteGrid(out, colX[i], cy + P, cell, plan.columns[i].color));
    cy += h + 20;
  }
  return cy - y;
}

function clusters(out: Skeleton[], plan: BoardPlan, x: number, y: number): number {
  const perRow = Math.min(3, Math.max(1, plan.groups.length));
  const w = CELL + 2 * P;
  const tops = Array.from({ length: perRow }, () => y);
  for (const group of plan.groups) {
    const col = tops.indexOf(Math.min(...tops));
    const gx = x + col * (w + GAP);
    const gy = tops[col];
    const label = wrap(group.label, 28);
    const head = linesOf(label) * 26 + 16;
    const body = noteGrid([], 0, 0, group.notes, group.color);
    const h = P + head + body + P;
    out.push(rect(gx, gy, w, h, FRAME, FRAME_STROKE));
    out.push(text(gx + P, gy + P, label, 20));
    noteGrid(out, gx + P, gy + P + head, group.notes, group.color);
    tops[col] = gy + h + GAP;
  }
  return Math.max(...tops) - y;
}

function flow(out: Skeleton[], plan: BoardPlan, x: number, y: number): number {
  const W = 200;
  const H = 150;
  const A = 48;
  const perLine = 5;
  plan.steps.forEach((step, i) => {
    const sx = x + (i % perLine) * (W + A);
    const sy = y + Math.floor(i / perLine) * (H + 40);
    out.push(note(sx, sy, `${i + 1}\n${step}`, 'blue', W, H));
    if (i < plan.steps.length - 1 && (i + 1) % perLine !== 0) {
      out.push({
        type: 'arrow',
        x: sx + W + 6,
        y: sy + H / 2,
        width: A - 12,
        height: 0,
        points: [
          [0, 0],
          [A - 12, 0],
        ],
        strokeColor: MUTED,
        strokeWidth: 2,
        roughness: 0,
        endArrowhead: 'arrow',
      });
    }
  });
  const lines = Math.max(1, Math.ceil(plan.steps.length / perLine));
  return lines * H + (lines - 1) * 40;
}

/** Ganzes Board ab `origin`; liefert Skelette und die Gesamthöhe. */
export function layoutBoard(plan: BoardPlan, origin: { x: number; y: number }): { elements: Skeleton[]; height: number } {
  const out: Skeleton[] = [];
  const { x } = origin;
  let y = origin.y + header(out, plan, x, origin.y);
  const usable =
    plan.layout === 'matrix' && plan.columns.length && plan.rows.length
      ? 'matrix'
      : plan.layout === 'flow' && plan.steps.length
        ? 'flow'
        : plan.groups.length
          ? 'clusters'
          : plan.steps.length
            ? 'flow'
            : null;
  if (usable === 'matrix') y += matrix(out, plan, x, y);
  else if (usable === 'flow') y += flow(out, plan, x, y);
  else if (usable === 'clusters') y += clusters(out, plan, x, y);
  if (plan.takeaways.length) {
    y += 30;
    out.push(text(x, y, 'Wichtigste Erkenntnisse', 22));
    y += 44;
    plan.takeaways.forEach((t, i) => out.push(note(x + i * (200 + G), y, t, 'purple', 200, 150)));
    y += 150;
  }
  return { elements: out, height: y - origin.y };
}

/** Neue Anordnung vorhandener Post-its in Gruppen (zum Clustern): Zielposition je Notiz + Rahmen mit Überschrift. */
export function layoutClusters(
  groups: { label: string; color: NoteColor; notes: number[] }[],
  origin: { x: number; y: number },
  size = S,
): { headers: Skeleton[]; positions: Map<number, { x: number; y: number; color: string }> } {
  const headers: Skeleton[] = [];
  const positions = new Map<number, { x: number; y: number; color: string }>();
  const w = 2 * size + G + 2 * P;
  const perRow = Math.min(3, Math.max(1, groups.length));
  const tops = Array.from({ length: perRow }, () => origin.y);
  for (const group of groups) {
    const col = tops.indexOf(Math.min(...tops));
    const gx = origin.x + col * (w + GAP);
    const gy = tops[col];
    const label = wrap(group.label, 28);
    const head = linesOf(label) * 26 + 16;
    const rows = Math.max(1, Math.ceil(group.notes.length / 2));
    const h = P + head + rows * size + (rows - 1) * G + P;
    headers.push(rect(gx, gy, w, h, FRAME, FRAME_STROKE));
    headers.push(text(gx + P, gy + P, label, 20));
    group.notes.forEach((n, i) =>
      positions.set(n, { x: gx + P + (i % 2) * (size + G), y: gy + P + head + Math.floor(i / 2) * (size + G), color: NOTE_FILL[group.color] }),
    );
    tops[col] = gy + h + GAP;
  }
  return { headers, positions };
}

export const NOTE_SIZE = S;
