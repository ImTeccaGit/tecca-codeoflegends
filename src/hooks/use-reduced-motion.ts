import { useEffect, useState } from "react";

function readPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const systemPrefersReduced =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  return (
    systemPrefersReduced ||
    document.documentElement.dataset.reduceMotion === "true"
  );
}

/**
 * Combines the OS preference with the app-level "Riduci le animazioni" setting.
 * The setting is applied as `data-reduce-motion` on <html> by RuntimePreferences.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPreference);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    const update = () => setReduced(readPreference());

    update();
    mediaQuery?.addEventListener("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });

    return () => {
      mediaQuery?.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return reduced;
}
