export type SqlValue = string | number | boolean | null;

export interface Statement {
  sql: string;
  params?: SqlValue[];
}

/** Zugriff auf die Datenbank. Lesen ist frei, Schreiben geschieht ausschließlich in Transaktionen. */
export interface Driver {
  select<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  tx(statements: Statement[]): Promise<void>;
}

let current: Driver | null = null;

export function setDriver(driver: Driver): void {
  current = driver;
}

export function db(): Driver {
  if (!current) throw new Error('Datenbank ist nicht initialisiert');
  return current;
}
