import type { CampId, MapSide } from "@/features/jungle/data/camps";

/**
 * Model routes for practice. They describe only the ORDER of camps — the
 * common clear patterns players train — and carry no timings, win rates or
 * "optimal" claims. Times come only from the user's own attempts.
 */

export type RouteCategory = "full" | "five" | "three" | "invade" | "custom";

export interface JungleRoute {
  key: string;
  name: string;
  side: MapSide;
  category: RouteCategory;
  camps: CampId[];
  description: string;
}

export const CATEGORY_LABELS: Record<RouteCategory, string> = {
  full: "Full Clear",
  five: "5 Camp Clear",
  three: "3 Camp Clear",
  invade: "Invasione simulata",
  custom: "Personalizzato",
};

export const MODEL_ROUTES: readonly JungleRoute[] = [
  {
    key: "blue-full-red-start",
    name: "Full Clear · partenza Red",
    side: "blue",
    category: "full",
    camps: ["blue-red", "blue-krugs", "blue-raptors", "blue-wolves", "blue-blue", "blue-gromp"],
    description: "Tutti i sei campi del proprio lato, dal buff rosso verso il lato superiore.",
  },
  {
    key: "blue-full-blue-start",
    name: "Full Clear · partenza Blue",
    side: "blue",
    category: "full",
    camps: ["blue-blue", "blue-gromp", "blue-wolves", "blue-raptors", "blue-red", "blue-krugs"],
    description: "Tutti i sei campi del proprio lato, dal buff blu verso il lato inferiore.",
  },
  {
    key: "blue-five-camp",
    name: "5 Camp · senza Krug",
    side: "blue",
    category: "five",
    camps: ["blue-red", "blue-raptors", "blue-wolves", "blue-blue", "blue-gromp"],
    description: "Cinque campi saltando i Krug, per finire sul lato superiore.",
  },
  {
    key: "blue-three-camp",
    name: "3 Camp · Red → Blue",
    side: "blue",
    category: "three",
    camps: ["blue-red", "blue-blue", "blue-gromp"],
    description: "I due buff e Gromp, per arrivare presto al fiume superiore.",
  },
  {
    key: "blue-invade-top",
    name: "Invasione · lato superiore",
    side: "blue",
    category: "invade",
    camps: ["blue-blue", "blue-gromp", "blue-wolves", "scuttle-top", "red-raptors", "red-red"],
    description:
      "Allenamento nel Practice Tool: lato superiore, Scuttle e due campi della giungla avversaria.",
  },
  {
    key: "red-full-red-start",
    name: "Full Clear · partenza Red",
    side: "red",
    category: "full",
    camps: ["red-red", "red-krugs", "red-raptors", "red-wolves", "red-blue", "red-gromp"],
    description: "Tutti i sei campi del proprio lato, dal buff rosso verso il lato inferiore.",
  },
  {
    key: "red-full-blue-start",
    name: "Full Clear · partenza Blue",
    side: "red",
    category: "full",
    camps: ["red-blue", "red-gromp", "red-wolves", "red-raptors", "red-red", "red-krugs"],
    description: "Tutti i sei campi del proprio lato, dal buff blu verso il lato superiore.",
  },
  {
    key: "red-five-camp",
    name: "5 Camp · senza Krug",
    side: "red",
    category: "five",
    camps: ["red-red", "red-raptors", "red-wolves", "red-blue", "red-gromp"],
    description: "Cinque campi saltando i Krug, per finire sul lato inferiore.",
  },
  {
    key: "red-three-camp",
    name: "3 Camp · Red → Blue",
    side: "red",
    category: "three",
    camps: ["red-red", "red-blue", "red-gromp"],
    description: "I due buff e Gromp, per arrivare presto al fiume inferiore.",
  },
  {
    key: "red-invade-bot",
    name: "Invasione · lato inferiore",
    side: "red",
    category: "invade",
    camps: ["red-blue", "red-gromp", "red-wolves", "scuttle-bot", "blue-raptors", "blue-red"],
    description:
      "Allenamento nel Practice Tool: lato inferiore, Scuttle e due campi della giungla avversaria.",
  },
];

export function findModelRoute(key: string): JungleRoute | undefined {
  return MODEL_ROUTES.find((route) => route.key === key);
}
