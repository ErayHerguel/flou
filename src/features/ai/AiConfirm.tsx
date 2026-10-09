import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { cx } from '../../lib/cx';
import { overBudget, useAiConfirm } from './client';
import { formatRange, formatTokens, formatUsd } from './cost';
import { MODELS, type ModelId } from './models';
import { useAi } from './store';
import { useSpend } from './usage';

/**
 * Kostendialog vor einer KI-Aktion: geschätzte Kosten pro Modell, Stand des Monatsbudgets,
 * Wahl des Modells für genau diese Aktion.
 */
export function AiConfirm() {
  const request = useAiConfirm((s) => s.request);
  const budget = useAi((s) => s.budget);
  const spent = useSpend((s) => s.month);
  const [model, setModel] = useState<ModelId | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setModel(request?.model ?? null);
    startRef.current?.focus();
  }, [request]);

  if (!request || !model) return null;
  const { req, prepared } = request;
  const chosen = prepared.estimates.find((e) => e.model === model);
  const over = chosen ? overBudget(chosen.high) : false;
  const cancel = () => request.resolve(null);

  return (
    <Modal onClose={cancel} position="center" className="w-[440px] p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-accent" />
        <h2 className="text-base font-semibold">{req.title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Eingabe: {formatTokens(prepared.inputTokens)} Tokens{req.webSearch ? ` · bis zu ${req.webSearch} Websuchen` : ''}. Die Kosten
        hängen von der Länge der Antwort ab.
      </p>

      <div className="mt-4 space-y-1.5" role="radiogroup" aria-label="Modell">
        {MODELS.map((m) => {
          const estimate = prepared.estimates.find((e) => e.model === m.id);
          const active = m.id === model;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              onClick={() => setModel(m.id)}
              className={cx(
                'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left',
                active ? 'border-accent bg-accent-soft' : 'border-border hover:bg-hover',
              )}
            >
              <span className={cx('h-3.5 w-3.5 shrink-0 rounded-full border-2', active ? 'border-accent bg-accent' : 'border-border-strong')} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{m.name}</span>
                <span className="block text-xs text-faint">{m.hint}</span>
              </span>
              {estimate && <span className="shrink-0 text-sm tabular-nums">{formatRange(estimate.low, estimate.high)}</span>}
            </button>
          );
        })}
      </div>

      <div className={cx('mt-4 rounded-md px-3 py-2 text-xs', over ? 'bg-[var(--c-tag-red-bg)] text-[var(--c-tag-red-fg)]' : 'bg-hover text-muted')}>
        {budget > 0 ? (
          <>
            Diesen Monat: {formatUsd(spent)} von {formatUsd(budget)} Budget.
            {over && ' Mit dieser Aktion überschreitest du dein Monatsbudget.'}
          </>
        ) : (
          <>Diesen Monat bisher: {formatUsd(spent)}. Abgerechnet wird direkt über dein Anthropic-Konto.</>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={cancel} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-hover">
          Abbrechen
        </button>
        <button
          ref={startRef}
          onClick={() => request.resolve(model)}
          className={cx('h-8 rounded-md px-3 text-sm font-medium text-accent-fg', over ? 'bg-danger' : 'bg-accent')}
        >
          {over ? 'Trotzdem starten' : 'Starten'}
        </button>
      </div>
    </Modal>
  );
}
