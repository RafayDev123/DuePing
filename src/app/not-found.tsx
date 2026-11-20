import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="m-0 mono text-[13px] text-muted">404</p>
      <h1 className="m-0 mt-1 text-[26px] font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-muted">It may have moved, or the link may be private and no longer valid.</p>
      <div className="mt-2 flex gap-2"><Link className="btn btn-primary" href="/">Home</Link><Link className="btn" href="/app">Open workspace</Link></div>
    </main>
  );
}
