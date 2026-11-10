/**
 * Italian labels for the most common League of Legends queue ids, from the
 * Riot static queue list (https://static.developer.riotgames.com/docs/lol/queues.json).
 * Unknown ids fall back to the game mode reported by match-v5, never to a guess.
 */
const QUEUE_LABELS: Record<number, string> = {
  0: "Partita personalizzata",
  400: "Normale (Draft)",
  420: "Classificata Solo/Duo",
  430: "Normale (Blind)",
  440: "Classificata Flex",
  450: "ARAM",
  490: "Normale (Quickplay)",
  700: "Clash",
  720: "ARAM Clash",
  1700: "Arena",
  1710: "Arena",
};

const MODE_LABELS: Record<string, string> = {
  CLASSIC: "Classica",
  ARAM: "ARAM",
  CHERRY: "Arena",
  URF: "URF",
  ONEFORALL: "Uno per tutti",
};

export type QueueGroup = "solo" | "flex" | "normal" | "aram" | "other";

export function queueLabel(queueId: number, gameMode: string | null): string {
  return (
    QUEUE_LABELS[queueId] ??
    (gameMode ? MODE_LABELS[gameMode] ?? gameMode : null) ??
    `Coda ${queueId}`
  );
}

export function queueGroup(queueId: number): QueueGroup {
  if (queueId === 420) return "solo";
  if (queueId === 440) return "flex";
  if (queueId === 400 || queueId === 430 || queueId === 490) return "normal";
  if (queueId === 450 || queueId === 720) return "aram";
  return "other";
}

export const RANKED_QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: "Classificata Solo/Duo",
  RANKED_FLEX_SR: "Classificata Flex",
};
