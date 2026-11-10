import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NAVIGATION_MODULES } from "@/app/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

export function CommandMenu() {
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return NAVIGATION_MODULES;
    }

    return NAVIGATION_MODULES.filter((module) => {
      const haystack =
        `${module.label} ${module.navigationLabel} ${module.description} ${module.path}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  // Search state is reset when the palette closes, from the event itself.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setActiveIndex(0);
    }
    setOpen(next);
  };

  const openModule = (path: string) => {
    handleOpenChange(false);
    navigate(path);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          results.length === 0 ? 0 : (current + 1) % results.length,
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          results.length === 0
            ? 0
            : (current - 1 + results.length) % results.length,
        );
      }

      if (event.key === "Enter") {
        const selected = results[activeIndex];
        if (selected) {
          event.preventDefault();
          openModule(selected.path);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[16%] max-w-xl translate-y-0 gap-0 overflow-hidden border-white/10 p-0"
      >
        <DialogTitle className="sr-only">Cerca nell'app</DialogTitle>
        <DialogDescription className="sr-only">
          Cerca e apri un modulo di Tecca CodeOfLegends.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <Search className="size-4 text-primary" />
          {/* Radix Dialog focuses the first focusable element: this input. */}
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Cerca moduli, sezioni, funzioni…"
            className="h-7 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            aria-label="Cerca nell'app"
          />
          <kbd className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60">
            ESC
          </kbd>
        </div>

        <div className="max-h-[330px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nessun modulo trovato per “{query}”.
            </div>
          ) : (
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- WAI-ARIA listbox pattern for the command palette results.
            <ul role="listbox" aria-label="Risultati ricerca" className="space-y-0.5">
              {results.map((module, index) => {
                const Icon = module.icon;
                const isActive = index === activeIndex;

                return (
                  <li key={module.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openModule(module.path)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-primary/[0.12] text-foreground"
                          : "text-muted-foreground hover:bg-white/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md border",
                          isActive
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-white/[0.07] bg-white/[0.02] text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {module.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {module.description}
                        </span>
                      </span>
                      <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/50 uppercase">
                        Fase {String(module.phase).padStart(2, "0")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2.5 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-white/10 bg-black/20 px-1 py-0.5 font-mono text-[9px]">
              ↑↓
            </kbd>
            Naviga
          </span>
          <span className="flex items-center gap-1.5">
            <CornerDownLeft className="size-3" />
            Apri
          </span>
          <span className="ml-auto font-mono tracking-[0.14em] uppercase">
            {results.length} moduli
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
