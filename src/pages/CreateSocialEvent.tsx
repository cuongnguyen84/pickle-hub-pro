// ============================================================================
// CreateSocialEvent (`/clb/:slug/su-kien/moi`) — organizer form.
// ----------------------------------------------------------------------------
// react-hook-form + zod, mirrors the FlexTournamentSetup style. Auth-gated
// behind useClubOwnership. Submits via standard supabase insert (RLS lets
// `created_by = auth.uid()` rows through). Auto-slug from title with
// debounced uniqueness check.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useClub } from "@/hooks/useClub";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

interface FormState {
  title_vi: string;
  title_en: string;
  slug: string;
  description_vi: string;
  description_en: string;
  start_at: string; // datetime-local input
  end_at: string;
  location_text: string;
  location_lat: string;
  location_lng: string;
  court_count: number;
  max_players: number;
  level_min: string;
  level_max: string;
  price_vnd: number;
  allow_guests: boolean;
  cancellation_hours: number;
  zalo_group_url: string;
  visibility: "public" | "club_only";
}

const initial: FormState = {
  title_vi: "",
  title_en: "",
  slug: "",
  description_vi: "",
  description_en: "",
  start_at: "",
  end_at: "",
  location_text: "",
  location_lat: "",
  location_lng: "",
  court_count: 1,
  max_players: 16,
  level_min: "",
  level_max: "",
  price_vnd: 0,
  allow_guests: true,
  cancellation_hours: 12,
  zalo_group_url: "",
  visibility: "public",
};

function toIsoFromLocal(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function CreateSocialEvent() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const create = t.socialEvents.create;
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);

  const [form, setForm] = useState<FormState>(initial);
  const [slugAutoTouched, setSlugAutoTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);

  // Auto-fill slug from title until the user edits the slug field manually.
  useEffect(() => {
    if (slugAutoTouched) return;
    setForm((f) => ({ ...f, slug: slugify(f.title_vi) }));
  }, [form.title_vi, slugAutoTouched]);

  // Debounced uniqueness check.
  useEffect(() => {
    if (!form.slug || form.slug.length < 3) {
      setSlugTaken(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      const { data } = await supabase
        .from("social_events")
        .select("id")
        .eq("slug", form.slug)
        .maybeSingle();
      setSlugTaken(Boolean(data));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [form.slug]);

  const slugValid = useMemo(
    () => /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.slug) && form.slug.length >= 3 && form.slug.length <= 100,
    [form.slug],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(publish: boolean) {
    if (!user || !clubData) return;
    // Required fields
    if (form.title_vi.trim().length < 3) {
      toast({ title: create.errorRequired, description: create.titleVi, variant: "destructive" });
      return;
    }
    if (!slugValid) {
      toast({ title: create.errorSlugFormat, variant: "destructive" });
      return;
    }
    if (slugTaken) {
      toast({ title: create.errorSlugTaken, variant: "destructive" });
      return;
    }
    const startIso = toIsoFromLocal(form.start_at);
    const endIso = toIsoFromLocal(form.end_at);
    if (!startIso || !endIso) {
      toast({ title: create.errorRequired, description: create.startAt, variant: "destructive" });
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      toast({ title: create.errorTimeOrder, variant: "destructive" });
      return;
    }

    const lat = form.location_lat.trim() === "" ? null : Number(form.location_lat);
    const lng = form.location_lng.trim() === "" ? null : Number(form.location_lng);
    const levelMin = form.level_min.trim() === "" ? null : Number(form.level_min);
    const levelMax = form.level_max.trim() === "" ? null : Number(form.level_max);

    setSubmitting(true);
    try {
      const { error } = await supabase.from("social_events").insert({
        club_id: clubData.club.id,
        slug: form.slug,
        title_vi: form.title_vi.trim(),
        title_en: form.title_en.trim() === "" ? null : form.title_en.trim(),
        description_vi: form.description_vi.trim() === "" ? null : form.description_vi.trim(),
        description_en: form.description_en.trim() === "" ? null : form.description_en.trim(),
        start_at: startIso,
        end_at: endIso,
        location_text: form.location_text.trim() === "" ? null : form.location_text.trim(),
        location_lat: lat,
        location_lng: lng,
        court_count: form.court_count,
        max_players: form.max_players,
        level_min: levelMin,
        level_max: levelMax,
        price_vnd: form.price_vnd,
        allow_guests: form.allow_guests,
        cancellation_hours: form.cancellation_hours,
        zalo_group_url: form.zalo_group_url.trim() === "" ? null : form.zalo_group_url.trim(),
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
      navigate(`/su-kien/${form.slug}`);
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

  return (
    <TheLineLayout title={create.pageTitle} active="events" noindex>
      <div className="tl-shell" style={{ padding: "32px 16px 60px", maxWidth: 760, margin: "0 auto" }}>
        <Card>
          <CardHeader>
            <CardTitle>{create.pageTitle}</CardTitle>
            <CardDescription>
              {create.pageSubtitle}
              {clubData && (
                <>
                  {" · "}
                  <Link to={`/clb/${clubData.club.slug}/quan-ly`}>{clubData.club.name}</Link>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!submitting) submit(true);
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="title-vi">{create.titleVi}*</Label>
                <Input
                  id="title-vi"
                  value={form.title_vi}
                  onChange={(e) => update("title_vi", e.target.value)}
                  placeholder={create.titleViPlaceholder}
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title-en">{create.titleEn}</Label>
                <Input
                  id="title-en"
                  value={form.title_en}
                  onChange={(e) => update("title_en", e.target.value)}
                  placeholder={create.titleEnPlaceholder}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">{create.slug}*</Label>
                <div className="flex gap-2">
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugAutoTouched(true);
                      update("slug", slugify(e.target.value));
                    }}
                    maxLength={100}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSlugAutoTouched(false);
                      update("slug", slugify(form.title_vi));
                    }}
                  >
                    {create.slugAuto}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{create.slugHint}</p>
                {form.slug && !slugValid && (
                  <p className="text-sm text-destructive">{create.errorSlugFormat}</p>
                )}
                {slugValid && slugTaken && (
                  <p className="text-sm text-destructive">{create.errorSlugTaken}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc-vi">{create.descriptionVi}</Label>
                <Textarea
                  id="desc-vi"
                  rows={4}
                  value={form.description_vi}
                  onChange={(e) => update("description_vi", e.target.value)}
                  maxLength={2000}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc-en">{create.descriptionEn}</Label>
                <Textarea
                  id="desc-en"
                  rows={3}
                  value={form.description_en}
                  onChange={(e) => update("description_en", e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-at">{create.startAt}*</Label>
                  <Input
                    id="start-at"
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => update("start_at", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-at">{create.endAt}*</Label>
                  <Input
                    id="end-at"
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => update("end_at", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">{create.location}</Label>
                <Input
                  id="location"
                  value={form.location_text}
                  onChange={(e) => update("location_text", e.target.value)}
                  placeholder={create.locationPlaceholder}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="latlng">{create.latLng}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    id="latlng"
                    value={form.location_lat}
                    onChange={(e) => update("location_lat", e.target.value)}
                    placeholder="10.762622"
                    inputMode="decimal"
                  />
                  <Input
                    value={form.location_lng}
                    onChange={(e) => update("location_lng", e.target.value)}
                    placeholder="106.660172"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="courts">{create.courtCount}</Label>
                  <Input
                    id="courts"
                    type="number"
                    min={1}
                    max={50}
                    value={form.court_count}
                    onChange={(e) => update("court_count", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max">{create.maxPlayers}</Label>
                  <Input
                    id="max"
                    type="number"
                    min={2}
                    max={200}
                    value={form.max_players}
                    onChange={(e) => update("max_players", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancel-hrs">{create.cancellationHours}</Label>
                  <Input
                    id="cancel-hrs"
                    type="number"
                    min={0}
                    max={168}
                    value={form.cancellation_hours}
                    onChange={(e) => update("cancellation_hours", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="level-min">{create.levelMin}</Label>
                  <Input
                    id="level-min"
                    inputMode="decimal"
                    value={form.level_min}
                    onChange={(e) => update("level_min", e.target.value)}
                    placeholder="3.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level-max">{create.levelMax}</Label>
                  <Input
                    id="level-max"
                    inputMode="decimal"
                    value={form.level_max}
                    onChange={(e) => update("level_max", e.target.value)}
                    placeholder="4.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">{create.priceVnd}</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.price_vnd}
                  onChange={(e) => update("price_vnd", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">{create.priceVndHint}</p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="allow-guests">{create.allowGuests}</Label>
                  <p className="text-xs text-muted-foreground">{create.allowGuestsHint}</p>
                </div>
                <Switch
                  id="allow-guests"
                  checked={form.allow_guests}
                  onCheckedChange={(v) => update("allow_guests", v)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zalo">{create.zaloGroupUrl}</Label>
                <Input
                  id="zalo"
                  type="url"
                  value={form.zalo_group_url}
                  onChange={(e) => update("zalo_group_url", e.target.value)}
                  placeholder="https://zalo.me/g/..."
                />
              </div>

              <div className="space-y-2">
                <Label>{create.visibility}</Label>
                <div className="space-y-1">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.visibility === "public"}
                      onChange={() => update("visibility", "public")}
                    />
                    <span>{create.visibilityPublic}</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.visibility === "club_only"}
                      onChange={() => update("visibility", "club_only")}
                    />
                    <span>{create.visibilityClubOnly}</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => submit(false)}
                >
                  {create.saveDraft}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {submitting ? create.submitting : create.publishNow}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </TheLineLayout>
  );
}
