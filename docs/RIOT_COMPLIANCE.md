# Conformità Riot Games

TECCA CODEOFLEGENDS è un companion **non affiliato** a Riot Games. Questo
documento elenca le fonti di dati usate, i vincoli rispettati e le verifiche
fatte per la release.

## 1. Fonti di dati

| Fonte | Uso | Autenticazione | Dove |
| --- | --- | --- | --- |
| Data Dragon (`ddragon.leagueoflegends.com`) | Campioni, abilità, skin, oggetti, rune, immagini | Nessuna (CDN pubblico) | Backend Rust |
| Riot API: account-v1, summoner-v4, league-v4, match-v5, lol-status-v4 | Profili, rank, partite, verifica chiave | Chiave personale dell'utente (`X-Riot-Token`) | Backend Rust |
| Riot API: league-v4 (classifiche), match-v5 (Solo/Duo) | Statistiche globali dei campioni, **opt-in** | Chiave personale dell'utente | Backend Rust, disattivata di default |
| Live Client Data API (`127.0.0.1:2999`) | Stato della partita, dati del giocatore locale, Riot ID e campioni della tabella punteggi per il pannello partita | Nessuna, certificato Riot verificato | Backend Rust, opt-in |
| API del client League (LCU, `127.0.0.1:<porta del lockfile>`) | **Solo il proprio** account, rank e ultime 20 partite, senza chiave | Password di sessione locale dal `lockfile`, certificato Riot verificato | Backend Rust, attiva di default e disattivabile |

Il frontend non contatta nessuna di queste API: carica solo le immagini Data
Dragon, consentite dalla CSP. **Non** vengono usati scraping né siti di
statistiche di terze parti.

### API del client League (LCU)

Riot documenta che l'API del client **non è ufficialmente supportata** per le
applicazioni di terze parti: può cambiare o smettere di funzionare con un
aggiornamento. È usata su richiesta esplicita dell'utente, solo per evitare
di dover inserire una chiave API per **il proprio account**, con questi
limiti:

| Vincolo | Implementazione |
| --- | --- |
| Solo lettura | Solo richieste GET: `current-summoner`, `region-locale`, `current-ranked-stats`, cronologia e dettaglio partite (`client/sync.rs`) |
| Nessuna azione sul client | Nessuna POST, PUT o DELETE: niente auto-accept, lobby, champion select, chat o acquisti |
| File del gioco | Il `lockfile` della cartella di League viene **letto**, mai scritto; nessun altro file del gioco viene toccato |
| Segreto di sessione | Usato solo in memoria per l'header Basic verso 127.0.0.1; il `Debug` lo nasconde; mai nei log, nel database o nella webview |
| Rete | Solo `127.0.0.1`, senza proxy; catena TLS verificata con la CA Riot |
| Dati | Solo l'account connesso nel client; le partite sono salvate con `source = 'league-client'` e l'interfaccia mostra la fonte "Client League (LCU)" |
| Controllo dell'utente | Interruttore in Impostazioni → Account automatico; lettura manuale con un pulsante |
| Ritmo | Un controllo ogni 30 s; lettura completa a ogni nuova sessione del client e poi ogni 10 minuti |

Se il client non è aperto, l'app lo dice e usa i dati già salvati. Durante
una partita la Live Client Data API fornisce il Riot ID del giocatore, che
viene ricordato come riserva: senza client o chiave, però, non arrivano né
rank né partite.

## 2. Chiave API

- La chiave non è mai inclusa nel frontend, nel repository, nei file di build,
  nel database o nei log.
- Viene letta, nell'ordine, da:
  1. variabile d'ambiente di processo `RIOT_API_KEY`;
  2. Gestione credenziali di Windows (servizio `com.tecca.codeoflegends`),
     dove la salva **Impostazioni → Chiave API Riot**.
- Il campo nell'interfaccia è in sola scrittura: la chiave non viene mai
  rimandata alla webview.
- Viene inviata solo come header `X-Riot-Token` agli host ufficiali
  `*.api.riotgames.com`.
- Le chiavi di sviluppo scadono dopo 24 ore. Per distribuire l'app ad altri
  serve una chiave **personale** o di **produzione**, approvata tramite il
  Developer Portal.

## 3. Rate limit e richieste

- Il limitatore è per routing value e usa i limiti della chiave di sviluppo
  (20 richieste/s, 100 ogni 2 minuti) con un margine.
- Sui `429` rispetta `Retry-After`; i `5xx` hanno un numero di tentativi
  limitato.
- Cache locale: profilo 60 min, rank 10 min, lista partite 3 min. Le partite
  concluse si scaricano una sola volta.
- Una sola sincronizzazione per giocatore alla volta.
- Statistiche globali (opt-in): al massimo una richiesta ogni 2,5 s,
  così resta circa metà del limite per le ricerche dei profili; classifica
  aggiornata al massimo una volta al giorno, ogni giocatore riletto dopo
  almeno 12 ore, ogni partita scaricata una sola volta; pausa automatica su
  `429` (Retry-After), errori di rete e chiave scaduta. Si salvano solo i
  campi necessari alle aggregazioni (niente nomi o Riot ID degli altri
  giocatori) e solo le ultime 3 patch; eliminabili da Impostazioni.
- Gli errori distinguono chiave non valida o scaduta, account inesistente,
  limite raggiunto e problemi di rete, con messaggi chiari per l'utente.

## 4. Gioco e client

| Vincolo | Stato | Verifica (release 0.10.0) |
| --- | --- | --- |
| Nessuna lettura della memoria del processo | Rispettato | Nessuna API di processo o memoria nel codice; nessuna dipendenza `windows-sys`, `winapi` o `sysinfo` nel crate |
| Nessuna injection, hook o debugger | Rispettato | Come sopra |
| Nessuna modifica ai file del gioco o del client | Rispettato | Il percorso di League serve solo a **leggere** il `lockfile`; le scritture avvengono solo nella cartella dati dell'app |
| Nessuna automazione o input sintetico | Rispettato | Nessun `SendInput` o simili; l'overlay ignora mouse e tastiera |
| Overlay | Finestra Tauri separata, opzionale, trasparente, click-through | `live/window.rs`; capability `overlay` con soli eventi e log |
| Dati in partita | I propri dati del client; per gli altri giocatori solo l'identità della tabella punteggi e il profilo pubblico Riot API (livello, rank ufficiale, ultime classificate), mai nomi nascosti o bot; build informativa del proprio campione. Niente timer, cooldown, oggetti o punteggi altrui, MMR propri o suggerimenti dinamici | `docs/LIVE_GAME.md` § 1 bis, test su scarto dei dati di partita altrui e nomi nascosti |
| Statistiche | Analisi personale: solo dalle partite dell'utente, con numerosità e IC. Statistiche globali: calcolate solo dalle partite scaricate con la chiave dell'utente, con numerosità, patch, regione e fascia dichiarate; nessuna percentuale stimata o presa da siti terzi | `docs/MATCH_ANALYSIS.md`, `src-tauri/src/meta/` |
| Pubblicità | Assente | — |

## 5. Distribuzione

- Per le policy Riot, ogni prodotto distribuito pubblicamente va **registrato e
  approvato** tramite il Riot Developer Portal. La release 0.10.0 è pensata per
  uso personale e test: la registrazione resta a carico del titolare del
  progetto.
- La raccolta delle statistiche globali con una chiave di sviluppo è adatta
  solo a prototipi e uso personale: per distribuirla ad altri utenti serve una
  chiave di produzione approvata, con limiti e scopo dichiarati a Riot.
- Nell'app e nella documentazione va riportata la dicitura legale Riot:
  *TECCA CODEOFLEGENDS isn't endorsed by Riot Games and doesn't reflect the
  views or opinions of Riot Games or anyone officially involved in producing or
  managing Riot Games properties. Riot Games, and all associated properties are
  trademarks or registered trademarks of Riot Games, Inc.*

## 6. Come rifare la verifica

```powershell
# Nessuna chiave reale nel repository e nella cronologia (solo le chiavi fittizie dei test)
git log -p --all | Select-String -Pattern "RGAPI-[0-9a-fA-F]{8}-" | Select-Object -ExpandProperty Line -Unique

# Nessuna API di processo, memoria o input nel backend
Select-String -Path src-tauri\src\*.rs, src-tauri\src\*\*.rs -Pattern "ReadProcessMemory|OpenProcess|SendInput|SetWindowsHookEx"

# Permessi e CSP: verificati anche dal test cargo `release_tests`
cargo test --manifest-path src-tauri/Cargo.toml release_tests
```
