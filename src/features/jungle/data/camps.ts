/**
 * Schematic Summoner's Rift jungle layout drawn for TECCA (no Riot map art).
 * Coordinates are approximate positions on a 600×600 board with the Blue base
 * bottom-left and the Red base top-right: good for studying routes, not a
 * pixel-exact copy of the minimap.
 *
 * No spawn or respawn times are stored here: Riot does not publish them in a
 * structured, versioned source, so the app does not state them.
 */

import type { CampId } from "@/types/jungle";

export { CAMP_IDS, type CampId } from "@/types/jungle";
export type MapSide = "blue" | "red";
export type CampOwner = MapSide | "river";
export type CampKind = "buff" | "camp" | "scuttle";
/** Which half of a team's jungle: toward top lane or toward bot lane. */
export type Quadrant = "top" | "bot";

export interface Camp {
  id: CampId;
  name: string;
  short: string;
  owner: CampOwner;
  kind: CampKind;
  quadrant: Quadrant;
  x: number;
  y: number;
  description: string;
  /** Where the name is drawn, to avoid overlapping nearby pits. */
  labelPosition?: "above" | "below";
}

const SIDE_CAMPS = [
  {
    key: "blue",
    name: "Buff blu",
    short: "B",
    kind: "buff",
    description: "Campo buff: sconfiggerlo concede un potenziamento temporaneo.",
  },
  {
    key: "gromp",
    name: "Gromp",
    short: "G",
    kind: "camp",
    description: "Campo singolo accanto al buff blu.",
  },
  {
    key: "wolves",
    name: "Lupi",
    short: "W",
    kind: "camp",
    description: "Campo di gruppo nella metà superiore della propria giungla.",
  },
  {
    key: "raptors",
    name: "Rapaci",
    short: "R",
    kind: "camp",
    description: "Campo di gruppo vicino alla corsia centrale.",
  },
  {
    key: "red",
    name: "Buff rosso",
    short: "R",
    kind: "buff",
    description: "Campo buff: sconfiggerlo concede un potenziamento temporaneo.",
  },
  {
    key: "krugs",
    name: "Krug",
    short: "K",
    kind: "camp",
    description: "Campo di gruppo accanto al buff rosso.",
  },
] as const;

/** Blue side positions; the Red side is the point mirror (600 − x, 600 − y). */
const BLUE_POSITIONS: Record<(typeof SIDE_CAMPS)[number]["key"], [number, number, Quadrant]> = {
  blue: [154, 280, "top"],
  gromp: [86, 259, "top"],
  wolves: [154, 336, "top"],
  raptors: [280, 381, "bot"],
  red: [312, 438, "bot"],
  krugs: [341, 491, "bot"],
};

function sideCamps(side: MapSide): Camp[] {
  return SIDE_CAMPS.map((camp) => {
    const [bx, by, quadrant] = BLUE_POSITIONS[camp.key];
    const mirrored = side === "red";
    return {
      id: `${side}-${camp.key}` as CampId,
      name: camp.name,
      short: camp.short,
      owner: side,
      kind: camp.kind,
      // The Red side mirrors positions and swaps which lane each half faces.
      quadrant: mirrored ? (quadrant === "top" ? "bot" : "top") : quadrant,
      x: mirrored ? 600 - bx : bx,
      y: mirrored ? 600 - by : by,
      description: camp.description,
    };
  });
}

export const CAMPS: readonly Camp[] = [
  ...sideCamps("blue"),
  ...sideCamps("red"),
  {
    id: "scuttle-top",
    name: "Scuttle superiore",
    short: "S",
    owner: "river",
    kind: "scuttle",
    quadrant: "top",
    x: 178,
    y: 211,
    description: "Mostro neutrale del fiume, lato corsia superiore.",
  },
  {
    id: "scuttle-bot",
    name: "Scuttle inferiore",
    short: "S",
    owner: "river",
    kind: "scuttle",
    quadrant: "bot",
    x: 422,
    y: 389,
    description: "Mostro neutrale del fiume, lato corsia inferiore.",
    labelPosition: "above",
  },
];

const CAMP_INDEX = new Map(CAMPS.map((camp) => [camp.id, camp]));

export function getCamp(id: CampId): Camp {
  const camp = CAMP_INDEX.get(id);
  if (!camp) {
    throw new Error(`Campo sconosciuto: ${id}`);
  }
  return camp;
}

export function isCampId(value: string): value is CampId {
  return CAMP_INDEX.has(value as CampId);
}

/** Epic objective areas: map locations only, no timers. */
export const OBJECTIVES = [
  {
    id: "baron",
    name: "Fossa del Barone",
    x: 205,
    y: 176,
    labelY: 140,
    description:
      "Area dell'obiettivo epico nel fiume superiore. I mostri presenti e i tempi cambiano tra stagioni e patch: fai riferimento alle note patch ufficiali.",
  },
  {
    id: "dragon",
    name: "Fossa del Drago",
    x: 395,
    y: 424,
    labelY: 466,
    description:
      "Area dei draghi nel fiume inferiore. Tipi, effetti e tempi dipendono dalla patch: fai riferimento alle note patch ufficiali.",
  },
] as const;

export const SIDE_LABELS: Record<MapSide, string> = {
  blue: "Blue Side",
  red: "Red Side",
};

export function campOwnerLabel(owner: CampOwner): string {
  return owner === "river" ? "Fiume" : SIDE_LABELS[owner];
}
