// ============================================================================
// EditSocialEvent (`/clb/:slug/quan-ly/su-kien/:event_slug/sua`) — PR58.
// ----------------------------------------------------------------------------
// Organizer-only edit page. Pre-fills the same fields as CreateSocialEvent
// but in a single non-wizard form (the user already knows the fields).
//
// Constraints:
//   - slug is immutable (display only)
//   - max_players cannot drop below the count of active registrations
//   - if start_at <= now() the form locks read-only with a banner
//   - cancel-event flow uses the cancel_social_event RPC (atomic cascade
//     onto event_registrations)
//
// Persists in two writes: social_events UPDATE, then event_payment_config
// upsert when price_vnd > 0. Both rely on RLS (organizer-only).
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, AlertTriangle, Trash2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useEventOwnership } from "@/hooks/useClubOwnership";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import {
  validateField,
  type FormErrors,
  type FormState,
} from "@/components/social/create-event/types";

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh, no DST

function isoToLocalDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
function isoToLocalTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_MS);
  return d.toISOString().slice(11, 16);
}
function localToIso(date: string, time: string): string {
  // date+time are interpreted as Asia/Ho_Chi_Minh local; subtract offset
  // back to UTC before serialising.
  return new Date(new Date(`${date}T${time}:00Z`).getTime() - TZ_OFFSET_MS).toISOString();
}

export default function EditSocialEvent() {
  const { slug: clubSlug, event_slug } = useParams<{ slug: string; event_slug: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permission = useEventOwnership(event_slug);
  const edit = t.socialEvents.editEvent;

  const [form, setForm] = useState<FormState | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventStartIso, setEventStartIso] = useState<string | null>(null);
  const [activeRegs, setActiveRegs] = useState<number>(0);
  const [hasPaidClaims, setHasPaidClaims] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTyped, setCancelTyped] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

  const { data: bundle, isLoading, refetch } = useQuery({
    queryKey: ["edit-event", event_slug],
    queryFn: async () => {
      if (!event_slug) return null;
      const { data: ev } = await supabase
        .from("social_events")
        .select(
          `id, slug, title_vi, title_en, description_vi, description_en,
           start_at, end_at, location_text, court_count, max_players,
           price_vnd, zalo_group_url, visibility, status, club_id,
           requires_prepayment, prepayment_deadline_hours`,
        )
        .eq("slug", event_slug)
        .maybeSingle();
      if (!ev) return null;

      const { data: pc } = await supabase
        .from("event_payment_config")
        .select("bank_code, bank_account_number, bank_account_name")
        .eq("event_id", (ev as { id: string }).id)
        .maybeSingle();

      const { data: activeRegs } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", (ev as { id: string }).id)
        .is("cancelled_at", null);

      const regIds = (activeRegs ?? []).map((r) => (r as { id: string }).id);

      let paidCount = 0;
      if (regIds.length > 0) {
        const { count } = await supabase
          .from("payment_orders")
          .select("id", { count: "exact", head: true })
          .in("registration_id", regIds)
          .eq("player_claimed_paid", true);
        paidCount = count ?? 0;
      }

      return { ev, pc, regCount: regIds.length, paidCount };
    },
    enabled: Boolean(event_slug),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!bundle?.ev) return;
    const e = bundle.ev as {
      id: string;
      title_vi: string;
      title_en: string | null;
      description_vi: string | null;
      description_en: string | null;
      start_at: string;
      end_at: string;
      location_text: string | null;
      court_count: number;
      max_players: number;
      price_vnd: number;
      zalo_group_url: string | null;
      visibility: "public" | "club_only";
      requires_prepayment?: boolean;
      prepayment_deadline_hours?: number;
    };
    setEventId(e.id);
    setEventStartIso(e.start_at);
    setActiveRegs(bundle.regCount);
    setHasPaidClaims(bundle.paidCount > 0);
    setForm({
      title: e.title_vi ?? "",
      description: e.description_vi ?? "",
      start_date: isoToLocalDate(e.start_at),
      start_time: isoToLocalTime(e.start_at),
      end_time: isoToLocalTime(e.end_at),
      location_text: e.location_text ?? "",
      court_count: e.court_count ?? 2,
      max_players: e.max_players ?? 16,
      zalo_group_url: e.zalo_group_url ?? "",
      visibility: e.visibility ?? "public",
      price_vnd: e.price_vnd ?? 0,
      bank_code: (bundle.pc as { bank_code?: string } | null)?.bank_code ?? "",
      bank_account_number:
        (bundle.pc as { bank_account_number?: string } | null)?.bank_account_number ?? "",
      bank_account_name:
        (bundle.pc as { bank_account_name?: string } | null)?.bank_account_name ?? "",
      // PR67 — prefill from DB; new events on older clients default to
      // false / 12 via the column DEFAULTs.
      requires_prepayment: e.requires_prepayment ?? false,
      prepayment_deadline_hours: e.prepayment_deadline_hours ?? 12,
    });
  }, [bundle]);

  const errors: FormErrors = useMemo(() => {
    if (!form) return {};
    const errs: FormErrors = {};
    const fields: (keyof FormState)[] = [
      "title",
      "start_date",
      "start_time",
      "end_time",
      "location_text",
      "court_count",
      "max_players",
      "zalo_group_url",
      "visibility",
      "price_vnd",
      "bank_code",
      "bank_account_number",
      "bank_account_name",
    ];
    for (const f of fields) {
      errs[f] = validateField(f, form, t);
    }
    // Cross-rule — max_players cannot drop below the already-registered count.
    if (form.max_players < activeRegs) {
      errs.max_players = edit.errorMaxPlayersBelowReg.replace("{n}", String(activeRegs));
    }
    return errs;
  }, [form, t, activeRegs, edit]);

  const allValid = useMemo(() => {
    if (!form) return false;
    return Object.values(errors).every((e) => !e);
  }, [form, errors]);

  const eventStarted = useMemo(() => {
    if (!eventStartIso) return false;
    return new Date(eventStartIso).getTime() <= Date.now();
  }, [eventStartIso]);

  const isCancelled = bundle?.ev
    ? (bundle.ev as { status: string }).status === "cancelled"
    : false;
  const readOnly = eventStarted || isCancelled;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setTouched((p) => ({ ...p, [key]: true }));
  }

  async function handleSave() {
    if (!form || !eventId || !allValid || readOnly) return;
    setSaving(true);
    try {
      const startIso = localToIso(form.start_date, form.start_time);
      const endIso = localToIso(form.start_date, form.end_time);
      const patch = {
        title_vi: form.title.trim(),
        description_vi: form.description.trim() || null,
        start_at: startIso,
        end_at: endIso,
        location_text: form.location_text.trim(),
        court_count: form.court_count,
        max_players: form.max_players,
        zalo_group_url: form.zalo_group_url.trim() || null,
        visibility: form.visibility,
        price_vnd: form.price_vnd,
        // PR67 — only meaningful for paid events. Free events force
        // requires_prepayment back to false so toggling price to 0
        // doesn't leave a stale requirement attached.
        requires_prepayment: form.price_vnd > 0 ? form.requires_prepayment : false,
        prepayment_deadline_hours: form.prepayment_deadline_hours,
      };
      const { error: upErr } = await supabase
        .from("social_events")
        .update(patch)
        .eq("id", eventId);
      if (upErr) {
        console.error("EditSocialEvent update error", upErr);
        toast({ title: t.common.error, description: upErr.message, variant: "destructive" });
        return;
      }

      if (form.price_vnd > 0) {
        const { error: pcErr } = await supabase
          .from("event_payment_config")
          .upsert({
            event_id: eventId,
            bank_code: form.bank_code.trim(),
            bank_account_number: form.bank_account_number.trim(),
            bank_account_name: form.bank_account_name.trim(),
            enabled: true,
          });
        if (pcErr) {
          console.error("event_payment_config upsert error", pcErr);
          toast({
            title: edit.savedPartialTitle,
            description: edit.savedPartialBody,
            variant: "destructive",
          });
          return;
        }
      }

      // PR62 v2 — refetchType: 'all' is required because App.tsx sets
      // refetchOnMount: false globally. Without it, invalidateQueries
      // only triggers a refetch for queries with ACTIVE observers; the
      // destination ClubManage page hasn't mounted yet, so its
      // observers are inactive, and after navigate the freshly-mounted
      // page reads the cached-but-stale data (refetchOnMount=false
      // suppresses the auto-refetch). refetchType: 'all' kicks off an
      // immediate background fetch even for inactive queries, so by
      // the time the destination mounts the cache is fresh.
      const clubIdForList = (bundle?.ev as { club_id?: string } | null | undefined)?.club_id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["edit-event", event_slug], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["social-event", event_slug], refetchType: "all" }),
        ...(clubIdForList
          ? [queryClient.invalidateQueries({ queryKey: ["club-events-manage", clubIdForList], refetchType: "all" })]
          : []),
        queryClient.invalidateQueries({ queryKey: ["club", clubSlug], refetchType: "all" }),
      ]);

      toast({ title: edit.savedTitle, description: edit.savedBody });
      navigate(`/clb/${clubSlug}/quan-ly`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelEvent() {
    if (!eventId || !bundle?.ev) return;
    const evTitle = (bundle.ev as { title_vi: string }).title_vi;
    if (cancelTyped.trim() !== evTitle) return;
    setCancelling(true);
    try {
      const { error: rpcErr } = await supabase.rpc("cancel_social_event", {
        p_event_id: eventId,
        p_reason: "Event cancelled by organizer",
      });
      if (rpcErr) {
        console.error("cancel_social_event error", rpcErr);
        toast({ title: t.common.error, description: rpcErr.message, variant: "destructive" });
        return;
      }
      // PR62 v2 — same invalidation set + refetchType: 'all' as
      // handleSave so the destination reflects the cancellation. See
      // handleSave for the refetchOnMount=false rationale.
      const clubIdForList = (bundle?.ev as { club_id?: string } | null | undefined)?.club_id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["edit-event", event_slug], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["social-event", event_slug], refetchType: "all" }),
        ...(clubIdForList
          ? [queryClient.invalidateQueries({ queryKey: ["club-events-manage", clubIdForList], refetchType: "all" })]
          : []),
        queryClient.invalidateQueries({ queryKey: ["club", clubSlug], refetchType: "all" }),
      ]);

      toast({ title: edit.cancelEventSuccessTitle, description: edit.cancelEventSuccessBody });
      setCancelOpen(false);
      navigate(`/clb/${clubSlug}/quan-ly`);
    } finally {
      setCancelling(false);
    }
  }

  if (permission.state === "loading" || isLoading) {
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
  if (!form || !bundle?.ev) {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  const evTitle = (bundle.ev as { title_vi: string }).title_vi;
  const evSlug = (bundle.ev as { slug: string }).slug;

  return (
    <TheLineLayout title={`${edit.pageTitle} — ${evTitle}`} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">
            ◆{" "}
            <Link to={`/clb/${clubSlug}/quan-ly`} style={{ color: "inherit", textDecoration: "none" }}>
              {edit.eyebrow}
            </Link>
          </div>
          <h1>{evTitle}</h1>
        </header>

        {readOnly && (
          <Card className="mb-4 border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h2 className="font-semibold">
                  {isCancelled ? edit.readOnlyCancelledTitle : edit.readOnlyStartedTitle}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isCancelled ? edit.readOnlyCancelledBody : edit.readOnlyStartedBody}
                </p>
              </div>
            </div>
          </Card>
        )}

        {activeRegs > 0 && !readOnly && (
          <Card className="mb-4 border-amber-400/40 bg-amber-50 p-4 dark:bg-amber-950/30">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {edit.activeRegsWarning.replace("{n}", String(activeRegs))}
            </p>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-1">
              <Label>{edit.slugLabel}</Label>
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground">
                /su-kien/{evSlug}
              </p>
              <p className="text-xs text-muted-foreground">{edit.slugImmutableHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-title">{edit.titleLabel} *</Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={200}
                disabled={readOnly}
              />
              {touched.title && errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-desc">{edit.descriptionLabel}</Label>
              <Textarea
                id="ev-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                disabled={readOnly}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ev-date">{edit.dateLabel} *</Label>
                <Input
                  id="ev-date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setField("start_date", e.target.value)}
                  disabled={readOnly}
                />
                {touched.start_date && errors.start_date && (
                  <p className="text-xs text-destructive">{errors.start_date}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-start">{edit.startTimeLabel} *</Label>
                <Input
                  id="ev-start"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setField("start_time", e.target.value)}
                  disabled={readOnly}
                />
                {touched.start_time && errors.start_time && (
                  <p className="text-xs text-destructive">{errors.start_time}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">{edit.endTimeLabel} *</Label>
                <Input
                  id="ev-end"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setField("end_time", e.target.value)}
                  disabled={readOnly}
                />
                {touched.end_time && errors.end_time && (
                  <p className="text-xs text-destructive">{errors.end_time}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-loc">{edit.locationLabel} *</Label>
              <Input
                id="ev-loc"
                value={form.location_text}
                onChange={(e) => setField("location_text", e.target.value)}
                disabled={readOnly}
              />
              {touched.location_text && errors.location_text && (
                <p className="text-xs text-destructive">{errors.location_text}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ev-courts">{edit.courtCountLabel}</Label>
                <Input
                  id="ev-courts"
                  type="number"
                  min={1}
                  value={form.court_count}
                  onChange={(e) => setField("court_count", Number(e.target.value))}
                  disabled={readOnly}
                />
                {touched.court_count && errors.court_count && (
                  <p className="text-xs text-destructive">{errors.court_count}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-max">
                  {edit.maxPlayersLabel}
                  {activeRegs > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({edit.maxPlayersFloor.replace("{n}", String(activeRegs))})
                    </span>
                  )}
                </Label>
                <Input
                  id="ev-max"
                  type="number"
                  min={Math.max(4, activeRegs)}
                  value={form.max_players}
                  onChange={(e) => setField("max_players", Number(e.target.value))}
                  disabled={readOnly}
                />
                {touched.max_players && errors.max_players && (
                  <p className="text-xs text-destructive">{errors.max_players}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-zalo">{edit.zaloLabel}</Label>
              <Input
                id="ev-zalo"
                value={form.zalo_group_url}
                onChange={(e) => setField("zalo_group_url", e.target.value)}
                placeholder="https://zalo.me/g/..."
                disabled={readOnly}
              />
              {touched.zalo_group_url && errors.zalo_group_url && (
                <p className="text-xs text-destructive">{errors.zalo_group_url}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{edit.visibilityLabel}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.visibility === "public" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setField("visibility", "public")}
                  disabled={readOnly}
                >
                  {edit.visibilityPublic}
                </Button>
                <Button
                  type="button"
                  variant={form.visibility === "club_only" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setField("visibility", "club_only")}
                  disabled={readOnly}
                >
                  {edit.visibilityClubOnly}
                </Button>
              </div>
            </div>

            {/* Payment section */}
            <div className="space-y-2 border-t border-border pt-5">
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {edit.paymentHeading}
              </h2>
              <Label htmlFor="ev-price">{edit.priceLabel}</Label>
              <Input
                id="ev-price"
                type="number"
                min={0}
                step={1000}
                value={form.price_vnd}
                onChange={(e) => setField("price_vnd", Number(e.target.value))}
                disabled={readOnly || hasPaidClaims}
              />
              {touched.price_vnd && errors.price_vnd && (
                <p className="text-xs text-destructive">{errors.price_vnd}</p>
              )}
              {hasPaidClaims && (
                <p className="text-xs text-amber-600">{edit.priceLockedByClaims}</p>
              )}
              {form.price_vnd > 0 && (
                <>
                  <p className="mt-2 text-xs text-amber-600">{edit.bankWarning}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="ev-bank-code">{edit.bankCodeLabel}</Label>
                      <Input
                        id="ev-bank-code"
                        value={form.bank_code}
                        onChange={(e) =>
                          setField("bank_code", e.target.value.toUpperCase())
                        }
                        placeholder="VCB"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ev-bank-num">{edit.bankAccountNumberLabel}</Label>
                      <Input
                        id="ev-bank-num"
                        value={form.bank_account_number}
                        onChange={(e) => setField("bank_account_number", e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ev-bank-name">{edit.bankAccountNameLabel}</Label>
                      <Input
                        id="ev-bank-name"
                        value={form.bank_account_name}
                        onChange={(e) => setField("bank_account_name", e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* PR67 — prepayment toggle + deadline. Same UX as the
                      CreateSocialEvent wizard's Step2Payment block. */}
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex items-start gap-3">
                      <input
                        id="ev-edit-requires-prepayment"
                        type="checkbox"
                        checked={form.requires_prepayment}
                        onChange={(e) => setField("requires_prepayment", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border"
                        disabled={readOnly}
                      />
                      <div className="flex-1">
                        <Label htmlFor="ev-edit-requires-prepayment" className="cursor-pointer">
                          {t.socialEvents.create.requirePrepayment}
                        </Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t.socialEvents.create.requirePrepaymentDescription}
                        </p>
                      </div>
                    </div>

                    {form.requires_prepayment && (
                      <div className="ml-7 space-y-2">
                        <Label htmlFor="ev-edit-prepayment-deadline">
                          {t.socialEvents.create.paymentDeadlineHours}
                        </Label>
                        <Input
                          id="ev-edit-prepayment-deadline"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={168}
                          value={form.prepayment_deadline_hours}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setField(
                              "prepayment_deadline_hours",
                              Number.isFinite(n) ? Math.min(168, Math.max(1, Math.trunc(n))) : 12,
                            );
                          }}
                          className="max-w-[120px]"
                          disabled={readOnly}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t.socialEvents.create.paymentDeadlineHint}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                className="tl-btn green"
                disabled={!allValid || saving || readOnly}
                onClick={handleSave}
                style={{
                  opacity: !allValid || saving || readOnly ? 0.5 : 1,
                  cursor: !allValid || saving || readOnly ? "not-allowed" : "pointer",
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? edit.saving : `${edit.save} →`}
              </button>
              <Link
                to={`/clb/${clubSlug}/quan-ly`}
                className="tl-btn"
                style={{ textDecoration: "none" }}
              >
                {edit.cancelBtn}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Danger zone — cancel event entirely */}
        {!isCancelled && (
          <Card className="mt-8 border-destructive/40">
            <CardContent className="space-y-3 pt-6">
              <h2 className="font-mono text-xs uppercase tracking-wider text-destructive">
                {edit.dangerZone}
              </h2>
              <h3 className="text-lg font-semibold">{edit.cancelEventHeading}</h3>
              <p className="text-sm text-muted-foreground">{edit.cancelEventBody}</p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                className="gap-1"
                disabled={eventStarted}
              >
                <Trash2 className="h-4 w-4" /> {edit.cancelEventCta}
              </Button>
            </CardContent>
          </Card>
        )}

        {cancelOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !cancelling && setCancelOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{edit.cancelEventModalTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {edit.cancelEventModalBody.replace("{n}", String(activeRegs))}
              </p>
              <div className="mt-4 space-y-2">
                <Label htmlFor="ev-cancel-confirm">
                  {edit.cancelEventModalInputLabel.replace("{name}", evTitle)}
                </Label>
                <Input
                  id="ev-cancel-confirm"
                  value={cancelTyped}
                  onChange={(e) => setCancelTyped(e.target.value)}
                  autoFocus
                  disabled={cancelling}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelTyped("");
                  }}
                >
                  {edit.modalBack}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cancelTyped.trim() !== evTitle || cancelling}
                  onClick={handleCancelEvent}
                >
                  {cancelling ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  {cancelling ? edit.cancelEventCancelling : edit.cancelEventConfirmCta}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TheLineLayout>
  );
}
