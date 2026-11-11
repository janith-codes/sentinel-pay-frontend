import { redirect } from "next/navigation";

/**
 * The root has no content of its own.
 *
 * Middleware already redirects `/` to `/login` when there is no session; this
 * handles the other case, where there is one.
 */
export default function RootPage() {
  redirect("/dashboard");
}
