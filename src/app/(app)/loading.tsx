export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      aria-busy="true"
      className="space-y-6 animate-pulse"
    >
      <span className="sr-only">Loading page...</span>
      <div aria-hidden="true" className="h-8 w-56 rounded-lg bg-slate-200" />
      <div aria-hidden="true" className="h-4 w-80 max-w-full rounded bg-slate-200/70" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
      </div>
      <div aria-hidden="true" className="h-64 rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
