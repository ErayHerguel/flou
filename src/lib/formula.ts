/**
 * Formeln für Datenbanken: Zahlen, "Text", true/false, prop("Name"),
 * Operatoren + - * / % ^ == != < > <= >= && || ! sowie Funktionen (siehe FUNCTIONS).
 */
export type FormulaValue = number | string | boolean | null;

type Node =
  | { k: 'lit'; v: FormulaValue }
  | { k: 'prop'; name: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const TOKEN = /\s*(?:(\d+(?:[.,]\d+)?)|"((?:[^"\\]|\\.)*)"|([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)|(==|!=|<=|>=|&&|\|\||[-+*/%^<>!(),]))/y;

function tokenize(src: string): string[][] {
  const out: string[][] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    if (/^\s*$/.test(src.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(src);
    if (!m) throw new Error(`Unerwartetes Zeichen bei Position ${TOKEN.lastIndex + 1}`);
    if (m[1] !== undefined) out.push(['num', m[1].replace(',', '.')]);
    else if (m[2] !== undefined) out.push(['str', m[2].replace(/\\(.)/g, '$1')]);
    else if (m[3] !== undefined) out.push(['id', m[3]]);
    else out.push(['op', m[4]]);
  }
  return out;
}

const PRECEDENCE: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 7 };

export function parseFormula(src: string): Node {
  const tokens = tokenize(src);
  let i = 0;
  const peek = () => tokens[i];
  const expect = (v: string) => {
    if (tokens[i]?.[1] !== v) throw new Error(`„${v}“ erwartet`);
    i++;
  };
  const primary = (): Node => {
    const t = tokens[i++];
    if (!t) throw new Error('Unvollständige Formel');
    if (t[0] === 'num') return { k: 'lit', v: Number(t[1]) };
    if (t[0] === 'str') return { k: 'lit', v: t[1] };
    if (t[0] === 'op' && (t[1] === '-' || t[1] === '!')) return { k: 'un', op: t[1], a: expr(7) };
    if (t[0] === 'op' && t[1] === '(') {
      const e = expr(0);
      expect(')');
      return e;
    }
    if (t[0] === 'id') {
      if (t[1] === 'true' || t[1] === 'false') return { k: 'lit', v: t[1] === 'true' };
      if (peek()?.[1] !== '(') throw new Error(`Unbekannter Name „${t[1]}“`);
      i++;
      const args: Node[] = [];
      if (peek()?.[1] !== ')') {
        do args.push(expr(0));
        while (peek()?.[1] === ',' && ++i);
      }
      expect(')');
      if (t[1] === 'prop') {
        if (args[0]?.k !== 'lit' || typeof args[0].v !== 'string') throw new Error('prop("Name") erwartet einen Namen');
        return { k: 'prop', name: args[0].v };
      }
      if (!(t[1] in FUNCTIONS)) throw new Error(`Unbekannte Funktion „${t[1]}“`);
      return { k: 'call', fn: t[1], args };
    }
    throw new Error(`Unerwartet: „${t[1]}“`);
  };
  const expr = (min: number): Node => {
    let left = primary();
    for (;;) {
      const t = peek();
      const p = t?.[0] === 'op' ? PRECEDENCE[t[1]] : undefined;
      if (p === undefined || p < min) return left;
      i++;
      left = { k: 'bin', op: t[1], a: left, b: expr(t[1] === '^' ? p : p + 1) };
    }
  };
  const node = expr(0);
  if (i < tokens.length) throw new Error(`Unerwartet: „${tokens[i][1]}“`);
  return node;
}

const num = (v: FormulaValue): number => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : v === null || v === '' ? 0 : Number(String(v).replace(',', '.')));
const str = (v: FormulaValue): string => (v === null ? '' : typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v));
const truthy = (v: FormulaValue) => (typeof v === 'string' ? v !== '' : Boolean(v));
const DAY = 86_400_000;
const toDate = (v: FormulaValue) => new Date(`${str(v)}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const FUNCTIONS: Record<string, (args: FormulaValue[]) => FormulaValue> = {
  if: ([c, a, b]) => (truthy(c) ? a : (b ?? null)),
  concat: (args) => args.map(str).join(''),
  length: ([s]) => str(s).length,
  lower: ([s]) => str(s).toLowerCase(),
  upper: ([s]) => str(s).toUpperCase(),
  contains: ([s, sub]) => str(s).toLowerCase().includes(str(sub).toLowerCase()),
  empty: ([v]) => v === null || v === '' || v === false,
  round: ([n, d]) => {
    const f = 10 ** num(d ?? 0);
    return Math.round(num(n) * f) / f;
  },
  floor: ([n]) => Math.floor(num(n)),
  ceil: ([n]) => Math.ceil(num(n)),
  abs: ([n]) => Math.abs(num(n)),
  sqrt: ([n]) => Math.sqrt(num(n)),
  min: (args) => Math.min(...args.map(num)),
  max: (args) => Math.max(...args.map(num)),
  toNumber: ([v]) => num(v),
  format: ([v]) => str(v),
  today: () => iso(new Date()),
  dateAdd: ([d, n]) => {
    // Kalendertage statt Millisekunden: robust über Sommerzeitwechsel
    const date = toDate(d);
    date.setDate(date.getDate() + num(n));
    return iso(date);
  },
  dateBetween: ([a, b]) => Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY),
};

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS);

export function evaluate(node: Node, prop: (name: string) => FormulaValue): FormulaValue {
  switch (node.k) {
    case 'lit':
      return node.v;
    case 'prop':
      return prop(node.name);
    case 'un': {
      const a = evaluate(node.a, prop);
      return node.op === '-' ? -num(a) : !truthy(a);
    }
    case 'call':
      return FUNCTIONS[node.fn](node.args.map((a) => evaluate(a, prop)));
    case 'bin': {
      if (node.op === '&&') return truthy(evaluate(node.a, prop)) && truthy(evaluate(node.b, prop));
      if (node.op === '||') return truthy(evaluate(node.a, prop)) || truthy(evaluate(node.b, prop));
      const a = evaluate(node.a, prop);
      const b = evaluate(node.b, prop);
      switch (node.op) {
        case '+':
          return typeof a === 'string' || typeof b === 'string' ? str(a) + str(b) : num(a) + num(b);
        case '-':
          return num(a) - num(b);
        case '*':
          return num(a) * num(b);
        case '/':
          return num(b) === 0 ? null : num(a) / num(b);
        case '%':
          return num(a) % num(b);
        case '^':
          return num(a) ** num(b);
        case '==':
          return str(a) === str(b);
        case '!=':
          return str(a) !== str(b);
        default: {
          const cmp = typeof a === 'number' || typeof b === 'number' ? num(a) - num(b) : str(a).localeCompare(str(b));
          return node.op === '<' ? cmp < 0 : node.op === '>' ? cmp > 0 : node.op === '<=' ? cmp <= 0 : cmp >= 0;
        }
      }
    }
  }
}

/** Wertet eine Formel aus; Fehler werden als Error zurückgegeben statt geworfen. */
export function runFormula(src: string, prop: (name: string) => FormulaValue): FormulaValue | Error {
  try {
    if (!src.trim()) return null;
    const result = evaluate(parseFormula(src), prop);
    return typeof result === 'number' && !Number.isFinite(result) ? null : result;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}
