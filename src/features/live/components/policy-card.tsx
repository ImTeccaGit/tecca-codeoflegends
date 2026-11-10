import { Ban, CheckCircle2 } from "lucide-react";

const ALLOWED = [
  "Rilevare se una partita è in corso (stato connessione, caricamento, errore).",
  "Mostrare modalità, mappa e tempo di gioco.",
  "Mostrare i tuoi dati già visibili nel client: campione, livello, K/D/A, CS, CS/min, punteggio visione.",
  "Overlay opzionale in una finestra separata, trasparente e click-through.",
  "Pannello partita (approvato da te): rank, livello e partite classificate recenti degli altri giocatori dalla Riot API ufficiale, partendo dai Riot ID già visibili nella tabella punteggi; nomi nascosti e bot esclusi.",
  "Build del tuo campione (rune, oggetti, ordine abilità) calcolata dalle statistiche dell'app: informativa, nessuna scelta fatta al posto tuo.",
];

/** Excluded features and the policy reason (see docs/LIVE_GAME.md). */
const EXCLUDED: { feature: string; reason: string }[] = [
  {
    feature: "Timer di respawn di draghi, Baron, Araldo o campi della giungla",
    reason:
      "informazioni di sessione che il giocatore dovrebbe ricordare da sé; vietate dalle policy di gioco Riot.",
  },
  {
    feature: "Cooldown di ultimate, flash o incantesimi nemici",
    reason: "esplicitamente vietato (“tracking enemy ultimate cooldowns”).",
  },
  {
    feature: "Oggetti, rune, punteggi o timer degli altri giocatori nella partita in corso",
    reason: "dati di sessione: vengono scartati nel backend e non arrivano mai all'interfaccia.",
  },
  {
    feature: "Giocatori con nome nascosto (modalità anonima)",
    reason: "vietato de-anonimizzarli: non vengono mai cercati.",
  },
  {
    feature: "Suggerimenti dinamici (rotazioni, obiettivi, acquisti o abilità automatici)",
    reason: "le app non possono dettare o automatizzare le decisioni del giocatore.",
  },
  {
    feature: "Classifiche o MMR calcolati dall'app",
    reason: "vietati: si mostra solo il rank ufficiale Riot.",
  },
  {
    feature: "Notifiche o avvisi temporizzati durante la partita",
    reason: "sarebbero promemoria di gioco con vantaggio competitivo.",
  },
  {
    feature: "Lettura memoria, injection, modifica file, input automatico",
    reason: "vietati dai Termini di servizio e dalle regole del progetto.",
  },
  {
    feature: "Azioni sul client (LCU): auto-accept, lobby, champion select",
    reason:
      "sarebbero automazione. L'API del client è usata solo in lettura per il tuo account, fuori dalla partita (Impostazioni).",
  },
  {
    feature: "Win rate di Augment o oggetti Arena",
    reason: "esplicitamente vietati dalle policy.",
  },
];

export function PolicyCard() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-foreground">Cosa fa</p>
        <ul className="space-y-2">
          {ALLOWED.map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-foreground">
          Cosa non fa e perché
        </p>
        <ul className="space-y-2">
          {EXCLUDED.map(({ feature, reason }) => (
            <li key={feature} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <Ban className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <span>
                <span className="font-medium text-foreground/90">{feature}</span>
                {": "}
                {reason}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
