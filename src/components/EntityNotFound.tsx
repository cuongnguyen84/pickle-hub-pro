// ============================================================================
// EntityNotFound — shared 404 surface for missing clubs / events / profiles.
// ----------------------------------------------------------------------------
// Pages call <EntityNotFound entity="club" /> when the slug they tried to
// look up returned nothing. Renders inside TheLineLayout with noindex and
// a "back to listing" CTA tuned to the entity type so the viewer lands
// somewhere they can actually find what they were looking for.
// ============================================================================

import { Link } from "react-router-dom";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

type Entity = "club" | "event" | "profile";

interface Props {
  entity: Entity;
  active?: "events" | "clubs" | "live" | "videos" | "tournaments" | "blog" | "search" | "news" | "tools";
}

export function EntityNotFound({ entity, active }: Props) {
  const { t, language } = useI18n();
  const copy = t.socialEvents.entityNotFound[entity];
  const homeHref = language === "vi" ? "/vi" : "/";
  const backHref =
    entity === "club"
      ? "/clubs"
      : entity === "event"
        ? "/social"
        : homeHref;

  return (
    <TheLineLayout title={copy.title} active={active ?? "events"} noindex>
      <div
        className="tl-shell"
        style={{ padding: "60px 16px", textAlign: "center", maxWidth: 560, margin: "0 auto" }}
      >
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">404</div>
        <h1
          className="mt-3 font-serif italic"
          style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32 }}
        >
          {copy.title}
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--tl-fg-3)" }}>
          {copy.body}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="default">
            <Link to={backHref}>{copy.backCta}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={homeHref}>{language === "vi" ? "Về trang chủ" : "Back to home"}</Link>
          </Button>
        </div>
      </div>
    </TheLineLayout>
  );
}
