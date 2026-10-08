import type { CellValue, PropertyType } from '../../db/database';

/**
 * Datenbanken aus dem Notion-Export („Markdown & CSV“): jede Datenbank ist eine CSV-Datei, ihre
 * Einträge liegen als Markdown im gleichnamigen Ordner. Die erste Spalte ist der Titel.
 */

/** CSV nach RFC 4180 (Anführungszeichen, Kommas und Zeilenumbrüche in Feldern), ohne BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export interface ColumnSpec {
  name: string;
  type: PropertyType;
  /** Auswahloptionen in der Reihenfolge des ersten Auftretens */
  options: string[];
}

const BOOL = new Set(['yes', 'no', 'ja', 'nein', 'true', 'false']);
const URL_PATTERN = /^(https?:\/\/|mailto:)\S+$/i;

/** Notion schreibt Datumswerte englisch („October 8, 2026“, auch mit Uhrzeit oder „→“ für Zeiträume). */
export function parseNotionDate(value: string): string | null {
  const start = value.split('→')[0].trim();
  if (!start) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/.exec(start);
  if (!match) return null;
  const month = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(
    match[1].toLowerCase(),
  );
  if (month < 0) return null;
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

const parseNumber = (value: string): number | null => {
  const text = value.trim().replace(/[\s€$%]/g, '').replace(/,(?=\d{3}\b)/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
};

const splitMulti = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Erkennt den Typ einer Spalte anhand aller Werte. */
export function inferColumn(name: string, values: string[]): ColumnSpec {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) return { name, type: 'text', options: [] };
  if (filled.every((v) => BOOL.has(v.toLowerCase()))) return { name, type: 'checkbox', options: [] };
  if (filled.every((v) => parseNumber(v) !== null)) return { name, type: 'number', options: [] };
  if (filled.every((v) => parseNotionDate(v) !== null)) return { name, type: 'date', options: [] };
  if (filled.every((v) => URL_PATTERN.test(v))) return { name, type: 'url', options: [] };
  const multi = filled.some((v) => v.includes(','));
  const options: string[] = [];
  for (const v of filled) for (const part of multi ? splitMulti(v) : [v]) if (!options.includes(part)) options.push(part);
  // Wenige, sich wiederholende Werte: Auswahl; sonst freier Text.
  const repetitive = options.length <= 30 && options.length <= Math.max(6, Math.ceil(filled.length * 0.6));
  if (repetitive && options.every((o) => o.length <= 60)) return { name, type: multi ? 'multi_select' : 'select', options };
  return { name, type: 'text', options: [] };
}

/** Zellwert passend zum erkannten Typ; Auswahlwerte als Optionsnamen (die IDs vergibt der Import). */
export function cellValue(spec: ColumnSpec, raw: string): CellValue {
  const value = raw.trim();
  if (!value) return null;
  switch (spec.type) {
    case 'checkbox':
      return ['yes', 'ja', 'true'].includes(value.toLowerCase());
    case 'number':
      return parseNumber(value);
    case 'date':
      return parseNotionDate(value);
    case 'multi_select':
      return splitMulti(value);
    default:
      return value;
  }
}

/**
 * Entfernt die Eigenschaftszeilen („Status: Erledigt“), die Notion in Eintrags-Seiten direkt unter
 * den Titel schreibt; die Werte kommen aus der CSV-Datei.
 */
export function stripPropertyLines(markdown: string, headers: string[]): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() !== '');
  if (start < 0 || !/^#\s/.test(lines[start])) return markdown;
  const names = new Set(headers.map((h) => h.trim().toLowerCase()));
  let i = start + 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  const first = i;
  while (i < lines.length && names.has(lines[i].split(':')[0].trim().toLowerCase()) && lines[i].includes(':')) i++;
  if (i === first) return markdown;
  return [...lines.slice(0, start + 1), '', ...lines.slice(i)].join('\n');
}
