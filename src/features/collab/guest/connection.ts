import { create } from 'zustand';
import type { ClientMessage, Request, ServerMessage } from '../protocol';

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'revoked';

export const useConnection = create<{ status: ConnectionStatus }>(() => ({ status: 'connecting' }));

type Listener = (message: ServerMessage) => void;

const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_MS = [500, 1000, 2000, 4000, 8000];

/** Fehler, die vom Gastgeber kommen (z. B. „Nur Lesezugriff“). */
export class HostError extends Error {}

/**
 * WebSocket zum Gastgeber mit Anfragen/Antworten und automatischem Neuverbinden.
 * Nach jedem (Wieder-)Verbinden laufen die registrierten `onOpen`-Rückrufe.
 */
class Connection {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve(value: unknown): void; reject(err: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<Listener>();
  private openers = new Set<() => void>();
  private attempt = 0;
  private reauth: (() => Promise<boolean>) | null = null;
  private onLost: ((attempt: number) => void) | null = null;

  /** onLost: wird bei jedem erfolglosen Neuverbinden aufgerufen (z. B. um eine neue Adresse zu suchen). */
  start(reauth: () => Promise<boolean>, onLost?: (attempt: number) => void) {
    this.reauth = reauth;
    this.onLost = onLost ?? null;
    this.open();
  }

  private open() {
    useConnection.setState({ status: this.attempt === 0 ? 'connecting' : 'offline' });
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      useConnection.setState({ status: 'online' });
      for (const fn of this.openers) fn();
    };
    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (message.t === 'res') {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.ok) entry.resolve(message.value);
        else entry.reject(new HostError(message.error));
        return;
      }
      for (const listener of this.listeners) listener(message);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Verbindung zum Gastgeber unterbrochen'));
        this.pending.delete(id);
      }
      void this.retry(opened);
    };
  }

  private async retry(wasOpen: boolean) {
    useConnection.setState({ status: 'offline' });
    // Kam gar keine Verbindung zustande, kann der Zugang entfernt worden sein: neu anmelden.
    if (!wasOpen && this.attempt > 0 && this.reauth) {
      const valid = await this.reauth().catch(() => true);
      if (!valid) {
        useConnection.setState({ status: 'revoked' });
        return;
      }
    }
    const delay = RETRY_MS[Math.min(this.attempt, RETRY_MS.length - 1)];
    this.attempt += 1;
    this.onLost?.(this.attempt);
    setTimeout(() => this.open(), delay);
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  request<T>(req: Request): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('Keine Verbindung zum Gastgeber'));
        return;
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Der Gastgeber antwortet nicht'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.ws.send(JSON.stringify({ t: 'req', id, req } satisfies ClientMessage));
    });
  }

  listen(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onOpen(fn: () => void): () => void {
    this.openers.add(fn);
    return () => this.openers.delete(fn);
  }

  get online() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const connection = new Connection();
