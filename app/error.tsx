'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-title">Something went wrong</h1>
      <p className="max-w-sm text-muted">
        This is a local error in the app, not a problem with your data — everything in your vault
        stays on this device. {error.message ? `(${error.message})` : null}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-control bg-accent px-4 py-2 font-medium text-accent-foreground transition-colors duration-150 ease-out-quart hover:bg-accent-hover active:bg-accent-active"
      >
        Try again
      </button>
    </main>
  );
}
