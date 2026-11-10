import {
  ArrowUpRight,
  Database,
  Settings2,
  ShieldOff,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AVAILABLE_MODULE_COUNT, MODULES } from "@/app/navigation";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePrimaryProfile } from "@/hooks/use-riot";
import { useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { soloRankLabel } from "@/lib/profile-label";
import { RIOT_REGIONS } from "@/types/system";

function RuneArtwork() {
  return (
    <div className="pointer-events-none absolute -top-24 -right-20 hidden size-[430px] opacity-90 lg:block">
      <svg viewBox="0 0 320 320" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="hero-rune" x1="60" y1="30" x2="270" y2="290">
            <stop offset="0%" stopColor="var(--primary-soft)" stopOpacity="0.9" />
            <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="hero-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="160" cy="160" r="132" fill="url(#hero-core)" />
        <circle
          cx="160"
          cy="160"
          r="142"
          stroke="url(#hero-rune)"
          strokeOpacity="0.35"
          strokeDasharray="2 9"
          className="origin-center animate-orbit-slow"
        />
        <circle
          cx="160"
          cy="160"
          r="112"
          stroke="url(#hero-rune)"
          strokeOpacity="0.5"
          strokeDasharray="38 12 4 12"
          className="origin-center animate-orbit"
        />
        <path
          d="M160 54 253 108v104L160 266 67 212V108L160 54Z"
          stroke="url(#hero-rune)"
          strokeWidth="1.2"
          strokeOpacity="0.7"
        />
        <path
          d="M160 84 226 122v76l-66 38-66-38v-76l66-38Z"
          stroke="url(#hero-rune)"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />
        <path
          d="M130 132h60M160 132v66"
          stroke="url(#hero-rune)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="160" cy="132" r="4" fill="var(--secondary)" />
        <circle cx="130" cy="132" r="2.5" fill="var(--primary-soft)" />
        <circle cx="190" cy="132" r="2.5" fill="var(--primary-soft)" />
        <circle cx="160" cy="198" r="2.5" fill="var(--secondary)" />
        <circle cx="253" cy="160" r="3" fill="var(--primary)" />
        <circle cx="67" cy="160" r="2" fill="var(--secondary)" />
      </svg>
    </div>
  );
}

export function WelcomePanel() {
  const { data } = useSystemSnapshot();
  const { data: profile } = usePrimaryProfile();
  const regionLabel =
    RIOT_REGIONS.find((region) => region.value === data?.settings.region)
      ?.label ?? "Non impostata";

  return (
    <section className="panel-sheen relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-surface-raised via-surface to-surface-muted shadow-hero">
      <div className="hero-secondary-glow pointer-events-none absolute inset-0" />
      <RuneArtwork />

      <div className="relative z-10 grid gap-6 p-6 sm:p-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.85fr)] xl:items-center">
        <div className="flex min-w-0 flex-col">
          <Badge variant="secondary" className="w-fit">
            <Sparkles className="size-3" />
            Beta · {AVAILABLE_MODULE_COUNT} moduli su {MODULES.length} attivi
          </Badge>

          <p className="mt-5 font-mono text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
            Welcome to
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.9rem,3.1vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.04em]">
            TECCA <span className="text-gradient">CODEOFLEGENDS</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Il companion desktop per League of Legends che parte da dati reali,
            architettura locale e trasparenza totale. Nessun profilo inventato,
            nessuna statistica simulata: ciò che non è ancora collegato viene
            dichiarato, non nascosto.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Button asChild>
              <Link to="/settings">
                <Settings2 className="size-4" />
                Configura l'app
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/champions">
                Esplora i moduli
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>

          <dl className="mt-7 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
            <div>
              <dt className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
                Moduli attivi
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold text-foreground">
                {AVAILABLE_MODULE_COUNT}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  / {MODULES.length}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
                Storage
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold text-foreground">
                Locale
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
                API key client
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold text-secondary">
                Zero
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative rounded-xl border border-white/[0.07] bg-background/45 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Profilo Riot</p>
            <Badge variant="outline">
              <span className={profile ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-warning"} />
              {profile ? "Collegato" : "Non collegato"}
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <ProfileAvatar iconUrl={profile?.profileIconUrl} className="size-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {profile ? `${profile.gameName}#${profile.tagLine}` : "Nessun account collegato"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Regione: {profile ? profile.region.toUpperCase() : regionLabel}
                {profile?.summonerLevel ? ` · livello ${profile.summonerLevel}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="size-3.5" />
                Rank attuale
              </span>
              <span className="font-mono text-[10px] text-foreground">
                {profile ? soloRankLabel(profile) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                {profile ? <Database className="size-3.5" /> : <ShieldOff className="size-3.5" />}
                Fonte
              </span>
              <span className={profile ? "text-[10px] text-secondary" : "text-[10px] text-warning"}>
                {profile ? profile.source : "Nessuna"}
              </span>
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/70">
            {profile
              ? `${profile.matches.length} partite salvate sul dispositivo. Si aggiorna da solo quando apri il client di League.`
              : "Apri il client di League of Legends: il tuo account viene collegato in automatico, senza chiave API."}
          </p>

          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            {profile ? (
              <Link to={`/players/${encodeURIComponent(profile.puuid)}`}>Apri il profilo</Link>
            ) : (
              <Link to="/settings">Configura il profilo</Link>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
