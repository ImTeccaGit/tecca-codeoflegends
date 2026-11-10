import { ExternalLink, ShieldCheck, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CAMPS, OBJECTIVES, campOwnerLabel } from "@/features/jungle/data/camps";
import { getErrorMessage } from "@/lib/errors";
import { openExternalUrl } from "@/services/external-service";

const PATCH_NOTES_URL = "https://www.leagueoflegends.com/it-it/news/tags/patch-notes/";

async function openPatchNotes() {
  try {
    await openExternalUrl(PATCH_NOTES_URL);
  } catch (error) {
    toast.error(getErrorMessage(error));
  }
}

const GROUPS = [
  { title: "Buff", filter: (kind: string) => kind === "buff" },
  { title: "Campi", filter: (kind: string) => kind === "camp" },
  { title: "Fiume", filter: (kind: string) => kind === "scuttle" },
] as const;

/** Monsters and objectives with what is safe to state: names, sides, areas. */
export function MonstersInfo() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/[0.05] p-4">
        <TimerOff className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">
            Nessun tempo di spawn o respawn
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Riot non pubblica questi tempi in una fonte ufficiale strutturata e
            versionata, e cambiano tra patch. Per non mostrare valori inventati
            o superati, l'app non li indica: fai riferimento alle note patch
            ufficiali.
          </p>
          <Button variant="outline" size="sm" onClick={() => void openPatchNotes()}>
            Note patch ufficiali
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <p className="eyebrow mb-2">{group.title}</p>
            <ul className="space-y-1.5">
              {CAMPS.filter((camp) => group.filter(camp.kind) && camp.owner !== "red").map((camp) => (
                <li key={camp.id} className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">
                    {camp.name}
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                      {camp.owner === "river" ? campOwnerLabel(camp.owner) : "uno per lato"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {camp.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section>
        <p className="eyebrow mb-2">Obiettivi epici</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {OBJECTIVES.map((objective) => (
            <li key={objective.id} className="rounded-lg border border-warning/15 bg-warning/[0.03] px-3 py-2">
              <p className="text-xs font-semibold text-foreground">{objective.name}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                {objective.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-secondary/15 bg-secondary/[0.04] p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Modulo solo per l'allenamento: nessun timer di partita, nessun
          rilevamento del client, nessuna informazione nascosta e nessuna
          automazione. Le politiche Riot per gli sviluppatori vietano strumenti
          che diano informazioni non disponibili ai giocatori durante la
          partita; eventuali funzioni live verranno valutate solo dopo una
          verifica esplicita delle policy.
        </p>
      </div>
    </div>
  );
}
