import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `cacheComponents` and `partialPrefetching` are scaffolded on by
  // create-next-app. Both are switched off here on purpose.
  //
  // Every authenticated screen in this app reads the session cookie, and
  // `cacheComponents` requires each such dynamic read to sit behind its own
  // Suspense boundary or an explicit `"use cache"` directive. That buys
  // nothing for a dashboard whose pages are all per-user and uncacheable,
  // while making the token handling considerably easier to get wrong.
  cacheComponents: false,
  partialPrefetching: false,

  // Tailwind v4 is compiled through the Turbopack CSS loader, which is also
  // what the installed @tailwindcss/turbopack package provides. Next 16 uses
  // Turbopack for both `dev` and `build`.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // The browser never talks to Spring Boot directly, so no API host ends up
  // in the client bundle and the backend needs no CORS configuration.
  // See src/lib/api/server-client.ts for the reasoning.
  reactStrictMode: true,
};

export default nextConfig;
