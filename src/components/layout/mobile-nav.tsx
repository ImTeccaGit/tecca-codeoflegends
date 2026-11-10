import { Settings2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { getModuleById, MAIN_NAVIGATION_MODULES } from "@/app/navigation";
import { LogoWordmark } from "@/components/brand/logo-mark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { usePrimaryProfile } from "@/hooks/use-riot";
import { profileSubtitle } from "@/lib/profile-label";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const settingsModule = getModuleById("settings");

export function MobileNav() {
  const open = useUiStore((state) => state.mobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);
  const setProfileOpen = useUiStore((state) => state.setProfileOpen);
  const primary = usePrimaryProfile().data ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-[290px] max-w-[86vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-l-0 border-r-white/10 bg-sidebar p-0"
      >
        <DialogHeader className="border-b border-white/[0.06] px-5 py-5 text-left">
          <LogoWordmark />
          <DialogTitle className="sr-only">Navigazione</DialogTitle>
          <DialogDescription className="sr-only">
            Scegli un modulo di Tecca CodeOfLegends.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <nav
            className="space-y-1 px-3 py-5"
            aria-label="Navigazione mobile"
          >
            {MAIN_NAVIGATION_MODULES.map((module) => {
              const Icon = module.icon;

              return (
                <NavLink
                  key={module.id}
                  to={module.path}
                  end={module.path === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-primary/[0.13] text-white"
                        : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all",
                          isActive
                            ? "scale-y-100 opacity-100"
                            : "scale-y-50 opacity-0",
                        )}
                      />
                      <Icon
                        className={cn(
                          "size-[17px]",
                          isActive
                            ? "text-primary-soft"
                            : "text-muted-foreground/70",
                        )}
                      />
                      <span className="flex-1 truncate">
                        {module.navigationLabel}
                      </span>
                      {module.status === "planned" ? (
                        <span className="size-1 rounded-full bg-muted-foreground/35" />
                      ) : null}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="space-y-2 border-t border-white/[0.06] p-3">
          {settingsModule ? (
            <NavLink
              to={settingsModule.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-primary/[0.13] text-white"
                    : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Settings2
                    className={cn(
                      "size-[17px]",
                      isActive ? "text-primary-soft" : "text-muted-foreground/70",
                    )}
                  />
                  Settings
                </>
              )}
            </NavLink>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setProfileOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-primary/25 hover:bg-primary/[0.06]"
          >
            <ProfileAvatar iconUrl={primary?.profileIconUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-foreground">
                {primary ? `${primary.gameName}#${primary.tagLine}` : "Profilo"}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {primary ? profileSubtitle(primary) : "Non collegato"}
              </span>
            </span>
          </button>

          <p className="text-center font-mono text-[9px] tracking-[0.16em] text-muted-foreground/50 uppercase">
            TECCA CODEOFLEGENDS · Beta
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
