# Live Game & Desktop Overlay

Modulo della Fase 7. Questo documento riassume le policy Riot consultate,
cosa è stato implementato, cosa è stato escluso di proposito e perché.

## 1. Fonti consultate

- Riot Developer Portal, documentazione LoL, sezione *Game Client API → Live
  Client Data API* (`https://127.0.0.1:2999/liveclientdata/...`, certificato
  radice `riotgames.pem`).
- Riot Developer Portal, *General Policies* e *Game Policies* di League of
  Legends.

Punti rilevanti delle policy:

- **Consentito:** overlay con dati statici disponibili prima della partita,
  statistiche del giocatore stesso, strumenti di allenamento sui propri dati.
- **Vietato:**
  - fornire informazioni di sessione che il giocatore non conoscerebbe già;
  - app che dettano le decisioni del giocatore;
  - tracciare i cooldown delle ultimate nemiche;
  - usare informazioni assenti dal client che diano un vantaggio competitivo;
  - identificare o analizzare giocatori nascosti dal gioco, o de-anonimizzarli;
  - mostrare win rate di Augment o oggetti Arena;
  - pubblicità in partita.
- **Distribuzione:** ogni prodotto va registrato e approvato da Riot tramite
  il Developer Portal.
- **LCU:** l'API del client non è supportata ufficialmente per le applicazioni
  di terze parti.

## 1 bis. Pannello partita (approvato dall'utente il 10/11/2026)

Su richiesta esplicita dell'utente, dopo aver segnalato il conflitto con le
regole precedenti, il modulo mostra anche un **pannello partita** in stile
"scheda giocatori". La pagina ufficiale delle policy non era leggibile in
automatico; un riassunto secondario dell'aggiornamento Riot del 29/05/2025
indica come consentiti i dati dalle API ufficiali e i suggerimenti di build,
e come vietati: giocatori in modalità anonima, sistemi di rank/MMR propri,
tracker dei cooldown, pubblicità e overlay che decidono al posto del
giocatore. La verifica sul testo ufficiale resta a carico del titolare prima
di una distribuzione pubblica.

| Elemento | Dettaglio |
| --- | --- |
| Giocatori | Dalla Live Client Data API: Riot ID, campione, squadra e corsia (quello che mostra la tabella punteggi). Oggetti, punteggi, rune, incantesimi e timer altrui vengono scartati in `live/snapshot.rs`. |
| Profilo pubblico | Con la chiave dell'utente (`live/board.rs`): account-v1 → summoner-v4 (livello) → league-v4 (rank Solo/Duo ufficiale) → match-v5 (ultime 5 classificate degli ultimi 30 giorni: vittorie, KDA medio, ruolo principale, partite con il campione attuale). Una ricerca per partita; la raccolta delle statistiche globali va in pausa nel frattempo. |
| Esclusi | Bot e giocatori con nome nascosto: nessuna richiesta. Nessun rank o MMR calcolato dall'app. |
| Build | Del solo campione dell'utente, dalle statistiche dell'app (partite raccolte o personali), calcolata a inizio partita: rune, oggetti iniziali, fondamentali, stivali, finali, livelli 1-2-3, ordine abilità. Nessun acquisto o livellamento automatico. |
| Finestra | Label `board`, trasparente, sempre in primo piano, mai focalizzata, **click-through**; si apre da solo a inizio partita; tasto rapido globale `Home` registrato da Rust (nessun permesso alla webview) per nasconderlo o riaprirlo, pulsante nella pagina Live Game. Si chiude a fine partita. Capability: solo eventi e log. |

## 2. Cosa è implementato

| Funzione | Dettaglio |
| --- | --- |
| Consenso esplicito | Rilevamento **disattivato di default**. Interruttore nella pagina Live Game, persistito in `settings.live_enabled` e registrato nel log attività. Quando è spento il backend non fa alcuna richiesta. |
| Rilevamento partita | Polling in sola lettura della Live Client Data API locale: ogni 2 s in partita, ogni 5 s altrimenti. Si usano 3 endpoint: `gamestats`, `activeplayername`, `playerlist`. |
| Stato connessione | `disabled`, `not_running` (porta chiusa), `loading` (client attivo ma dati non pronti), `in_game`, `error` (risposta non valida, dettaglio nei log). |
| Dati mostrati | Solo dati **del giocatore locale**, già visibili nel suo client: modalità, mappa, tempo di gioco, campione, livello, ruolo, K/D/A, CS, CS/min, punteggio visione. |
| Privacy | Le righe degli altri giocatori vengono scartate nel backend Rust (`live/snapshot.rs`) e non arrivano mai alla webview; un test lo verifica. Spettatori e replay: viene mostrata solo la partita, senza dati personali. |
| Eventi | `live-game-update` viene emesso solo quando il contenuto cambia; `overlay-settings-updated` dopo ogni salvataggio delle impostazioni. |
| Overlay | Finestra Tauri separata (label `overlay`), opzionale e chiusa di default. Si configurano dimensioni (200–600 × 80–400 px), angolo dello schermo, margini, opacità (30–100%) e tema (Tecca, Minimal, Alto contrasto). |
| Modalità overlay | Finestra trasparente, senza bordi, sempre in primo piano, fuori dalla barra delle applicazioni, mai focalizzata e **click-through** (`set_ignore_cursor_events`). Non riceve input, quindi non può interagire con il gioco. |
| Modalità finestra | Finestra normale con bordi, non in primo piano. Chiuderla dalla X equivale a "nascondi overlay". |
| Risorse | Overlay nascosto = finestra distrutta (nessun webview attivo). L'overlay viene chiuso insieme alla finestra principale. |
| Permessi | La capability `overlay` concede solo `core:event:default` e `log:allow-log`: niente finestre, file, shell o URL. |

## 3. Cosa NON è implementato e perché

| Funzione esclusa | Motivo |
| --- | --- |
| Timer di respawn di draghi, Baron, Araldo, campi della giungla (`eventdata`) | Informazioni di sessione che il giocatore deve ricordare da sé, con un vantaggio competitivo; vietate. Il feed `eventdata` non viene letto. |
| Cooldown di ultimate, Flash o incantesimi nemici | Vietato esplicitamente ("tracking enemy ultimate cooldowns"). |
| Oggetti, rune, punteggi o timer degli altri giocatori nella partita in corso | Informazioni di sessione; scartate nel backend. (Rank e storico pubblici: vedi § 1 bis.) |
| Suggerimenti dinamici (rotazioni, obiettivi, acquisti o livelli automatici) | Le app non possono dettare o automatizzare le decisioni del giocatore. La build informativa del proprio campione è nel § 1 bis. |
| Notifiche o avvisi temporizzati in partita | Sarebbero promemoria con vantaggio competitivo. |
| Lettura memoria, injection, hook, modifica dei file, input automatico | Vietati dai Termini di servizio e da AGENTS.md. |
| Azioni tramite l'API del client (LCU): auto-accept, lobby, champion select | Automazione vietata. L'LCU è usata **solo in lettura** per il proprio account, fuori dalla partita, dal modulo `client` (vedi RIOT_COMPLIANCE.md). |
| Win rate di Augment o oggetti Arena | Vietati esplicitamente. |
| Overlay interattivo sopra il gioco | Non serve, e un overlay che cattura l'input interferirebbe con il gioco. |
| Pubblicità nell'overlay | Vietata in partita. |

## 4. Sicurezza della connessione

- `HttpLiveSource` parla solo con `https://127.0.0.1:2999` e ignora i proxy.
- Il certificato del gioco è verificato contro la CA radice di Riot inclusa in
  `src-tauri/certs/riotgames.pem` (pinning).
- Il controllo del nome host è disattivato: il certificato non è emesso per
  `127.0.0.1`, mentre la catena resta verificata.
- Timeout: connessione 800 ms, richiesta 2 s.

## 5. Test

- Rust (`src-tauri/src/live/tests.rs`) con una partita **simulata solo nei
  test** tramite la trait `LiveSource`. I casi coperti:
  - gioco non avviato, schermata di caricamento, risposta malformata;
  - in partita, spettatore, CS/min nel primo minuto;
  - nessuna richiesta quando il rilevamento è disattivato;
  - emissione degli eventi solo sui cambiamenti, aggiornamento dei dati e
    disconnessione;
  - validazione e posizionamento dell'overlay;
  - persistenza con fallback sicuri.
- Vitest (`src/features/live/lib/live-format.test.ts`): formattazione e
  contratti Zod.
- L'app non contiene né mostra dati di partita simulati.

## 6. Limiti noti

- In modalità finestra la posizione e la dimensione cambiate a mano non
  vengono salvate.
- L'overlay si posiziona sul monitor della finestra principale.
- Le partite in modalità **schermo intero esclusivo** possono coprire
  qualsiasi finestra, overlay compreso: serve la modalità "Senza bordi" o
  "Finestra" del gioco.
- La verifica con una partita reale dipende dall'utente: lo sviluppo è stato
  verificato senza partita in corso (stato `not_running`) e con i test
  simulati.
