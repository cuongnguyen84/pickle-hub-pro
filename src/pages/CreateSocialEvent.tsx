// ============================================================================
// CreateSocialEvent (`/clb/:slug/su-kien/moi`) — organizer wizard (PR50a).
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

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useClub } from "@/hooks/useClub";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { useClubPaymentConfig } from "@/hooks/useClubPaymentConfig";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WizardProgress } from "@/components/social/create-event/WizardProgress";
import { Step1Info } from "@/components/social/create-event/Step1Info";
import { Step2Payment } from "@/components/social/create-event/Step2Payment";
import {
  initialForm,
  validateStep1,
  validateStep2,
  type FormState,
  type FormErrors,
} from "@/components/social/create-event/types";

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

export default function CreateSocialEvent() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const create = t.socialEvents.create;
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);
  // Pulled up-front so the Step-2 banner doesn't have to wait when the
  // user crosses the step boundary.
  const { data: paymentConfig, isLoading: paymentConfigLoading } =
    useClubPaymentConfig(clubData?.club.id);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);

  // Auto-generate slug from the title; user can't edit it directly in the
  // wizard (the field is hidden) but we still want a clean URL.
  const slugValue = useMemo(() => slugify(form.title), [form.title]);

  // Debounced uniqueness check — only matters at submit time but we
  // pre-check so we can show the error inline on Step 2 (before publish).
  useEffect(() => {
    if (slugValue.length < 3) {
      setSlugTaken(false);
      return;
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

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function markTouched(key: keyof FormState) {
    setTouched((tch) => ({ ...tch, [key]: true }));
  }

  function handleNext() {
    if (step1Result.valid) {
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

    setSubmitting(true);
    try {
      const { error } = await supabase.from("social_events").insert({
        club_id: clubData.club.id,
        slug: finalSlug,
        title_vi: form.title.trim(),
        title_en: null,
        description_vi: form.description.trim() === "" ? null : form.description.trim(),
        description_en: null,
        start_at: startIso,
        end_at: endIso,
        location_text: form.location_text.trim() === "" ? null : form.location_text.trim(),
        location_lat: null,
        location_lng: null,
        court_count: form.court_count,
        max_players: form.max_players,
        level_min: null,
        level_max: null,
        price_vnd: form.price_vnd,
        allow_guests: true,
        cancellation_hours: 12,
        zalo_group_url:
          form.zalo_group_url.trim() === "" ? null : form.zalo_group_url.trim(),
        visibility: form.visibility,
        status: publish ? "published" : "draft",
        created_by: user.id,
      });
      if (error) {
        if (error.message.toLowerCase().includes("social_events_slug")) {
          toast({ title: create.errorSlugTaken, variant: "destructive" });
          return;
        }
        console.error("CreateSocialEvent insert error", error);
        toast({ title: t.common.error, description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: publish ? create.successPublished : create.successDraft });
      navigate(`/su-kien/${finalSlug}`);
    } finally {
      setSubmitting(false);
    }
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
            <WizardProgress step={step} />
            {step === 1 ? (
              <Step1Info
                form={form}
                errors={combinedErrors}
                touched={touched}
                onChange={setField}
                onBlur={markTouched}
              />
            ) : (
              <Step2Payment
                form={form}
                errors={combinedErrors}
                touched={touched}
                onChange={setField}
                onBlur={markTouched}
                paymentConfig={paymentConfig}
                paymentConfigLoading={paymentConfigLoading}
                clubSlug={slug ?? ""}
                language={language}
              />
            )}

            {/* Footer button bar. Sticky-ish via mt-8; full-width on
                mobile, right-aligned on sm+. */}
            <div className="mt-8 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              {step === 1 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={step1Disabled}
                  className="sm:min-w-[140px]"
                >
                  {create.nextButton}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={submitting}
                  >
                    {create.backButton}
                  </Button>
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
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {submitting ? create.submitting : create.publishNow}
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
