import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import type { Lane } from "@/types/catalog";

interface LaneIconProps extends SVGProps<SVGSVGElement> {
  lane: Lane;
}

/**
 * Original TECCA lane glyphs (no Riot assets): a small map frame with the
 * lane highlighted for Top/Mid/Bot, a leaf for the jungle and a shield for
 * support. Drawn with currentColor so they follow the design tokens.
 */
export function LaneIcon({ lane, className, ...props }: LaneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      {lane === "TOP" || lane === "MIDDLE" || lane === "BOTTOM" ? (
        <rect x="4" y="4" width="16" height="16" rx="3" strokeOpacity={0.3} />
      ) : null}
      {lane === "TOP" ? <path d="M4 15V7a3 3 0 0 1 3-3h8" strokeWidth={2.4} /> : null}
      {lane === "MIDDLE" ? (
        <>
          <path d="M7.5 16.5l9-9" strokeWidth={2.4} />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {lane === "BOTTOM" ? <path d="M9 20h8a3 3 0 0 0 3-3V9" strokeWidth={2.4} /> : null}
      {lane === "JUNGLE" ? (
        <>
          <path d="M12 3.5c-4.5 3.2-6 7.4-4.4 11.3C8.6 17.2 10.2 19 12 20.5c1.8-1.5 3.4-3.3 4.4-5.7C18 10.9 16.5 6.7 12 3.5z" />
          <path d="M12 8v12.5M12 12.5l-2.4-2M12 15.5l2.4-2" />
        </>
      ) : null}
      {lane === "UTILITY" ? (
        <>
          <path d="M12 3.5l7 2.8v5.4c0 4.1-2.9 7.4-7 8.8-4.1-1.4-7-4.7-7-8.8V6.3z" />
          <path d="M12 9v6M9 12h6" />
        </>
      ) : null}
    </svg>
  );
}
