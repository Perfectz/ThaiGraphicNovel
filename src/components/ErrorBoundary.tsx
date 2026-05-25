import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Optional override for the fallback UI. Receives the captured error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional hook for error reporting (Sentry, console, etc.). Called with error + info. */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = {
  error: Error | null;
};

/**
 * Last line of defense for unhandled render-time errors. React requires a class
 * component for error boundaries — this is the one legitimate use of inheritance
 * in a React codebase. Wrap any subtree whose failure should not take down the
 * whole app: 3D scenes, dynamic imports, third-party widgets, etc.
 *
 * Usage:
 *   <GameErrorBoundary>
 *     <TitleThreeScene />
 *   </GameErrorBoundary>
 *
 * The default fallback offers two recovery paths: reload the page, or reset the
 * boundary (which re-mounts children and lets the user try again without a full
 * page refresh — useful for transient failures like a failed asset fetch).
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the configured reporter (or console as a safe default).
    this.props.onError?.(error, info);
    if (!this.props.onError) {
      console.error('[GameErrorBoundary] uncaught render error', error, info);
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <main role="alert" className="grid h-dvh w-screen place-items-center bg-[#0A0A0B] px-6 text-[#F4F1EB]">
        <div className="flex max-w-md flex-col gap-5 text-center">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.32em] text-[#67E8F9]">
            Bangkok Rift · Unhandled error
          </p>
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-[#F4F1EB] sm:text-3xl">
            Something tore the scene.
          </h1>
          <p className="text-sm text-[#F4F1EB]/70">
            The game caught a runtime error and bailed before it could damage your save. You can try again —
            your progress is intact in local storage.
          </p>
          {import.meta.env.DEV ? (
            <pre className="overflow-auto rounded-md border border-[#3A3D44] bg-[#15171B] p-3 text-left text-[11px] text-[#F4F1EB]/80">
              {error.message}
            </pre>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="title-modern-button title-modern-button--primary"
            >
              <span aria-hidden="true">↺</span>
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="title-modern-button title-modern-button--ghost"
            >
              <span>Reload page</span>
            </button>
          </div>
        </div>
      </main>
    );
  }
}
