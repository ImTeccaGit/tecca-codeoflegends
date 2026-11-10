import { useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CommandMenu } from "@/components/layout/command-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { SplashScreen } from "@/components/layout/splash-screen";
import { TopBar } from "@/components/layout/top-bar";
import { useUiStore } from "@/stores/ui-store";

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setCommandOpen]);

  // The page wrapper is keyed by pathname, so this stable ref callback runs
  // once per route change: reset the scroll position of the main area.
  const resetScrollOnRoute = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  return (
    <div className="relative isolate flex h-dvh overflow-hidden">
      <div className="app-backdrop pointer-events-none fixed inset-0 -z-10" />
      <div className="surface-grid pointer-events-none fixed inset-0 -z-10 opacity-50" />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Vai al contenuto
      </a>

      <Sidebar />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          ref={mainRef}
          id="main-content"
          className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          tabIndex={-1}
        >
          <div
            key={location.pathname}
            ref={resetScrollOnRoute}
            className="page-transition mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav />
      <CommandMenu />
      <SplashScreen />
    </div>
  );
}
