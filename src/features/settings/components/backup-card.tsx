import { ArchiveRestore, DatabaseBackup } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBackups, useCreateBackup } from "@/hooks/use-backups";
import { getErrorMessage } from "@/lib/errors";
import { isBackupAvailable } from "@/services/backup-service";

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "medium" });

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Manual backups plus the automatic ones made before each migration. */
export function BackupCard() {
  const backups = useBackups();
  const create = useCreateBackup();
  const available = isBackupAvailable();
  const list = backups.data ?? [];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Dati locali</p>
          <h2 className="mt-1 font-display text-sm font-semibold">Backup del database</h2>
        </div>
        <DatabaseBackup className="size-4 text-secondary" aria-hidden="true" />
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Copia verificata del database nella cartella <code className="font-mono">backups</code> accanto
        al file. Viene creata anche in automatico prima di ogni aggiornamento dello schema. Si
        conservano gli ultimi 10 backup.
      </p>

      <Button
        size="sm"
        className="mt-3 w-full"
        disabled={!available || create.isPending}
        onClick={() =>
          create.mutate(undefined, {
            onSuccess: (info) => toast.success(`Backup creato: ${info.fileName}`),
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      >
        <DatabaseBackup className="size-3.5" />
        {create.isPending ? "Backup in corso…" : "Crea backup ora"}
      </Button>

      {!available ? (
        <p className="mt-3 text-[11px] text-muted-foreground">Disponibile solo nell'app desktop.</p>
      ) : backups.isError ? (
        <p className="mt-3 text-[11px] text-destructive">{getErrorMessage(backups.error)}</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">Nessun backup presente.</p>
      ) : (
        <ul className="mt-3 space-y-1.5" aria-label="Backup disponibili">
          {list.slice(0, 5).map((backup) => (
            <li
              key={backup.fileName}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5 text-[11px]"
              title={backup.path}
            >
              <span className="min-w-0 truncate text-foreground">
                {dateTime.format(Date.parse(backup.createdAt))}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge variant={backup.reason === "manual" ? "outline" : "secondary"}>
                  {backup.reason === "manual" ? "Manuale" : "Pre-migrazione"}
                </Badge>
                <span className="font-mono text-muted-foreground">{formatSize(backup.sizeBytes)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
        <ArchiveRestore className="mt-px size-3 shrink-0" aria-hidden="true" />
        Ripristino: chiudi l'app, rinomina il file del database e copia al suo posto il backup
        scelto con il nome <code className="font-mono">tecca-codeoflegends.sqlite3</code> (guida in
        docs/DATABASE.md).
      </p>
    </Card>
  );
}
