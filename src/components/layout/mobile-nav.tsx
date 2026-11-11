"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

/**
 * The navigation drawer, below `lg`.
 *
 * ---------------------------------------------------------------------------
 * How it works
 * ---------------------------------------------------------------------------
 * The panel is a `popover="manual"` element, which puts it in the top layer —
 * so it and its `::backdrop` sit above every other element regardless of
 * stacking context, with no z-index arms race.
 *
 * The swipe is a horizontal scroller with two scroll-snap stops: the sheet, and
 * a viewport-wide spacer. Dragging between them is what opens and closes it.
 * Doing it this way means momentum, velocity and mid-gesture interruption come
 * from the browser's own scrolling, which no amount of pointer-event
 * bookkeeping reproduces convincingly.
 *
 * State is read from an `IntersectionObserver` on the sheet rather than from
 * the scroll position, because the observer fires the same way whichever route
 * the sheet took — user swipe, programmatic scroll, or a snap settling — so
 * every dismissal path converges on one callback.
 *
 * The CSS half of this lives in globals.css under `.Drawer`.
 */

/** The element made inert while the drawer is open. */
const MAIN_CONTENT_ID = "main-content";

export function MobileNav() {
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !scroller) return;

    // Show first, so the element is in the top layer before anything scrolls.
    drawer.showPopover();

    // `scroll-initial-target` puts the initial position at the closed stop.
    // Without support for it the drawer would appear already open with no
    // slide-in, so jump it there by hand.
    if (!CSS.supports("scroll-initial-target", "nearest")) {
      scroller.scrollTo({ left: scroller.offsetWidth, behavior: "instant" });
      // Two frames: a single one is not enough for the jump to commit, and the
      // animating scroll below would cancel it before it applied.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scroller.scrollTo({ left: 0, behavior: "auto" });
        });
      });
      return;
    }

    // `behavior: auto` defers to the CSS `scroll-behavior`, which is smooth
    // unless the user has asked for reduced motion.
    scroller.scrollTo({ left: 0, behavior: "auto" });
  }, []);

  const close = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Scroll back to the spacer and stop. Calling hidePopover() here would
    // yank the element out of the top layer mid-animation and the slide-out
    // would never be seen; the observer below hides it once the sheet has
    // actually left.
    scroller.scrollTo({ left: scroller.offsetWidth, behavior: "auto" });
  }, []);

  // --- open/closed detection ------------------------------------------------
  useEffect(() => {
    const drawer = drawerRef.current;
    const sheet = sheetRef.current;
    if (!drawer || !sheet) return;

    const main = document.getElementById(MAIN_CONTENT_ID);

    function onOpened() {
      // Keyboard and screen-reader users must not be able to reach the page
      // behind the drawer.
      if (main) main.inert = true;
      setIsOpen(true);
      sheet?.focus();
    }

    function onClosed() {
      drawer?.hidePopover();
      if (main) main.inert = false;
      setIsOpen(false);
    }

    // "Any pixel of the sheet visible" counts as not-closed. Intentionally
    // tiny, so the closed callback only fires once the sheet is truly gone.
    const visibleThreshold = 1 / Math.max(window.innerWidth, 1);

    const observer = new IntersectionObserver(
      (entries) => {
        // A programmatic scroll can deliver several entries at once; only the
        // last describes where the sheet ended up.
        const entry = entries.at(-1);
        if (!entry) return;
        if (entry.intersectionRatio < visibleThreshold) onClosed();
        else if (entry.intersectionRatio === 1) onOpened();
      },
      // The popover is the intersection root, so the ratio measures how much
      // of the sheet has been swiped on-screen.
      { root: drawer, threshold: [visibleThreshold, 1] },
    );

    observer.observe(sheet);

    return () => {
      observer.disconnect();
      if (main) main.inert = false;
    };
  }, []);

  // --- backdrop fade fallback ----------------------------------------------
  // Firefox has no scroll-driven animations. The @supports gate in the
  // stylesheet keeps the keyframes from applying there, so this is the only
  // writer of the custom property when it runs.
  useEffect(() => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!drawer || !scroller || !sheet) return;
    if (CSS.supports("animation-timeline: scroll()")) return;

    function onScroll() {
      const width = sheet!.offsetWidth || 1;
      // Same mapping as the keyframes: 0 scroll is open, sheet-width is closed.
      const ratio = 1 - scroller!.scrollLeft / width;
      drawer!.style.setProperty(
        "--drawer-backdrop",
        String(Math.min(Math.max(ratio, 0), 1)),
      );
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  // --- Escape ---------------------------------------------------------------
  // On `document`, because focus is inside the drawer when it is open.
  // `popover="manual"` opts out of the browser's own Escape handling.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        // Return focus to what opened it, or it lands on <body>.
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="sp-drawer"
        className="grid size-11 place-items-center rounded-lg text-ink-600 transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* `popover="manual"`: light-dismiss is implemented below instead,
          because the built-in version also fires part-way through a swipe. */}
      <div
        ref={drawerRef}
        id="sp-drawer"
        popover="manual"
        className="Drawer lg:hidden"
        onClick={(event) => {
          // Light-dismiss: a tap on the dimmed strip outside the sheet.
          if (
            sheetRef.current &&
            event.target instanceof Node &&
            !sheetRef.current.contains(event.target)
          ) {
            close();
          }
        }}
      >
        <div ref={scrollerRef} className="Drawer-scroller">
          <div
            ref={sheetRef}
            /* `tabindex=-1` makes the sheet focusable programmatically, so
               focus can move into the drawer, without adding it to the tab
               order. */
            tabIndex={-1}
            className="Drawer-sheet outline-none"
          >
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <Link
                href="/dashboard"
                onClick={close}
                className="text-sidebar-foreground"
              >
                <Brand />
              </Link>
              <button
                type="button"
                onClick={() => {
                  close();
                  triggerRef.current?.focus();
                }}
                aria-label="Close navigation menu"
                className="grid size-11 place-items-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto py-4">
              <SidebarNav onNavigate={close} />
            </div>

            <div className="border-t border-sidebar-border p-4">
              <EnvironmentBadge />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
