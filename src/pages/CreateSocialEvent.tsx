// ============================================================================
// CreateSocialEvent (`/clb/:slug/social/moi`) — organizer wizard (PR50a).
// ----------------------------------------------------------------------------
// Refactored from a single-form page into a 2-step wizard:
//   Step 1 — event details (name, schedule, location, capacity, visibility)
//   Step 2 — participation fee + a reactive banner that explains what the
//            player will see at registration based on the club's payment
//            config (free / pay-at-venue / VietQR).
//
// State lives here (single source of truth). Validation is computed live in
// useMemo; per-field display gates on a `touched` map so the user doesn't
// see red text on inputs they haven't touched yet. Step 1 → Step 2 only
// when every Step-1 field validates; the submit handlers require Step-2
// to also validate (and re-run Step-1 as a final defence).
//
// Backend insert maps form state onto the existing `social_events` schema
// (single-language title/description, default cancellation_hours = 12,
// allow_guests = true, no lat/lng/level UI). The fields that the wizard
// drops compared to the legacy single-form keep sensible defaults so the
// DB constraints stay satisfied.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { completeJourney, startJourney, trackJourneyStep } from "@/lib/journeys";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { LoadingState } from "@/components/states/PageStates";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useClub } from "@/hooks/useClub";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { StepHeader } from "@/components/wizard/StepHeader";
import { Step1Info } from "@/components/social/create-event/Step1Info";
import { Step2Payment } from "@/components/social/create-event/Step2Payment";
import {
  initialForm,
  validateSlots,
  validateStep1,
  validateStep2,
  type FormState,
  type FormErrors,
} from "@/components/social/create-event/types";
import type { SocialEventTemplate } from "@/content/social-event-templates";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { useNoindex } from "@/hooks/useNoindex";
import { useAutosaveDraft } from "@/hooks/useAutosaveDraft";
import { DraftRestoredBanner, DraftSaveStatus } from "@/components/wizard/DraftAutosave";

function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Strip Vietnamese diacritics + general Latin accents.
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Build an ISO timestamp from a YYYY-MM-DD date + HH:MM time string,
 * interpreted in the client's local zone. Returns null on parse failure.
 */
function composeIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// UX-05 recovery panel — map each validated field to its input's DOM id
// (ids live in Step1Info/Step2Payment) so a missing-field row can scroll
// + focus the exact control.
const FIELD_DOM_ID: Partial<Record<keyof FormState, string>> = {
  title: "ev-name",
  start_date: "ev-date",
  start_time: "ev-start-time",
  end_time: "ev-end-time",
  location_text: "ev-location",
  court_count: "ev-courts",
  max_players: "ev-max",
  zalo_group_url: "ev-zalo",
  repeat_weeks: "ev-repeat",
  price_vnd: "ev-price",
  bank_code: "ev-bank-code",
  bank_account_number: "ev-account-number",
  bank_account_name: "ev-account-name",
  prepayment_deadline_hours: "ev-prepayment-deadline",
};

interface MissingField {
  /** DOM id of the offending input, or null when there is no single field
   *  to jump to (slot-level errors). */
  fieldId: string | null;
  text: string;
}

export default function CreateSocialEvent() {
  // PR72 (SEO Phase 2A I-7): organizer-only wizard.
  useNoindex();

  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const create = t.socialEvents.create;
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);

  const [step, setStep] = useState<1 | 2>(1);

  // ── BASE-02 journey instrumentation (contract: north-star-journeys.md) ──
  // Entry condition: the authorized create wizard is usable.
  const journeyStartedRef = useRef(false);
  useEffect(() => {
    if (permission.state === "allowed" && !journeyStartedRef.current) {
      journeyStartedRef.current = true;
      startJourney("organizer_event");
      trackJourneyStep("organizer_event", "organizer_event_creation_started", {
        auth_state: "authenticated",
      });
    }
  }, [permission.state]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  // UX-03 — explicit fee branching. Not part of FormState: validation +
  // submit stay keyed on the persisted price_vnd (proposal §6 condition);
  // this only drives which Step-2 fields render.
  const [feeMode, setFeeMode] = useState<"free" | "paid">("free");
  // UX-05 O4 — weekly-repeat partial retry. Index of the first batch copy
  // that has NOT been created yet; > 0 means the previous publish stopped
  // mid-batch and the next submit resumes from there (keeps the -tuanN
  // slug suffixes and +7d date offsets aligned with the copies already in
  // the DB).
  const [batchResumeIndex, setBatchResumeIndex] = useState(0);

  // ── UX-04 autosave (local-first, xem docs/proposals/ux-01-05) ────────────
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form],
  );
  // Bank trio deliberately EXCLUDED from the draft (same rule as UX-02
  // templates, D3): payment account details never persist outside the DB —
  // CodeQL js/clear-text-storage-of-sensitive-data. Re-entered on restore.
  const draftValue = useMemo(() => {
    const { bank_code: _bc, bank_account_number: _ban, bank_account_name: _bn, ...safeForm } = form;
    return { form: safeForm, step };
  }, [form, step]);
  const draft = useAutosaveDraft<{
    form: Omit<FormState, "bank_code" | "bank_account_number" | "bank_account_name">;
    step: 1 | 2;
  }>({
    key: slug ? `draft:social:${slug}` : null,
    value: draftValue,
    enabled: !submitting && dirty,
  });
  const [restoredDraft, setRestoredDraft] = useState(false);
  useEffect(() => {
    // Apply once at mount. Shape-guard: an envelope from a future schema is
    // already filtered by the hook; this guards a hand-edited payload.
    const d = draft.initial;
    if (!d || typeof d.form !== "object" || d.form === null) return;
    setForm({ ...initialForm, ...d.form });
    setStep(d.step === 2 ? 2 : 1);
    // Restore the fee branch from the persisted price. A paid draft with
    // price still 0 re-opens as "free" — the bank trio is never in the
    // draft anyway, so nothing paid-side is lost.
    if (typeof d.form.price_vnd === "number" && d.form.price_vnd > 0) {
      setFeeMode("paid");
    }
    setRestoredDraft(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate slug from the title; user can't edit it directly in the
  // wizard (the field is hidden) but we still want a clean URL.
  const slugValue = useMemo(() => slugify(form.title), [form.title]);

  // Debounced uniqueness check — only matters at submit time but we
  // pre-check so we can show the error inline on Step 2 (before publish).
  useEffect(() => {
    if (slugValue.length < 3) {
      setSlugTaken(false);
      return undefined;
    }
    const handle = window.setTimeout(async () => {
      const { data } = await supabase
        .from("social_events")
        .select("id")
        .eq("slug", slugValue)
        .maybeSingle();
      setSlugTaken(Boolean(data));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [slugValue]);

  // Live-validate every field on every render. Cheap (pure helpers, ~10
  // fields). Step components display the value only when touched.
  const step1Result = useMemo(() => validateStep1(form, t), [form, t]);
  const step2Result = useMemo(() => validateStep2(form, t), [form, t]);
  const combinedErrors: FormErrors = useMemo(
    () => ({ ...step1Result.errors, ...step2Result.errors }),
    [step1Result.errors, step2Result.errors],
  );
  // NOTE(rules-of-hooks): this memo must stay ABOVE the permission early
  // returns below — calling it after a conditional return crashed the page
  // (React #310) when useClubOwnership resolved loading -> allowed.
  // 2026-05-22 — surface a human-readable list of what's still missing
  // so the organizer knows WHY the green button is greyed out. Without
  // this hint, the user keeps clicking and nothing happens (silent
  // validation only flagged invalid fields with inline red text, which
  // is easy to miss on a long form).
  const slotResult = validateSlots(form.slots, form.max_players, t);
  const missingFields = useMemo<MissingField[]>(() => {
    const list: MissingField[] = [];
    const fieldLabel: Partial<Record<keyof FormState, string>> = {
      title:           create.eventName,
      start_date:      create.startDate,
      start_time:      create.startTime,
      end_time:        create.endTime,
      location_text:   create.location,
      court_count:     create.courtCount,
      max_players:     create.maxPlayers,
      zalo_group_url:  create.zaloGroupUrl,
      price_vnd:       create.priceAmount,
      bank_code:       create.bankLabel,
      bank_account_number: create.accountNumberLabel,
      bank_account_name:   create.accountNameLabel,
      prepayment_deadline_hours: create.paymentDeadlineHours,
    };
    const showStep2 = step === 2;
    const errors = showStep2
      ? { ...step1Result.errors, ...step2Result.errors }
      : step1Result.errors;
    for (const [key, msg] of Object.entries(errors)) {
      if (!msg) continue;
      const k = key as keyof FormState;
      const label = fieldLabel[k] ?? key;
      list.push({ fieldId: FIELD_DOM_ID[k] ?? null, text: `${label}: ${msg}` });
    }
    if (slotResult.totalError) {
      // Capacity overflow — Max players is the field the message points at.
      list.push({ fieldId: "ev-max", text: slotResult.totalError });
    }
    for (const [slotId, slotErr] of Object.entries(slotResult.errors)) {
      if (!slotErr) continue;
      const slotIdx = form.slots.findIndex((s) => s.id === slotId);
      const slotLabel = (form.slots[slotIdx]?.label?.trim() || `${language === "vi" ? "Nhóm" : "Group"} ${slotIdx + 1}`);
      for (const msg of Object.values(slotErr)) {
        if (msg) list.push({ fieldId: null, text: `${slotLabel}: ${msg}` });
      }
    }
    // Slug is derived from the title — fixing it means renaming the event.
    if (slugTaken) list.push({ fieldId: "ev-name", text: create.errorSlugTaken });
    return list;
  }, [
    step,
    step1Result.errors,
    step2Result.errors,
    slotResult,
    form.slots,
    slugTaken,
    create,
    language,
  ]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Editing the slug family or the batch shape invalidates a pending
    // partial-batch resume — the -tuanN offsets no longer line up.
    if (batchResumeIndex > 0 && (key === "title" || key === "start_date" || key === "repeat_weeks")) {
      setBatchResumeIndex(0);
    }
  }
  function markTouched(key: keyof FormState) {
    setTouched((tch) => ({ ...tch, [key]: true }));
  }

  // UX-03 — choosing "Miễn phí" must CLEAR all fee state (risk-auditor #4:
  // no hidden fee data may survive under a free event), not just hide it.
  function handleFeeModeChange(mode: "free" | "paid") {
    setFeeMode(mode);
    if (mode === "free") {
      setForm((f) => ({
        ...f,
        price_vnd: 0,
        bank_code: "",
        bank_account_number: "",
        bank_account_name: "",
        requires_prepayment: false,
      }));
    }
  }

  // UX-02 — apply a static template over a pristine form. Bank trio can
  // never be in a preset (whitelist type, D3), so feeMode derives cleanly
  // from the preset price.
  function applyTemplate(tpl: SocialEventTemplate) {
    setForm({ ...initialForm, ...tpl.preset });
    setFeeMode((tpl.preset.price_vnd ?? 0) > 0 ? "paid" : "free");
  }

  // UX-05 recovery — scroll + focus the offending field. Step-1 fields can
  // be listed while the user is on Step 2 (and vice versa), so flip the
  // step first when the element isn't mounted.
  function jumpToField(fieldId: string) {
    const go = () => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    };
    if (document.getElementById(fieldId)) {
      go();
      return;
    }
    setStep((s) => (s === 1 ? 2 : 1));
    window.setTimeout(go, 60); // let the other step render first
  }

  function handleNext() {
    if (step1Result.valid) {
      trackJourneyStep("organizer_event", "organizer_event_details_completed", {
        auth_state: "authenticated",
      });
      setStep(2);
      // Auto-scroll to top of the wizard card so the user lands at the
      // Step-2 heading rather than wherever the Step-1 form happened to
      // be scrolled to.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Mark every Step-1 field touched so the errors surface inline.
    setTouched((tch) => ({
      ...tch,
      title: true,
      description: true,
      start_date: true,
      start_time: true,
      end_time: true,
      location_text: true,
      court_count: true,
      max_players: true,
      zalo_group_url: true,
      visibility: true,
    }));
    toast({
      title: t.common.error,
      description: create.errorRequired,
      variant: "destructive",
    });
  }

  function handleBack() {
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(publish: boolean) {
    if (!user || !clubData) return;
    // Defence: re-validate everything at submit time so an organizer who
    // somehow bypassed the "Next" gate can't insert a bad row.
    if (!step1Result.valid) {
      setStep(1);
      handleNext();
      return;
    }
    if (!step2Result.valid) {
      setTouched((tch) => ({ ...tch, price_vnd: true }));
      toast({
        title: t.common.error,
        description: combinedErrors.price_vnd ?? create.errorRequired,
        variant: "destructive",
      });
      return;
    }

    const startIso = composeIso(form.start_date, form.start_time);
    const endIso = composeIso(form.start_date, form.end_time);
    if (!startIso || !endIso) {
      toast({
        title: create.errorRequired,
        description: create.startAt,
        variant: "destructive",
      });
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      toast({ title: create.errorTimeOrder, variant: "destructive" });
      return;
    }

    if (slugTaken) {
      toast({ title: create.errorSlugTaken, variant: "destructive" });
      return;
    }
    const finalSlug = slugValue.length >= 3 ? slugValue : slugify(`${form.title}-${Date.now()}`);
    if (finalSlug.length < 3) {
      toast({ title: create.errorSlugFormat, variant: "destructive" });
      return;
    }

    const organizerProps = {
      auth_state: "authenticated" as const,
      submit_action: publish ? ("publish" as const) : ("save_draft" as const),
      visibility: form.visibility,
      price_type: form.price_vnd > 0 ? "paid" : "free",
      requires_prepayment: form.price_vnd > 0 ? form.requires_prepayment : false,
      slot_mode: form.slots.length > 0 ? "configured" : "none",
    };
    trackJourneyStep("organizer_event", "organizer_event_submit_attempted", organizerProps);

    setSubmitting(true);
    try {
      // PR51 atomic submit. The RPC writes social_events + (when paid)
      // event_payment_config inside one PL/pgSQL transaction so a
      // partial failure can't strand a paid event without bank config.
      // Slots are persisted as JSONB. Trim/normalise the per-slot shape
      // before submit so the DB stores tidy values + the edge function
      // can lookup by id without surprises.
      const cleanSlots = form.slots.map((s) => ({
        id: s.id,
        label: s.label.trim(),
        kind: s.kind,
        capacity: Number(s.capacity) || 0,
        court_count: s.court_count ?? null,
        skill_level:
          s.kind === "skill" ? (s.skill_level?.trim() || null) : null,
        min_play_months:
          s.kind === "duration"
            ? s.min_play_months == null
              ? null
              : Number(s.min_play_months)
            : null,
        notes: s.notes && s.notes.trim().length > 0 ? s.notes.trim() : null,
      }));

      const paymentPayload =
        form.price_vnd > 0
          ? {
              bank_code: form.bank_code,
              bank_account_number: form.bank_account_number.trim(),
              bank_account_name: form.bank_account_name.trim(),
            }
          : null;

      // PR weekly-repeat — submit the base event first, then loop N
      // weekly copies (offset start_at + end_at by 7 days each, append
      // a -tuanN suffix to the slug). Each iteration calls the same
      // atomic RPC so a failure mid-loop leaves the earlier copies in
      // place; we surface a partial-failure toast rather than rollback.
      const repeatCount = Math.max(0, Math.min(12, Number(form.repeat_weeks) || 0));
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();

      // UX-05 O4 — resume support: after a partial batch we stay in the
      // wizard and the next submit continues from the first missing week
      // (same slug suffixes, same +7d offsets) instead of re-creating the
      // whole batch.
      const startIndex = Math.min(batchResumeIndex, repeatCount);
      let firstSlug = finalSlug;
      let createdCount = 0;
      for (let i = startIndex; i <= repeatCount; i++) {
        const offsetMs = i * 7 * 24 * 60 * 60 * 1000;
        const iterStart = new Date(startMs + offsetMs).toISOString();
        const iterEnd = new Date(endMs + offsetMs).toISOString();
        const iterSlug = i === 0 ? finalSlug : `${finalSlug}-tuan${i + 1}`;

        const eventPayload = {
          club_id: clubData.club.id,
          slug: iterSlug,
          title_vi: form.title.trim(),
          description_vi: form.description.trim() === "" ? null : form.description.trim(),
          start_at: iterStart,
          end_at: iterEnd,
          location_text: form.location_text.trim() === "" ? null : form.location_text.trim(),
          court_count: form.court_count,
          max_players: form.max_players,
          price_vnd: form.price_vnd,
          zalo_group_url:
            form.zalo_group_url.trim() === "" ? null : form.zalo_group_url.trim(),
          // PR68 — optional ball + free perks badges
          ball_type: form.ball_type.trim() === "" ? null : form.ball_type.trim(),
          free_perks: form.free_perks.length > 0 ? form.free_perks : null,
          status: publish ? "published" : "draft",
          visibility: form.visibility,
          requires_prepayment: form.price_vnd > 0 ? form.requires_prepayment : false,
          prepayment_deadline_hours: form.prepayment_deadline_hours,
          slots: cleanSlots,
        };

        const { data: rows, error } = await supabase.rpc(
          "create_social_event_with_payment",
          { p_event: eventPayload, p_payment: paymentPayload },
        );
        if (error) {
          if (error.message.toLowerCase().includes("social_events_slug")) {
            toast({
              title: createdCount === 0
                ? create.errorSlugTaken
                : `${create.errorSlugTaken} (${createdCount}/${repeatCount + 1})`,
              variant: "destructive",
            });
            if (createdCount === 0) {
              trackJourneyStep("organizer_event", "organizer_event_publish_failed", {
                auth_state: "authenticated",
                failure_stage: "rpc",
                failure_code: "slug_taken",
              });
              return;
            }
            break;
          }
          console.error("CreateSocialEvent RPC error", error);
          trackJourneyStep("organizer_event", "organizer_event_publish_failed", {
            auth_state: "authenticated",
            failure_stage: "rpc",
            failure_code: "rpc_error",
          });
          toast({ title: t.common.error, description: error.message, variant: "destructive" });
          if (createdCount === 0) return;
          break;
        }
        const row = Array.isArray(rows) && rows.length > 0
          ? (rows[0] as { event_slug: string })
          : null;
        if (i === 0) firstSlug = row?.event_slug ?? iterSlug;
        createdCount++;
      }

      // Cumulative across resume passes: copies 0..startIndex-1 already
      // exist in the DB from the previous partial run.
      const totalCreated = startIndex + createdCount;
      const complete = totalCreated === repeatCount + 1;
      if (createdCount > 0) {
        const batchProps = {
          ...organizerProps,
          requested_event_count: repeatCount + 1,
          created_event_count: totalCreated,
          batch_result: complete ? ("complete" as const) : ("partial" as const),
        };
        if (!complete) {
          // Contract: partial repeat batches emit the failure diagnostic
          // ALONGSIDE the activation event.
          trackJourneyStep("organizer_event", "organizer_event_publish_failed", {
            ...batchProps,
            failure_stage: "rpc",
            failure_code: "partial_batch",
          });
        }
        if (startIndex === 0) {
          // Activation fires once per wizard session — a resume pass after
          // a partial batch must not double-count the journey.
          completeJourney(
            "organizer_event",
            publish ? "organizer_event_published" : "organizer_event_draft_saved",
            batchProps,
          );
        }
      }

      if (!complete) {
        // Stay in the wizard with the form intact (and the local draft
        // kept) so the organizer can hit Publish again to create the
        // missing weeks.
        setBatchResumeIndex(totalCreated);
        toast({
          title: create.partialBatchToast
            .replace("{created}", String(totalCreated))
            .replace("{total}", String(repeatCount + 1)),
          variant: "destructive",
        });
        return;
      }

      draft.clear();
      if (repeatCount > 0) {
        toast({
          title: create.bulkCreatedToast.replace("{count}", String(totalCreated)),
        });
      } else {
        toast({ title: publish ? create.successPublished : create.successDraft });
      }
      navigate(`/social/${firstSlug}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <LoadingState />
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

  const step1Disabled = !step1Result.valid;
  const submitDisabled = submitting || !step1Result.valid || !step2Result.valid || slugTaken;


  return (
    <TheLineLayout title={create.pageTitle} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 760, margin: "0 auto" }}>
        <header className="tl-page-head">
          {clubData && (
            <div className="kicker">
              ◆{" "}
              <Link to={`/clb/${clubData.club.slug}/quan-ly`} style={{ color: "inherit", textDecoration: "none" }}>
                {clubData.club.name}
              </Link>
            </div>
          )}
          <h1>{create.pageTitle}</h1>
        </header>

        <Card>
          <CardContent className="pt-6">
            {restoredDraft && (
              <DraftRestoredBanner
                onStartOver={() => {
                  draft.clear();
                  setForm(initialForm);
                  setStep(1);
                  setTouched({});
                }}
              />
            )}
            <StepHeader
              step={step}
              total={2}
              label={step === 1 ? create.step1Heading : create.step2Heading}
            />
            {step === 1 ? (
              <Step1Info
                form={form}
                errors={combinedErrors}
                touched={touched}
                onChange={setField}
                onBlur={markTouched}
                showTemplates={!dirty}
                onApplyTemplate={applyTemplate}
              />
            ) : (
              <Step2Payment
                form={form}
                errors={combinedErrors}
                touched={touched}
                onChange={setField}
                onBlur={markTouched}
                language={language}
                feeMode={feeMode}
                onFeeModeChange={handleFeeModeChange}
              />
            )}

            {/* UX-05 recovery panel (issue #5). Renders when the current
                step's submit button would be disabled by a validation
                error. Semantic tokens only; each row with a known field
                is a button that scrolls + focuses the exact input. */}
            {((step === 1 && step1Disabled) ||
              (step === 2 && submitDisabled && !submitting)) &&
              missingFields.length > 0 && (
                <div
                  role="alert"
                  className="mt-6 rounded-md border border-border px-4 py-3 text-sm"
                >
                  <p className="flex items-center gap-2 font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {create.missingFieldsTitle.replace(
                      "{count}",
                      String(missingFields.length),
                    )}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {missingFields.map((item, i) => (
                      <li key={i}>
                        {item.fieldId ? (
                          <button
                            type="button"
                            onClick={() => jumpToField(item.fieldId as string)}
                            className="py-1 text-left text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            {item.text}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{item.text}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Footer button bar. Sticky-ish via mt-8; full-width on
                mobile, right-aligned on sm+. */}
            <div className="mt-4 border-t pt-3">
              <DraftSaveStatus lastSavedAt={draft.lastSavedAt} saveFailed={draft.saveFailed} />
            </div>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {/* Footer buttons. TheLine vibrant-green pill for the
                  primary CTA (Next on step 1, Publish on step 2). Back
                  + Save-draft are neutral inline / outline pills so the
                  primary action stays the visual anchor. */}
              {step === 1 ? (
                /* DS-03: .tl-btn.green → variant default (lime). type="button"
                   stays explicit on every wizard button — Next must never
                   become an implicit form submit (blocker B3). */
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={step1Disabled}
                  className="min-w-[140px]"
                >
                  {create.nextButton}
                </Button>
              ) : (
                <>
                  {/* De-emphasized mono back link — deliberately NOT a
                      Button variant (characterization: transparent, no
                      hover fill). Inline styles moved to classes. */}
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={submitting}
                    className="tl-mono tl-caps px-3.5 py-2.5 text-[11px] text-[var(--tl-fg-3)] hover:underline disabled:cursor-not-allowed"
                    style={{ letterSpacing: "0.04em" }} // .tl-caps (0.06em) would win over a tracking-* class
                  >
                    {create.backButton}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitDisabled}
                    onClick={() => submit(false)}
                  >
                    {create.saveDraft}
                  </Button>
                  <Button
                    type="button"
                    disabled={submitDisabled}
                    onClick={() => submit(true)}
                    className="min-w-[140px]"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? create.submitting : `${create.publishNow} →`}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TheLineLayout>
  );
}
