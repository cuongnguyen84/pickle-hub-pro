// ============================================================================
// MatchActions — Sprint 2 Phase 3B.1
// Kudos count + comment count placeholders + Share button.
// ============================================================================

import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "../shared/ShareSheet";
import type { MatchDetail } from "@/hooks/social";

export const MatchActions = ({ match }: { match: MatchDetail }) => {
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/tran-dau/${match.slug}`
    : `https://www.thepicklehub.net/tran-dau/${match.slug}`;
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          aria-label="Kudos (Sprint 2 Phase 3B.2)"
          disabled
        >
          <Heart className="h-4 w-4" />
          <span>0</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          aria-label="Bình luận (Sprint 2 Phase 3B.2)"
          disabled
        >
          <MessageCircle className="h-4 w-4" />
          <span>0</span>
        </button>
      </div>
      <ShareSheet
        url={url}
        title="Trận pickleball của tôi"
        text={`Trận của tôi: ${url}`}
      />
    </div>
  );
};

export default MatchActions;
