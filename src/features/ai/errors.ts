export class AiError extends Error {}

/** Vom Nutzer abgebrochen */
export class AiCancelled extends Error {
  constructor() {
    super('Abgebrochen');
  }
}
