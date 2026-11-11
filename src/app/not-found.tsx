import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-5">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
          <FileQuestion className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          That route does not exist in this console.
        </p>
        <Button asChild className="mt-2">
          <Link href="/dashboard">Back to the dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
