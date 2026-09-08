import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Self-hosted fonts: the build must not depend on Google Fonts so it can
// run offline (e.g. bundled on a Raspberry Pi image).
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
