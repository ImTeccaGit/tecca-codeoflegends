# Architettura — Tecca CodeOfLegends

Documento di riferimento per la struttura tecnica della Fase 1. Descrive solo
ciò che esiste e funziona, più i punti di estensione previsti.

---

## 1. Principi

1. **Separazione rigida dei livelli.** La UI non parla mai direttamente con
   SQLite o con API esterne.
2. **Validazione ai confini.** Ogni dato che attraversa il bridge Tauri viene
   validato con Zod; ogni input esterno viene validato di nuovo in Rust.
3. **Un solo punto di accesso.** I servizi TypeScript sono l'unico ingresso a
   `invoke`; Rust è l'unico punto di accesso a filesystem e database.
4. **Trasparenza.** Nessun fallback silenzioso che simuli successo. Se il
   backend non c'è, la UI lo dice.
5. **Migrazioni append-only.** Lo schema evolve aggiungendo file, mai
   modificando quelli già applicati.

---

## 2. Flusso dei dati

```
┌─────────────────────────────────────────────────────────────┐
│ React (feature)                                             │
│  └─ hook TanStack Query (src/hooks)                         │
│      └─ servizio TypeScript (src/services)                  │
│          └─ invokeCommand + schema Zod (src/lib/tauri.ts)   │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tauri IPC
┌───────────────────────────▼─────────────────────────────────┐
│ Rust                                                        │
│  commands.rs  → validazione e orchestrazione                │
│  db.rs        → SQLite, migrazioni, activity log            │
│  models.rs    → contratti serializzati (camelCase)          │
│  error.rs     → AppError { code, message }                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ rusqlite
┌───────────────────────────▼─────────────────────────────────┐
│ SQLite locale (WAL, foreign_keys ON, tabelle STRICT)        │
└─────────────────────────────────────────────────────────────┘
```

Regole pratiche:

- Nessun componente importa `@tauri-apps/api/core` direttamente; solo
  `src/lib/tauri.ts` lo fa.
- Nessun componente importa `rusqlite` o SQL.
- TanStack Query possiede lo stato server; Zustand possiede solo stato UI
  effimero (command palette, drawer mobile).

---

## 3. Frontend

### 3.1 Registry dei moduli

`src/app/navigation.ts` è la fonte unica per:

- elenco moduli, etichette e descrizioni;
- gruppo di navigazione;
- fase e stato (`available`, `in-development`, `planned`);
- icona e percorso.

Sidebar, drawer mobile, command palette, dashboard e pagine di scaffold leggono
lo stesso registry. Aggiungere un modulo significa aggiungere una voce qui e una
rotta nel router.

### 3.2 Routing

`src/app/router.tsx` usa `createHashRouter`, scelta deliberata per evitare
problemi di deep-link nel webview Tauri. Le rotte principali:

| Percorso | Pagina | Stato |
| --- | --- | --- |
| `/` | Dashboard | Reale |
| `/settings` | Settings | Reale |
| `/champions` | Champions | Scaffold |
| `/champions/:championId` | Dettaglio campione | Scaffold parametrico |
| `/runes` | Rune Builder | Scaffold |
| `/builds` | Build Builder | Scaffold |
| `/jungle` | Jungle Routes | Scaffold |
| `/players` | Player Profiles | Scaffold |
| `/matches` | Match History | Scaffold |
| `/analysis` | Match Analysis | Reale (dati match-v5 locali) |
| `/matchups` | Matchups | Reale (dati match-v5 locali) |
| `/live` | Live Game & Overlay | Reale (finestra `overlay` separata) |
| `*` | 404 | Reale |

### 3.3 Shell e accessibilità

- Sidebar permanente su desktop (`lg`), drawer Radix su mobile.
- Skip link verso `#main-content`.
- Focus visibile globale, ruoli ARIA nelle primitive, navigazione da tastiera.
- Command palette con `Ctrl+K`, frecce, `Enter` ed `Esc`.
- Animazioni brevi, disattivate da `prefers-reduced-motion` e dalla preferenza
  utente (`html[data-reduce-motion="true"]`).

### 3.4 Design system

Token definiti una sola volta in `src/index.css` e mappati su Tailwind con
`@theme inline`:

| Token | Valore |
| --- | --- |
| Background | `#10121C` |
| Surface / Card | `#191B29` |
| Primary | `#8B6CFF` |
| Secondary | `#42D6D0` |
| Foreground | `#F3F4FA` |
| Muted foreground | `#969AAF` |

Ombre e bagliori sono token anch'essi (`--shadow-card`,
`--shadow-button-primary`, `--shadow-nav-indicator`, `--shadow-module-hover`,
`--shadow-hero`, `--drop-shadow-rift-path`, `--drop-shadow-rift-camp`) e
generano le utility `shadow-*` / `drop-shadow-*`. Sfondi decorativi riusabili
vivono come utility in `index.css` (`app-backdrop`, `surface-grid`,
`hero-secondary-glow`, `chart-grid`, `panel-sheen`). Nessun colore (hex o
`rgba`) è scritto nei componenti.

Le animazioni di ingresso/uscita di Dialog e Tooltip (`animate-in`,
`fade-in-0`, `zoom-in-95`, …) provengono da `tw-animate-css`, importato in
`index.css`. Sono soggette alle stesse regole di riduzione del movimento.

### 3.5 Gestione errori

- `AppError` (`src/lib/errors.ts`) normalizza errori backend, di rete e
  sconosciuti in `{ code, message }`.
- `src/lib/query-client.ts` registra `QueryCache` e `MutationCache` per mostrare
  toast globali sugli errori e registrarli nei log locali.
- `ErrorBoundary` intercetta gli errori di rendering e li scrive nei log
  tramite `src/services/log-service.ts`.
- Le feature mostrano stati espliciti di loading, empty, error e success.

### 3.6 Dati competitivi e Modalità DEMO

- Contratto: `src/types/dashboard.ts` (Zod). I dati Riot futuri dovranno
  rispettare gli stessi schemi.
- Calcoli: `src/lib/match-stats.ts`, funzioni pure. Ogni valore delle card
  (Win Rate, KDA, medie, campioni, grafico) è derivato dalle partite elencate,
  mai scritto a mano.
- Origine: `useDashboardData()` restituisce `null` finché non esiste una fonte
  reale, e i pannelli mostrano stati vuoti espliciti.
- **Modalità DEMO**: interruttore in dashboard (`demoMode` in Zustand, solo
  sessione, spento a ogni avvio). Il dataset `features/dashboard/demo/` ha
  `source: "demo"`, id `DEMO-xxx`, patch `DEMO`, e ogni pannello mostra
  `DemoBadge`. Non viene mai salvato né inviato al backend.
- Il grafico (Recharts) è caricato in lazy: chunk separato dal bundle
  principale. Una sola serie per volta, un solo asse.

### 3.7 Anteprima browser

`getSystemSnapshot()` restituisce uno snapshot marcato `runtime: "browser"`
quando `window.__TAURI_INTERNALS__` non è presente. Non è un mock di dati di
gioco: descrive l'assenza del backend e disabilita i salvataggi.

---

## 4. Backend Rust

### 4.1 Comandi Tauri

| Comando | Input | Output |
| --- | --- | --- |
| `get_system_snapshot` | — | `SystemSnapshot` |
| `update_settings` | `SettingsPatch` | `AppSettings` |
| `get_champion_catalog` | — | `ChampionCatalog` (patch corrente) |
| `get_champion_detail` | `key` (id Data Dragon, alfanumerico ≤ 64) | `ChampionDetail \| null` |
| `get_catalog_status` | — | `CatalogStatus` |
| `sync_data_dragon` | — | `SyncOutcome` (async) |
| `set_champion_favorite` | `championId`, `favorite` | `ChampionPreferences` |
| `set_champion_lanes` | `championId`, `lanes` (≤ 5, valori Riot) | `ChampionPreferences` |
| `list_jungle_routes` | — | `CustomRoute[]` |
| `save_jungle_route` | `RouteInput` (crea o aggiorna) | `CustomRoute` |
| `delete_jungle_route` | `id` | — |
| `list_clear_attempts` | — | `ClearAttempt[]` (ultimi 1000) |
| `save_clear_attempt` | `AttemptInput` | `ClearAttempt` |
| `delete_clear_attempt` | `id` | — |

| `get_match_analysis` | `puuid` | `AnalysisDataset \| null` (solo dati locali) |
| `get_client_account_status` | — | `ClientStatus` |
| `set_client_sync_enabled` | `enabled` | `ClientStatus` |
| `sync_from_client` | — | `ClientStatus` (async, lettura immediata) |
| `set_league_install_path` | `path \| null` (validato: contiene `LeagueClient.exe`) | `ClientStatus` |
| `get_live_snapshot` | — | `LiveSnapshot` |
| `set_live_enabled` | `enabled` | `LiveSnapshot` |
| `get_overlay_settings` | — | `OverlaySettings` |
| `update_overlay_settings` | `OverlayPatch` (async: crea/chiude la finestra) | `OverlaySettings` |

Evento verso la webview: `catalog-updated` (payload: versione) dopo ogni
import riuscito. `useCatalogUpdateListener` invalida le query `["catalog"]`.

I comandi delegano la logica a `Database`; non contengono query o regole di
business complesse.

### 4.2 Errori e log

`AppError` serializza sempre come:

```json
{ "code": "DATABASE_ERROR", "message": "Operazione sul database locale non riuscita. ..." }
```

- `message` è il testo per l'utente (`AppError::user_message`), senza dettagli
  tecnici. Fanno eccezione gli errori di validazione, già comprensibili.
- Il dettaglio tecnico (`Display`) viene scritto nei log da
  `AppError::logged()` al confine di ogni comando.

Codici esposti: `DATABASE_ERROR`, `VALIDATION_ERROR`, `BACKEND_UNAVAILABLE`.
Il frontend normalizza codici sconosciuti in `UNKNOWN_ERROR`.

**Log locali** (`tauri-plugin-log`): file ruotati (1 MB, 5 file conservati,
timestamp UTC) in `%LOCALAPPDATA%\com.tecca.codeoflegends\logs\`, più stdout in
sviluppo. Il percorso è esposto nello snapshot (`logDirectory`) e mostrato in
Impostazioni. Nessun invio remoto; non loggare mai segreti.

**Database non apribile:** l'app non termina. `DatabaseSlot::Unavailable`
viene gestito come stato Tauri, ogni comando restituisce `DATABASE_ERROR` con
un messaggio che indica la cartella dei log, e la UI mostra lo stato di errore.

### 4.3 Database

Apertura in `Database::open`:

- directory applicativa Tauri creata se assente;
- `journal_mode = WAL`;
- `foreign_keys = ON`;
- `busy_timeout = 5000`;
- migrazioni mancanti applicate in transazione;
- evento reale "Applicazione avviata" registrato;
- activity log limitato a 200 record.

### 4.4 Schema di base (v2, invariato)

| Tabella | Scopo | Note |
| --- | --- | --- |
| `settings` | Preferenze locali | Valori JSON serializzati, `updated_at` |
| `champions` | Cache campioni futura | `champion_key` univoco |
| `favorite_champions` | Preferiti | FK con `ON DELETE CASCADE` |
| `rune_pages` | Pagine runiche future | `shards_json` |
| `builds` | Build future | `items_json`, `skill_order_json` |
| `jungle_routes` | Route future | `steps_json`, `patch` |
| `players` | Profili futuri | chiave `puuid` |
| `matches` | Cronologia futura | `raw_json`, indici per player e data |
| `match_participants` | Partecipanti | chiave composta `(match_id, puuid)` |
| `matchup_notes` | Note personali | FK verso `champions` |
| `activity_log` | Eventi reali locali | indice su `created_at` |

Tutte le tabelle sono `STRICT`. I timestamp sono ISO 8601 UTC generati da
SQLite con `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`.

### 4.5 Catalogo Data Dragon (schema v3)

Moduli Rust:

```
ddragon/model.rs     forme JSON grezze (serde), campi richiesti obbligatori
ddragon/bundle.rs    conversione + validazione (prima di qualsiasi scrittura)
ddragon/client.rs    HTTP: timeout, 3 tentativi con backoff solo su errori transitori
ddragon/sync.rs      un sync alla volta, scheduler ogni 6 h, registro controlli
catalog/repository.rs  tutto l'SQL: import transazionale, verifica, query
catalog/dto.rs       contratti verso il frontend (Zod in src/types/catalog.ts)
```

| Tabella | Chiave | Note |
| --- | --- | --- |
| `patch_versions` | `version` | fonte, URL, lingua, conteggi, `imported_at` |
| `champions` (0001) | `id` = chiave numerica Riot | identità stabile, aggiornata solo dalla patch più recente |
| `champion_versions` | `(champion_id, patch_version)` | nome, titolo, storia, classi, risorsa, valutazioni, statistiche, immagine |
| `champion_spells` | `(champion_id, patch_version, slot)` | `P`, `Q`, `W`, `E`, `R`; FK composta verso `champion_versions` |
| `champion_skins` | `(patch_version, skin_id)` | `UNIQUE (patch_version, champion_id, num)` |
| `items` | `(patch_version, item_id)` | oro, acquistabile, in negozio, mappe, componenti |
| `rune_trees`, `runes` | `(patch_version, id)` | FK runa → albero della stessa patch |
| `data_dragon_checks` | `id` | esito di ogni controllo (ultimi 200) |

Flusso di import:

1. `versions.json` → versione release più recente (ordine numerico).
2. Se già presente: controllo registrato come `up_to_date`.
3. Download di `championFull.json`, `item.json`, `runesReforged.json` (`it_IT`).
4. Validazione: versione dei file, id numerici univoci, 4 abilità + passiva,
   skin base presente, nessun duplicato. Un errore annulla tutto.
5. Una transazione inserisce tutto, poi `verify_patch` controlla i conteggi
   rispetto alla fonte, 5 abilità per campione, skin base, nomi unici,
   `PRAGMA foreign_key_check` e `quick_check`. Un problema causa il rollback.
6. Commit, evento `catalog-updated` e voce nell'activity log.

Garanzie: trigger `BEFORE UPDATE/DELETE` rendono immutabili tutte le tabelle
versionate; reimportare una versione esistente è rifiutato; importare una patch
più vecchia non sovrascrive l'identità dei campioni.

Testo: le descrizioni Data Dragon contengono markup. Rust lo converte in testo
semplice (`html_to_text`) e la UI non usa mai `dangerouslySetInnerHTML`.

### 4.6 Preferenze sui campioni (schema v4)

- `favorite_champions` (0001) e `user_champion_lanes` (0004), entrambe legate a
  `champions.id`: sopravvivono a ogni nuova patch.
- Le corsie (`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`) sono **dati
  dell'utente**: Data Dragon non le pubblica e non vengono mai presentate come
  ufficiali. In futuro potranno essere proposte dalle partite reali (Riot API).
- SQL in `catalog/preferences.rs`; il catalogo arricchisce ogni campione con
  `favorite` e `lanes` in un solo passaggio (`PreferenceIndex`).
- Frontend: mutazioni ottimistiche su lista e dettaglio con rollback in caso
  di errore (`useToggleFavorite`, `useSetChampionLanes`).

### 4.7 Jungle & Farming (schema v5)

Solo dati di allenamento dell'utente: nessuna integrazione live.

- Rust `jungle/`: `CAMP_IDS` (14 campi, specchio di `src/types/jungle.ts`),
  validazione di ogni input (lato, campi noti e non ripetuti, nome ≤ 60, note ≤
  500, campione esistente, tempi crescenti, clear ≤ 30 minuti).
- Percorsi personalizzati in `jungle_routes` (0001): `steps_json` = campi.
- Tentativi in `jungle_clear_attempts` + `jungle_clear_splits` (0005): ogni
  split è il tempo cumulativo al completamento di un campo; il totale è
  l'ultimo split. Il tentativo conserva nome, lato e campi del percorso.
- Frontend `features/jungle/`: dati schematici della mappa (`data/camps.ts`),
  percorsi modello (`data/routes.ts`), cronometro come reducer puro
  (`lib/training-timer.ts`, testato con orologio simulato) e statistiche
  (`lib/attempt-stats.ts`). Lo stato del cronometro vive nella pagina, così la
  mappa mostra i progressi e il cambio percorso è bloccato durante un clear.

### 4.8 Riot API e dati giocatore (schema v6)

Modulo Rust `riot/`, un servizio per responsabilità:

```
routing.rs     piattaforme (euw1…) → cluster (americas/europe/asia/sea)
rate_limit.rs  finestre 18/1 s e 95/120 s per routing value + blocco Retry-After
secrets.rs     KeyProvider: RIOT_API_KEY, poi Gestione credenziali di Windows
transport.rs   HTTP dietro una trait (simulato nei test)
client.rs      header X-Riot-Token, retry 429/5xx limitati, mappatura errori
account.rs / summoner.rs / league.rs / matches.rs   un modulo per API Riot
repository.rs  SQLite: players, player_ranked, matches, match_participants,
               player_matches, saved_profiles, player_sync
sync.rs        TTL (profilo 60', rank 10', partite 3'), deduplica, lock per PUUID
```

Errori dedicati: `NOT_FOUND` (Riot ID inesistente), `RIOT_KEY` (chiave
mancante, non valida o scaduta), `RATE_LIMITED` (con secondi di attesa).

Comandi: `get_riot_key_status`, `set_riot_api_key` (sola scrittura),
`clear_riot_api_key`, `verify_riot_api_key`, `search_player`, `sync_player`,
`get_player_profile`, `get_primary_profile`, `list_saved_profiles`,
`save_player_profile`, `remove_player_profile`, `delete_player_data`.

La partita è condivisa tra giocatori: il collegamento è `player_matches`
(`matches.player_puuid` della 0001 resta inutilizzata). `matches.raw_json`
conserva la risposta originale di match-v5.

### 4.9 Match Analysis & Matchups (schema v7)

Modulo Rust `analysis/`: `repository::dataset` restituisce le partite del
giocatore arricchite con:

- avversario di corsia (stesso `teamPosition`, squadra opposta, solo se
  univoco);
- alleati, nemici e kill della squadra;
- ban;
- oggetti con il flag "completato" da Data Dragon;
- rune;
- patch.

Le aggregazioni sono funzioni pure TypeScript
(`src/features/analysis/lib`, `src/features/matchups/lib`), così card,
tabelle e grafici usano gli stessi numeri. Migrazione `0007_match_analysis`:
aggiunge `match_participants.damage_taken` e la tabella `match_bans`, e fa il
backfill da `matches.raw_json`. Dettagli in
[MATCH_ANALYSIS.md](MATCH_ANALYSIS.md).

### 4.9 bis Account dal client League (schema v8)

Modulo Rust `client/` (LCU, sola lettura, senza chiave API):

```
lockfile.rs    cartella di League (override, metadati Riot, percorsi
               standard) e lettura del lockfile (password mai stampata)
source.rs      ClientSource (trait) + HttpClientSource: GET Basic auth su
               127.0.0.1, CA Riot, nessun proxy
convert.rs     risposte LCU → LeagueEntry e MatchDto (stesso storage di
               match-v5; match id "EUW1_<gameId>", nessun doppione)
sync.rs        account → profilo salvato (principale se non ce n'è uno),
               rank, ultime 20 partite con source = 'league-client'
service.rs     controllo ogni 30 s, lettura a ogni nuova sessione e poi ogni
               10 min, evento `client-account-updated`, Riot ID dalla Live
               Client come riserva
repository.rs  preferenze: attivo, cartella manuale, Riot ID visto in partita
```

Comandi: `get_client_account_status`, `set_client_sync_enabled`,
`sync_from_client`, `set_league_install_path`. La migrazione
`0008_client_source` aggiunge `matches.source` e
`player_sync.client_synced_at`; la fonte mostrata ("Riot API", "Client League
(LCU)" o entrambe) è calcolata dai dati salvati.

### 4.9 ter Statistiche globali dei campioni (schema v9)

Modulo Rust `meta/` (Riot API ufficiale con la chiave dell'utente, opt-in,
disattivato di default):

```
collector.rs   un passo: classifica league-v4 della fascia scelta (Master+:
               challenger/grandmaster/master; Diamante/Smeraldo/Platino:
               divisioni I e II, pagina 1) al massimo una volta al giorno,
               poi le partite Solo/Duo (queue 420) delle ultime 2 settimane
               di un giocatore (match-v5), scaricate una sola volta.
               Una richiesta ogni 2,5 s (circa metà di una chiave dev)
store.rs       impostazioni, giocatori di partenza, righe compatte per
               partecipante (pagina di rune canonica, rune chiave,
               incantesimi, oggetti), ban; conserva le ultime 3 patch
stats.rs       aggregazioni per campione/patch/ruolo: popolarità, vittorie,
               ban, ruoli, pagine di rune, rune chiave, incantesimi, stivali,
               oggetti completi, avversari di corsia (minimo 5 partite)
service.rs     ciclo in background, stato in memoria, pause su 429/errori
static_data.rs nomi e icone di frammenti e incantesimi evocatore (Data Dragon
               non importa summoner.json né i frammenti)
```

Comandi: `get_global_stats_status`, `update_global_stats_settings`,
`clear_global_stats`, `get_champion_global_stats`, `get_champion_roles`.

Schema v10 (`0010_global_timeline`): per ogni partita raccolta si legge anche
la timeline match-v5 (una richiesta in più) per ordine delle abilità, oggetti
iniziali (primi 90 s) e ordine di acquisto; le partite già salvate vengono
completate 5 alla volta. Le partite personali (Riot API o client League) sono
copiate con `seed_tier = 'PERSONAL'`: non entrano mai nelle statistiche
globali, ma la pagina del campione le usa (etichettate) quando le partite
raccolte non contengono quel campione. Le corsie mostrate nella lista e nella
scheda sono quelle giocate davvero (almeno il 15% delle partite con corsia
nota), non più scelte dall'utente; la tabella `user_champion_lanes` resta
ma non è più usata dall'interfaccia. Nessuna percentuale è
salvata: tutto è ricalcolato dalle righe a ogni richiesta e la UI mostra
sempre la numerosità. Remake (< 5 min o resa anticipata) esclusi. Il rank è
verificato solo per il giocatore da cui parte ogni partita.

UI: Impostazioni → *Statistiche globali dei campioni* (interruttore, regione,
fascia, contatori, eliminazione) e pagina del campione (ruoli, patch,
panoramica, rune complete con alternative, oggetti, incantesimi, counter).

### 4.10 Live Game & Overlay (nessuna migrazione)

Modulo Rust `live/`, policy e limiti in [LIVE_GAME.md](LIVE_GAME.md):

```
source.rs      LiveSource (trait) + HttpLiveSource: GET https://127.0.0.1:2999,
               CA Riot inclusa (certs/riotgames.pem), timeout brevi, no proxy
snapshot.rs    funzione pura: gamestats + activeplayername + playerlist →
               LiveSnapshot con i SOLI dati del giocatore locale
service.rs     LiveService: opt-in, polling 2 s in partita / 5 s altrimenti,
               emette `live-game-update` solo sui cambiamenti
overlay.rs     OverlaySettings: validazione, patch, posizionamento puro
window.rs      finestra `overlay`: trasparente, sempre sopra, click-through;
               nascosta = distrutta
repository.rs  chiavi `live_enabled` e `overlay` nella tabella settings
```

Eventi: `live-game-update` (snapshot) e `overlay-settings-updated`. La
finestra overlay carica lo stesso bundle e, riconosciuta dalla label,
renderizza solo `OverlayApp` (nessun router, nessun input). Capability
`overlay`: `core:event:default`, `log:allow-log`.

### 4.11 Migrazioni

```
src-tauri/migrations/0001_init.sql                 schema iniziale
src-tauri/migrations/0002_defaults.sql             valori di default + primo evento
src-tauri/migrations/0003_data_dragon_catalog.sql  catalogo Data Dragon versionato
src-tauri/migrations/0004_user_champion_lanes.sql  corsie assegnate dall'utente
src-tauri/migrations/0005_jungle_training.sql      tentativi di clear e split
src-tauri/migrations/0006_riot_player_data.sql     dati giocatore Riot API
src-tauri/migrations/0007_match_analysis.sql       danni subiti, ban (backfill da raw_json)
src-tauri/migrations/0008_client_source.sql        fonte delle partite, lettura dal client
```

`MIGRATIONS` in `src-tauri/src/db.rs` elenca i file con `include_str!`. La
versione applicata è tracciata con `PRAGMA user_version`.

**Regola:** mai modificare una migrazione già rilasciata. Per ogni modifica:

1. creare `000N_descrizione.sql`;
2. aggiungerla a `MIGRATIONS` in ordine;
3. verificare l'avvio su un database esistente e su uno nuovo.

All'apertura, prima di migrare:

- un database con schema **più recente** di quello conosciuto viene rifiutato
  senza modifiche (protezione dal downgrade);
- un database esistente con schema più vecchio riceve un **backup verificato**
  (`VACUUM INTO` + `integrity_check`) in `backups/`.

Il modulo `backup.rs` gestisce anche i backup manuali (comandi
`create_database_backup` e `list_database_backups`) e conserva gli ultimi 10.
Guida completa: [DATABASE.md](DATABASE.md).

---

## 5. Sicurezza

- **CSP** in `tauri.conf.json`:
  - produzione (`csp`): `default-src 'self'`, `connect-src` limitato all'IPC,
    `img-src` con Data Dragon, `object-src 'none'`, `base-uri 'self'`,
    `frame-ancestors 'none'`, nessun `unsafe-eval`;
  - sviluppo (`devCsp`): aggiunge solo il dev server Vite.
- **Capabilities** minime:
  - `main`: `core:event:default`, `opener:allow-open-url` con scope limitato,
    `log:allow-log`;
  - `overlay`: `core:event:default`, `log:allow-log`.
  I comandi applicativi non richiedono permessi core. Il test Rust
  `release_tests` fallisce se compaiono `core:default`, `shell:`, `fs:`,
  `http:` o `process:`, o se la CSP di produzione contiene il dev server.
- **Rete**: solo il backend Rust contatta Data Dragon, la Riot API (chiave
  nell'header, rate limit, retry limitati) e la Live Client Data API locale
  (CA Riot verificata). Dettagli in [RIOT_COMPLIANCE.md](RIOT_COMPLIANCE.md).
- **Link esterni** solo HTTPS e solo origini in allowlist
  (`developer.riotgames.com`, `www.riotgames.com`), applicata due volte:
  in `external-service.ts` e nello scope della capability opener. Le due
  liste vanno mantenute allineate. Include `www.leagueoflegends.com` per le
  note patch ufficiali.
- **Segreti** mai nel frontend, mai in `VITE_*`, mai nei log. `.env*` ignorati
  tranne `.env.example`.
- **Input** validati due volte: Zod lato client, Rust lato backend.
- **SQL** mai costruito con input utente; i nomi tabella provengono da una
  costante interna.

---

## 6. Scelte tecniche e motivazioni

| Scelta | Motivazione |
| --- | --- |
| HashRouter | Evita problemi di deep link e reload nel webview Tauri |
| SQLite bundled (`rusqlite`) | Nessuna dipendenza da un'installazione esterna |
| Migrazioni con `include_str!` | Schema versionato nel binario, nessun file esterno mancante |
| Zod + Rust validation | Difesa in profondità sui confini |
| TanStack Query | Cache, retry, invalidazione e stato server esplicito |
| Zustand minimale | Solo UI state, nessuna duplicazione di dati server |
| Primitives shadcn-style locali | Controllo completo su stile e accessibilità senza generatore |
| Snapshot browser esplicito | La UI resta ispezionabile senza simulare un backend |

---

## 7. Come estendere il progetto

### Nuovo modulo UI

1. Aggiungere la voce in `MODULES` (`src/app/navigation.ts`).
2. Creare `src/features/<feature>/<feature>-page.tsx`.
3. Registrare la rotta in `src/app/router.tsx`.
4. Finché i dati non sono reali, usare `FeaturePlaceholder` con scope e
   prerequisiti onesti.

### Nuovo comando backend

1. Definire i modelli in `src-tauri/src/models.rs`.
2. Implementare la logica in un modulo dedicato (non nel comando).
3. Esporre il comando in `commands.rs` e in `generate_handler!`.
4. Definire lo schema Zod in `src/types/`.
5. Aggiungere la funzione in `src/services/`.
6. Creare l'hook TanStack Query e gestire loading/empty/error.
7. Aggiungere un test manuale verificato e riportarlo.

### Nuova migrazione

1. Creare il file SQL numerato.
2. Aggiungerlo a `MIGRATIONS`.
3. Verificare sia un database nuovo sia uno già alla versione precedente.
4. Non modificare mai i file precedenti.

---

## 8. Debito tecnico noto

- Bundle JS principale oltre 500 kB; i grafici Recharts sono già in chunk lazy.
- L'elenco delle regioni è duplicato in tre punti (`RIOT_REGIONS`,
  `riotRegionSchema`, `VALID_REGIONS` in Rust).
- Nei modelli Rust `state` e `kind` sono `String` mentre Zod usa enum: un
  valore nuovo lato backend farebbe fallire l'intero snapshot.
- La potatura dell'activity log avviene solo all'avvio.
- La modalità degradata (database non apribile) è verificata solo in
  compilazione, non con un guasto reale.
- Le immagini Data Dragon non sono in cache locale: offline i dati restano
  consultabili, mentre le immagini dipendono dalla cache di WebView2.
- Le skin senza immagine vengono rilevate solo nella UI, al caricamento.
- Oggetti e rune sono importati ma non hanno ancora una schermata (Fase 3).
- `matches` non ha ancora un vincolo di unicità per giocatore oltre alla chiave
  primaria `match_id`; da rivedere con l'integrazione reale.
- L'activity log è potenzialmente rumoroso su molti avvii; la potatura a 200
  record mitiga ma non elimina il problema.
- Installer non firmato (manca un certificato Authenticode).

---

## 9. Aggiornamenti

Stato attuale (0.10.0): **aggiornamento manuale tramite installer NSIS**.
L'installer della nuova versione sostituisce i file dell'app in
`%LOCALAPPDATA%\TECCA CODEOFLEGENDS` e lascia invariati i dati in
`%APPDATA%\com.tecca.codeoflegends`.

L'architettura è già pronta per aggiornamenti senza perdita di dati:

| Elemento | Dove |
| --- | --- |
| Versione unica in `package.json`, `Cargo.toml` e `tauri.conf.json` | Test `release_tests::version_is_identical_in_cargo_tauri_and_npm` |
| Migrazioni append-only con transazione e `user_version` | `db.rs` |
| Backup verificato automatico prima di ogni migrazione | `backup.rs` |
| Rifiuto di un database creato da una versione più recente | `Database::check_compatible` |
| Nessun downgrade dall'installer | `bundle.windows.allowDowngrades = false` |
| Identificatore stabile (`com.tecca.codeoflegends`) che decide la cartella dati | `tauri.conf.json` |

**Aggiornamento in-app (futuro, non abilitato).** Non è attivo nessun
aggiornamento automatico: un updater senza firma permetterebbe di distribuire
binari arbitrari. Se verrà aggiunto, dovrà:

1. usare `tauri-plugin-updater` con artifact firmati (chiave minisign
   generata con `tauri signer generate`). La chiave privata va **fuori** dal
   repository, la pubblica in `plugins.updater.pubkey`;
2. leggere il manifest solo da un endpoint HTTPS controllato dal progetto (per
   esempio GitHub Releases);
3. chiedere conferma all'utente prima di scaricare e installare, senza
   aggiornamenti silenziosi;
4. firmare anche l'installer con Authenticode;
5. concedere alla finestra `main` solo il permesso `updater:default`, in una
   capability dedicata.

## 10. Build e rilascio

```powershell
npm run desktop:build
```

- Esegue `npm run build` (typecheck + Vite), compila Rust in `release` (LTO,
  `opt-level = "s"`, `panic = "abort"`) e crea l'installer NSIS.
- Target: `nsis` con `installMode: currentUser` (nessun privilegio di
  amministratore), lingue italiano e inglese e compressione LZMA. WebView2
  viene installato con il bootstrapper ufficiale, se manca.
- Output: `src-tauri/target/release/bundle/nsis/TECCA CODEOFLEGENDS_<versione>_x64-setup.exe`.
- L'eseguibile si chiama `tecca-codeoflegends.exe` (`mainBinaryName`) e il
  nome mostrato è `TECCA CODEOFLEGENDS` (`productName`).
- MSI non è generato: richiederebbe WiX e non aggiunge nulla per
  un'installazione per utente.
