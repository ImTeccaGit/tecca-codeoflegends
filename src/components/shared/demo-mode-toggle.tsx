import { FlaskConical } from "lucide-react";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

interface DemoModeToggleProps {
  className?: string;
  /** True when real data is available: DEMO is never mixed with it. */
  disabled?: boolean;
}

/** Switch for the session-only DEMO dataset. Off on every app start. */
export function DemoModeToggle({ className, disabled = false }: DemoModeToggleProps) {
  const id = useId();
  const demoMode = useUiStore((state) => state.demoMode);
  const setDemoMode = useUiStore((state) => state.setDemoMode);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-1.5 transition-colors duration-200",
        demoMode
          ? "border-dashed border-warning/40 bg-warning/[0.06]"
          : "border-white/[0.07] bg-white/[0.02]",
        className,
      )}
    >
      <FlaskConical
        aria-hidden="true"
        className={cn(
          "size-3.5 transition-colors",
          demoMode ? "text-warning" : "text-muted-foreground",
        )}
      />
      <Label htmlFor={id} className="cursor-pointer text-xs font-semibold">
        Modalità DEMO
      </Label>
      <Switch
        id={id}
        checked={demoMode && !disabled}
        disabled={disabled}
        onCheckedChange={setDemoMode}
        aria-describedby={`${id}-hint`}
      />
      <span id={`${id}-hint`} className="sr-only">
        {disabled
          ? "Non disponibile: la dashboard mostra già i tuoi dati reali."
          : "Mostra un set di dati dimostrativi etichettati. Non sono le tue partite e non vengono salvati."}
      </span>
    </div>
  );
}
