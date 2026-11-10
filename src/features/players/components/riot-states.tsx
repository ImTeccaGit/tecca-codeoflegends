import { KeyRound, MonitorSmartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export function RiotDesktopOnly() {
  return (
    <EmptyState
      icon={MonitorSmartphone}
      title="Disponibile nell'app desktop"
      description="La Riot API è chiamata solo dal backend Rust, con la chiave salvata sul dispositivo. Nell'anteprima browser non c'è backend."
    />
  );
}

export function RiotKeyMissing() {
  return (
    <EmptyState
      icon={KeyRound}
      title="Ricerca giocatori: serve la chiave API Riot"
      description="Il tuo account si collega da solo quando apri il client di League (Impostazioni → Account automatico). Per cercare altri giocatori serve una chiave del Riot Developer Portal, salvata nella Gestione credenziali di Windows."
      action={
        <Button asChild size="sm">
          <Link to="/settings">
            <KeyRound className="size-3.5" />
            Configura la chiave
          </Link>
        </Button>
      }
    />
  );
}
