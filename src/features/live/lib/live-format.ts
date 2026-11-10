import type { StatusTone } from "@/components/shared/status-dot";
import type { LiveStatus } from "@/types/live";

export const STATUS_LABELS: Record<LiveStatus, string> = {
  disabled: "Disattivato",
  not_running: "Nessuna partita",
  loading: "Caricamento partita",
  in_game: "In partita",
  error: "Errore",
};

export const STATUS_TONES: Record<LiveStatus, StatusTone> = {
  disabled: "muted",
  not_running: "warning",
  loading: "secondary",
  in_game: "success",
  error: "danger",
};

/** 754.3 → "12:34"; hours shown only when needed. */
export function formatGameTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const tail = `${mm}:${String(secs).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${tail}` : tail;
}

export function formatKda(kills: number, deaths: number, assists: number): string {
  return `${kills} / ${deaths} / ${assists}`;
}

const MODE_LABELS: Record<string, string> = {
  CLASSIC: "Classica",
  ARAM: "ARAM",
  PRACTICETOOL: "Strumento di allenamento",
  TUTORIAL: "Tutorial",
  URF: "URF",
  CHERRY: "Arena",
};

export function formatGameMode(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

const MAP_LABELS: Record<number, string> = {
  11: "Landa degli evocatori",
  12: "Abisso ululante",
  30: "Arena",
};

export function formatMap(mapNumber: number, mapName: string): string {
  return MAP_LABELS[mapNumber] ?? mapName;
}

const POSITION_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};

export function formatPosition(position: string | null): string | null {
  if (!position) {
    return null;
  }
  return POSITION_LABELS[position] ?? position;
}

export function formatUpdatedAt(updatedAtMs: number): string {
  if (updatedAtMs <= 0) {
    return "mai";
  }
  return new Date(updatedAtMs).toLocaleTimeString("it-IT");
}
