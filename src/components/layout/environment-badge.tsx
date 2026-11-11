import { ShieldCheck } from "lucide-react";

/**
 * A reminder of what the console is pointed at.
 *
 * The API host itself is not shown: it is server-side configuration and has no
 * business being in the client bundle. This states the security posture of the
 * session instead, which is the part an operator actually needs to know.
 */
export function EnvironmentBadge() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
      <ShieldCheck
        className="mt-0.5 size-4 shrink-0 text-sidebar-primary"
        aria-hidden="true"
      />
      <div className="min-w-0 text-xs leading-snug text-sidebar-foreground/70">
        <p className="font-medium text-sidebar-foreground">Session secured</p>
        <p className="mt-0.5">
          Tokens are held server-side in httpOnly cookies.
        </p>
      </div>
    </div>
  );
}
