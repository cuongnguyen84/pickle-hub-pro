// ============================================================================
// MatchActions — Sprint 4 Phase 4B
// Real KudosButton (replaces Sprint 2 placeholder) + comment placeholder
// + Share button.
// ============================================================================

import { MessageCircle } from "lucide-react";
import { ShareSheet } from "../shared/ShareSheet";
import { KudosButton } from "@/components/social/KudosButton";
import { useMatchKudos } from "@/hooks/social/useKudos";
import { useI18n } from "@/i18n";
import type { MatchDetail } from "@/hooks/social";

export const MatchActions = ({ match }: { match: MatchDetail }) => {
  const { language } = useI18n();
  const { data: kudosState } = useMatchKudos(match.id);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/tran-dau/${match.slug}`
    : `https://www.thepicklehub.net/tran-dau/${match.slug}`;
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <KudosButton
          matchId={match.id}
          count={kudosState?.count ?? 0}
          kudoed={kudosState?.kudoed ?? false}
          variant="detail"
        />
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          aria-label={language === "vi" ? "Bình luận" : "Comments"}
          disabled
        >
          <MessageCircle className="h-4 w-4" />
          <span>0</span>
        </button>
      </div>
      <ShareSheet
        url={url}
        title={language === "vi" ? "Trận pickleball của tôi" : "My pickleball match"}
        text={
          language === "vi"
            ? `Trận của tôi: ${url}`
            : `Check out my match: ${url}`
        }
      />
    </div>
  );
};

export default MatchActions;
