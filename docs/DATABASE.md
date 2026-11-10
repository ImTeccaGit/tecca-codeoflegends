# Database locale (SQLite)

TECCA CODEOFLEGENDS salva tutti i dati sul dispositivo, in un unico file
SQLite gestito **solo** dal backend Rust. Il frontend non accede mai al file.

## 1. Posizione

| Elemento | Percorso |
| --- | --- |
| Database | `%APPDATA%\com.tecca.codeoflegends\tecca-codeoflegends.sqlite3` |
| File WAL temporanei | Stessa cartella, suffissi `-wal` e `-shm` |
| Backup | `%APPDATA%\com.tecca.codeoflegends\backups\` |
| Log tecnici | `%LOCALAPPDATA%\com.tecca.codeoflegends\logs\` |

Il percorso esatto si vede e si copia da **Impostazioni → Database locale**.
La cartella dipende dall'identificatore `com.tecca.codeoflegends`, non dal nome
dell'app: rinominare il prodotto non sposta né perde i dati.

## 2. Creazione e apertura

All'avvio (`Database::open` in `src-tauri/src/db.rs`):

1. crea la cartella, se manca;
2. apre il file (lo crea, se manca) con `journal_mode = WAL`,
   `foreign_keys = ON` e `busy_timeout = 5000`;
3. **controlla la compatibilità**: se il file ha uno schema più recente di
   quello che questa versione conosce, cioè è stato creato da una release
   successiva, l'apertura viene rifiutata **senza modificare nulla**;
4. **fa un backup prima di migrare**: se il database esiste e lo schema è più
   vecchio, crea un backup verificato (`pre-migration`);
5. applica le migrazioni mancanti, ognuna in una transazione;
6. registra l'avvio nel log attività e tiene solo gli ultimi 200 eventi.

Se un passaggio fallisce l'app **resta aperta in modalità degradata**: ogni
funzione che usa il database mostra un errore chiaro con il percorso dei log,
mentre il dettaglio tecnico finisce nel file di log. Nessun fallback simula un
successo.

## 3. Migrazioni

- File append-only in `src-tauri/migrations/`, elencati in ordine in
  `MIGRATIONS` (`db.rs`). La versione dello schema è in `PRAGMA user_version`.
- Una migrazione già rilasciata **non si modifica mai**: ogni cambiamento è un
  nuovo file più una nuova voce nell'elenco.
- Ogni migrazione gira in `BEGIN … COMMIT` insieme all'aggiornamento di
  `user_version`; in caso di errore si fa `ROLLBACK` e il database resta alla
  versione precedente.
- Le tabelle sono `STRICT`. I timestamp sono ISO 8601 UTC generati da SQLite.

| Versione | Migrazione | Contenuto |
| --- | --- | --- |
| 1 | `0001_init` | Impostazioni, campioni, build, rune, partite, note, log attività |
| 2 | `0002_defaults` | Valori predefiniti delle impostazioni |
| 3 | `0003_data_dragon_catalog` | Catalogo Data Dragon versionato per patch |
| 4 | `0004_user_champion_lanes` | Preferiti e corsie scelte dall'utente |
| 5 | `0005_jungle_training` | Percorsi e tentativi di allenamento jungle |
| 6 | `0006_riot_player_data` | Giocatori, rank, partite match-v5, profili salvati |
| 7 | `0007_match_analysis` | Danni subiti e ban; backfill da `raw_json` |
| 8 | `0008_client_source` | Fonte di ogni partita (`riot-api` o `league-client`) e ultima lettura dal client |
| 9 | `0009_global_stats` | Statistiche globali opt-in: impostazioni, giocatori di partenza, partite Solo/Duo compatte, partecipanti e ban |
| 10 | `0010_global_timeline` | Ordine abilità, oggetti iniziali e acquisti dalla timeline match-v5; copia delle partite personali (`seed_tier = 'PERSONAL'`) |

## 4. Persistenza

Sono salvati e sopravvivono al riavvio e agli aggiornamenti dell'app:

- impostazioni (regione, animazioni, rilevamento Live, overlay, account
  automatico dal client, cartella di League, Riot ID visto in partita);
- catalogo Data Dragon;
- preferiti e corsie;
- percorsi e tentativi jungle;
- profili e partite Riot;
- log attività.

Le chiavi API **non** sono nel database: stanno nella Gestione credenziali di
Windows (vedi `RIOT_COMPLIANCE.md`).

La disinstallazione **non** cancella la cartella dati, a meno che tu non
selezioni l'opzione dell'uninstaller che elimina i dati dell'applicazione.

## 5. Backup

| Tipo | Quando |
| --- | --- |
| `pre-migration` | Automatico, prima di aggiornare lo schema di un database esistente |
| `manual` | **Impostazioni → Backup del database → Crea backup ora** |

- Il backup è fatto con `VACUUM INTO`: una copia coerente e compatta, creata
  anche con l'app in uso.
- Ogni copia viene riaperta in sola lettura e controllata con
  `PRAGMA integrity_check`; una copia non integra viene eliminata e segnalata.
- Nome del file: `tecca-codeoflegends-<tipo>-<AAAAMMGG-HHMMSSmmm>-v<schema>.sqlite3`.
- Si conservano gli ultimi **10** backup; i più vecchi vengono rimossi.

### Ripristino (manuale, voluto)

L'app non sovrascrive mai da sola il database in uso. Per ripristinare:

1. chiudi TECCA CODEOFLEGENDS;
2. in `%APPDATA%\com.tecca.codeoflegends\` rinomina
   `tecca-codeoflegends.sqlite3` (per esempio in `…-old.sqlite3`) e rimuovi gli
   eventuali file `-wal` e `-shm`;
3. copia il backup scelto da `backups\` nella cartella e rinominalo
   `tecca-codeoflegends.sqlite3`;
4. riavvia l'app. Se il backup ha uno schema più vecchio viene migrato in
   automatico, e prima viene fatto un nuovo backup.

Un backup creato da una versione **più recente** dell'app non si apre con una
versione precedente: è il controllo di compatibilità del punto 2.

## 6. Test

In `src-tauri/src/db.rs`, `backup.rs` e nei test dei moduli, sempre su file
temporanei e mai sul database reale:

- creazione di un database nuovo con i valori predefiniti;
- persistenza dopo la riapertura, senza rieseguire le migrazioni;
- validazione delle impostazioni;
- backup pre-migrazione da uno schema v6 e nessun backup su un database nuovo;
- rifiuto di un database creato da una versione più recente, lasciato intatto;
- backup manuale verificato e leggibile, rotazione a 10 file, file estranei
  ignorati;
- backfill della migrazione 0007.
