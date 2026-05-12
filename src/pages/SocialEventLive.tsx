// ============================================================================
// SocialEventLive (`/su-kien/:slug/live`) — mobile-first 5-zone player screen
// ----------------------------------------------------------------------------
// Renders during a live social event. Reads the persisted match schedule
// (social_event_matches) + subscribes to realtime updates so every connected
// device updates as scores come in.
//
// Zones:
//   1. Now — the player's current/in-progress match (also the score-input form)
//   2. Next — the player's next scheduled match (read-only)
//   3. Standings — top 5 + highlight the current player
//   4. Score Input — folded into Zone 1 (single card to reduce vertical scrolling)
//   5. Zalo — link to the event group (only if event.zalo_group_url is set)
//
// Identification:
//   - Authenticated user: profile_id = auth.uid()
//   - Guest: magic_token in localStorage from PR2 RegistrationModal flow
//   - Neither: spectator mode (zones 1, 2, 4 hidden; standings + Zalo only)
// ============================================================================

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Trophy, ClipboardList, ExternalLink } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useSocialEvent } from "@/hooks/useSocialEvent";
import { useEventRegistrations } from "@/hooks/useEventRegistrations";
import { useEventLive, type LiveMatchRow, type MyRegistration } from "@/hooks/useEventLive";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { StandingRow } from "@/lib/social-events/standings";

interface PlayerNameMap {
  [profileId: string]: string;
}

function teamLabel(
  match: LiveMatchRow,
  team: "a" | "b",
  names: PlayerNameMap,
): string {
  const ids =
    team === "a"
      ? [match.team_a_player1_id, match.team_a_player2_id]
      : [match.team_b_player1_id, match.team_b_player2_id];
  return ids
    .map((id) => (id ? names[id] ?? "?" : "—"))
    .join(" & ");
}

interface MatchCardProps {
  match: LiveMatchRow;
  names: PlayerNameMap;
  language: "vi" | "en";
}

function MatchCard({ match, names, language }: MatchCardProps) {
  const live = (useI18n().t.socialEvents as { live: Record<string, string> }).live;
  const statusLabel =
    match.status === "completed"
      ? live.statusCompleted
      : match.status === "in_progress"
        ? live.statusInProgress
        : live.statusScheduled;
  const statusVariant: "default" | "secondary" | "outline" =
    match.status === "completed"
      ? "outline"
      : match.status === "in_progress"
        ? "default"
        : "secondary";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <Badge variant="outline">
          {live.round} {match.round}
        </Badge>
        <Badge variant="outline">
          {live.court} {match.court}
        </Badge>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      <div style={{ display: "grid", gap: 6, fontSize: 15 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span><strong>{teamLabel(match, "a", names)}</strong></span>
          <span style={{ fontFamily: "Geist Mono", fontWeight: 600 }}>
            {match.team_a_score ?? "—"}
          </span>
        </div>
        <div style={{ color: "var(--tl-fg-3)", fontSize: 12, textAlign: "center" }}>
          {language === "vi" ? "vs" : "vs"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span><strong>{teamLabel(match, "b", names)}</strong></span>
          <span style={{ fontFamily: "Geist Mono", fontWeight: 600 }}>
            {match.team_b_score ?? "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ScoreInputProps {
  match: LiveMatchRow;
  me: MyRegistration;
  isOrganizer: boolean;
  onSubmitted: () => void;
}

function ScoreInput({ match, me, isOrganizer, onSubmitted }: ScoreInputProps) {
  const { t } = useI18n();
  const live = t.socialEvents.live;
  const [a, setA] = useState<string>(
    match.team_a_score != null ? String(match.team_a_score) : "",
  );
  const [b, setB] = useState<string>(
    match.team_b_score != null ? String(match.team_b_score) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [organizerMode, setOrganizerMode] = useState(false);

  const onMyTeamA =
    match.team_a_player1_id === me.profile_id ||
    match.team_a_player2_id === me.profile_id;
  const onMyTeamB =
    match.team_b_player1_id === me.profile_id ||
    match.team_b_player2_id === me.profile_id;
  const inMatch = onMyTeamA || onMyTeamB;

  if (!inMatch && !isOrganizer) {
    return (
      <p style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
        {live.notInMatchToast}
      </p>
    );
  }

  async function handleSubmit(override = false) {
    const scoreA = Number(a);
    const scoreB = Number(b);
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
      toast({ title: live.scoreErrorToast, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        match_id: match.id,
        team_a_score: scoreA,
        team_b_score: scoreB,
        organizer_override: override,
      };
      if (!override) {
        body.registration_id = me.registration_id;
        body.magic_token = me.magic_token;
      }
      const { data, error } = await supabase.functions.invoke<{
        ok?: true;
        status?: string;
      }>("submit-match-score", { body });
      if (error || !data?.ok) {
        toast({ title: live.scoreErrorToast, variant: "destructive" });
        return;
      }
      toast({
        title:
          data.status === "completed" ? live.scoreCompletedToast : live.scoreToast,
      });
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  const myTeamConfirmed = onMyTeamA ? match.confirmed_by_team_a : match.confirmed_by_team_b;
  const otherTeamConfirmed = onMyTeamA ? match.confirmed_by_team_b : match.confirmed_by_team_a;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <Label htmlFor="score-a" style={{ fontSize: 12 }}>
            {teamLabel(match, "a", {})}
          </Label>
          <Input
            id="score-a"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={a}
            onChange={(e) => setA(e.target.value)}
            style={{ fontSize: 22, height: 56, textAlign: "center", fontFamily: "Geist Mono" }}
          />
        </div>
        <div>
          <Label htmlFor="score-b" style={{ fontSize: 12 }}>
            {teamLabel(match, "b", {})}
          </Label>
          <Input
            id="score-b"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={b}
            onChange={(e) => setB(e.target.value)}
            style={{ fontSize: 22, height: 56, textAlign: "center", fontFamily: "Geist Mono" }}
          />
        </div>
      </div>
      {inMatch && (
        <Button onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? live.submitting : live.submitScore}
        </Button>
      )}
      {inMatch && myTeamConfirmed && !otherTeamConfirmed && (
        <p style={{ fontSize: 13, color: "var(--tl-fg-3)", textAlign: "center" }}>
          {live.awaitingOpponent}
        </p>
      )}
      {inMatch && myTeamConfirmed && otherTeamConfirmed && (
        <p style={{ fontSize: 13, color: "var(--primary)", textAlign: "center" }}>
          {live.bothConfirmed}
        </p>
      )}
      {isOrganizer && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px dashed var(--tl-border, #22252a)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {!organizerMode ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setOrganizerMode(true)}
            >
              {live.organizerOverride}
            </Button>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "var(--tl-fg-3)", marginBottom: 8 }}>
                {live.organizerOverrideHint}
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {live.organizerOverride}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface StandingsTableProps {
  standings: StandingRow[];
  names: PlayerNameMap;
  myProfileId: string | null;
  limit?: number;
}

function StandingsTable({ standings, names, myProfileId, limit = 8 }: StandingsTableProps) {
  const { t } = useI18n();
  const live = t.socialEvents.live;
  const top = standings.slice(0, limit);
  if (top.length === 0) {
    return <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>—</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--tl-border, #22252a)", textAlign: "left" }}>
          <th style={{ padding: "8px 6px", width: 30, color: "var(--tl-fg-3)", fontSize: 12 }}>{live.colRank}</th>
          <th style={{ padding: "8px 6px", color: "var(--tl-fg-3)", fontSize: 12 }}>{live.colPlayer}</th>
          <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--tl-fg-3)", fontSize: 12 }}>{live.colWins}</th>
          <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--tl-fg-3)", fontSize: 12 }}>{live.colLosses}</th>
          <th style={{ padding: "8px 6px", textAlign: "center", color: "var(--tl-fg-3)", fontSize: 12 }}>{live.colDiff}</th>
        </tr>
      </thead>
      <tbody>
        {top.map((r, i) => {
          const isMe = r.player_id === myProfileId;
          return (
            <tr
              key={r.player_id}
              style={{
                borderBottom: "1px solid var(--tl-border, #22252a)",
                background: isMe ? "rgba(0, 185, 107, 0.08)" : undefined,
              }}
            >
              <td style={{ padding: "8px 6px", fontFamily: "Geist Mono", color: "var(--tl-fg-3)" }}>{i + 1}</td>
              <td style={{ padding: "8px 6px" }}>
                {names[r.player_id] ?? "?"}
                {isMe && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--primary)" }}>
                    ({live.youLabel})
                  </span>
                )}
              </td>
              <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "Geist Mono" }}>{r.wins}</td>
              <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "Geist Mono" }}>{r.losses}</td>
              <td
                style={{
                  padding: "8px 6px",
                  textAlign: "center",
                  fontFamily: "Geist Mono",
                  color:
                    r.point_diff > 0
                      ? "var(--primary)"
                      : r.point_diff < 0
                        ? "var(--destructive)"
                        : undefined,
                }}
              >
                {r.point_diff > 0 ? `+${r.point_diff}` : r.point_diff}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function SocialEventLive() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const live = t.socialEvents.live;
  const { user } = useAuth();
  const { data: event, isLoading: eventLoading } = useSocialEvent(slug);
  const { data: registrations } = useEventRegistrations(event?.id);
  const { data, isLoading, me, myStanding } = useEventLive(event?.id);

  const isOrganizer = Boolean(user && event && user.id === event.created_by);

  // Build a profile_id → display_name lookup from the registrations array.
  // Registrations have both profile_id (FK) and display_name; the matches
  // table references profile_id only.
  const playerNames = useMemo<PlayerNameMap>(() => {
    const map: PlayerNameMap = {};
    for (const r of registrations ?? []) {
      if (r.profile_id) map[r.profile_id] = r.display_name;
    }
    return map;
  }, [registrations]);

  if (eventLoading || isLoading) {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  if (!event) {
    return (
      <TheLineLayout title={t.socialEvents.detail.notFound} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{t.socialEvents.detail.notFound}</h1>
        </div>
      </TheLineLayout>
    );
  }

  const eventTitle = language === "vi" ? event.title_vi : (event.title_en || event.title_vi);
  const noSchedule = data.allMatches.length === 0;
  const spectator = !me && !isOrganizer;

  return (
    <TheLineLayout
      title={me ? `${live.pageTitle} — ${eventTitle}` : `${live.pageTitleSpectator} — ${eventTitle}`}
      active="events"
      noindex
    >
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">
            ◆{" "}
            <Link to={`/su-kien/${event.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
              {eventTitle}
            </Link>
          </div>
          <h1>{me ? live.pageTitle : live.pageTitleSpectator}</h1>
        </header>

        {noSchedule && (
          <Card className="p-6" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{live.noScheduleTitle}</h3>
            <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>{live.noScheduleBody}</p>
            {isOrganizer && (
              <div style={{ marginTop: 16 }}>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/su-kien/${event.slug}/xep-cap`}>
                    <ClipboardList className="mr-1 h-3.5 w-3.5" /> {live.organizerCta}
                  </Link>
                </Button>
              </div>
            )}
          </Card>
        )}

        {!noSchedule && spectator && (
          <Card className="p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {live.notRegisteredTitle}
            </h3>
            <p style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>{live.notRegisteredBody}</p>
          </Card>
        )}

        {/* Zone 1 — Now + Score Input merged */}
        {!noSchedule && me && (
          <Card className="p-5 mb-4">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--tl-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              {live.zoneNow}
            </h3>
            {data.currentMatch ? (
              <div style={{ display: "grid", gap: 16 }}>
                <MatchCard
                  match={data.currentMatch}
                  names={playerNames}
                  language={language}
                />
                <ScoreInput
                  match={data.currentMatch}
                  me={me}
                  isOrganizer={isOrganizer}
                  onSubmitted={() => {
                    // Realtime subscription will refetch; nothing local to do.
                  }}
                />
              </div>
            ) : (
              <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>{live.zoneNoNow}</p>
            )}
          </Card>
        )}

        {/* Zone 2 — Next */}
        {!noSchedule && me && (
          <Card className="p-5 mb-4">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--tl-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              {live.zoneNext}
            </h3>
            {data.nextMatch ? (
              <MatchCard match={data.nextMatch} names={playerNames} language={language} />
            ) : (
              <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>{live.zoneNoNext}</p>
            )}
          </Card>
        )}

        {/* Zone 3 — Standings */}
        {!noSchedule && (
          <Card className="p-5 mb-4">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--tl-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Trophy className="h-4 w-4" /> {live.zoneStandings}
            </h3>
            <StandingsTable
              standings={data.standings}
              names={playerNames}
              myProfileId={me?.profile_id ?? null}
            />
            {myStanding && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--tl-fg-3)" }}>
                {live.youLabel}: {myStanding.wins}W / {myStanding.losses}L ·{" "}
                {myStanding.point_diff > 0 ? `+${myStanding.point_diff}` : myStanding.point_diff}
              </p>
            )}
          </Card>
        )}

        {/* Zone 5 — Zalo */}
        {event.zalo_group_url && (
          <Card className="p-4 mb-4">
            <Button asChild variant="outline" className="w-full">
              <a href={event.zalo_group_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> {live.openZalo}
              </a>
            </Button>
          </Card>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24 }}>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/su-kien/${event.slug}`}>{live.backToEvent}</Link>
          </Button>
          {isOrganizer && (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/su-kien/${event.slug}/xep-cap`}>{live.organizerCta}</Link>
            </Button>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
}
