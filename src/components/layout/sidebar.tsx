import {
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { getModuleById, MAIN_NAVIGATION_MODULES } from "@/app/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { StatusDot, type StatusTone } from "@/components/shared/status-dot";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePrimaryProfile } from "@/hooks/use-riot";
import { useClientAccountStatus } from "@/hooks/use-client-account";
import { useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { profileSubtitle } from "@/lib/profile-label";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

const settingsModule = getModuleById("settings");

export function Sidebar() {
  const { data, isError, refetch, isFetching } = useSystemSnapshot();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore(
    (state) => state.toggleSidebarCollapsed,
  );
  const setProfileOpen = useUiStore((state) => state.setProfileOpen);
  const primary = usePrimaryProfile().data ?? null;
  const { pathname } = useLocation();

  const isPathActive = (path: string) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`);

  const databaseTone: StatusTone = isError
    ? "danger"
    : data?.database.state === "ready"
      ? "success"
      : "warning";

  const databaseLabel =
    data?.runtime === "browser"
      ? "Anteprima browser"
      : data?.database.state === "ready"
        ? "SQLite connesso"
        : "Database non disponibile";

  const clientStatus = useClientAccountStatus();
  const keyConfigured = data?.riot.state === "configured";
  const clientConnected = clientStatus.data?.state === "connected";
  const riotLabel = keyConfigured
    ? "Riot connesso"
    : clientConnected
      ? "Account dal client"
      : "Riot non collegato";

  return (
    <aside
      style={{ width: collapsed ? 76 : "clamp(248px, 17vw, 312px)" }}
      className="relative z-20 hidden shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-sidebar/95 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/[0.07] to-transparent" />

      <div
        className={cn(
          "relative flex items-center gap-3 px-4 pt-5 pb-4",
          collapsed && "flex-col gap-2.5 px-2",
        )}
      >
        <NavLink
          to="/"
          aria-label="Tecca CodeOfLegends — Dashboard"
          className={cn(
            "group/logo flex min-w-0 items-center gap-3 rounded-xl outline-none",
            collapsed && "justify-center",
          )}
        >
          <span className="relative shrink-0">
            <span className="absolute inset-0 rounded-full bg-primary/20 opacity-0 blur-xl transition-opacity duration-300 group-hover/logo:opacity-100" />
            <LogoMark className="relative size-9 transition-transform duration-300 group-hover/logo:scale-105" />
          </span>
          {!collapsed ? (
            <span className="min-w-0 leading-none">
              <span className="block font-mono text-[9px] font-semibold tracking-[0.34em] text-muted-foreground uppercase">
                Tecca
              </span>
              <span className="mt-1 block truncate font-display text-[14px] font-semibold tracking-tight text-foreground">
                Code<span className="text-primary">Of</span>Legends
              </span>
            </span>
          ) : null}
        </NavLink>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={
                collapsed ? "Espandi la sidebar" : "Comprimi la sidebar"
              }
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/[0.08] hover:text-primary",
                !collapsed && "ml-auto",
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "bottom"}>
            {collapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {!collapsed ? (
        <div className="relative px-5 pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.18em] text-primary uppercase">
            <Sparkles className="size-2.5" />
            Beta
          </span>
        </div>
      ) : null}

      <ScrollArea className="relative min-h-0 flex-1">
        <nav
          className={cn("space-y-1 pb-4", collapsed ? "px-2" : "px-3")}
          aria-label="Navigazione principale"
        >
          {MAIN_NAVIGATION_MODULES.map((module) => {
            const Icon = module.icon;
            const active = isPathActive(module.path);

            const link = (
              <NavLink
                key={module.id}
                to={module.path}
                end={module.path === "/"}
                className={cn(
                  "group relative flex items-center rounded-lg text-[13px] font-medium outline-none transition-[background-color,color] duration-200",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-primary/[0.13] text-white"
                    : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
                    active
                      ? "scale-y-100 opacity-100 shadow-nav-indicator"
                      : "scale-y-50 opacity-0",
                  )}
                />
                <Icon
                  className={cn(
                    "size-[17px] shrink-0 transition-colors",
                    active
                      ? "text-primary-soft"
                      : "text-muted-foreground/70 group-hover:text-foreground",
                  )}
                />
                {!collapsed ? (
                  <span className="flex-1 truncate">
                    {module.navigationLabel}
                  </span>
                ) : null}
                {!collapsed && module.status === "planned" ? (
                  <span
                    className="size-1 rounded-full bg-muted-foreground/35"
                    aria-label="Modulo pianificato"
                  />
                ) : null}
              </NavLink>
            );

            if (!collapsed) {
              return link;
            }

            return (
              <Tooltip key={module.id}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">
                  {module.navigationLabel}
                  {module.status === "planned" ? " · pianificato" : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </ScrollArea>

      <div
        className={cn(
          "relative shrink-0 border-t border-white/[0.06]",
          collapsed ? "space-y-1.5 p-2" : "space-y-2 p-3",
        )}
      >
        {!collapsed ? (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Stato locale</span>
              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label="Aggiorna stato del sistema"
              >
                <RefreshCw
                  className={cn(
                    "size-3",
                    isFetching ? "animate-spin text-primary" : "",
                  )}
                />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <StatusDot
                  tone={databaseTone}
                  pulse={databaseTone === "success"}
                />
                <span className="truncate">{databaseLabel}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <StatusDot tone={keyConfigured || clientConnected ? "success" : "warning"} />
                {keyConfigured ? "Riot" : clientConnected ? "Client" : "Riot off"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                  aria-label={`${databaseLabel}. Aggiorna stato`}
                >
                  <span className="relative">
                    <Database className="size-4" />
                    <span className="absolute -top-1 -right-1">
                      <StatusDot tone={databaseTone} />
                    </span>
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {databaseLabel}
                {isFetching ? " · aggiornamento…" : ""}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex size-9 items-center justify-center rounded-lg text-muted-foreground">
                  <span className="relative">
                    <Radio className="size-4" />
                    <span className="absolute -top-1 -right-1">
                      <StatusDot
                        tone={
                          data?.riot.state === "configured"
                            ? "success"
                            : "warning"
                        }
                      />
                    </span>
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">{riotLabel}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {settingsModule ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={settingsModule.path}
                className={cn(
                  "group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-200",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  isPathActive(settingsModule.path)
                    ? "bg-primary/[0.13] text-white"
                    : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all",
                    isPathActive(settingsModule.path)
                      ? "scale-y-100 opacity-100"
                      : "scale-y-50 opacity-0",
                  )}
                />
                <Settings2
                  className={cn(
                    "size-[17px] shrink-0",
                    isPathActive(settingsModule.path)
                      ? "text-primary-soft"
                      : "text-muted-foreground/70 group-hover:text-foreground",
                  )}
                />
                {!collapsed ? <span>Settings</span> : null}
              </NavLink>
            </TooltipTrigger>
            {collapsed ? (
              <TooltipContent side="right">Settings</TooltipContent>
            ) : null}
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className={cn(
                "group flex w-full items-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-left transition-colors hover:border-primary/25 hover:bg-primary/[0.06]",
                collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2",
              )}
              aria-label="Apri profilo utente"
            >
              <ProfileAvatar iconUrl={primary?.profileIconUrl} />
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-foreground">
                    {primary ? `${primary.gameName}#${primary.tagLine}` : "Profilo"}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {primary ? profileSubtitle(primary) : "Non collegato"}
                  </span>
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "top"}>
            {primary ? `${primary.gameName}#${primary.tagLine}` : "Profilo non collegato"}
          </TooltipContent>
        </Tooltip>

        <p
          className={cn(
            "text-center font-mono text-[9px] tracking-[0.16em] text-muted-foreground/40 uppercase",
            collapsed && "text-[8px] tracking-[0.08em]",
          )}
        >
          v
          {data?.appVersion ?? "—"}
          {!collapsed ? " · beta" : ""}
        </p>
      </div>
    </aside>
  );
}
