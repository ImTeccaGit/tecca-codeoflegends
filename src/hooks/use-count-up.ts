import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface CountUpOptions {
  duration?: number;
  enabled?: boolean;
}

/**
 * Animates a numeric value once per mount. Never re-runs for in-place updates,
 * so dashboard refreshes do not replay the count-up animation.
 *
 * State only holds the in-flight frame value; outside an animation the hook
 * returns `target` directly, so no state is synchronised inside the effect.
 */
export function useCountUp(
  target: number,
  { duration = 900, enabled = true }: CountUpOptions = {},
): number {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = enabled && !reducedMotion && Number.isFinite(target);
  const [frameValue, setFrameValue] = useState<number | null>(
    shouldAnimate ? 0 : null,
  );
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || hasAnimated.current) {
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / Math.max(duration, 1), 1);

      if (progress < 1) {
        const eased = 1 - (1 - progress) ** 3;
        setFrameValue(target * eased);
        frame = requestAnimationFrame(tick);
        return;
      }

      // Marked only on completion: a StrictMode remount restarts cleanly.
      hasAnimated.current = true;
      setFrameValue(null);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, shouldAnimate, target]);

  return shouldAnimate ? (frameValue ?? target) : target;
}
