import { cn } from "@/lib/utils";

/**
 * The wordmark.
 *
 * The shield is inline SVG rather than an image file: it is two paths, so a
 * network request for it would cost more than it saves, and as inline markup
 * it inherits `currentColor` and stays crisp at any size.
 */
export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-navy-600 text-white">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4.5"
          // Decorative: the wordmark beside it carries the name.
          aria-hidden="true"
        >
          <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6L12 2.5Z" />
          <path d="m8.8 11.9 2.3 2.4 4.1-4.4" />
        </svg>
      </span>
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span className="text-[0.95rem] font-semibold tracking-tight">
            SentinelPay
          </span>
          <span className="mt-0.5 text-[0.68rem] tracking-wide text-current/60 uppercase">
            Payments console
          </span>
        </span>
      )}
    </span>
  );
}
