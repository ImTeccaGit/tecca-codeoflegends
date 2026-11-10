# TECCA CODEOFLEGENDS

Companion desktop per League of Legends su Windows, costruito con Tauri 2,
React e Rust. L'app è **local-first**: i dati stanno in un database SQLite sul
dispositivo, non c'è telemetria e nessuna credenziale Riot passa dal frontend.
Non legge la memoria del gioco e non modifica i suoi file.

> **Release 0.10.0 (beta).** 9 moduli su 11 sono operativi. Rune Builder e
> Build Builder restano pianificati. Le funzioni Riot API sono state verificate
> con risposte simulate; la verifica con una chiave reale spetta all'utente.
> Problemi residui: [§ 0.6](#06-problemi-residui-della-release).

TECCA CODEOFLEGENDS isn't endorsed by Riot Games and doesn't reflect the views
or opinions of Riot Games or anyone officially involved in producing or
managing Riot Games properties. Riot Games, and all associated properties are
trademarks or registered trademarks of Riot Games, Inc.

---

## 0. Guida rapida

### 0.1 Installare

1. Scarica `TECCA CODEOFLEGENDS_0.10.0_x64-setup.exe`. Se lo compili tu, si
   trova in `src-tauri\target\release\bundle\nsis\`.
2. Avvialo. L'installazione è **per utente** e non richiede privilegi di
   amministratore; installa in `%LOCALAPPDATA%\TECCA CODEOFLEGENDS` e crea i
   collegamenti nel menu Start.
3. L'installer **non è firmato digitalmente**, quindi Windows SmartScreen può
   mostrare "Windows ha protetto il PC": scegli *Ulteriori informazioni →
   Esegui comunque* solo se l'installer viene da una fonte di cui ti fidi.
4. WebView2 è già presente su Windows 10/11 aggiornati. Se manca, l'installer
   scarica il bootstrapper ufficiale Microsoft.

### 0.2 Avviare

Dal menu Start: **TECCA CODEOFLEGENDS**. Al primo avvio:

- viene creato il database in `%APPDATA%\com.tecca.codeoflegends\`;
- il catalogo Data Dragon viene importato in automatico (serve la rete, circa
  3 MB).

### 0.3 Aggiornare

Gli aggiornamenti sono **manuali e sicuri**: non c'è nessun download
automatico.

1. Chiudi l'app.
2. Esegui l'installer della nuova versione: aggiorna l'installazione esistente
   e lascia i dati al loro posto.
3. Al primo avvio, se lo schema del database cambia, l'app crea un backup
   verificato (`backups\…pre-migration…`) prima di migrare.

L'installer rifiuta di installare una versione **più vecchia** sopra una più
recente (`allowDowngrades: false`). Anche il database creato da una versione
più recente non viene aperto da una precedente, quindi i dati non si
corrompono. Dettagli: [docs/DATABASE.md](DATABASE.md). Architettura
prevista per un futuro aggiornamento in-app firmato:
[docs/ARCHITECTURE.md § Aggiornamenti](ARCHITECTURE.md#9-aggiornamenti).

### 0.4 Configurare le API

- **Data Dragon**: nessuna configurazione, è pubblico.
- **Il tuo account, senza chiave**: apri il client di League of Legends. L'app
  legge in automatico, in sola lettura, il tuo account, il rank e le ultime 20
  partite, e li imposta come profilo principale (Impostazioni → *Account
  automatico dal client di League*, disattivabile). Usa l'API del client, che
  Riot non supporta ufficialmente: può smettere di funzionare dopo un
  aggiornamento. Durante una partita l'app riconosce comunque il tuo Riot ID.
- **Riot API (chiave)**, per cercare **altri** giocatori o se non vuoi usare il
  client:
  1. crea una chiave su [developer.riotgames.com](https://developer.riotgames.com).
     Le chiavi di sviluppo scadono dopo 24 ore; per un uso continuativo serve
     una chiave personale o di produzione approvata;
  2. in **Impostazioni → Chiave API Riot** incollala e salvala. Finisce nella
     Gestione credenziali di Windows e non viene mai mostrata di nuovo;
  3. premi **Verifica chiave**;
  4. in alternativa imposta la variabile d'ambiente `RIOT_API_KEY`, che ha la
     precedenza.
- **Live Game**: si attiva con l'interruttore nella pagina Live Game (spento
  di default). Usa solo l'API locale del gioco durante una partita.

### 0.5 Creare una nuova build

Requisiti: [§ 3](#3-requisiti).

1. Aggiorna la versione **in tutti e tre i file**: `package.json`,
   `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`. Il test
   `release_tests` fallisce se sono diverse.
2. Se lo schema cambia, aggiungi una **nuova** migrazione in
   `src-tauri/migrations/` e la sua voce in `MIGRATIONS`.
3. Esegui tutti i check (devono passare senza errori):

```powershell
npm run typecheck; npm run lint; npm test; npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

4. Genera l'installer:

```powershell
npm run desktop:build
```

L'output è in `src-tauri\target\release\bundle\nsis\TECCA CODEOFLEGENDS_<versione>_x64-setup.exe`.
Al primo build Tauri scarica gli strumenti NSIS da GitHub.

### 0.6 Problemi residui della release

| Problema | Impatto | Azione necessaria |
| --- | --- | --- |
| Installer non firmato | Avviso SmartScreen | Serve un certificato di firma del codice (Authenticode) e la sua configurazione in `bundle.windows` |
| Chiave Riot reale mai provata | Le funzioni Riot API sono verificate solo con risposte simulate | Inserire una chiave e sincronizzare un profilo |
| Live Game non provato in partita | Verificato solo senza partita in corso | Avviare una partita con il rilevamento attivo |
| Registrazione del prodotto su Riot Developer Portal | Obbligatoria per una distribuzione pubblica | A carico del titolare del progetto |
| Nessun file `LICENSE` | `package.json` dichiara MIT ma il testo della licenza manca | Scelta legale del titolare |
| `cargo audit` non eseguito | Dipendenze Rust non verificate contro l'advisory DB | `cargo install cargo-audit`, poi `cargo audit` |
| Rune Builder, Build Builder | Moduli pianificati | Fasi future |

---

## 1. Cosa funziona davvero

| Area | Stato | Note |
| --- | --- | --- |
| Shell applicativa | Operativa | Sidebar permanente, drawer mobile, top bar, command palette `Ctrl+K`, skip link |
| Dashboard | Operativa | Dati locali reali; Win Rate, KDA, Rank, LP, partite, grafico, campioni e patch vuoti finché Riot non è collegato, oppure dimostrativi con **Modalità DEMO** |
| Settings | Operativa | Regione, animazioni, chiave Riot, backup del database, diagnostica, dicitura legale Riot |
| Backend Rust | Operativo | Comandi Tauri sottili, errori serializzati `{ code, message }` |
| Database | Operativo | SQLite WAL, schema v8, migrazioni append-only, backup automatici pre-migrazione e manuali, controllo di compatibilità. Dettagli in [docs/DATABASE.md](DATABASE.md) |
| Activity log | Operativo | Solo eventi reali dell'app, massimo 200 record, nessuna telemetria |
| Log tecnici | Operativo | File locali ruotati (`tauri-plugin-log`), percorso visibile in Impostazioni |
| Champions | Operativo | Catalogo Riot Data Dragon (`it_IT`): griglia, ricerca, filtri per corsia (tue), classe e preferiti, ordinamento, scheda con abilità, statistiche, valutazioni e skin |
| Data Dragon | Operativo | Import automatico (controllo ogni 6 ore) e manuale di campioni, abilità, skin, oggetti e rune, versionato per patch, con verifica di integrità |
| Riot API | Implementata (verifica con chiave reale in sospeso) | Account-v1, Summoner-v4, League-v4, Match-v5 dal solo backend Rust; chiave in `RIOT_API_KEY` o nella Gestione credenziali di Windows |
| Account automatico | Implementato e verificato con un client reale | Account, rank e ultime 20 partite dal client League aperto, senza chiave (LCU, sola lettura); Riot ID dalla partita come riserva |
| Player Profiles | Implementato | Ricerca per Riot ID e regione, rank Solo/Flex, statistiche, performance per campione, profili salvati e principale |
| Match History | Implementata | Partite match-v5 salvate in locale con oggetti, rune, KDA, CS/min, filtri per coda |
| Live Game | Implementato (verificato senza partita in corso) | Opt-in, Live Client Data API locale in sola lettura, solo i dati del giocatore; nessun timer, suggerimento o dato altrui. Dettagli in [docs/LIVE_GAME.md](LIVE_GAME.md) |
| Overlay desktop | Implementato | Finestra Tauri separata, opzionale, trasparente e click-through (o finestra normale); dimensioni, posizione, opacità e tema configurabili |
| Jungle & Farming | Operativo | Mappa schematica originale (Blue/Red Side, 12 campi, Scuttle, fosse epiche), percorsi modello e personalizzati, cronometro di allenamento con tempi per campo, storico, record, confronto e grafico |
| Match Analysis | Implementata (verificata con dati simulati: nessuna partita reale in locale) | Post-partita sulle tue partite match-v5: card, grafici, tabelle per campione e ruolo, dettaglio partita con confronto in corsia, filtri; fonte, patch, numerosità e IC 95% sempre indicati. Dettagli in [docs/MATCH_ANALYSIS.md](MATCH_ANALYSIS.md) |
| Matchups | Implementati (stessa verifica) | Tuo campione vs avversari di corsia affrontati: win rate, presenza pick/ban nelle tue partite, counter, sinergie, rune usate, oggetti completati. Statistiche globali dichiarate non disponibili |
| Rune, Build | **Scaffold pianificati** | Rotta e layout presenti. Oggetti e rune sono già importati per i builder futuri |

Il conteggio "Moduli attivi" nella dashboard deriva dal registry
`src/app/navigation.ts` e vale **9 / 11** in questa fase.

### Riot API

- **Chiave**: incollala in **Impostazioni → Chiave API Riot** (salvata nella
  Gestione credenziali di Windows, campo in sola scrittura) oppure imposta la
  variabile d'ambiente `RIOT_API_KEY`, che ha la precedenza. La chiave non
  arriva mai al frontend, non finisce nei log, nel database o nel repository.
  Le chiavi di sviluppo del Riot Developer Portal scadono dopo 24 ore.
- **Endpoint usati** (solo ufficiali): `account-v1`, `summoner-v4`,
  `league-v4`, `match-v5`, `lol-status-v4` (verifica chiave). Nessuno scraping.
- **Rate limit**: limiti della chiave di sviluppo (20/s, 100/2 min) applicati
  per routing value, con margine; i `429` rispettano `Retry-After`.
- **Cache**: profilo 60 min, rank 10 min, lista partite 3 min; ogni partita è
  scaricata una sola volta. "Aggiorna da Riot" forza l'aggiornamento.
- **Dashboard**: con un profilo principale salvato mostra i dati reali,
  etichettati "Riot API"; i remake sono esclusi dalle statistiche. La modalità
  DEMO si disattiva quando esistono dati reali e non si mescola mai con essi.

### Jungle & Farming

- **Mappa**: SVG originale TECCA, nessuna risorsa grafica Riot. Le posizioni
  sono schematiche (adatte a studiare l'ordine dei campi, non in scala esatta).
- **Percorsi modello** per Blue e Red Side: Full Clear (partenza Red e Blue),
  5 Camp, 3 Camp, Invasione simulata. Indicano solo l'ordine dei campi: nessun
  tempo "ufficiale". I percorsi personalizzati si creano cliccando la mappa o
  partendo da un modello.
- **Cronometro di allenamento**: avvio manuale, un tempo per campo, pausa,
  annulla ultimo campo. È dichiaratamente un timer di allenamento: non legge il
  gioco e non è un timer live.
- **Storico**: ogni tentativo salva una copia del percorso (resta valido anche
  se modifichi o elimini il percorso); record personale, media, miglioramento,
  grafico e confronto campo per campo tra due tentativi.
- **Mostri e obiettivi**: nomi, tipo, lato e area. **Nessun tempo di spawn o
  respawn**: Riot non li pubblica in una fonte strutturata e versionata, quindi
  l'app rimanda alle note patch ufficiali.
- **Schede campioni jungle**: i campioni a cui hai assegnato la corsia Giungla.

### Dati Data Dragon

- Fonte: [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon),
  CDN pubblico, nessuna chiave. Scaricato solo dal backend Rust.
- Al primo avvio il catalogo viene importato automaticamente (circa 3 MB
  compressi). Poi un controllo ogni 6 ore; il pulsante **Controlla
  aggiornamenti** nella pagina Champions lo esegue subito.
- Ogni patch resta salvata: una nuova versione aggiunge righe e non modifica né
  cancella quelle precedenti (vincolo imposto da trigger SQLite).
- Le immagini non vengono scaricate: si salvano i nomi file Data Dragon e l'app
  costruisce gli URL ufficiali. Le splash delle skin non sono versionate dal CDN.
- Data Dragon elenca anche varianti chroma senza immagine: l'app le mostra in un
  elenco separato invece di inventare un'anteprima.
- Il filtro **Classe** usa le classi ufficiali Data Dragon (Assassino,
  Combattente, Mago, Tiratore, Supporto, Tank).
- Il filtro **Corsia** (Top, Giungla, Mid, Bot, Supporto, con icone originali)
  usa le corsie **assegnate da te**: Riot non pubblica le corsie dei campioni e
  l'unica fonte pubblica (Meraki Analytics) è ferma alla patch 16.3. Le assegni
  con "Assegna corsie" nella griglia o dalla scheda del campione.
- **Preferiti**: stella su card e scheda, filtro "Preferiti". Preferiti e corsie
  sono salvati in SQLite, legati all'id stabile del campione: restano validi a
  ogni nuova patch.

---

## 2. Stack

- **Frontend:** React 19, TypeScript 7 (`strict`), Vite 8, Tailwind CSS 4.
- **UI:** primitive shadcn/ui (Radix + CVA), `lucide-react`, `sonner`,
  `tw-animate-css` per le animazioni di Dialog e Tooltip.
- **Stato:** TanStack Query per i dati backend, Zustand solo per stato UI effimero.
- **Contratti:** Zod ai confini (`src/types/*`, `src/lib/tauri.ts`).
- **Desktop:** Tauri 2.
- **Backend:** Rust, `rusqlite` con SQLite bundled, `tauri-plugin-log`,
  `reqwest` con TLS nativo di Windows (Data Dragon, Riot API, Live Client),
  `keyring` (Gestione credenziali di Windows).
- **Grafici:** Recharts (caricato lazy) solo su dati reali.
- **Font:** Manrope Variable e Space Grotesk Variable, inclusi nel bundle.

---

## 3. Requisiti

- Windows 10/11 (target primario).
- Node.js 20+ (verificato con Node 26).
- Rust stable con toolchain MSVC (verificato con Rust 1.99).
- Visual Studio 2022 Build Tools con workload **Desktop development with C++**
  (necessario per linkare Tauri su Windows).
- WebView2 (normalmente già presente su Windows 11).

---

## 4. Avvio

```powershell
npm install
npm run desktop:dev
```

`npm run desktop:dev` avvia Vite sulla porta `1420` e apre la finestra Tauri.
Il database viene creato al primo avvio in:

```
%APPDATA%\com.tecca.codeoflegends\tecca-codeoflegends.sqlite3
```

Il percorso esatto è visibile e copiabile da **Impostazioni → Database locale**.

I log tecnici (errori del database e dell'interfaccia) sono scritti in:

```
%LOCALAPPDATA%\com.tecca.codeoflegends\logs\tecca-codeoflegends.log
```

Rotazione a 1 MB, 5 file conservati, timestamp UTC. Restano sul dispositivo.
Se il database non può essere aperto, l'app si avvia comunque e mostra un
errore esplicito con il percorso dei log.

### Solo frontend nel browser

```powershell
npm run dev
```

In questa modalità il backend non è disponibile: la dashboard mostra lo stato
"Anteprima browser", il database risulta non disponibile e i salvataggi sono
disabilitati. È un comportamento voluto, non un fallback che simula successo.

---

## 5. Comandi

```powershell
npm run dev              # Vite dev server (browser)
npm run build            # typecheck + build produzione
npm run preview          # anteprima build
npm run typecheck        # solo TypeScript
npm run lint             # oxlint
npm test                 # Vitest (logica pura, dataset DEMO, navigazione)
npm run test:rust        # cargo test (database su file temporanei)
# Verifica live su Data Dragon reale (rete, ~2 minuti): import completo,
# confronto 1:1 con l'elenco ufficiale dei campioni, controllo di ~2.100 immagini
cargo test --manifest-path src-tauri/Cargo.toml live_data_dragon_import -- --ignored --nocapture

npm run desktop:dev      # app Tauri completa
npm run desktop:build    # bundle Windows (NSIS)

npm run check:rust       # cargo check
npm run lint:rust        # cargo clippy -D warnings
npm run fmt:rust         # cargo fmt
```

Verifica completa prima di considerare concluso un task:

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

---

## 6. Struttura

```
src/
  app/            router, providers, registry moduli
  components/     UI, layout, feedback, shared
  features/       un modulo per cartella (dashboard, champions, jungle,
                  players, matches, analysis, matchups, live, settings…)
  hooks/          hook TanStack Query
  lib/            utils, errori, gateway Tauri, query client
  services/       unico punto di accesso a invoke e URL esterni
  stores/         Zustand (solo UI)
  types/          contratti Zod
src-tauri/
  src/            main, lib, commands, db, backup, error, catalog, ddragon,
                  riot, analysis, live, jungle
  migrations/     SQL append-only
  capabilities/   permessi Tauri
docs/             ARCHITECTURE, ROADMAP, DATABASE, RIOT_COMPLIANCE,
                  LIVE_GAME, MATCH_ANALYSIS
scripts/          generazione icone
```

Dettagli e confini architetturali: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
Piano di sviluppo e criteri di uscita: [`docs/ROADMAP.md`](ROADMAP.md).

---

## 7. Regole dati

1. Nessun dato inventato viene mostrato come reale.
2. Ogni dato esterno futuro avrà fonte, patch/versione e timestamp di recupero.
3. Gli stati vuoti sono espliciti; i moduli non pronti dichiarano di non esserlo.
4. Gli errori sono mostrati con messaggio comprensibile; il dettaglio tecnico
   resta nei log locali.
5. Le preferenze sono realmente persistite, non solo memorizzate in memoria.

Queste regole sono vincolanti e sono ripetute in [`AGENTS.md`](AGENTS.md).

---

## 8. Conformità Riot Games

Il progetto rispetta i seguenti vincoli:

- nessuna API key Riot nel frontend, nel repository, nei file di build o nei log;
- nessun accesso alla memoria del processo di gioco (niente hook, injection,
  pattern scanning o debugger);
- nessuna modifica ai file del gioco o del client;
- nessuna automazione di gameplay o manipolazione dell'input;
- solo API pubbliche/documentate e dati consentiti;
- rispetto di rate limit, Terms of Service e policy Riot;
- eventuale overlay solo come finestra Tauri separata, trasparente e non
  interattiva sul gioco.

Le integrazioni Riot sono esclusivamente lato Rust, con chiave gestita tramite
OS credential store. Verifica completa: [docs/RIOT_COMPLIANCE.md](RIOT_COMPLIANCE.md).

---

## 9. Sicurezza

- CSP restrittiva in `src-tauri/tauri.conf.json`: quella di produzione non
  include il dev server, che resta solo in `devCsp`.
- Capabilities Tauri minime:
  - finestra `main`: `core:event:default`, `opener:allow-open-url` con scope
    limitato ai domini in allowlist, `log:allow-log`;
  - finestra `overlay`: `core:event:default`, `log:allow-log`.
  Il test `release_tests` blocca `core:default`, `shell:`, `fs:`, `http:` e
  `process:`.
- Nessun permesso shell generico.
- Link esterni solo verso `developer.riotgames.com`, `www.riotgames.com` e
  `www.leagueoflegends.com` (note patch), tramite allowlist applicata sia in
  `src/services/external-service.ts` sia nella capability opener.
- Messaggi di errore per l'utente senza dettagli tecnici; il dettaglio va nei
  log locali.
- Input validati sia in TypeScript (Zod) sia in Rust.
- `.env` e credenziali ignorati da Git.

---

## 10. Problemi noti e soluzioni

| Problema | Causa | Soluzione |
| --- | --- | --- |
| `npm.ps1 cannot be loaded` | Execution policy PowerShell | Usare `npm.cmd` oppure `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `Option 'baseUrl' has been removed` | TypeScript 7 | Non usare `baseUrl`; gli alias vivono solo in `paths` e in `vite.config.ts` |
| `Cannot find package 'esbuild'` in build | Vite 8 non include più esbuild | Lasciare `minify` booleano in `vite.config.ts` |
| `link.exe not found` durante `cargo check` | Manca il workload C++ | Installare VS 2022 Build Tools con `Microsoft.VisualStudio.Workload.VCTools` |
| Chunk JS > 500 kB | Dipendenze UI concentrate | Avviso non bloccante; i grafici sono già separati in chunk lazy |
| SmartScreen all'installazione | Installer non firmato | Vedi § 0.6 |

---

## 11. Licenza

`package.json` dichiara MIT, ma il file `LICENSE` non è ancora presente (vedi
§ 0.6). Il progetto non è affiliato a Riot Games. League of Legends è un
marchio di Riot Games, Inc.
