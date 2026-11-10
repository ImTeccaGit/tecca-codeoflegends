import { AppWindow, Layers, MousePointerClick } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUpdateOverlay } from "@/hooks/use-live";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  OVERLAY_ANCHORS,
  OVERLAY_LIMITS,
  OVERLAY_THEMES,
  overlaySettingsSchema,
  type OverlayPatch,
  type OverlaySettings,
} from "@/types/live";

const ANCHOR_LABELS: Record<OverlaySettings["anchor"], string> = {
  "top-left": "In alto a sinistra",
  "top-right": "In alto a destra",
  "bottom-left": "In basso a sinistra",
  "bottom-right": "In basso a destra",
};

const THEME_LABELS: Record<OverlaySettings["theme"], string> = {
  tecca: "Tecca",
  minimal: "Minimal",
  contrast: "Alto contrasto",
};

function Choice<T extends string>({
  legend,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={option === value ? "secondary" : "outline"}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {labels[option]}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Overlay preferences. Remounted (via `key`) whenever the saved settings
 * change, so the local draft always starts from the persisted values.
 */
export function OverlaySettingsCard({ settings }: { settings: OverlaySettings }) {
  const update = useUpdateOverlay();
  const [draft, setDraft] = useState<OverlaySettings>(settings);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = (patch: OverlayPatch, success?: string) => {
    update.mutate(patch, {
      onSuccess: () => {
        if (success) {
          toast.success(success);
        }
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  const apply = () => {
    const parsed = overlaySettingsSchema.safeParse({ ...draft, visible: settings.visible });
    if (!parsed.success) {
      toast.error(
        "Valori non validi: controlla dimensioni (200–600 × 80–400), margini (0–2000) e opacità (30–100%).",
      );
      return;
    }
    const { visible: _visible, ...rest } = parsed.data;
    save(rest, "Impostazioni overlay salvate");
  };

  const set = <K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <Label htmlFor="overlay-visible" className="text-xs font-semibold">
              Mostra l'overlay
            </Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Finestra separata e opzionale. Chiusa = nessuna risorsa usata.
            </p>
          </div>
        </div>
        <Switch
          id="overlay-visible"
          checked={settings.visible}
          disabled={update.isPending}
          onCheckedChange={(visible) =>
            save({ visible }, visible ? "Overlay aperto" : "Overlay chiuso")
          }
        />
      </div>

      <Choice
        legend="Modalità"
        options={["overlay", "window"] as const}
        labels={{ overlay: "Overlay trasparente", window: "Finestra" }}
        value={draft.mode}
        onChange={(mode) => set("mode", mode)}
      />
      <p className="-mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        {draft.mode === "overlay" ? (
          <>
            <MousePointerClick className="mt-px size-3.5 shrink-0 text-secondary" />
            Sempre in primo piano, trasparente e “click-through”: mouse e
            tastiera passano al gioco. Si sposta solo da queste impostazioni.
          </>
        ) : (
          <>
            <AppWindow className="mt-px size-3.5 shrink-0 text-secondary" />
            Finestra normale con bordi: puoi spostarla, ridimensionarla o
            chiuderla. Non resta sopra il gioco.
          </>
        )}
      </p>

      <Choice
        legend="Posizione sullo schermo"
        options={OVERLAY_ANCHORS}
        labels={ANCHOR_LABELS}
        value={draft.anchor}
        onChange={(anchor) => set("anchor", anchor)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          id="overlay-width"
          label="Larghezza (px)"
          value={draft.width}
          min={OVERLAY_LIMITS.width.min}
          max={OVERLAY_LIMITS.width.max}
          onChange={(value) => set("width", value)}
        />
        <NumberField
          id="overlay-height"
          label="Altezza (px)"
          value={draft.height}
          min={OVERLAY_LIMITS.height.min}
          max={OVERLAY_LIMITS.height.max}
          onChange={(value) => set("height", value)}
        />
        <NumberField
          id="overlay-offset-x"
          label="Margine orizzontale"
          value={draft.offsetX}
          min={OVERLAY_LIMITS.offset.min}
          max={OVERLAY_LIMITS.offset.max}
          onChange={(value) => set("offsetX", value)}
        />
        <NumberField
          id="overlay-offset-y"
          label="Margine verticale"
          value={draft.offsetY}
          min={OVERLAY_LIMITS.offset.min}
          max={OVERLAY_LIMITS.offset.max}
          onChange={(value) => set("offsetY", value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="overlay-opacity" className="flex justify-between text-xs">
          Opacità <span className="tabular-nums text-muted-foreground">{Math.round(draft.opacity * 100)}%</span>
        </Label>
        <input
          id="overlay-opacity"
          type="range"
          min={OVERLAY_LIMITS.opacity.min}
          max={OVERLAY_LIMITS.opacity.max}
          step={0.05}
          value={draft.opacity}
          onChange={(event) => set("opacity", event.currentTarget.valueAsNumber)}
          className="w-full accent-primary"
        />
      </div>

      <Choice
        legend="Tema"
        options={OVERLAY_THEMES}
        labels={THEME_LABELS}
        value={draft.theme}
        onChange={(theme) => set("theme", theme)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={apply} disabled={!dirty || update.isPending}>
          Applica
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDraft(settings)}
          disabled={!dirty || update.isPending}
        >
          Annulla modifiche
        </Button>
        {dirty ? <Badge variant="warning">Modifiche non salvate</Badge> : null}
      </div>
      <p className={cn("text-[11px] text-muted-foreground")}>
        La posizione è calcolata sul monitor della finestra principale e resta
        sempre entro i bordi dello schermo.
      </p>
    </div>
  );
}
