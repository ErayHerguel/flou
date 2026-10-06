import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

export const useConfirm = create<ConfirmState>(() => ({ request: null }));

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  useConfirm.getState().request?.resolve(false);
  return new Promise((resolve) => {
    useConfirm.setState({
      request: {
        ...options,
        resolve: (ok) => {
          useConfirm.setState({ request: null });
          resolve(ok);
        },
      },
    });
  });
}
