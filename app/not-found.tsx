import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-title">Page not found</h1>
      <p className="text-muted">There&apos;s nothing here. Your local data is untouched.</p>
      <Link
        href="/"
        className="mt-2 rounded-control bg-accent px-4 py-2 font-medium text-accent-foreground transition-colors duration-150 ease-out-quart hover:bg-accent-hover active:bg-accent-active"
      >
        Back to profiles
      </Link>
    </main>
  );
}
