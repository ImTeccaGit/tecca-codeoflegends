import { ImageOff, Palette } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChampionSkin } from "@/types/catalog";

/**
 * Data Dragon lists base skins and some chroma variants together, and does
 * not publish art for every entry. Images load lazily; when Data Dragon has
 * no image for an entry it moves to a separate, honest list — no placeholder
 * art is ever shown in its place.
 */
export function SkinGallery({ skins }: { skins: ChampionSkin[] }) {
  const [missing, setMissing] = useState<ReadonlySet<number>>(() => new Set());
  const [selected, setSelected] = useState<ChampionSkin | null>(null);
  const [splashFailed, setSplashFailed] = useState(false);

  const visible = skins.filter((skin) => !missing.has(skin.num));
  const withoutImage = skins.filter((skin) => missing.has(skin.num));

  const markMissing = (num: number) =>
    setMissing((current) => new Set(current).add(num));

  return (
    <div className="space-y-4">
      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-3"
        aria-label="Skin con immagine"
      >
        {visible.map((skin) => (
          <li key={skin.id}>
            <button
              type="button"
              onClick={() => {
                setSplashFailed(false);
                setSelected(skin);
              }}
              className="card-lift group relative block w-full overflow-hidden rounded-xl border border-white/[0.06] bg-surface-raised text-left outline-none"
              aria-label={`Apri ${skin.name}`}
            >
              <img
                src={skin.loadingUrl}
                alt=""
                width={308}
                height={560}
                loading="lazy"
                decoding="async"
                onError={() => markMissing(skin.num)}
                className="aspect-[308/560] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent px-2.5 pt-8 pb-2">
                <span className="line-clamp-2 text-[11px] leading-tight font-semibold text-foreground">
                  {skin.name}
                </span>
                {skin.hasChromas ? (
                  <span className="mt-1 inline-flex items-center gap-1 font-mono text-[8px] tracking-[0.12em] text-secondary uppercase">
                    <Palette className="size-2.5" />
                    Chroma
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {withoutImage.length > 0 ? (
        <details className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
            <ImageOff className="size-3.5 text-muted-foreground" />
            Varianti senza immagine ufficiale ({withoutImage.length})
          </summary>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Voci presenti in Data Dragon (spesso varianti chroma) per cui Data
            Dragon non pubblica un'immagine.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {withoutImage.map((skin) => (
              <li
                key={skin.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {skin.name}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-4xl gap-3 p-3">
          <DialogTitle className="px-1 pt-1">{selected?.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Splash art ufficiale da Riot Data Dragon.
          </DialogDescription>
          {selected && !splashFailed ? (
            <img
              src={selected.splashUrl}
              alt={selected.name}
              width={1215}
              height={717}
              onError={() => setSplashFailed(true)}
              className="aspect-[1215/717] w-full rounded-xl object-cover"
            />
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-xs text-muted-foreground">
              Data Dragon non pubblica la splash art di questa voce.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
