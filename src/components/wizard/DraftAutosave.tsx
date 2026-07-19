// ============================================================================
// Draft autosave UI (UX-04) — the two pieces every wizard shares:
//   <DraftRestoredBanner onStartOver={…} />  — shown once after a restore
//   <DraftSaveStatus lastSavedAt={…} saveFailed={…} />  — "last saved" line
// Copy contract (proposal §5): autosave is device-local, the label must say
// so ("trên thiết bị") — never imply cross-device sync.
// ============================================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function DraftRestoredBanner({ onStartOver }: { onStartOver: () => void }) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
    >
      <span>{t.drafts.restoredBanner}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onStartOver();
            setDismissed(true);
          }}
        >
          {t.drafts.startOver}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          OK
        </Button>
      </div>
    </div>
  );
}

/**
 * One reserved line above the wizard's action buttons — height is constant
 * whether or not anything has saved yet, so the buttons never jump.
 */
export function DraftSaveStatus({
  lastSavedAt,
  saveFailed,
}: {
  lastSavedAt: number | null;
  saveFailed: boolean;
}) {
  const { t } = useI18n();
  let text = "";
  if (saveFailed) {
    text = t.drafts.saveFailed;
  } else if (lastSavedAt) {
    const d = new Date(lastSavedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    text = t.drafts.savedLocalAt.replace("{time}", `${hh}:${mm}`);
  }
  return (
    <p
      aria-live="polite"
      className={`min-h-5 font-mono text-xs ${saveFailed ? "text-destructive" : "text-muted-foreground"}`}
    >
      {text}
    </p>
  );
}
