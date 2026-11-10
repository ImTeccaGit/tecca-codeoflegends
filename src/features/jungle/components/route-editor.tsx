import { ArrowDown, ArrowUp, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCamp, SIDE_LABELS, type CampId, type MapSide } from "@/features/jungle/data/camps";
import { useDeleteRoute, useSaveRoute } from "@/hooks/use-jungle";
import { cn } from "@/lib/utils";
import { routeInputSchema } from "@/types/jungle";

export interface RouteDraft {
  id?: string;
  name: string;
  side: MapSide;
  camps: CampId[];
  notes: string;
}

interface RouteEditorProps {
  draft: RouteDraft;
  onChange: (draft: RouteDraft) => void;
  onClose: (savedId?: string) => void;
}

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Custom route editor. Camps are added by clicking the map (handled by the
 * page) and can be reordered or removed here. Saved in SQLite.
 */
export function RouteEditor({ draft, onChange, onClose }: RouteEditorProps) {
  const save = useSaveRoute();
  const remove = useDeleteRoute();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const parsed = routeInputSchema.safeParse({
      id: draft.id,
      name: draft.name,
      side: draft.side,
      camps: draft.camps,
      notes: draft.notes.trim() || null,
      championId: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dati non validi");
      return;
    }
    setError(null);
    save.mutate(parsed.data, { onSuccess: (route) => onClose(route.id) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{draft.id ? "Modifica percorso" : "Nuovo percorso"}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Clicca i campi sulla mappa per aggiungerli o toglierli, nell'ordine
            in cui li farai.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onClose()} aria-label="Chiudi editor">
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="route-name" className="text-xs">Nome</Label>
        <Input
          id="route-name"
          value={draft.name}
          maxLength={60}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Es. Full clear con Scuttle"
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium">Lato di partenza</span>
        <div role="radiogroup" aria-label="Lato di partenza" className="grid grid-cols-2 gap-1">
          {(["blue", "red"] as const).map((side) => (
            <button
              key={side}
              type="button"
              role="radio"
              aria-checked={draft.side === side}
              onClick={() => onChange({ ...draft, side })}
              className={cn(
                "rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                draft.side === side
                  ? side === "blue"
                    ? "border-secondary/40 bg-secondary/[0.12] text-secondary"
                    : "border-destructive/40 bg-destructive/[0.12] text-destructive"
                  : "border-white/[0.07] text-muted-foreground hover:text-foreground",
              )}
            >
              {SIDE_LABELS[side]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium">Sequenza ({draft.camps.length})</p>
        {draft.camps.length === 0 ? (
          <p className="mt-1.5 rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[10px] text-muted-foreground">
            Nessun campo: clicca la mappa.
          </p>
        ) : (
          <ol className="mt-1.5 space-y-1">
            {draft.camps.map((id, index) => (
              <li key={id} className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">
                <span className="w-4 font-mono text-[10px] text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[11px]">
                  {getCamp(id).name}
                  {getCamp(id).owner !== "river" && getCamp(id).owner !== draft.side ? (
                    <span className="ml-1.5 font-mono text-[8px] text-warning uppercase">nemico</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onChange({ ...draft, camps: move(draft.camps, index, index - 1) })}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Sposta ${getCamp(id).name} prima`}
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={index === draft.camps.length - 1}
                  onClick={() => onChange({ ...draft, camps: move(draft.camps, index, index + 1) })}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Sposta ${getCamp(id).name} dopo`}
                >
                  <ArrowDown className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, camps: draft.camps.filter((camp) => camp !== id) })}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Rimuovi ${getCamp(id).name}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="route-notes" className="text-xs">Note (facoltative)</Label>
        <textarea
          id="route-notes"
          value={draft.notes}
          maxLength={500}
          rows={2}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          className="w-full resize-none rounded-lg border border-input bg-surface-muted/70 px-3 py-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/25"
          placeholder="Es. leash dalla bot lane, smite sul Gromp"
        />
      </div>

      {error ? (
        <p role="alert" className="text-[11px] text-destructive">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave} disabled={save.isPending}>
          <Save className="size-3.5" />
          {save.isPending ? "Salvataggio…" : "Salva percorso"}
        </Button>
        {draft.id ? (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" />
            Elimina
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare il percorso?</DialogTitle>
            <DialogDescription>
              "{draft.name}" verrà rimosso. I tentativi già registrati restano
              nello storico con la loro sequenza.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() => {
                if (!draft.id) return;
                remove.mutate(draft.id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    onClose();
                  },
                });
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
