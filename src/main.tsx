import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GuestApp } from './GuestApp';
import { GUEST } from './lib/mode';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{GUEST ? <GuestApp /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
