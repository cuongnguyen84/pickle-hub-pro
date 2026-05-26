// ============================================================================
// MatchDuprStatus — render the DUPR sync state of a match (PR4)
// ----------------------------------------------------------------------------
// Reads matches.dupr_sync_status + related columns and shows:
//   - "Submitted to DUPR" badge + link to mydupr.com when status='submitted'
//   - "Submitting…" inline spinner when status='pending'
//   - Red "Failed" badge + retry button (admin/recorded_by only) when
//     status='failed', with the truncated error message in the tooltip
//   - "Superseded" badge when status='superseded'
//   - Nothing at all when status is NULL
//
// Compact (md size) and standalone — drop anywhere on the match detail page.
// All copy bilingual.
// ============================================================================

import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export type DuprSyncStatus = "pending" | "submitted" | "failed" | "superseded" | null;

export interface MatchDuprStatusProps {
  matchId: string;
  status: DuprSyncStatus;
  duprMatchId: string | null;
  duprHashedMatchCode: string | null;
  duprSyncError: string | null;
  /** True when the viewer can hit retry (admin or recorded_by). */
  canRetry: boolean;
  /** Optional callback after a retry to refresh the parent's data. */
  onRetried?: () => void;
}

function duprLink(matchCode: string | null, hashed: string | null) {
  // DUPR uses hashedMatchCode for share URLs; fall back to matchCode if
  // hashed is missing.
  const code = hashed ?? matchCode;
  if (!code) return null;
  return `https://mydupr.com/dupr/match/${code}`;
}

export function MatchDuprStatus({
  matchId,
  status,
  duprMatchId,
  duprHashedMatchCode,
  duprSyncError,
  canRetry,
  onRetried,
}: MatchDuprStatusProps) {
  const { language } = useI18n();
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  if (!status) return null;

  const link = duprLink(duprMatchId, duprHashedMatchCode);

  const onRetry = async () => {
    setRetrying(true);
    setRetryMessage(null);
    try {
      const { error } = await supabase.functions.invoke("dupr-match-submit", {
        body: {
          action: "create",
          internal_source: "match",
          internal_match_id: matchId,
        },
      });
      if (error) {
        const fnError = error as { context?: { status?: number }; message?: string };
        setRetryMessage(fnError.message ?? "retry_failed");
      } else {
        setRetryMessage(language === "vi" ? "Đã gửi lại" : "Resubmitted");
        onRetried?.();
      }
    } catch (e) {
      setRetryMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        {language === "vi" ? "Đang gửi DUPR…" : "Submitting to DUPR…"}
      </Badge>
    );
  }

  if (status === "submitted") {
    return (
      <div className="inline-flex items-center gap-2">
        <Badge variant="default" className="gap-1.5 bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          {language === "vi" ? "Đã gửi DUPR" : "Submitted to DUPR"}
          {duprMatchId && (
            <span className="ml-1 font-mono text-[10px] opacity-90">
              {duprMatchId}
            </span>
          )}
        </Badge>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            {language === "vi" ? "Xem trên DUPR" : "View on DUPR"}
          </a>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <TooltipProvider>
        <div className="inline-flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {language === "vi" ? "Gửi DUPR thất bại" : "DUPR submit failed"}
              </Badge>
            </TooltipTrigger>
            {duprSyncError && (
              <TooltipContent className="max-w-xs">
                <code className="break-words text-xs">{duprSyncError}</code>
              </TooltipContent>
            )}
          </Tooltip>
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={retrying}
              className="h-7 px-2 text-xs"
            >
              {retrying ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-3 w-3" />
              )}
              {language === "vi" ? "Thử lại" : "Retry"}
            </Button>
          )}
          {retryMessage && (
            <span className="text-xs text-muted-foreground">{retryMessage}</span>
          )}
        </div>
      </TooltipProvider>
    );
  }

  if (status === "superseded") {
    return (
      <Badge variant="outline" className="gap-1.5">
        {language === "vi"
          ? "Đã xoá khỏi DUPR"
          : "Removed from DUPR"}
      </Badge>
    );
  }

  return null;
}

export default MatchDuprStatus;
