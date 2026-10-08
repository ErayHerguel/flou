import { Component, type ReactNode } from 'react';

/** Fängt Darstellungsfehler ab, damit nicht die ganze Oberfläche leer bleibt. Gespeichertes bleibt erhalten. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('Darstellungsfehler', error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">Da ist etwas schiefgelaufen</h1>
        <p className="max-w-[480px] text-sm text-muted">{this.state.error.message}</p>
        <p className="max-w-[480px] text-xs text-faint">Gespeicherte Inhalte sind nicht betroffen.</p>
        <button onClick={() => location.reload()} className="h-8 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg">
          Neu laden
        </button>
      </div>
    );
  }
}
