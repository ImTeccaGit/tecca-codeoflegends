import { CheckCircle2, ExternalLink, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClearRiotKey, useRiotKeyStatus, useSetRiotKey, useVerifyRiotKey } from "@/hooks/use-riot";
import { getErrorMessage } from "@/lib/errors";
import { openExternalUrl } from "@/services/external-service";
import { isRiotAvailable } from "@/services/riot-service";
import { riotApiKeySchema } from "@/types/riot";
import type { RiotRegion } from "@/types/system";

async function openPortal() {
  try {
    await openExternalUrl("https://developer.riotgames.com");
  } catch (error) {
    toast.error(getErrorMessage(error));
  }
}

/**
 * Write-only Riot API key form. The key goes straight to the Rust backend,
 * which stores it in the Windows Credential Manager; the webview never reads
 * it back, and it is never kept in React state after submitting.
 */
export function RiotKeyCard({ region }: { region: RiotRegion }) {
  const status = useRiotKeyStatus();
  const save = useSetRiotKey();
  const clear = useClearRiotKey();
  const verify = useVerifyRiotKey();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const available = isRiotAvailable();
  const configured = status.data?.configured === true;

  const submit = () => {
    const parsed = riotApiKeySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Chiave non valida");
      return;
    }
    setError(null);
    save.mutate(parsed.data, { onSettled: () => setDraft("") });
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold text-foreground">Chiave API Riot</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Necessaria per cercare account e partite. Le chiavi di sviluppo si
              generano sul Riot Developer Portal e scadono dopo 24 ore.
            </p>
          </div>
        </div>
        <Badge variant={configured ? "success" : "warning"}>
          {!available
            ? "Solo app desktop"
            : configured
              ? status.data?.source === "environment"
                ? "Da RIOT_API_KEY"
                : "Configurata"
              : "Non configurata"}
        </Badge>
      </div>

      {available ? (
        <>
          {status.data?.environmentOverrides ? (
            <p className="rounded-lg border border-secondary/20 bg-secondary/[0.05] px-3 py-2 text-[11px] text-muted-foreground">
              È impostata la variabile d'ambiente RIOT_API_KEY: ha la precedenza
              sulla chiave salvata qui.
            </p>
          ) : null}

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Label htmlFor="riot-api-key" className="text-xs">
              {configured ? "Sostituisci la chiave" : "Incolla la chiave"}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="riot-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                aria-describedby="riot-api-key-help"
                aria-invalid={error ? true : undefined}
              />
              <Button type="submit" disabled={!draft || save.isPending}>
                <ShieldCheck className="size-4" />
                {save.isPending ? "Salvataggio…" : "Salva"}
              </Button>
            </div>
            {error ? <p role="alert" className="text-[11px] text-destructive">{error}</p> : null}
            <p id="riot-api-key-help" className="text-[10px] leading-relaxed text-muted-foreground/80">
              Viene salvata nella Gestione credenziali di Windows dal backend:
              non resta nell'interfaccia, non viene mai mostrata, registrata nei
              log o scritta nel database.
            </p>
          </form>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!configured || verify.isPending}
              onClick={() => verify.mutate(region)}
            >
              <CheckCircle2 className="size-3.5" />
              {verify.isPending ? "Verifica…" : "Verifica chiave"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={status.data?.source !== "credential_store" || clear.isPending}
              onClick={() => clear.mutate(undefined)}
            >
              <Trash2 className="size-3.5" />
              Rimuovi chiave salvata
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void openPortal()}>
              Riot Developer Portal
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Nell'anteprima browser non c'è backend: la chiave si configura
          nell'app desktop.
        </p>
      )}
    </div>
  );
}
