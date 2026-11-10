import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export function BuildBuilderPage() {
  return (
    <FeaturePlaceholder
      moduleId="builds"
      note="Le build saranno composizioni dell'utente salvate in SQLite, non suggerimenti spacciati per statistiche reali finché non esisterà una fonte verificata."
      scope={[
        "Item core, situazionali e ordine di acquisto.",
        "Ordine abilità e note per fase di gioco.",
        "Build per campione e ruolo, con duplicazione.",
        "Confronto locale tra build salvate.",
      ]}
      prerequisites={[
        "Catalogo item reale da Data Dragon con cache.",
        "Tabelle builds con JSON validato e versionamento.",
        "Editor drag-and-drop accessibile e testato.",
      ]}
    />
  );
}
