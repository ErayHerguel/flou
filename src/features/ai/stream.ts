import { EMPTY_USAGE, type Usage } from './cost';

/** Ein Inhaltsblock der Antwort, so wie die API ihn liefert (für Rückfragen unverändert weitergeben). */
export type Block = { type: string; [key: string]: unknown };

export interface Citation {
  url?: string;
  title?: string;
  cited_text?: string;
}

/**
 * Setzt die gestreamten Ereignisse der Messages-API wieder zu einer vollständigen Antwort zusammen:
 * Inhaltsblöcke (Text samt Quellen, Denken, Websuche), Abbruchgrund und Verbrauch.
 */
export class MessageAccumulator {
  model = '';
  content: Block[] = [];
  stopReason: string | null = null;
  usage: Usage = { ...EMPTY_USAGE };
  /** Rohtext der Werkzeug-Eingaben, bis der Block abgeschlossen ist */
  private partialJson = new Map<number, string>();

  constructor(private onText?: (delta: string, full: string) => void) {}

  get text(): string {
    return this.content
      .filter((b) => b.type === 'text')
      .map((b) => String(b.text ?? ''))
      .join('');
  }

  /** Alle Quellen aus Text-Zitaten, ohne doppelte Adressen */
  get citations(): Citation[] {
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const block of this.content) {
      for (const c of (block.citations as Citation[] | undefined) ?? []) {
        if (!c.url || seen.has(c.url)) continue;
        seen.add(c.url);
        out.push(c);
      }
    }
    return out;
  }

  handle(event: Record<string, unknown>): void {
    switch (event.type) {
      case 'message_start': {
        const message = event.message as { model?: string; usage?: Record<string, number> };
        this.model = message.model ?? this.model;
        this.applyUsage(message.usage);
        break;
      }
      case 'content_block_start': {
        const block = { ...(event.content_block as Block) };
        if (block.type === 'text') block.text = String(block.text ?? '');
        this.content[event.index as number] = block;
        break;
      }
      case 'content_block_delta': {
        const index = event.index as number;
        const block = this.content[index];
        const delta = event.delta as Record<string, unknown>;
        if (!block) break;
        if (delta.type === 'text_delta') {
          block.text = String(block.text ?? '') + String(delta.text ?? '');
          this.onText?.(String(delta.text ?? ''), this.text);
        } else if (delta.type === 'citations_delta') {
          block.citations = [...((block.citations as unknown[]) ?? []), delta.citation];
        } else if (delta.type === 'thinking_delta') {
          block.thinking = String(block.thinking ?? '') + String(delta.thinking ?? '');
        } else if (delta.type === 'signature_delta') {
          block.signature = delta.signature;
        } else if (delta.type === 'input_json_delta') {
          this.partialJson.set(index, (this.partialJson.get(index) ?? '') + String(delta.partial_json ?? ''));
        }
        break;
      }
      case 'content_block_stop': {
        const index = event.index as number;
        const raw = this.partialJson.get(index);
        if (raw !== undefined && this.content[index]) {
          try {
            this.content[index].input = raw ? JSON.parse(raw) : {};
          } catch {
            this.content[index].input = {};
          }
          this.partialJson.delete(index);
        }
        break;
      }
      case 'message_delta': {
        const delta = event.delta as { stop_reason?: string | null };
        if (delta?.stop_reason !== undefined) this.stopReason = delta.stop_reason;
        this.applyUsage(event.usage as Record<string, unknown> | undefined);
        break;
      }
    }
  }

  /** Verbrauchsangaben sind kumulativ; spätere Werte ersetzen frühere. */
  private applyUsage(usage: Record<string, unknown> | undefined): void {
    if (!usage) return;
    const n = (key: string) => (typeof usage[key] === 'number' ? (usage[key] as number) : undefined);
    this.usage = {
      inputTokens: n('input_tokens') ?? this.usage.inputTokens,
      outputTokens: n('output_tokens') ?? this.usage.outputTokens,
      cacheReadTokens: n('cache_read_input_tokens') ?? this.usage.cacheReadTokens,
      cacheWriteTokens: n('cache_creation_input_tokens') ?? this.usage.cacheWriteTokens,
      webSearches:
        ((usage.server_tool_use as Record<string, number> | undefined)?.web_search_requests as number | undefined) ??
        this.usage.webSearches,
    };
  }

  /** Inhalt für die Fortsetzung nach `pause_turn` (unverändert, ohne Lücken). */
  get replayContent(): Block[] {
    return this.content.filter(Boolean);
  }
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    webSearches: a.webSearches + b.webSearches,
  };
}
