import {
  Bell,
  ChevronRight,
  CloudOff,
  Database,
  Menu,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getModuleByPath, NAV_GROUPS } from "@/app/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { useCatalogStatus } from "@/hooks/use-catalog";
import { useClientAccountStatus } from "@/hooks/use-client-account";
import { usePrimaryProfile } from "@/hooks/use-riot";
import { soloRankLabel } from "@/lib/profile-label";
import { useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { formatDateTime } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { RIOT_REGIONS } from "@/types/system";

export function TopBar() {
  const location = useLocation();
  const activeModule = getModuleByPath(location.pathname);
  const activeGroup = NAV_GROUPS.find(
    (group) => group.id === activeModule?.group,
  );
  const { data } = useSystemSnapshot();
  const { data: catalogStatus } = useCatalogStatus();
  const currentPatch = catalogStatus?.current ?? null;
  const primary = usePrimaryProfile().data ?? null;
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const profileOpen = useUiStore((state) => state.profileOpen);
  const setProfileOpen = useUiStore((state) => state.setProfileOpen);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const activity = data?.activity ?? [];
  const clientStatus = useClientAccountStatus();
  const keyConfigured = data?.riot.state === "configured";
  const clientConnected = clientStatus.data?.state === "connected";
  const riotConnected = keyConfigured || clientConnected;
  const regionLabel =
    RIOT_REGIONS.find((region) => region.value === data?.settings.region)
      ?.label ?? "Non impostata";

  return (
    <header className="relative z-30 flex h-[60px] shrink-0 items-center gap-2 border-b border-white/[0.06] bg-background/75 px-3 backdrop-blur-xl sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Apri navigazione"
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex min-w-0 items-center gap-2.5">
        <div className="min-w-0">
          <p className="hidden items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground/60 uppercase sm:flex">
            {activeGroup?.label ?? "Workspace"}
            <ChevronRight className="size-2.5 text-muted-foreground/35" />
            <span className="text-muted-foreground/80">Tecca</span>
          </p>
          {/* Not a heading: each page owns its single <h1>. */}
          <p className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
            {activeModule?.navigationLabel ?? "Tecca CodeOfLegends"}
          </p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/25 hover:bg-white/[0.045] hover:text-foreground"
          aria-label="Cerca moduli e sezioni"
        >
          <Search className="size-3.5 text-muted-foreground/70 transition-colors group-hover:text-primary" />
          <span className="flex-1 truncate">Cerca moduli e sezioni…</span>
          <kbd className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground/70">
            CTRL K
          </kbd>
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted-foreground sm:inline-flex">
              <span
                className={`size-1.5 rounded-full ${
                  riotConnected ? "bg-success" : "bg-warning"
                }`}
              />
              <Radio className="size-3" />
              {keyConfigured ? "Riot connesso" : clientConnected ? "Account dal client" : "Riot non collegato"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {data?.riot.message ?? "Stato Riot non disponibile"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted-foreground lg:inline-flex">
              {currentPatch ? (
                <Database className="size-3 text-secondary" />
              ) : (
                <CloudOff className="size-3" />
              )}
              Patch {currentPatch?.patch ?? "—"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {currentPatch
              ? `${currentPatch.source} ${currentPatch.version}, importata il ${formatDateTime(currentPatch.importedAt)}.`
              : "Nessuna patch Data Dragon importata. Nessun numero viene inventato."}
          </TooltipContent>
        </Tooltip>

        <Badge
          variant={data?.runtime === "browser" ? "warning" : "secondary"}
          className="hidden xl:inline-flex"
        >
          <span
            className={`size-1.5 rounded-full ${
              data?.runtime === "browser" ? "bg-warning" : "bg-secondary"
            }`}
          />
          {data?.runtime === "browser" ? "Browser" : "Desktop"}
        </Badge>

        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                aria-label={`Notifiche: ${activity.length} eventi`}
              >
                <Bell className="size-4.5" />
                {activity.length > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[8px] leading-4 font-bold text-primary-foreground">
                    {activity.length > 9 ? "9+" : activity.length}
                  </span>
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifiche</TooltipContent>
          </Tooltip>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                Notifiche
              </DialogTitle>
              <DialogDescription>
                Eventi reali registrati sul dispositivo. Nessuna notifica
                simulata.
              </DialogDescription>
            </DialogHeader>

            {activity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center">
                <ShieldCheck className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-xs font-semibold text-foreground">
                  Nessuna notifica
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Le attività dell'app compariranno qui con data e dettaglio.
                </p>
              </div>
            ) : (
              <ul className="-mx-1 max-h-[360px] space-y-1 overflow-y-auto px-1">
                {activity.slice(0, 12).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5"
                  >
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-surface-raised text-muted-foreground">
                      <Bell className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {entry.title}
                      </p>
                      {entry.detail ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                          {entry.detail}
                        </p>
                      ) : null}
                    </div>
                    <time
                      dateTime={entry.createdAt}
                      className="shrink-0 font-mono text-[9px] text-muted-foreground/50"
                    >
                      {formatDateTime(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="group relative ml-0.5 flex size-8 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary"
                aria-label="Apri profilo utente"
              >
                <ProfileAvatar iconUrl={primary?.profileIconUrl} className="size-full border-0" />
                <span
                  className={`absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background ${primary ? "bg-success" : "bg-warning"}`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {primary ? `${primary.gameName}#${primary.tagLine}` : "Profilo non collegato"}
            </TooltipContent>
          </Tooltip>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Profilo utente</DialogTitle>
              <DialogDescription>
                {primary
                  ? "Profilo principale salvato: dati reali dalla Riot API, conservati sul dispositivo."
                  : "Nessun account fittizio: il profilo viene popolato solo con dati reali della Riot API."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <ProfileAvatar iconUrl={primary?.profileIconUrl} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {primary ? `${primary.gameName}#${primary.tagLine}` : "Profilo non collegato"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {primary
                    ? `${primary.region.toUpperCase()}${primary.summonerLevel ? ` · livello ${primary.summonerLevel}` : ""}`
                    : `Regione configurata: ${regionLabel}`}
                </p>
              </div>
              <Badge variant={primary ? "secondary" : "outline"}>
                {primary ? "Riot API" : "Offline"}
              </Badge>
            </div>

            <dl className="space-y-2 text-xs">
              <ProfileRow
                label="Account Riot"
                value={primary ? `${primary.gameName}#${primary.tagLine}` : "—"}
              />
              <ProfileRow label="Rank Solo/Duo" value={primary ? soloRankLabel(primary) : "—"} />
              <ProfileRow label="Patch" value={currentPatch?.patch ?? "—"} />
              <ProfileRow
                label="Partite locali"
                value={String(primary ? primary.matches.length : (data?.database.tableCounts.matches ?? 0))}
              />
              <ProfileRow
                label="Ultimo aggiornamento"
                value={primary?.sync.matchesSyncedAt ? formatDateTime(primary.sync.matchesSyncedAt) : "—"}
              />
              <ProfileRow
                label="Runtime"
                value={data?.runtime === "tauri" ? "Desktop" : "Browser"}
              />
              <ProfileRow
                label="Versione"
                value={`v${data?.appVersion ?? "—"}`}
              />
            </dl>

            <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Le chiamate alla Riot API passano solo dal backend Rust: il
              frontend non vede mai la chiave API.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild size="sm">
                <Link
                  to={primary ? `/players/${encodeURIComponent(primary.puuid)}` : "/players"}
                  onClick={() => setProfileOpen(false)}
                >
                  <UserRound className="size-3.5" />
                  {primary ? "Apri profilo" : "Cerca il tuo profilo"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings" onClick={() => setProfileOpen(false)}>
                  <Settings2 className="size-3.5" />
                  Impostazioni
                </Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="ml-0.5 text-muted-foreground"
            >
              <Link to="/settings" aria-label="Apri impostazioni">
                <Settings2 className="size-4.5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[10px] text-foreground">{value}</dd>
    </div>
  );
}
