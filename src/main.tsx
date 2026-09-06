import React from 'react';
import ReactDOM from 'react-dom/client';
import { lazy, Suspense } from 'react';
import BangkokExperience from './bangkok/BangkokExperience';
import './index.css';

// The rebuilt training adventure is the main game. Earlier prototypes remain
// reachable for regression checks and their existing saves stay untouched.
const LegacyApp = lazy(() => import('./App'));
const legacy = /\/(legacy|battle-demo|microgames)\/?$/.test(window.location.pathname);

// Re-evaluating the entry during development must not create a second React root.
const container = document.getElementById('root') as HTMLElement & {
  bangkokReactRoot?: ReturnType<typeof ReactDOM.createRoot>;
};
const root = (container.bangkokReactRoot ??= ReactDOM.createRoot(container));
root.render(
  <React.StrictMode>
    {legacy ? (
      <Suspense fallback={<p>Loading adventure…</p>}>
        <LegacyApp />
      </Suspense>
    ) : (
      <BangkokExperience />
    )}
  </React.StrictMode>,
);
