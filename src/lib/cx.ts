/** Verbindet Klassennamen und ignoriert leere Werte. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
