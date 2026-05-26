// ============================================================================
// EventMatchesCard — list + log matches trong social event.
// ----------------------------------------------------------------------------
// Section nằm dưới CTA card trong SocialEventDetail. Bất kỳ ai cũng xem
// được lịch sử match (RPC public-readable). Nút "+ Ghi nhận trận" chỉ
// active khi viewer là organizer hoặc registered player (server cũng
// kiểm tra lại trong log_social_event_match).
//
// Organizer-only:
//   - Nút "Gửi DUPR" trên mỗi match có winning_team + submitted_to_dupr=false.
//   - Toggle ready_for_dupr (đẩy vào queue) — chia sẻ RPC mark_match_ready_for_dupr
//     đã được mở rộng ở migration 20260526120100.
// ============================================================================

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useSocialEventMatches,
  type SocialEventMatchRow,
} from "@/hooks/useSocialEventMatches";
import { LogEventMatchDialog } from "./LogEventMatchDialog";
import { SubmitEventMatchDuprDialog } from "./SubmitEventMatchDuprDialog";

interface Props {
  eventId: string;
  /** Viewer được phép log trận (organizer hoặc registered player). */
  canLog: boolean;
  /** Viewer là organizer của event — gate hành động Gửi DUPR. */
  isOrganizer: boolean;
  /** Profile id của viewer khi đã đăng nhập (prefill team A player 1). */
  selfProfileId?: string | null;
}

function formatTeamLine(players: SocialEventMatchRow["team_a_players"]): string {
  return players.map((p) => p.display_name ?? "—").join(" / ");
}

function formatScoreLine(a: number[], b: number[]): string {
  const games = Math.min(a.length, b.length);
  const parts: string[] = [];
  for (let i = 0; i < games; i++) {
    parts.push(`${a[i] ?? 0}-${b[i] ?? 0}`);
  }
  return parts.join(", ");
}

function formatPlayedAt(iso: string, lang: "vi" | "en"): string {
  try {
    return new Date(iso).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function EventMatchesCard({ eventId, canLog, isOrganizer, selfProfileId }: Props) {
  const { t, language } = useI18n();
  const copy = t.socialEvents.eventDupr.matches;

  const { matches } = useSocialEventMatches(eventId);
  const [logOpen, setLogOpen] = useState(false);
  const [submitDialogMatch, setSubmitDialogMatch] = useState<SocialEventMatchRow | null>(null);
  const queryClient = useQueryClient();

  const readyMutation = useMutation<
    boolean,
    { code: string; message: string },
    { matchId: string; ready: boolean }
  >({
    mutationFn: async ({ matchId, ready }) => {
      const { data, error } = await supabase.rpc("mark_match_ready_for_dupr", {
        p_match_id: matchId,
        p_ready: ready,
      });
      if (error) {
        const msg = String(error.message ?? "").trim();
        throw { code: msg, message: msg };
      }
      return Boolean(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["social-event-matches", eventId],
      });
    },
  });

  async function toggleReady(match: SocialEventMatchRow) {
    try {
      await readyMutation.mutateAsync({ matchId: match.id, ready: !match.ready_for_dupr });
      toast({
        title: !match.ready_for_dupr
          ? t.socialEvents.matches.readyOn
          : t.socialEvents.matches.readyOff,
      });
    } catch (e) {
      const errCode = (e as { code?: string })?.code ?? "";
      const msg =
        errCode === "not_authorized"
          ? t.socialEvents.managers.errNotAuthorized
          : errCode === "already_submitted"
            ? t.socialEvents.matches.errAlreadySubmitted
            : t.socialEvents.matches.toggleError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Card className="p-5 mb-6">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 8,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{copy.heading}</h3>
        {canLog && (
          <Button type="button" size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {copy.logCta}
          </Button>
        )}
      </div>

      {matches.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--tl-fg-3)", margin: 0 }}>
          {canLog ? copy.emptyCanLog : copy.empty}
        </p>
      ) : (
        <ol style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
          {matches.map((match) => {
            const aWins = match.winning_team === "a";
            const bWins = match.winning_team === "b";
            return (
              <li
                key={match.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--tl-border)",
                  background: "var(--tl-surface, rgba(0,0,0,0.02))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 6,
                    fontSize: 12,
                    color: "var(--tl-fg-3)",
                  }}
                >
                  <span>{formatPlayedAt(match.played_at, language)}</span>
                  <span>·</span>
                  <span>
                    {match.format === "singles"
                      ? t.socialEvents.matches.formatSingles
                      : match.format === "doubles"
                        ? t.socialEvents.matches.formatDoubles
                        : t.socialEvents.matches.formatMixed}
                  </span>
                  {match.submitted_to_dupr ? (
                    <Badge variant="default">{copy.submittedBadge}</Badge>
                  ) : match.ready_for_dupr ? (
                    <Badge variant="secondary">{copy.readyBadge}</Badge>
                  ) : (
                    <Badge variant="outline">{copy.draftBadge}</Badge>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: aWins ? 600 : 400 }}>
                      {formatTeamLine(match.team_a_players)} {aWins && "✓"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: bWins ? 600 : 400, marginTop: 2 }}>
                      {formatTeamLine(match.team_b_players)} {bWins && "✓"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatScoreLine(match.team_a_score, match.team_b_score)}
                  </div>
                </div>

                {match.dupr_match_id && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--tl-fg-3)" }}>
                    DUPR matchCode:{" "}
                    <code style={{ fontFamily: "'Geist Mono', monospace" }}>
                      {match.dupr_match_id}
                    </code>
                  </div>
                )}

                {isOrganizer && !match.submitted_to_dupr && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleReady(match)}
                      disabled={readyMutation.isPending}
                    >
                      {readyMutation.isPending && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {match.ready_for_dupr ? copy.unmarkReadyCta : copy.markReadyCta}
                    </Button>
                    {match.winning_team !== null && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setSubmitDialogMatch(match)}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> {copy.sendToDuprCta}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <LogEventMatchDialog
        eventId={eventId}
        open={logOpen}
        onOpenChange={setLogOpen}
        defaultSelfProfileId={selfProfileId ?? null}
      />

      {submitDialogMatch && (
        <SubmitEventMatchDuprDialog
          match={submitDialogMatch}
          eventId={eventId}
          open={submitDialogMatch !== null}
          onOpenChange={(open) => {
            if (!open) setSubmitDialogMatch(null);
          }}
        />
      )}
    </Card>
  );
}
