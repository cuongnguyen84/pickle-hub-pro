// ============================================================================
// SocialEventMatchmaking (`/su-kien/:slug/xep-cap`) — Mexicano / RoundRobin
// ----------------------------------------------------------------------------
// Pure client-side tool: pick checked-in players → generate schedule →
// print/copy. Nothing persists. Organizer can re-generate as often as needed.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Loader2, Sparkles, Printer, Copy, RefreshCw } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { useSocialEvent } from "@/hooks/useSocialEvent";
import { useEventRegistrations } from "@/hooks/useEventRegistrations";
import { useEventOwnership } from "@/hooks/useClubOwnership";
import { toast } from "@/hooks/use-toast";
import {
  generate,
  scheduleToText,
  type MMSchedule,
  type Format,
} from "@/lib/matchmaking";
import { interp } from "@/lib/social-events/format";

export default function SocialEventMatchmaking() {
  const { slug } = useParams<{ slug: string }>();
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

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (permission.state === "anonymous") return <Navigate to="/login" replace />;
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
            <Link to={`/su-kien/${event.slug}/danh-sach`} style={{ color: "inherit", textDecoration: "none" }}>
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
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> {mm.copy}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-1 h-3.5 w-3.5" /> {mm.print}
                </Button>
              </div>
            </div>
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
      </div>
    </TheLineLayout>
  );
}
