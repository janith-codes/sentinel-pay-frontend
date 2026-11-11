import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

/**
 * One typeface, loaded by `next/font` so it is self-hosted and the layout does
 * not shift when it arrives. The variable is what `--font-sans` in globals.css
 * resolves to.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SentinelPay",
    template: "%s · SentinelPay",
  },
  description:
    "Payment processing and fraud monitoring console for the SentinelPay platform.",
  // A payments console has no business being indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d172b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `lang` is set explicitly so device translation and screen-reader
    // pronunciation both have something to go on.
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
