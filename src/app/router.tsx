import { AlertTriangle } from "lucide-react";
import {
  createHashRouter,
  isRouteErrorResponse,
  RouterProvider,
  useRouteError,
} from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { BuildBuilderPage } from "@/features/builds/build-builder-page";
import { ChampionDetailPage } from "@/features/champions/champion-detail-page";
import { ChampionsPage } from "@/features/champions/champions-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { JungleRoutesPage } from "@/features/jungle/jungle-routes-page";
import { LiveGamePage } from "@/features/live/live-game-page";
import { MatchAnalysisPage } from "@/features/analysis/match-analysis-page";
import { MatchHistoryPage } from "@/features/matches/match-history-page";
import { MatchupsPage } from "@/features/matchups/matchups-page";
import { NotFoundPage } from "@/features/system/not-found-page";
import { PlayerProfilePage } from "@/features/players/player-profile-page";
import { PlayersPage } from "@/features/players/players-page";
import { RuneBuilderPage } from "@/features/runes/rune-builder-page";
import { SettingsPage } from "@/features/settings/settings-page";

function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "La rotta richiesta non è disponibile.";

  return (
    <div className="app-backdrop flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="font-display text-xl font-semibold">
          Navigazione interrotta
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => window.location.assign("#/")}>
          Torna alla dashboard
        </Button>
      </div>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "champions", element: <ChampionsPage /> },
      { path: "champions/:championId", element: <ChampionDetailPage /> },
      { path: "runes", element: <RuneBuilderPage /> },
      { path: "builds", element: <BuildBuilderPage /> },
      { path: "jungle", element: <JungleRoutesPage /> },
      { path: "players", element: <PlayersPage /> },
      { path: "players/:puuid", element: <PlayerProfilePage /> },
      { path: "matches", element: <MatchHistoryPage /> },
      { path: "analysis", element: <MatchAnalysisPage /> },
      { path: "matchups", element: <MatchupsPage /> },
      { path: "live", element: <LiveGamePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
