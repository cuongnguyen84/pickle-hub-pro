// ============================================================================
// SocialEventMatchmaking (`/social/:slug/xep-cap`) — Mexicano / RoundRobin
// ----------------------------------------------------------------------------
// Pick checked-in players → generate Mexicano / Round-Robin schedule →
// print/copy/save. On mount the page reads any existing saved schedule
// from `social_event_matches` and rebuilds an MMSchedule from it so the
// organizer can come back later and see what was saved (rather than the
// empty "no schedule yet" state).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Printer, Copy, RefreshCw, Save, PlayCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n";
import { useSocialEvent } from "@/hooks/useSocialEvent";
import { useEventRegistrations, type EventRegistrationRow } from "@/hooks/useEventRegistrations";
import { useEventOwnership } from "@/hooks/useClubOwnership";
import { useNoindex } from "@/hooks/useNoindex";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  generate,
  scheduleToText,
  type MMMatch,
  type MMPlayer,
  type MMRound,
  type MMSchedule,
  type Format,
} from "@/lib/matchmaking";
import { interp } from "@/lib/social-events/format";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";

interface SavedMatchRow {
  id: string;
  round: number;
  court: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  status: "scheduled" | "in_progress" | "completed";
}

/**
 * Rebuild an MMSchedule from the rows persisted in social_event_matches so
 * the organizer can return to /xep-cap after navigation and see what was
 * saved. The matchmaking lib's MMPlayer.id is registration.id (not
 * profile.id) — we look up registrations by profile_id to recover that
 * mapping. Players whose registration we can't resolve get a placeholder
 * row so the rebuild doesn't drop columns silently.
 *
 * sittingOut is NOT persisted, so we leave it empty. Format also isn't
 * persisted — the caller defaults to 'mexicano' when restoring.
 */
function rebuildScheduleFromSaved(
  savedMatches: SavedMatchRow[],
  registrations: EventRegistrationRow[],
  format: Format,
): MMSchedule {
  const profileToReg = new Map<string, EventRegistrationRow>();
  for (const r of registrations) {
    if (r.profile_id) profileToReg.set(r.profile_id, r);
  }

  const mkPlayer = (profileId: string | null): MMPlayer => {
    if (!profileId) return { id: `__missing__:${Math.random()}`, name: "—", level: null };
    const reg = profileToReg.get(profileId);
    if (!reg) return { id: profileId, name: "?", level: null };
    return { id: reg.id, name: reg.display_name, level: reg.self_rated_level };
  };

  const byRound = new Map<number, MMMatch[]>();
  for (const m of savedMatches) {
    const list = byRound.get(m.round) ?? [];
    list.push({
      round: m.round,
      court: m.court,
      teamA: [mkPlayer(m.team_a_player1_id), mkPlayer(m.team_a_player2_id)],
      teamB: [mkPlayer(m.team_b_player1_id), mkPlayer(m.team_b_player2_id)],
    });
    byRound.set(m.round, list);
  }
  const rounds: MMRound[] = Array.from(byRound.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, matches]) => ({
      round,
      matches: matches.sort((a, b) => a.court - b.court),
      sittingOut: [],
    }));

  const players = new Set<string>();
  for (const r of rounds) {
    for (const m of r.matches) {
      players.add(m.teamA[0].id);
      players.add(m.teamA[1].id);
      players.add(m.teamB[0].id);
      players.add(m.teamB[1].id);
    }
  }

  return { rounds, playerCount: players.size, format };
}

export default function SocialEventMatchmaking() {
  // PR72 (SEO Phase 2A I-7): organizer-only matchmaking config.
  useNoindex();

  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useI18n();
  const mm = t.socialEvents.matchmaking;
  const permission = useEventOwnership(slug);
  const { data: event } = useSocialEvent(slug);
  const { data: registrations } = useEventRegistrations(event?.id);

  const [format, setFormat] = useState<Format>("mexicano");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rounds, setRounds] = useState(4);
  // Courts default to 2 on first render — `event` resolves asynchronously
  // from the query, so we can't read event.court_count in useState init.
  // The useEffect below syncs the real value once the event loads.
  const [courts, setCourts] = useState(2);
  const [courtsTouched, setCourtsTouched] = useState(false);
  const [schedule, setSchedule] = useState<MMSchedule | null>(null);
  // `viewingSaved` is true when the displayed schedule was rebuilt from
  // the DB (not freshly generated by the user). Drives the banner +
  // hides the "Save" button (no-op against an unmodified copy).
  const [viewingSaved, setViewingSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);

  // Saved matches restoration — fetch what's persisted so the page doesn't
  // look like a fresh blank slate after the organizer navigates away and back.
  const { data: savedMatches } = useQuery<SavedMatchRow[]>({
    queryKey: ["social-event-matches", event?.id],
    queryFn: async () => {
      if (!event?.id) return [];
      const { data, error } = await supabase
        .from("social_event_matches")
        .select(
          `id, round, court,
           team_a_player1_id, team_a_player2_id,
           team_b_player1_id, team_b_player2_id,
           status`,
        )
        .eq("event_id", event.id)
        .order("round", { ascending: true })
        .order("court", { ascending: true });
      if (error) {
        console.error("matchmaking: saved matches fetch error", error);
        return [];
      }
      return (data ?? []) as SavedMatchRow[];
    },
    enabled: Boolean(event?.id),
    staleTime: 5_000,
  });

  // One-shot restore. Once the user generates a fresh schedule locally
  // (schedule !== null) we never overwrite it on subsequent re-fetches.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (schedule) return; // user already generated a local preview
    if (!event || !savedMatches || !registrations) return;
    if (savedMatches.length === 0) return;
    const restored = rebuildScheduleFromSaved(savedMatches, registrations, format);
    setSchedule(restored);
    setViewingSaved(true);
    // Pre-select players who appear in the saved schedule so a "Tạo lại"
    // run starts with the same roster.
    const ids = new Set<string>();
    for (const r of restored.rounds) {
      for (const m of r.matches) {
        if (m.teamA[0].id && !m.teamA[0].id.startsWith("__missing__")) ids.add(m.teamA[0].id);
        if (m.teamA[1].id && !m.teamA[1].id.startsWith("__missing__")) ids.add(m.teamA[1].id);
        if (m.teamB[0].id && !m.teamB[0].id.startsWith("__missing__")) ids.add(m.teamB[0].id);
        if (m.teamB[1].id && !m.teamB[1].id.startsWith("__missing__")) ids.add(m.teamB[1].id);
      }
    }
    setSelected(ids);
    restoredRef.current = true;
  }, [event, savedMatches, registrations, format, schedule]);

  // Codex Bug 6 (PR #44): sync courts state from event.court_count once the
  // event resolves. We only auto-apply until the organizer manually
  // changes the input (courtsTouched flag) so subsequent event re-fetches
  // (e.g. on focus) don't clobber the organizer's override.
  useEffect(() => {
    if (!courtsTouched && event?.court_count) {
      setCourts(event.court_count);
    }
  }, [event?.court_count, courtsTouched]);

  // Default-select checked-in players the first time registrations load.
  const eligible = useMemo(() => {
    return (registrations ?? []).filter((r) => r.status !== "cancelled" && r.status !== "no_show");
  }, [registrations]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(eligible.map((r) => r.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  function handleGenerate() {
    if (selected.size < 4) {
      toast({ title: mm.notEnoughPlayers, variant: "destructive" });
      return;
    }
    const players = eligible
      .filter((r) => selected.has(r.id))
      .map((r) => ({ id: r.id, name: r.display_name, level: r.self_rated_level ?? null }));
    const next = generate(format, {
      players,
      rounds,
      courtCount: courts,
      seed: Date.now(),
    });
    setSchedule(next);
    // Local generation supersedes anything we restored from the DB.
    setViewingSaved(false);
  }

  function handleCopy() {
    if (!schedule) return;
    const text = scheduleToText(schedule, language);
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: mm.copied }))
      .catch(() => toast({ title: t.common.error, variant: "destructive" }));
  }

  function handlePrint() {
    window.print();
  }

  // ─── Save schedule to social_event_matches ──────────────────────────────
  //
  // Persists the in-memory MMSchedule so the /live page has data to render.
  // Each MMPlayer.id is a registration_id; we map it to profile_id via the
  // current registrations array. Registrations without a profile_id are
  // skipped (the live page tolerates null FKs, but a missing profile means
  // the player can't submit scores or appear in standings).
  //
  // If matches already exist for this event we open a confirm dialog and
  // overwrite (DELETE then INSERT). Re-generation is part of the normal
  // organizer flow — between rounds, the organizer regenerates and saves.
  async function persistSchedule() {
    if (!event || !schedule) return;
    setSaving(true);
    try {
      const regById = new Map(
        (registrations ?? []).map((r) => [r.id, r] as const),
      );

      // Defensive guard: every selected player must have a usable
      // profile_id, otherwise the insert below would silently write
      // NULL FKs and the live page would render blank. Walk-ins from
      // before migration 20260512120000 had NULL profile_id; that
      // migration backfills them, but if a stale row slipped through
      // we surface the bug instead of swallowing it.
      const missing: string[] = [];
      for (const r of schedule.rounds) {
        for (const m of r.matches) {
          for (const p of [...m.teamA, ...m.teamB]) {
            if (!regById.get(p.id)?.profile_id) missing.push(p.name);
          }
        }
      }
      if (missing.length > 0) {
        console.error("persistSchedule: players missing profile_id", missing);
        toast({
          title: t.common.error,
          description:
            language === "vi"
              ? `Người chơi sau chưa có hồ sơ: ${[...new Set(missing)].join(", ")}. Liên hệ admin để chạy migration walk-in.`
              : `Players missing a profile: ${[...new Set(missing)].join(", ")}. Ask admin to run the walk-in migration.`,
          variant: "destructive",
        });
        return;
      }

      const rows = schedule.rounds.flatMap((r) =>
        r.matches.map((m) => ({
          event_id: event.id,
          round: m.round,
          court: m.court,
          team_a_player1_id: regById.get(m.teamA[0].id)!.profile_id,
          team_a_player2_id: regById.get(m.teamA[1].id)!.profile_id,
          team_b_player1_id: regById.get(m.teamB[0].id)!.profile_id,
          team_b_player2_id: regById.get(m.teamB[1].id)!.profile_id,
          status: "scheduled" as const,
        })),
      );
      // Wipe existing matches first — RLS lets the organizer DELETE.
      const { error: delErr } = await supabase
        .from("social_event_matches")
        .delete()
        .eq("event_id", event.id);
      if (delErr) {
        console.error("persistSchedule: delete failed", delErr);
        toast({ title: t.common.error, description: delErr.message, variant: "destructive" });
        return;
      }
      if (rows.length === 0) {
        toast({ title: mm.savedToEventToast });
        return;
      }
      const { error: insErr } = await supabase
        .from("social_event_matches")
        .insert(rows);
      if (insErr) {
        console.error("persistSchedule: insert failed", insErr);
        toast({ title: t.common.error, description: insErr.message, variant: "destructive" });
        return;
      }
      toast({ title: mm.savedToEventToast });
      // Persisted state now matches the local preview. Future returns to
      // this page will rebuild from these rows; flag the in-memory copy
      // as "saved" so the banner reappears + Save button hides.
      setViewingSaved(true);
      // Other consumers (useEventLive on /live, the matchmaking page on a
      // fresh mount) read from this same query key — invalidate so they
      // refetch the new rows.
      queryClient.invalidateQueries({ queryKey: ["social-event-matches", event.id] });
    } finally {
      setSaving(false);
      setOverwriteOpen(false);
    }
  }

  async function handleSave() {
    if (!event || !schedule) return;
    // Probe for existing rows. If any, ask before overwriting.
    const { count } = await supabase
      .from("social_event_matches")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if ((count ?? 0) > 0) {
      setOverwriteOpen(true);
      return;
    }
    await persistSchedule();
  }

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (permission.state === "anonymous") {
    return <Navigate to={buildLoginRedirect(window.location.pathname + window.location.search)} replace />;
  }
  if (permission.state === "denied") {
    return (
      <TheLineLayout title={t.socialEvents.manage.noPermissionTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{t.socialEvents.manage.noPermissionTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>
            {t.socialEvents.manage.noPermissionBody}
          </p>
        </div>
      </TheLineLayout>
    );
  }

  if (!event) {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  const eventTitle = language === "vi" ? event.title_vi : (event.title_en || event.title_vi);
  const oddWarning = selected.size > 0 && selected.size % 4 !== 0;

  return (
    <TheLineLayout title={`${mm.pageTitle} — ${eventTitle}`} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 60, maxWidth: 1080, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">
            ◆{" "}
            <Link to={`/social/${event.slug}/danh-sach`} style={{ color: "inherit", textDecoration: "none" }}>
              {eventTitle}
            </Link>
          </div>
          <h1>{mm.pageTitle}</h1>
        </header>

        <Tabs value={format} onValueChange={(v) => setFormat(v as Format)} className="mb-4">
          <TabsList>
            <TabsTrigger value="mexicano">{mm.tabMexicano}</TabsTrigger>
            <TabsTrigger value="round_robin">{mm.tabRoundRobin}</TabsTrigger>
          </TabsList>
          <TabsContent value="mexicano" />
          <TabsContent value="round_robin" />
        </Tabs>

        <Card className="p-4 mb-4">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{mm.selectPlayersTitle}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={selectAll}>{mm.selectAll}</Button>
              <Button variant="ghost" size="sm" onClick={selectNone}>{mm.selectNone}</Button>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--tl-fg-3)", marginBottom: 12 }}>
            {interp(mm.selectedCount, { n: selected.size })}
          </p>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {eligible.map((r) => (
              <label
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: selected.has(r.id) ? "rgba(59,130,246,0.08)" : "var(--tl-bg-2, rgba(0,0,0,0.03))",
                  cursor: "pointer",
                }}
              >
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.display_name}
                </span>
                {r.self_rated_level != null && (
                  <Badge variant="outline" className="text-xs">{r.self_rated_level.toFixed(1)}</Badge>
                )}
              </label>
            ))}
          </div>
          {eligible.length === 0 && (
            <p style={{ color: "var(--tl-fg-3)", padding: 12 }}>{t.socialEvents.roster.noRegistrations}</p>
          )}
        </Card>

        <Card className="p-4 mb-4">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            <div>
              <Label htmlFor="mm-rounds">{mm.roundsLabel}</Label>
              <Input
                id="mm-rounds"
                type="number"
                min={1}
                max={20}
                value={rounds}
                onChange={(e) => setRounds(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div>
              <Label htmlFor="mm-courts">{mm.courtsLabel}</Label>
              <Input
                id="mm-courts"
                type="number"
                min={1}
                max={20}
                value={courts}
                onChange={(e) => {
                  setCourtsTouched(true);
                  setCourts(Math.max(1, Number(e.target.value)));
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button onClick={handleGenerate} className="w-full">
                {schedule ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {schedule ? mm.regenerate : mm.generate}
              </Button>
            </div>
          </div>
          {oddWarning && (
            <p style={{ marginTop: 10, fontSize: 13, color: "rgb(180,83,9)" }}>
              {mm.oddPlayersWarning}
            </p>
          )}
        </Card>

        {schedule && schedule.rounds.length > 0 && (
          <Card className="p-4">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>{mm.schedule}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> {mm.copy}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-1 h-3.5 w-3.5" /> {mm.print}
                </Button>
                {/* Hide Save while we're showing the schedule as already
                    persisted — saving an unchanged copy is a no-op + would
                    trigger the overwrite confirm dialog for no reason. */}
                {!viewingSaved && (
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-3.5 w-3.5" />
                    )}
                    {saving ? mm.savingToEvent : mm.saveToEvent}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/social/${event.slug}/live`)}
                >
                  <PlayCircle className="mr-1 h-3.5 w-3.5" /> {mm.openLivePage}
                </Button>
              </div>
            </div>
            {viewingSaved && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--tl-border, #22252a)",
                  background: "rgba(0, 185, 107, 0.06)",
                  fontSize: 13,
                  color: "var(--tl-fg-2, #c7c3bb)",
                }}
              >
                <strong style={{ color: "var(--primary)" }}>
                  {mm.savedScheduleBanner}
                </strong>{" "}
                {mm.regenerateHint}
              </div>
            )}
            <div style={{ display: "grid", gap: 16 }}>
              {schedule.rounds.map((r) => (
                <div key={r.round}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                    {mm.round} {r.round}
                  </h4>
                  <div style={{ display: "grid", gap: 6 }}>
                    {r.matches.map((m) => (
                      <div
                        key={`${m.round}-${m.court}`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "var(--tl-bg-2, rgba(0,0,0,0.03))",
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Badge variant="outline" className="shrink-0">
                          {mm.court} {m.court}
                        </Badge>
                        <span><strong>{m.teamA[0].name}</strong> & <strong>{m.teamA[1].name}</strong></span>
                        <span style={{ opacity: 0.5 }}>vs</span>
                        <span><strong>{m.teamB[0].name}</strong> & <strong>{m.teamB[1].name}</strong></span>
                      </div>
                    ))}
                  </div>
                  {r.sittingOut.length > 0 && (
                    <p style={{ fontSize: 13, color: "var(--tl-fg-3)", marginTop: 6 }}>
                      {mm.sittingOut}: {r.sittingOut.map((p) => p.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {(!schedule || schedule.rounds.length === 0) && (
          <p style={{ color: "var(--tl-fg-3)", padding: 24, textAlign: "center" }}>{mm.empty}</p>
        )}

        <AlertDialog open={overwriteOpen} onOpenChange={setOverwriteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{mm.saveOverwriteConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{mm.saveOverwriteConfirmBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={persistSchedule} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mm.saveToEvent}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TheLineLayout>
  );
}
