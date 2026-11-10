import { Radio } from "lucide-react";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Badge } from "@/components/ui/badge";
import type { DataSource } from "@/types/dashboard";

interface DataSourceBadgeProps {
  source: DataSource;
  /** Optional suffix, e.g. a count: "DEMO · 20", "Riot API · 20". */
  detail?: string;
  /** Real source name; defaults to "Riot API". */
  name?: string;
}

/** Always tells the user where a value comes from: DEMO or the Riot API. */
export function DataSourceBadge({ source, detail, name = "Riot API" }: DataSourceBadgeProps) {
  if (source === "demo") {
    return <DemoBadge label={detail ? `DEMO · ${detail}` : "DEMO"} />;
  }
  return (
    <Badge variant="secondary" className="shrink-0" title={`Dati reali: ${name}`}>
      <Radio aria-hidden="true" />
      {detail ? `${name} · ${detail}` : name}
    </Badge>
  );
}
