# Roadmap — Tecca CodeOfLegends

La roadmap distingue esplicitamente ciò che è **verificato** da ciò che è
**pianificato**. Nessuna fase può essere marcata completa senza compilazione,
esecuzione e verifica del comportamento.

Legenda stato:

- **Completato** — implementato, eseguito e verificato.
- **In corso** — parzialmente implementato, non ancora verificato end-to-end.
- **Pianificato** — non implementato; al massimo esiste uno scaffold UI onesto.

---

## Fase 1 — Fondamenta · Completato

### Obiettivo

Avere una base desktop solida, sicura e trasparente su cui costruire i moduli.

### Consegne

- [x] Scaffold Tauri 2 + React + TypeScript strict + Vite + Tailwind 4.
- [x] Design system scuro con palette ufficiale e token centralizzati.
- [x] Shell desktop: sidebar permanente, top bar, drawer mobile.
- [x] Command palette `Ctrl+K` con ricerca e navigazione da tastiera.
- [x] Skip link, focus visibile, ruoli ARIA, rispetto di
      `prefers-reduced-motion`.
- [x] Registry moduli unico con stato e fase.
- [x] Dashboard con dati reali: stato DB, schema, dimensione, conteggi,
      impostazioni, activity log.
- [x] Settings con persistenza reale su SQLite (regione, riduzione animazioni).
- [x] Diagnostica: percorso DB copiabile, runtime, record locali.
- [x] Rust: `AppError`, comandi tipizzati, validazione input.
- [x] SQLite: schema v2, migrazioni append-only, WAL, foreign key, `STRICT`.
- [x] Activity log locale con potatura a 200 record.
- [x] Stati loading, empty, error, success espliciti.
- [x] Anteprima browser consapevole dell'assenza del backend.
- [x] Icone applicazione generate e bundle Tauri configurato.
- [x] Documentazione: `AGENTS.md`, `README.md`, architettura, roadmap.

### Correzioni post-revisione (Fase 1)

- [x] Animazioni di Dialog e Tooltip ripristinate (`tw-animate-css`).
- [x] Capability opener limitata ai domini in allowlist.
- [x] Log tecnici locali ruotati (`tauri-plugin-log`), percorso in Impostazioni.
- [x] Messaggi di errore per l'utente senza dettagli tecnici.
- [x] App avviabile anche con database non apribile (errore esplicito).
- [x] Colori di ombre e bagliori spostati in token di `index.css`.
- [x] Testi fuorvianti corretti, un solo `<h1>` per pagina.
- [x] Form Impostazioni senza `useEffect` di sincronizzazione.

### Dashboard competitiva (Fase 1)

- [x] Card Win Rate, KDA, Rank, LP, Partite e stato Riot API.
- [x] Grafico performance (Recharts, caricato in lazy), ultime partite,
      campioni recenti, medie personali, ultima patch.
- [x] Modalità DEMO: dataset dimostrativo etichettato, solo di sessione, mai
      salvato. Senza DEMO i pannelli mostrano stati vuoti espliciti.
- [x] Contratti Zod in `src/types/dashboard.ts` e calcoli puri in
      `src/lib/match-stats.ts`, pronti per i dati Riot reali.
- [x] Lint frontend con oxlint, test con Vitest e `cargo test`.

### Criteri di uscita verificati

- `npm run typecheck` senza errori.
- `npm run build` senza errori.
- `cargo check` senza errori.
- `cargo clippy -D warnings` senza warning.
- `cargo fmt --check` pulito.
- Avvio dell'app desktop con creazione database e persistenza impostazioni.

### Fuori scope in questa fase

- Qualsiasi chiamata Riot.
- Qualsiasi lettura del client di gioco.
- Overlay.
- Dati campioni, partite, build o rune.

---

## Fase 2 — Champions Database · Completato

- [x] Client backend Data Dragon con timeout e retry controllati.
- [x] Catalogo SQLite versionato per patch, con fonte, URL e timestamp di import.
- [x] Import di campioni, abilità (passiva + Q/W/E/R), skin, oggetti e rune.
- [x] Controllo automatico ogni 6 ore + controllo manuale; registro dei controlli.
- [x] Dati storici immutabili (trigger) e verifica di integrità prima del commit.
- [x] Endpoint elenco e dettaglio campione.
- [x] UI elenco: ricerca, filtro per classe Data Dragon, ordinamento, stato fonte.
- [x] UI dettaglio: storia, abilità, statistiche, valutazioni, skin, patch.
- [x] Test con fixture fittizie + test live su Data Dragon reale (patch 16.22.1:
      173 campioni, 865 abilità, 9.268 voci skin, 863 oggetti, 62 rune,
      2.141 immagini verificate).
- [x] Preferiti persistiti (stella su card e scheda, filtro "Preferiti").
- [x] Filtro per corsia con icone originali, su corsie assegnate dall'utente
      (Data Dragon non pubblica le corsie).
- [ ] Corsie proposte automaticamente dalle partite reali (richiede Fase 5).
- [ ] Cache locale delle immagini per l'uso completamente offline.

**Criterio di uscita:** i dati mostrati provengono da Data Dragon e riportano
fonte, versione e timestamp.

---

## Fase 3 — Rune & Build Builder · Pianificato

**Prerequisiti:** catalogo campioni reale e fonti statiche Riot.

- [ ] Modello dati per alberi runici, frammenti e vincoli di combinazione.
- [ ] CRUD pagine runiche su SQLite.
- [ ] Editor accessibile con validazione delle combinazioni.
- [ ] Catalogo item reale con patch dichiarata.
- [ ] Build con item core, situazionali, ordine abilità e note.
- [ ] Duplicazione, rinomina, eliminazione con conferma.
- [ ] Export/import locale in formato versionato.

**Criterio di uscita:** creare, modificare, riavviare l'app e ritrovare i dati
identici; nessun suggerimento presentato come statistica.

---

## Fase 4 — Jungle & Farming · Completato

- [x] Mappa schematica originale: Blue/Red Side, 12 campi, Scuttle, fosse epiche.
- [x] Percorsi modello per lato (Full Clear ×2, 5 Camp, 3 Camp, Invasione
      simulata), dichiarati come sola sequenza, senza tempi ufficiali.
- [x] Percorsi personalizzati in SQLite (creazione dalla mappa o da un
      modello, riordino, note, eliminazione con conferma).
- [x] Cronometro di allenamento con tempo per campo, pausa e annulla.
- [x] Storico, record personale, media, miglioramento, grafico, confronto.
- [x] Schede dei campioni jungle (corsie assegnate dall'utente).
- [x] Mostri e obiettivi senza tempi di spawn inventati; nessuna funzione live.
- [ ] Note di matchup jungle e scenari di allenamento guidati.

**Criterio di uscita rispettato:** nessun percorso o tempo è presentato come
dato ufficiale; i tempi sono solo quelli registrati dall'utente.

---

## Fase 5 — Player Profiles & Match History · Implementato, verifica live in sospeso

- [x] Chiave solo lato Rust: `RIOT_API_KEY` o Gestione credenziali di Windows.
- [x] Client Riot con routing regionale, rate limiting, retry su 429/5xx, cache.
- [x] Ricerca account per Riot ID e regione (incluse SEA: sg2, tw2, vn2).
- [x] Profilo con rank Solo/Flex, statistiche, campioni e orari di aggiornamento.
- [x] Sincronizzazione partite con deduplica per `match_id`.
- [x] Cronologia con oggetti, rune e filtri per coda.
- [x] Stati: chiave mancante, account inesistente, rate limit, errore con dati
      precedenti conservati.
- [x] Dashboard alimentata dal profilo principale (DEMO mai mescolato).
- [x] 21 test Rust con risposte simulate.
- [ ] Verifica end-to-end con una chiave reale nell'app desktop.
- [ ] Dettaglio partita con tutti i partecipanti (dati già salvati).

**Criterio di uscita:** ogni dato remoto mostra fonte e ora di recupero; nessun
profilo o partita è inventato.

---

## Statistiche globali dei campioni · Implementate, verifica live in sospeso

- [x] Raccolta opt-in con la chiave dell'utente: league-v4 → match-v5 (Solo/Duo).
- [x] Rune più usate (pagina completa con frammenti), rune chiave, incantesimi,
      stivali e oggetti completi per campione, patch e ruolo.
- [x] Popolarità, vittorie, ban e avversari di corsia con numerosità dichiarata.
- [x] Pagina campione con ruoli, filtro patch e pannelli in stile scheda.
- [x] Ordine delle abilità, oggetti iniziali e build centrale (timeline match-v5).
- [x] Corsie reali dei campioni (lista e scheda) al posto di quelle scelte dall'utente.
- [x] Statistiche dalle partite personali quando mancano quelle raccolte (etichettate).
- [ ] Verifica con una chiave reale e un volume di partite significativo.

---

## Fase 6 — Match Analysis & Matchups · Implementata

Dettagli e limiti: [MATCH_ANALYSIS.md](MATCH_ANALYSIS.md).

- [x] Metriche post-partita documentate e testate (KDA, CS/min, oro/min, KP, danni, visione).
- [x] Grafici Recharts solo su serie reali e verificabili.
- [x] Statistiche con fonte, patch, numerosità, periodo e IC 95% dichiarati.
- [x] Matchup, counter, sinergie, rune e oggetti calcolati dalle partite dell'utente.
- [x] Analisi rigenerabile offline dai dati in cache.
- [ ] Timeline partita (match-v5 timeline): ordine di acquisto, oro nel tempo.
- [ ] Note di matchup personali (tabella `matchup_notes` già presente).
- [ ] Filtro per fascia classificata: non possibile con match-v5 (rank storico assente).
- [ ] Verifica con partite reali (richiede la chiave Riot dell'utente).

**Criterio di uscita:** nessun grafico o win rate dimostrativo viene mostrato
come dato della partita dell'utente.

---

## Fase 7 — Live Game & Overlay · Implementata

Policy Riot verificate: vedi [LIVE_GAME.md](LIVE_GAME.md).

- [x] Rilevamento partita tramite Live Client Data API locale in sola lettura.
- [x] Nessun hook, injection, pattern scanning o memory reading.
- [x] Finestra overlay Tauri separata, trasparente e non interattiva sul gioco.
- [x] Kill switch immediato e consenso esplicito (disattivato di default).
- [x] Solo i dati del giocatore locale; i dati degli altri scartati nel backend.
- [ ] ~~Suggerimenti contestuali in partita~~: esclusi, le policy vietano app
      che dettano le decisioni del giocatore.
- [x] Nessuna automazione di gameplay o manipolazione input.
- [ ] Verifica con una partita reale (dipende dall'utente).

**Criterio di uscita:** l'app non modifica, automatizza o ispeziona la memoria
del gioco in alcun modo.

---

## Fase 8 — Rifinitura e distribuzione · Release 0.10.0 (beta)

- [x] Test automatici frontend (Vitest) e backend (cargo test), con guardie
      di release (versione unica, CSP, permessi).
- [x] Code splitting dei grafici (Recharts lazy).
- [x] Percorso di aggiornamento sicuro: backup verificato prima di ogni
      migrazione, rifiuto dei database più recenti, `allowDowngrades: false`.
- [x] Backup manuali del database da Impostazioni.
- [x] Installer NSIS per utente (italiano e inglese).
- [ ] Firma Authenticode dell'installer (serve un certificato).
- [x] Log locali ruotati e diagnosticabili.
- [x] Documentazione utente: installazione, avvio, aggiornamento, API, build
      (README, [DATABASE.md](DATABASE.md), [RIOT_COMPLIANCE.md](RIOT_COMPLIANCE.md)).
- [ ] Aggiornamento in-app firmato (`tauri-plugin-updater`), solo con firma e
      conferma dell'utente: architettura in ARCHITECTURE.md § 9.
- [ ] Registrazione del prodotto sul Riot Developer Portal prima della
      distribuzione pubblica.
- [ ] File `LICENSE` (scelta del titolare).

---

## Non-obiettivi permanenti

Questi punti non entreranno mai nel prodotto, indipendentemente dalla fase:

- automazione di gameplay, clickbot, script di abilità, auto-accept;
- memory reading, DLL injection, hook, pattern scanning;
- modifica dei file di gioco o del client;
- API key Riot nel frontend, nel repository o nei log;
- telemetria remota non dichiarata;
- dati inventati presentati come reali.
