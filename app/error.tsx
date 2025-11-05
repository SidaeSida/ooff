'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 필요 시 외부로 로깅(예: Sentry)
  console.error(error);

  return (
    <div className="min-h-[50vh] grid place-items-center px-4">
      <div className="text-center max-w-[560px]">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-600">
          Please try again in a moment. If the issue persists, refresh the page or go back to Home.
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Try again"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Go Home"
          >
            Go Home
          </a>
        </div>

        {process.env.NODE_ENV === 'development' && error?.digest ? (
          <p className="mt-3 text-xs text-gray-400">error id: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
