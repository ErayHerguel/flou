import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { schedule } from '../../db/saveQueue';
import { setSetting } from '../../db/settings';
import { GUEST } from '../../lib/mode';
import { DEFAULT_MODEL, isModelId, type ModelId } from './models';

/** Ab welchen geschätzten Kosten vorher gefragt wird */
export type ConfirmMode = 'always' | 'cent' | 'fivecent' | 'never';

export const CONFIRM_THRESHOLD: Record<ConfirmMode, number> = {
  always: 0,
  cent: 0.01,
  fivecent: 0.05,
  never: Number.POSITIVE_INFINITY,
};

interface AiState {
  /** KI gibt es nur in der App selbst, nie für Gäste oder verbundene Geräte. */
  available: boolean;
  /** Ein Schlüssel liegt im Schlüsselbund (der Schlüssel selbst ist nie hier). */
  keySet: boolean;
  model: ModelId;
  confirm: ConfirmMode;
  /** Monatsbudget in US-Dollar, 0 = keins */
  budget: number;
  /** Simulierter Claude (nur Entwicklungs-Builds) */
  mock: boolean;
  hydrate(settings: Record<string, string>): Promise<void>;
  setKeySet(on: boolean): void;
  setModel(model: ModelId): void;
  setConfirm(mode: ConfirmMode): void;
  setBudget(usd: number): void;
}

const persist = (key: string, value: string) => schedule(`setting:${key}`, () => [setSetting(key, value)]);

export const useAi = create<AiState>((set) => ({
  available: !GUEST,
  keySet: false,
  model: DEFAULT_MODEL,
  confirm: 'cent',
  budget: 0,
  mock: false,
  async hydrate(settings) {
    const model = settings['ai.model'] ?? '';
    const confirm = settings['ai.confirm'] as ConfirmMode | undefined;
    const mock = GUEST ? false : await invoke<boolean>('ai_mock').catch(() => false);
    set({
      keySet: settings['ai.keySet'] === '1',
      model: isModelId(model) ? model : DEFAULT_MODEL,
      confirm: confirm && confirm in CONFIRM_THRESHOLD ? confirm : 'cent',
      budget: Math.max(0, Number(settings['ai.budget']) || 0),
      mock,
    });
  },
  setKeySet(on) {
    set({ keySet: on });
    persist('ai.keySet', on ? '1' : '0');
  },
  setModel(model) {
    set({ model });
    persist('ai.model', model);
  },
  setConfirm(confirm) {
    set({ confirm });
    persist('ai.confirm', confirm);
  },
  setBudget(usd) {
    const budget = Math.max(0, Math.round(usd * 100) / 100);
    set({ budget });
    persist('ai.budget', String(budget));
  },
}));

/** KI ist benutzbar: in der App, mit Schlüssel (oder simuliert). */
export const useAiReady = () => useAi((s) => s.available && (s.keySet || s.mock));

export function aiUsable(): boolean {
  const s = useAi.getState();
  return s.available && (s.keySet || s.mock);
}
