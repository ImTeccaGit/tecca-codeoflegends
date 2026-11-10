import {
  Crosshair,
  Hammer,
  History,
  LayoutDashboard,
  LineChart,
  Map,
  Radio,
  Settings,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ModuleStatus = "available" | "in-development" | "planned";
export type NavGroupId =
  | "overview"
  | "database"
  | "tools"
  | "performance"
  | "system";

export interface AppModule {
  id: string;
  path: string;
  label: string;
  navigationLabel: string;
  description: string;
  group: NavGroupId;
  phase: number;
  status: ModuleStatus;
  icon: LucideIcon;
  showInNavigation: boolean;
}

export const MODULES: AppModule[] = [
  {
    id: "dashboard",
    path: "/",
    label: "Dashboard",
    navigationLabel: "Dashboard",
    description:
      "Stato della piattaforma, moduli disponibili e attività locale in un'unica vista.",
    group: "overview",
    phase: 1,
    status: "available",
    icon: LayoutDashboard,
    showInNavigation: true,
  },
  {
    id: "live",
    path: "/live",
    label: "Live Game",
    navigationLabel: "Live Game",
    description:
      "Stato della partita in corso e i tuoi dati dalla Live Client Data API locale, con overlay opzionale.",
    group: "overview",
    phase: 7,
    status: "available",
    icon: Radio,
    showInNavigation: true,
  },
  {
    id: "champions",
    path: "/champions",
    label: "Champions Database",
    navigationLabel: "Champions",
    description:
      "Tutti i campioni da Riot Data Dragon: abilità, statistiche, skin e classi, con patch e fonte dichiarate.",
    group: "database",
    phase: 2,
    status: "available",
    icon: Shield,
    showInNavigation: true,
  },
  {
    id: "matchups",
    path: "/matchups",
    label: "Matchups & Counters",
    navigationLabel: "Matchups",
    description:
      "Il tuo campione contro gli avversari di corsia affrontati: counter, sinergie, rune e oggetti dalle tue partite.",
    group: "database",
    phase: 6,
    status: "available",
    icon: Crosshair,
    showInNavigation: true,
  },
  {
    id: "runes",
    path: "/runes",
    label: "Rune Builder",
    navigationLabel: "Rune Builder",
    description:
      "Composizione e salvataggio di pagine runiche con alberi, frammenti e preset.",
    group: "tools",
    phase: 3,
    status: "planned",
    icon: Sparkles,
    showInNavigation: true,
  },
  {
    id: "builds",
    path: "/builds",
    label: "Build Builder",
    navigationLabel: "Build Builder",
    description:
      "Build per ruolo con item core, ordine di abilità e note situazionali.",
    group: "tools",
    phase: 3,
    status: "planned",
    icon: Hammer,
    showInNavigation: true,
  },
  {
    id: "jungle",
    path: "/jungle",
    label: "Jungle Routes",
    navigationLabel: "Jungle Routes",
    description:
      "Mappa schematica, percorsi modello e personalizzati, cronometro di allenamento con storico e record personali.",
    group: "tools",
    phase: 4,
    status: "available",
    icon: Map,
    showInNavigation: true,
  },
  {
    id: "players",
    path: "/players",
    label: "Player Profiles",
    navigationLabel: "Player Profiles",
    description:
      "Ricerca per Riot ID, rank Solo e Flex, statistiche e campioni dalla Riot API ufficiale.",
    group: "performance",
    phase: 5,
    status: "available",
    icon: Users,
    showInNavigation: true,
  },
  {
    id: "matches",
    path: "/matches",
    label: "Match History",
    navigationLabel: "Match History",
    description:
      "Partite recuperate dalla Riot API con oggetti, rune, KDA e filtri per coda.",
    group: "performance",
    phase: 5,
    status: "available",
    icon: History,
    showInNavigation: true,
  },
  {
    id: "analysis",
    path: "/analysis",
    label: "Match Analysis",
    navigationLabel: "Match Analysis",
    description:
      "Analisi post-partita delle tue partite reali: statistiche, grafici, campioni e ruoli con fonte e numerosità.",
    group: "performance",
    phase: 6,
    status: "available",
    icon: LineChart,
    showInNavigation: true,
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    navigationLabel: "Settings",
    description:
      "Preferenze locali, regione Riot, diagnostica e gestione dei dati.",
    group: "system",
    phase: 1,
    status: "available",
    icon: Settings,
    showInNavigation: true,
  },
];

export const NAV_GROUPS: ReadonlyArray<{
  id: NavGroupId;
  label: string;
}> = [
  { id: "overview", label: "Panoramica" },
  { id: "database", label: "Database" },
  { id: "tools", label: "Strumenti" },
  { id: "performance", label: "Performance" },
  { id: "system", label: "Sistema" },
];

/**
 * Explicit order for the primary sidebar. Settings is intentionally excluded:
 * it lives in the persistent footer next to the profile and app version.
 */
const NAV_ORDER = [
  "dashboard",
  "champions",
  "builds",
  "runes",
  "jungle",
  "live",
  "players",
  "matches",
  "analysis",
  "matchups",
] as const;

export const MAIN_NAVIGATION_MODULES = NAV_ORDER.map((id) =>
  MODULES.find((module) => module.id === id),
).filter((module): module is AppModule => Boolean(module));

export const NAVIGATION_MODULES = [
  ...MAIN_NAVIGATION_MODULES,
  ...MODULES.filter(
    (module) => module.showInNavigation && module.id === "settings",
  ),
];

export function getModuleById(id: string): AppModule | undefined {
  return MODULES.find((module) => module.id === id);
}

export function getModuleByPath(pathname: string): AppModule | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  return (
    MODULES.find((module) => module.path === normalized) ??
    MODULES.filter((module) => module.path !== "/").find((module) =>
      normalized.startsWith(`${module.path}/`),
    )
  );
}

export const STATUS_LABELS: Record<ModuleStatus, string> = {
  available: "Disponibile",
  "in-development": "In sviluppo",
  planned: "Pianificato",
};

export const AVAILABLE_MODULE_COUNT = MODULES.filter(
  (module) => module.status === "available",
).length;
