import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export function RuneBuilderPage() {
  return (
    <FeaturePlaceholder
      moduleId="runes"
      note="Il builder non mostrerà alberi runici finti. Le opzioni arriveranno da dati statici Riot e le pagine salvate saranno record reali nel database locale."
      scope={[
        "Selezione albero primario, secondario e frammenti.",
        "Validazione delle combinazioni consentite.",
        "Salvataggio, duplicazione e cancellazione delle pagine.",
        "Preset collegati a campione e ruolo, esportabili.",
      ]}
      prerequisites={[
        "Modello dati rune e vincoli di validazione condivisi.",
        "Tabelle rune_pages con migrazione e indici.",
        "Fonte statica Riot integrata lato backend.",
      ]}
    />
  );
}
