import Link from "next/link";

// Shown for unknown pages and for anything that is not yours (tasks/receipts of other users return 404).
export default function NotFound() {
  return (
    <div role="status" className="mx-auto mt-16 max-w-md rounded-md border border-sl-border bg-sl-surface p-6 text-center">
      <p className="tnum text-3xl font-semibold text-sl-text">404</p>
      <p className="mt-2 text-sl-text">Not found</p>
      <p className="mt-1 text-sl-text-muted">This page doesn&apos;t exist, or it belongs to another account.</p>
      <Link href="/" className="mt-4 inline-block rounded border border-sl-border px-3 py-1.5 text-[13px] font-medium text-sl-text hover:border-sl-accent">Back to the console</Link>
    </div>
  );
}
