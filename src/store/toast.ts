import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

let nextId = 1;

export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

export function toast(message: string, kind: Toast['kind'] = 'info'): void {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  setTimeout(() => dismissToast(id), kind === 'error' ? 6000 : 3000);
}

export function dismissToast(id: number): void {
  useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function reportError(context: string, err: unknown): void {
  console.error(context, err);
  toast(`${context}: ${err instanceof Error ? err.message : String(err)}`, 'error');
}
