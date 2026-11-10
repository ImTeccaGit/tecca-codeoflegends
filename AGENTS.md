# Tecca CodeOfLegends — Permanent Agent Rules

Questo file contiene le regole permanenti del progetto. Ogni modifica futura
deve rispettarle. In caso di conflitto con richieste temporanee, chiedere
conferma esplicita all'utente prima di violarle.

## 1. Identità del progetto

- Nome: **Tecca CodeOfLegends**.
- Tipo: applicazione desktop Windows per League of Legends (companion, non
  automazione di gioco).
- Stack: Tauri 2, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Rust,
  SQLite, TanStack Query, Zustand, Recharts, Zod.
- Versione: **0.10.0 (beta)**, nome prodotto `TECCA CODEOFLEGENDS`.
- Stato attuale: **Fase 8 — Release Windows** (Fasi 1–7 completate tranne Rune
  e Build Builder). Dashboard, Settings, Champions (Riot Data Dragon), Jungle &
  Farming, Player Profiles, Match History, Match Analysis, Matchups e Live
  Game & Overlay sono operativi; Rune Builder e Build Builder sono scaffold UI
  dichiarati come pianificati.
- La UI è in italiano. Identificatori di codice, comandi, tipi e API sono in
  inglese. La documentazione è in italiano.

## 2. Regole non negoziabili su dati e trasparenza

1. **Nessun dato inventato presentato come reale.**
   - Non creare statistiche, win rate, rank, partite, campioni o profili finti.
   - I dati dimostrativi, se necessari, devono essere etichettati in modo
     esplicito come `DEMO` / `Dati dimostrativi` e non devono essere persistiti
     come se fossero sincronizzati.
   - Gli stati vuoti e i moduli non implementati devono dirlo chiaramente.
2. **Nessuna funzionalità dichiarata completa senza verifica.**
   - Una funzione è "completata" solo se compila, è stata eseguita e il
     comportamento è stato verificato.
   - Distinguere sempre: scaffold UI ≠ funzione implementata.
3. **Tracciabilità delle fonti.**
   - Ogni dato esterno deve avere fonte, versione/patch e timestamp di recupero.
   - Le cache devono essere identificabili e invalidabili.
4. **Errori trasparenti.**
   - Non nascondere errori con fallback silenziosi che simulano successo.
   - Mostrare messaggi utente comprensibili e conservare il dettaglio tecnico
     nei log.

## 3. Conformità Riot Games

Queste regole sono vincoli di prodotto, non semplici preferenze:

- **Nessuna API key Riot nel frontend, nel repository, nei file di build o nei
  log.** Le chiavi future dovranno essere gestite dal backend Rust tramite OS
  credential store; mai in `localStorage`, mai in variabili `VITE_*`.
- **Nessun accesso diretto alla memoria del processo di gioco.** Vietati hook,
  DLL injection, pattern scanning, debugger e memory reading.
- **Nessuna modifica ai file del gioco o del client.** Nessuna patch, nessun
  overlay che inietta input.
- **Nessuna automazione di gameplay.** Niente clickbot, script di abilità,
  auto-accept o manipolazione dell'input.
- **Solo API pubbliche/documentate e dati consentiti** (es. Data Dragon, Riot
  API con chiave approvata, Live Client Data API dove previsto).
- **API del client League (LCU)**: approvata esplicitamente dall'utente
  (10/11/2026) **solo** per leggere il proprio account, rank e cronologia
  partite (modulo `src-tauri/src/client/`). Vincoli:
  - sola lettura (GET) su 127.0.0.1;
  - il `lockfile` si legge e non si scrive mai;
  - la password di sessione non va mai nei log, nel database o nel frontend;
  - nessuna POST/PUT/DELETE: niente auto-accept, lobby, champion select o
    azioni sul client;
  - va sempre dichiarata come "non ufficialmente supportata" e resta
    disattivabile in Impostazioni.
  Ogni altro uso dell'LCU richiede una nuova approvazione.
- Rispettare rate limit, Terms of Service e policy Riot applicabili. Per
  funzionalità competititive/live, verificare le policy prima di implementare.
- L'overlay, se realizzato, deve essere una finestra Tauri separata, trasparente,
  non interattiva sul gioco e senza injection.

## 4. Architettura e confini

Separazione obbligatoria:

```
UI React  →  servizi TypeScript  →  invoke Tauri  →  comandi Rust  →  SQLite / API esterne
```

- La UI **non** chiama `invoke` direttamente: passa sempre da `src/services/*`.
- I servizi validano input/output con Zod ai confini.
- Il frontend **non** accede mai al database né alle API Riot direttamente.
- Rust è l'unico punto di accesso a SQLite, filesystem e future API esterne.
- TanStack Query gestisce lo stato server/remoto. Zustand gestisce solo stato UI
  effimero. Non duplicare stato server in Zustand.
- Le feature vivono in `src/features/<feature>/`; i componenti riutilizzabili in
  `src/components/`; la logica condivisa in `src/lib/`.

## 5. TypeScript

- `strict: true` sempre attivo; non introdurre `any`.
- Preferire tipi derivati da Zod (`z.infer`) per i contratti backend.
- Usare `unknown` per input esterni e restringerlo.
- Nessun `@ts-ignore` senza motivazione documentata e approvazione.
- Import con alias `@/`.
- Gestire esplicitamente loading, empty, error e success.
- Evitare `useEffect` per stato derivabile; usare Query o calcoli puri.

## 6. React e design system

- Componenti funzione, hook, composizione. Niente class component, tranne
  l'ErrorBoundary.
- UI in stile shadcn/ui: primitive Radix + CVA + `cn()`.
- Usare i token del design system; non introdurre colori hardcoded fuori da
  `src/index.css`.
- Palette ufficiale:
  - Background `#10121C`
  - Surface `#191B29`
  - Primary `#8B6CFF`
  - Secondary `#42D6D0`
- Dark mode è il tema principale e unico supportato in Fase 1.
- Sidebar permanente su desktop, drawer su mobile.
- Animazioni brevi e rispettose di `prefers-reduced-motion` e della preferenza
  "Riduci le animazioni".
- Accessibilità: focus visibile, label, ruoli ARIA, contrasto, navigazione da
  tastiera, skip link.

## 7. Rust e database

- Errori applicativi centralizzati in `AppError`, serializzati come
  `{ code, message }`.
- I comandi Tauri non devono contenere logica di business complessa: delegano a
  moduli (`db`, futuri `riot`, `analysis`).
- SQLite: migrazioni **append-only** in `src-tauri/migrations/`.
  - Mai modificare una migrazione già applicata.
  - Ogni nuova modifica = nuovo file + nuova voce in `MIGRATIONS`.
  - Usare transazioni e `PRAGMA foreign_keys = ON`.
- Non usare SQL dinamico con input utente.
- Le tabelle sono `STRICT`; mantenere tipi espliciti.
- I timestamp sono ISO 8601 UTC generati da SQLite.
- Log attività locale consentito solo per eventi reali dell'app; niente
  telemetria remota in Fase 1.

## 8. Sicurezza

- CSP restrittiva in `tauri.conf.json`.
- Capabilities Tauri minime, per finestra.
- Nessun `dangerousDisableAssetCspModification`, nessun permesso shell generico.
- Link esterni solo tramite allowlist in `external-service.ts`.
- Validare ogni input lato Rust, anche se già validato lato UI.
- Non loggare segreti, token o chiavi.
- `.env` e credenziali sempre in `.gitignore`.

## 9. Qualità e verifica

Prima di dichiarare un task concluso:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

- Avviare l'app (`npm run desktop:dev`) o il dev server e verificare la rotta
  modificata.
- Riportare comandi eseguiti, esito e problemi reali incontrati.
- Non "aggiustare" un test o un check disabilitandolo senza discuterne.

## 10. Struttura di riferimento

```
src/
  app/            router, providers, registry moduli
  components/     UI, layout, feedback, shared
  features/       dashboard, champions, runes, builds, jungle, players,
                  matches, analysis, matchups, live, settings, system
  hooks/          hook TanStack Query condivisi
  lib/            utils, errori, gateway Tauri, query client
  services/       unico punto di accesso a invoke / API esterne
  stores/         Zustand (solo UI)
  types/          contratti Zod e tipi
src-tauri/
  src/            main, lib, commands, db, models, error
  migrations/     SQL append-only
  capabilities/   permessi Tauri
docs/             ARCHITECTURE.md, ROADMAP.md
```

## 11. Comandi utili

```powershell
npm run dev              # Vite nel browser
npm run desktop:dev      # app Tauri completa
npm run build            # typecheck + build frontend
npm run typecheck        # solo TypeScript
npm run lint             # oxlint (TypeScript 7 non è supportato da typescript-eslint)
npm test                 # Vitest
npm run test:rust        # cargo test
npm run check:rust       # cargo check
npm run lint:rust        # cargo clippy -D warnings
npm run fmt:rust         # cargo fmt
npm run desktop:build    # bundle Windows (NSIS)
```

## 12. Release

- La versione va aggiornata **insieme** in `package.json`,
  `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` (test
  `release_tests`).
- Non cambiare `identifier` (`com.tecca.codeoflegends`): decide la cartella
  dati, quindi cambiarlo farebbe "perdere" i dati agli utenti.
- Nessun aggiornamento automatico senza firma, endpoint HTTPS controllato e
  conferma dell'utente (ARCHITECTURE.md § 9).
- Permessi: non usare `core:default`; aggiungere solo i permessi necessari,
  per finestra.
- Prima di ogni release: tutti i check del § 9, `npm run desktop:build`,
  installazione e avvio dell'installer generato.

## 13. Stato attuale verificato

- Frontend buildato con TypeScript strict.
- Backend compilato con `cargo check`.
- SQLite con schema v10, migrazioni, backup automatici pre-migrazione e
  manuali, rifiuto dei database creati da versioni più recenti, log attività.
- Settings persistite realmente (regione, riduzione animazioni).
- Champions implementato su Riot Data Dragon (catalogo versionato per patch,
  import automatico e manuale, verifica di integrità, test live documentato),
  con preferiti e filtro per corsie assegnate dall'utente.
- Jungle & Farming implementato come strumento di solo allenamento (mappa
  schematica originale, percorsi, cronometro, storico): nessuna funzione live.
- Riot API (account-v1, summoner-v4, league-v4, match-v5) implementata nel
  backend Rust con chiave in `RIOT_API_KEY` o nella Gestione credenziali di
  Windows; Player Profiles e Match History la usano. Verificata con risposte
  simulate; la verifica con una chiave reale è in sospeso.
- Live Game & Overlay implementati entro i limiti di `docs/LIVE_GAME.md`:
  opt-in, Live Client Data API locale in sola lettura, solo dati del giocatore
  locale, overlay in finestra separata click-through. Pannello partita
  approvato dall'utente (10/11/2026): rank ufficiale, livello e classificate
  recenti degli altri giocatori via Riot API (mai nomi nascosti o bot) e
  build informativa del proprio campione, in finestra separata click-through
  aperta da sola a inizio partita, tasto rapido `Home`. **Non** aggiungere timer, cooldown,
  oggetti/punteggi altrui della partita in corso, MMR propri, suggerimenti
  dinamici, LCU in partita o notifiche senza una nuova verifica delle policy. Verificato senza partita in
  corso e con test simulati; la verifica con una partita reale è in sospeso.
- Match Analysis e Matchups implementati sulle partite match-v5 salvate
  (vedi `docs/MATCH_ANALYSIS.md`): nessuna statistica globale, nessun filtro
  per fascia classificata (dato storico non disponibile). Verificati con test
  e dati simulati; la verifica con partite reali è in sospeso.
- Account automatico dal client League (LCU, sola lettura, senza chiave),
  attivo di default e disattivabile; fallback con il Riot ID visto dalla Live
  Client Data API durante la partita. Verificato con un client reale:
  account, rank e 20 partite letti e salvati.
- Statistiche dei campioni (`src-tauri/src/meta/`, schema v9–v10):
  raccolta opt-in, disattivata di default, con la chiave Riot dell'utente
  (league-v4 → match-v5 Solo/Duo, una richiesta ogni 2,5 s). La pagina
  campione mostra rune più usate, oggetti, incantesimi, ruoli, ban e counter
  calcolati solo da quelle partite, sempre con numerosità; ordine abilità e
  build dalla timeline match-v5. Se le partite raccolte non contengono il
  campione si usano le partite personali, etichettate come tali. Le corsie
  dei campioni sono quelle giocate davvero, non scelte dall'utente. Niente
  scraping o siti terzi. Verificata con test simulati; la verifica con una chiave reale è
  in sospeso.
- Rune Builder e Build Builder **non** sono
  implementati. Devono restare dichiarati come pianificati finché non lo
  saranno davvero.
