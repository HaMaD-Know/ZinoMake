import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTheme, readPref, type ThemePref } from './app/ui-store';
import './styles/global.css';

applyTheme(readPref<ThemePref>('theme', 'light'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
