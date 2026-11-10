# Match Analysis & Matchups

Modulo della Fase 6. L'analisi è **post-partita** e si basa solo sulle partite
reali salvate in locale dalla Riot API (match-v5) per un profilo salvato.
Nessun dato DEMO, nessuna fonte di terze parti, nessuna percentuale stimata.

## 1. Dati

| Dato | Origine |
| --- | --- |
| K/D/A, CS, oro, visione, danni ai campioni, oggetti, rune, ruolo | `match_participants` (match-v5) |
| Danni subiti | `match_participants.damage_taken` (`totalDamageTaken`, dalla migrazione 0007) |
| Kill della squadra (per la kill participation) | Somma delle kill dei partecipanti con lo stesso `teamId` |
| Avversario di corsia | Partecipante della squadra opposta con lo stesso `teamPosition`, solo se è **univoco** |
| Alleati e nemici | Gli altri partecipanti della partita |
| Ban | `match_bans` (`info.teams[].bans`, dalla migrazione 0007) |
| Patch | `major.minor` di `gameVersion` |
| Oggetti "completati" | Data Dragon: nessun potenziamento successivo, almeno 900 oro, non consumabile né trinket |
| Rank attuale | league-v4 (solo informativo) |

La migrazione `0007_match_analysis.sql` completa le partite già salvate leggendo
`matches.raw_json`, cioè la risposta originale di Riot. Se un campo manca nella
risposta resta `NULL`, e l'interfaccia lo mostra come "non fornito da Riot".

## 2. Calcoli

Sono tutti funzioni pure in `src/features/analysis/lib/analysis.ts` e
`src/features/matchups/lib/matchups.ts`, coperte da test Vitest.

| Statistica | Formula |
| --- | --- |
| KDA (partita) | (K + A) / max(D, 1) |
| KDA (aggregato) | (ΣK + ΣA) / max(ΣD, 1) |
| Win rate | vittorie / partite |
| Intervallo di confidenza | Wilson al 95% |
| CS/min, oro/min (aggregati) | Σ valore / Σ minuti giocati |
| Kill participation | Σ(K + A) / Σ kill della squadra, solo sulle partite in cui la squadra ha fatto almeno una kill; massimo 100% |
| Medie di danni | Solo sulle partite in cui il dato esiste; viene indicato "media su N di M partite" |
| Win rate mobile | Ultime 10 partite |

Sotto **5 partite** un win rate viene marcato come poco affidabile (asterisco
nelle tabelle, badge "Pochi dati" nelle card, barre chiare nei grafici).

## 3. Affidabilità mostrata

Ogni vista mostra un riquadro con:

- fonte (Riot API · match-v5);
- patch coinvolte;
- numero di partite analizzate;
- periodo (prima e ultima partita);
- metodo dell'intervallo di confidenza.

## 4. Filtri

Campione, ruolo, patch, modalità (coda), periodo (7/30/90 giorni o tutto) e
numero di partite (le ultime 10/20/50 o tutte, applicato dopo gli altri filtri).
I filtri sono salvati nell'URL.

**Fascia classificata: non disponibile.** match-v5 non riporta il rank dei
giocatori al momento della partita. Usare il rank attuale per le partite
passate sarebbe un dato inventato, quindi il filtro resta disattivato e la
pagina spiega il motivo.

## 5. Matchups: cosa c'è e cosa no

| Richiesta | Stato | Motivo |
| --- | --- | --- |
| Campione selezionato, avversario, ruolo | Implementato | Avversari affrontati davvero in corsia |
| Win rate del matchup | Implementato, **solo sulle tue partite** | Con numerosità e intervallo di confidenza |
| Pick rate e ban rate | Implementati **solo nelle tue partite** | Il campione presente in una delle due squadre, o bannato |
| Win/pick/ban rate globali | **Non disponibili** | La Riot API ufficiale non fornisce statistiche aggregate; niente fonti di terze parti non verificate |
| Counter | Implementato | Avversari di corsia ordinati dal win rate più basso (prima quelli con dati sufficienti) |
| Sinergie | Implementate | Alleati con cui hai giocato |
| Rune "consigliate" | Mostrate come **rune che hai usato** | Una raccomandazione richiederebbe dati globali |
| Build associate | **Oggetti completati** a fine partita, con frequenza | L'ordine di acquisto richiede la timeline match-v5, non usata |
| Schede dei campioni | Implementate | Ritratto, titolo e classi da Data Dragon |

## 6. Test

- **Rust** (`src-tauri/src/analysis/tests.rs`):
  - associazione partita–campione;
  - avversario di corsia, anche ambiguo o assente;
  - kill di squadra, alleati, nemici e ban;
  - dati mancanti;
  - ordine delle partite;
  - backfill della migrazione 0007 da `raw_json`.
- **Vitest**:
  - KDA, win rate, CS/min, oro/min e kill participation;
  - intervallo di Wilson;
  - filtri singoli e combinati, limite di partite, filtri dall'URL;
  - raggruppamenti per campione e ruolo;
  - serie dei grafici (cumulativo, mobile, settimane);
  - provenienza dei dati;
  - matchup, counter, sinergie, rune, oggetti e presenza.
