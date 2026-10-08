// Muss vor Excalidraw geladen werden: Schriften kommen aus dem App-Bundle, nie aus dem Internet.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';
export {};
