import { Compass, Home, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

export function NotFoundPage() {
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="flex justify-center">
          <LogoMark className="size-14" />
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Errore 404</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Questa rotta non esiste
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            Il modulo che cerchi non è stato ancora costruito o il percorso non
            è valido.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">
              <Home className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setCommandOpen(true)}>
            <Search className="size-4" />
            Cerca moduli
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/settings">
              <Compass className="size-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
