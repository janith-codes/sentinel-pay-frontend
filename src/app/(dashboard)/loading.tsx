/**
 * Shown while a dashboard route segment is being prepared.
 *
 * Shaped like the page it stands in for — a header line and a row of tiles —
 * so arriving data replaces it rather than pushing the layout around.
 */
export default function DashboardLoading() {
  return (
    <>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[--radius-card] bg-muted"
          />
        ))}
      </div>

      <div
        className="h-72 animate-pulse rounded-[--radius-card] bg-muted"
        aria-hidden="true"
      />

      <span className="visually-hidden" role="status">
        Loading
      </span>
    </>
  );
}
