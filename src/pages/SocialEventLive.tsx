// ============================================================================
// SocialEventLive (`/su-kien/:slug/live`) — mobile-first 5-zone player screen
// ----------------------------------------------------------------------------
// Renders during a live social event. Reads the persisted match schedule
// (social_event_matches) + subscribes to realtime updates so every connected
// device updates as scores come in.
//
// Zones:
//   1. Now — the identified player's current match. Three states:
//        a. They have an in_progress match  → MatchCard + ScoreInput
//        b. They have a scheduled match     → MatchCard + StartMatchCta
//        c. They have nothing pending       → "Đang nghỉ" placeholder
//   2. Next — the event-wide first scheduled match (visible to everyone,
//      including spectators).
//   3. Standings — every registered player (seeded 0-0 by useEventLive
//      until matches are completed), top 8 + highlight the current player.
//   4. Zalo — link to the event group (only if event.zalo_group_url is set).
//
// Identification:
//   - Authenticated user: profile_id = auth.uid()
//   - Guest: magic_token in localStorage from PR2 RegistrationModal flow
//   - Neither: spectator mode (Now zone hidden; Next + Standings still
//     render so anyone with the URL can follow the event).
// ============================================================================

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Trophy, ClipboardList, ExternalLink, PlayCircle } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
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
  /** Resolved registration row when the viewer is a registered player. */
  me: MyRegistration | null;
  /** True when the viewer is event organizer OR has admin role. */
  canManage: boolean;
  /** Map for rendering team labels (profile_id → display_name). */
  names: PlayerNameMap;
  onSubmitted: () => void;
}

/**
 * Score-input form shown on an in_progress match. Self-gates:
 *   - 4 match players (identified via `me.profile_id`) get the "Confirm
 *     score" button which routes through submit-match-score's player path
 *     (two-team confirm).
 *   - Organizers + admins get the override panel (expand → submit →
 *     match completes unilaterally).
 *   - A spectator viewing someone else's match returns the
 *     "you're not in this match" hint.
 *
 * `names` is threaded through so the team labels above each input show
 * "Alice & Bob" / "Carol & Dan" instead of a blank dash even when the
 * caller doesn't have a profile_id→name map handy at the input level.
 */
function ScoreInput({ match, me, canManage, names, onSubmitted }: ScoreInputProps) {
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

  const onMyTeamA = me
    ? match.team_a_player1_id === me.profile_id ||
      match.team_a_player2_id === me.profile_id
    : false;
  const onMyTeamB = me
    ? match.team_b_player1_id === me.profile_id ||
      match.team_b_player2_id === me.profile_id
    : false;
  const inMatch = onMyTeamA || onMyTeamB;

  if (!inMatch && !canManage) {
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
        // Player path needs the magic_token. A guest's token comes from
        // localStorage (the OTP modal persists it at register time); an
        // authed user picks it up via useEventLive if they have one. If
        // it's missing we can't go through the player path — fall back
        // to organizer override when canManage, else error.
        if (!me?.magic_token) {
          toast({ title: live.scoreErrorToast, variant: "destructive" });
          return;
        }
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
  // Unique element ids so multiple ScoreInput cards on the same page
  // (organizer scoring several courts at once) don't share input ids.
  const aId = `score-a-${match.id}`;
  const bId = `score-b-${match.id}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <Label htmlFor={aId} style={{ fontSize: 12 }}>
            {teamLabel(match, "a", names)}
          </Label>
          <Input
            id={aId}
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
          <Label htmlFor={bId} style={{ fontSize: 12 }}>
            {teamLabel(match, "b", names)}
          </Label>
          <Input
            id={bId}
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
      {canManage && (
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

interface StartMatchCtaProps {
  match: LiveMatchRow;
  /** Resolved registration row when the viewer is a registered player. */
  me: MyRegistration | null;
  /** True when the viewer either created the event OR has the admin role. */
  canManage: boolean;
}

/**
 * "Bắt đầu chơi" button shown on a scheduled match. Visible to:
 *   - the four players in the match (identified via `me.profile_id`)
 *   - the event organizer or admin (gated by `canManage` upstream)
 *
 * A single client-side UPDATE flips `status` from 'scheduled' → 'in_progress'.
 * RLS allows the four match players + the event organizer + admin to update;
 * the `.eq("status", "scheduled")` guard makes the call idempotent if a
 * peer just transitioned the row (the realtime channel will refetch and
 * the page rerenders with ScoreInput).
 *
 * Returns null when neither path applies (spectator viewing someone else's
 * match) so the parent can render this unconditionally and trust the
 * component to gate itself.
 */
function StartMatchCta({ match, me, canManage }: StartMatchCtaProps) {
  const { t } = useI18n();
  const live = t.socialEvents.live;
  const [starting, setStarting] = useState(false);

  const inMatch = me
    ? match.team_a_player1_id === me.profile_id ||
      match.team_a_player2_id === me.profile_id ||
      match.team_b_player1_id === me.profile_id ||
      match.team_b_player2_id === me.profile_id
    : false;

  if (!inMatch && !canManage) return null;

  async function handleStart() {
    setStarting(true);
    try {
      const { error } = await supabase
        .from("social_event_matches")
        .update({ status: "in_progress" })
        .eq("id", match.id)
        .eq("status", "scheduled");
      if (error) {
        console.error("StartMatchCta: update failed", error);
        toast({ title: t.common.error, description: error.message, variant: "destructive" });
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
        {live.startMatchHint}
      </p>
      <Button onClick={handleStart} disabled={starting}>
        {starting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlayCircle className="mr-2 h-4 w-4" />
        )}
        {starting ? live.starting : live.startMatch}
      </Button>
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
    return (
      <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>
        {live.zoneStandingsEmpty}
      </p>
    );
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
  const { isAdmin } = useAdminAuth();
  const { data: event, isLoading: eventLoading } = useSocialEvent(slug);
  const { data: registrations } = useEventRegistrations(event?.id);
  const { data, isLoading, me, myStanding } = useEventLive(event?.id);

  const isOrganizer = Boolean(user && event && user.id === event.created_by);
  // `canManage` extends isOrganizer with the admin role — admins can run the
  // event even on a club they don't own (start matches, organizer-override
  // a score). Both isOrganizer + canManage are needed: ScoreInput's
  // override panel hinges on canManage; the page CTAs at the bottom only
  // make sense for the event's actual organizer.
  const canManage = isOrganizer || isAdmin;

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

  // Zone Now derivation. For an identified player, `playerCurrent` is
  // their resolved in_progress-or-scheduled match. For an organizer / admin,
  // `orgInProgress` is every in_progress match they need to score — except
  // the one that's already being shown as `playerCurrent` (a user who is
  // both organizer + a player in one of the matches should see that match
  // once with the player UI, not duplicated as an organizer card).
  const playerCurrent = me ? data.currentMatch : null;
  const orgInProgress = useMemo<LiveMatchRow[]>(() => {
    if (!canManage) return [];
    return data.allMatches.filter(
      (m) =>
        m.status === "in_progress" &&
        (!playerCurrent || m.id !== playerCurrent.id),
    );
  }, [canManage, data.allMatches, playerCurrent]);

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
  const spectator = !me && !canManage;

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

        {/* Top-level "no schedule" banner — non-blocking. We still render
            the Next + Standings cards below so registrations are visible
            even when matches haven't been saved yet. */}
        {noSchedule && (
          <Card className="p-5 mb-4" style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{live.noScheduleTitle}</h3>
            <p style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>{live.noScheduleBody}</p>
            {canManage && (
              <div style={{ marginTop: 12 }}>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/su-kien/${event.slug}/xep-cap`}>
                    <ClipboardList className="mr-1 h-3.5 w-3.5" /> {live.organizerCta}
                  </Link>
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Spectator banner — visible whenever the viewer has no
            registration AND isn't the organizer. Independent of whether
            the schedule has been saved yet. */}
        {spectator && (
          <Card className="p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {live.notRegisteredTitle}
            </h3>
            <p style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>{live.notRegisteredBody}</p>
          </Card>
        )}

        {/* Zone 1 — Now. Two render paths share this card:
              (a) Identified player block — shows the player's currentMatch
                  (in_progress → ScoreInput, scheduled → StartMatchCta), or
                  the resting placeholder when they have nothing pending.
              (b) Organizer / admin block — shows EVERY in_progress match
                  the event has running so the organizer can score multiple
                  courts at once. The orgInProgress derivation upstream
                  already deduplicates against playerCurrent so an
                  organizer-who-is-also-a-player sees their match once.
            Spectators (neither `me` nor canManage) get nothing here. */}
        {(me || canManage) && (
          <Card className="p-5 mb-4">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--tl-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              {live.zoneNow}
            </h3>

            {/* (a) Player block — only when `me` is resolved. */}
            {me && playerCurrent && (
              <div style={{ display: "grid", gap: 16 }}>
                <MatchCard
                  match={playerCurrent}
                  names={playerNames}
                  language={language}
                />
                {playerCurrent.status === "in_progress" ? (
                  <ScoreInput
                    match={playerCurrent}
                    me={me}
                    canManage={canManage}
                    names={playerNames}
                    onSubmitted={() => {
                      // Realtime subscription will refetch; nothing local to do.
                    }}
                  />
                ) : (
                  <StartMatchCta
                    match={playerCurrent}
                    me={me}
                    canManage={canManage}
                  />
                )}
              </div>
            )}

            {/* Player has no pending match. Only show the placeholder when
                there are also no org-side in_progress cards to render
                below — otherwise the placeholder competes for attention. */}
            {me && !playerCurrent && orgInProgress.length === 0 && (
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {live.zoneRestingTitle}
                </h4>
                {data.firstScheduled ? (
                  <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>
                    {live.zoneRestingBody
                      .replace("{round}", String(data.firstScheduled.round))
                      .replace("{court}", String(data.firstScheduled.court))}
                  </p>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>
                    {live.zoneRestingNoNext}
                  </p>
                )}
              </div>
            )}

            {/* (b) Organizer / admin block — every in_progress match. */}
            {canManage && (
              <div
                style={{
                  marginTop: me && playerCurrent ? 24 : 0,
                  paddingTop: me && playerCurrent ? 16 : 0,
                  borderTop: me && playerCurrent ? "1px solid var(--tl-border, #22252a)" : "none",
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--tl-fg-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                  }}
                >
                  {live.zoneNowOrganizerSubtitle.replace("{n}", String(orgInProgress.length))}
                </p>
                {orgInProgress.length === 0 ? (
                  // For an organizer who isn't a player AND has no active
                  // match to score, this is the only thing rendered.
                  // Direct them to the Next zone's "Bắt đầu chơi" CTA.
                  !me && (
                    <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>
                      {live.zoneNowOrganizerEmpty}
                    </p>
                  )
                ) : (
                  <div style={{ display: "grid", gap: 24 }}>
                    {orgInProgress.map((m) => (
                      <div key={m.id} style={{ display: "grid", gap: 12 }}>
                        <MatchCard match={m} names={playerNames} language={language} />
                        <ScoreInput
                          match={m}
                          me={me}
                          canManage={canManage}
                          names={playerNames}
                          onSubmitted={() => {
                            // Realtime subscription will refetch.
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Zone 2 — Next. ALWAYS rendered — every viewer (spectator, player,
            organizer) should see "what's coming up". For the organizer /
            admin / 4 match players, the "Bắt đầu chơi" CTA is embedded
            here too so the match can be started without the
            organizer having to register themselves as a player first
            (Zone Now requires `me` and would otherwise be empty for
            them). StartMatchCta self-gates and returns null for
            spectators. */}
        <Card className="p-5 mb-4">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--tl-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            {live.zoneNext}
          </h3>
          {data.firstScheduled ? (
            <>
              <p style={{ fontSize: 12, color: "var(--tl-fg-3)", marginBottom: 8 }}>
                {live.zoneNextHint}
              </p>
              <MatchCard
                match={data.firstScheduled}
                names={playerNames}
                language={language}
              />
              {data.firstScheduled.status === "scheduled" && (
                <div style={{ marginTop: 12 }}>
                  <StartMatchCta
                    match={data.firstScheduled}
                    me={me}
                    canManage={canManage}
                  />
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>{live.zoneNoNext}</p>
          )}
        </Card>

        {/* Zone 3 — Standings. ALWAYS rendered. Seeded by useEventLive from
            the registrations so the table shows the full roster (0-0)
            immediately after the organizer publishes — no completed
            matches required. */}
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
