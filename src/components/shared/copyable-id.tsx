"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn, shortId } from "@/lib/utils";

/**
 * A UUID, shortened for display, with the full value one click away.
 *
 * Payment and account ids are the handle an operator needs when they move to
 * logs or to a support conversation, so they have to be copyable — but a
 * column of full UUIDs is unreadable. The abbreviation is visual only: the
 * accessible name and the `title` both carry the whole value.
 */
export function CopyableId({
  value,
  className,
  label = "identifier",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused outside a secure context or by
      // policy. The full value is in the `title`, so there is a way through.
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <code className="font-mono text-xs" title={value}>
        {shortId(value)}
      </code>
      <button
        type="button"
        onClick={copy}
        // Padding gives a usable tap target without the negative margin
        // changing the row height.
        className="-m-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={
          copied ? `${label} copied` : `Copy full ${label} ${value}`
        }
      >
        {copied ? (
          <Check className="size-3.5 text-success-700" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
      {/* Announces the result of the copy, which is otherwise only visual. */}
      <span role="status" aria-live="polite" className="visually-hidden">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </span>
  );
}
