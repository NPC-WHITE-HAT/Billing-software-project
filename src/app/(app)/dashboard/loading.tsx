export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      aria-busy="true"
      className="-m-4 min-h-full space-y-6 bg-slate-50 p-4 sm:-m-6 sm:space-y-8 sm:p-6 lg:p-8"
    >
      <span className="sr-only">Loading dashboard...</span>
      <div aria-hidden="true" className="h-32 rounded-2xl border border-slate-200 bg-white" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
      </div>
      <div aria-hidden="true" className="h-64 rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
