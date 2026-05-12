// ============================================================================
// CreateClub (`/clubs/new`) — self-service club creation form (PR55).
// ----------------------------------------------------------------------------
// Single page form. Auth-gated — anonymous viewers bounce to /login with
// a redirect param. On submit:
//   1. RPC check: user_club_count(auth.uid()) < 3
//   2. INSERT into clubs with created_by = auth.uid()
//   3. Optional logo upload to the clubs-logos bucket; persist logo_url
//      back onto the club row
//   4. Navigate to /clb/<slug>/quan-ly with a welcome toast
//
// Slug auto-generates from the name (Vietnamese diacritic stripping +
// lowercase + hyphens) but the user can override; uniqueness is checked
// with a 350ms debounce against the clubs table.
// ============================================================================

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useClubLogoUpload,
  CLUB_LOGO_MAX_BYTES,
} from "@/hooks/useClubLogoUpload";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const MAX_CLUBS_PER_USER = 3;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function CreateClub() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const create = t.socialEvents.createClub;
  const { upload, uploading, error: uploadErr } = useClubLogoUpload();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [slugTaken, setSlugTaken] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-slug from name until the user manually edits the slug field.
  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(name));
  }, [name, slugTouched]);

  // Debounced uniqueness check.
  useEffect(() => {
    if (!SLUG_RE.test(slug) || slug.length < 3) {
      setSlugTaken(false);
      return;
    }
    setSlugChecking(true);
    const handle = window.setTimeout(async () => {
      const { data } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      setSlugTaken(Boolean(data));
      setSlugChecking(false);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [slug]);

  const slugValid = useMemo(
    () => SLUG_RE.test(slug) && slug.length >= 3 && slug.length <= 50,
    [slug],
  );

  const nameValid = name.trim().length >= 3 && name.trim().length <= 100;
  const locationValid = location.trim().length >= 3;

  const canSubmit =
    !submitting &&
    !uploading &&
    nameValid &&
    slugValid &&
    !slugTaken &&
    !slugChecking &&
    locationValid;

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (f.size > CLUB_LOGO_MAX_BYTES) {
      toast({
        title: create.logoTooLargeTitle,
        description: create.logoTooLargeBody,
        variant: "destructive",
      });
      return;
    }
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result));
    reader.readAsDataURL(f);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
  }

  async function handleSubmit() {
    if (!user) return;
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Spam mitigation — server-side authoritative check.
      const { data: count, error: countErr } = await supabase.rpc(
        "user_club_count",
        { p_user_id: user.id },
      );
      if (countErr) {
        console.error("user_club_count error", countErr);
        toast({ title: t.common.error, description: countErr.message, variant: "destructive" });
        return;
      }
      const userClubs = typeof count === "number" ? count : 0;
      if (userClubs >= MAX_CLUBS_PER_USER) {
        toast({
          title: create.tooManyClubsTitle,
          description: create.tooManyClubsBody.replace("{max}", String(MAX_CLUBS_PER_USER)),
          variant: "destructive",
        });
        return;
      }

      // Optional logo upload BEFORE insert so we can persist logo_url
      // atomically with the club row. A failed upload is non-fatal —
      // we toast a warning and proceed with logo_url = null.
      let logoUrl: string | null = null;
      if (logoFile) {
        const result = await upload(logoFile);
        if (!result) {
          toast({
            title: create.logoUploadError,
            description: uploadErr ?? "",
            variant: "destructive",
          });
        } else {
          logoUrl = result.publicUrl;
        }
      }

      const { error: insErr } = await supabase.from("clubs").insert({
        slug,
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        location_text: location.trim(),
        logo_url: logoUrl,
        created_by: user.id,
      });
      if (insErr) {
        if (insErr.message.toLowerCase().includes("clubs_slug")) {
          setSlugTaken(true);
          toast({ title: create.slugTaken, variant: "destructive" });
          return;
        }
        console.error("CreateClub insert error", insErr);
        toast({ title: t.common.error, description: insErr.message, variant: "destructive" });
        return;
      }

      toast({ title: create.successTitle, description: create.successBody });
      navigate(`/clb/${slug}/quan-ly`);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Auth gating ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <TheLineLayout title="Loading…" active="clubs" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (!user) {
    return <Navigate to={buildLoginRedirect("/clubs/new")} replace />;
  }

  return (
    <TheLineLayout title={create.pageTitle} active="clubs" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {create.kicker}</div>
          <h1>{create.heading}</h1>
        </header>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="club-name">{create.nameLabel} *</Label>
              <Input
                id="club-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={create.namePlaceholder}
                maxLength={100}
                required
              />
              {name.length > 0 && !nameValid && (
                <p className="text-xs text-destructive">{create.nameInvalid}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-slug">{create.slugLabel} *</Label>
              <div className="flex gap-2">
                <Input
                  id="club-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="clb-test-saigon"
                  maxLength={50}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSlugTouched(false);
                    setSlug(slugify(name));
                  }}
                >
                  {create.slugAuto}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{create.slugHint}</p>
              {slug.length > 0 && !slugValid && (
                <p className="text-xs text-destructive">{create.slugInvalid}</p>
              )}
              {slugValid && slugChecking && (
                <p className="text-xs text-muted-foreground">{create.slugChecking}</p>
              )}
              {slugValid && !slugChecking && slugTaken && (
                <p className="text-xs text-destructive">{create.slugTaken}</p>
              )}
              {slugValid && !slugChecking && !slugTaken && slug.length >= 3 && (
                <p className="text-xs text-primary">{create.slugAvailable}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-desc">{create.descriptionLabel}</Label>
              <Textarea
                id="club-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={create.descriptionPlaceholder}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-location">{create.locationLabel} *</Label>
              <Input
                id="club-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={create.locationPlaceholder}
                maxLength={200}
                required
              />
              <p className="text-xs text-muted-foreground">{create.locationHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-logo">{create.logoLabel}</Label>
              {logoPreview ? (
                <div className="flex items-start gap-3">
                  <img
                    src={logoPreview}
                    alt=""
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-md border border-border object-cover"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={clearLogo}>
                    <X className="mr-1 h-3.5 w-3.5" /> {create.logoRemove}
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="club-logo"
                  className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground hover:border-primary/50"
                >
                  <Upload className="h-4 w-4" />
                  <span>{create.logoUpload}</span>
                </label>
              )}
              <input
                id="club-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">{create.logoHint}</p>
            </div>

            <button
              type="button"
              className="tl-btn green w-full sm:w-auto"
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{
                opacity: canSubmit ? 1 : 0.5,
                cursor: canSubmit ? "pointer" : "not-allowed",
                justifyContent: "center",
              }}
            >
              {submitting || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {submitting || uploading ? create.submitting : `${create.submit} →`}
            </button>

            <div className="rounded-md border border-blue-400/30 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              ⓘ {create.infoBanner.replace("{max}", String(MAX_CLUBS_PER_USER))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              <Link to="/clubs" className="hover:underline">
                ← {create.backToList}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </TheLineLayout>
  );
}
