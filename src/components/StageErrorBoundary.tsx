import { GameErrorBoundary } from './ErrorBoundary';
import { useGameStore } from '../store/gameStore';

/**
 * Stage-scoped error boundary. Wraps Stage3DAdventureDispatcher so a
 * GLTFLoader failure or runtime Three.js error inside any stage doesn't
 * take down the rest of the app — the player gets a recoverable UI and
 * can return to the level select instead of staring at a frozen canvas.
 *
 * Why this is separate from `GameErrorBoundary`: the top-level boundary
 * offers "Reload page" (heavy-handed) and "Try again" (re-mount the
 * subtree). Stage failures usually want a third option: "Return to map"
 * which leaves the page alive but pulls the player out of the broken
 * stage. That requires gameStore access, so it lives here.
 */
export function StageErrorBoundary({ children }: { children: React.ReactNode }) {
  const returnToOverworld = useGameStore((state) => state.returnToOverworld);

  return (
    <GameErrorBoundary
      onError={(error, info) => {
        // Keep the console-side breadcrumb so a tester pasting a bug
        // report has something more than "the stage broke". In dev we
        // include the React component stack; production keeps it terse.
        // No PII is captured here — error.message and a component stack
        // are the only ingredients.
        console.error('[Stage] runtime error', {
          message: error.message,
          name: error.name,
          stack: import.meta.env.DEV ? error.stack : undefined,
          componentStack: import.meta.env.DEV ? info.componentStack : undefined,
        });
      }}
      fallback={(error, reset) => (
        <main
          role="alert"
          className="grid h-dvh w-screen place-items-center bg-[#0A0A0B] px-6 text-[#F4F1EB]"
        >
          <div className="flex max-w-md flex-col gap-5 text-center">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#ef4444]">
              Stage failed to load
            </p>
            <h1 className="font-display text-2xl font-black uppercase tracking-tight text-[#F4F1EB] sm:text-3xl">
              Something tore the scene.
            </h1>
            <p className="text-sm text-[#F4F1EB]/70">
              The 3D scene hit an error before it could finish loading. Your save is intact — you can try the
              stage again, head back to the map, or report what happened.
            </p>
            {import.meta.env.DEV ? (
              <pre className="overflow-auto rounded-md border border-[#3A3D44] bg-[#15171B] p-3 text-left text-[11px] text-[#F4F1EB]/80">
                {error.name}: {error.message}
              </pre>
            ) : null}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="title-modern-button title-modern-button--primary"
              >
                <span aria-hidden="true">↺</span>
                <span>Reload stage</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  returnToOverworld();
                }}
                className="title-modern-button title-modern-button--ghost"
              >
                <span>Return to map</span>
              </button>
              <a
                href={`mailto:pzgambo@gmail.com?subject=${encodeURIComponent(
                  'Bangkok Rift bug report',
                )}&body=${encodeURIComponent(
                  `Stage failed to load.\n\nError: ${error.name} — ${error.message}\n\nUser-agent: ${
                    typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
                  }`,
                )}`}
                className="title-modern-button title-modern-button--ghost"
              >
                <span>Report bug</span>
              </a>
            </div>
          </div>
        </main>
      )}
    >
      {children}
    </GameErrorBoundary>
  );
}
