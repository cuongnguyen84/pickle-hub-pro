// ============================================================================
// EditClub (`/clb/:slug/quan-ly/cai-dat`) — organizer settings (PR57).
// ----------------------------------------------------------------------------
// Lets the owner update name, description, location, and logo. Slug is
// immutable (display-only) to keep links stable. Bottom of the page has
// a danger zone with the archive flow: double-confirm modal requires the
// owner to type the club name verbatim before the UPDATE fires.
//
// Auth: useClubOwnership gates — anon → /login redirect; non-owner → 403.
// ============================================================================

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useClub } from "@/hooks/useClub";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useClubLogoUpload,
  CLUB_LOGO_MAX_BYTES,
} from "@/hooks/useClubLogoUpload";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { useNoindex } from "@/hooks/useNoindex";

export default function EditClub() {
  // PR72 (SEO Phase 2A I-7): club settings + danger-zone archive.
  useNoindex();

  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);
  const { upload, uploading, error: uploadErr } = useClubLogoUpload();
  const edit = t.socialEvents.editClub;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTyped, setArchiveTyped] = useState("");
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!clubData) return;
    setName(clubData.club.name);
    setDescription(clubData.club.description ?? "");
    setLocation(clubData.club.location_text ?? "");
  }, [clubData]);

  const nameValid = name.trim().length >= 3 && name.trim().length <= 100;
  const locationValid = location.trim().length >= 3;
  const canSave = !saving && !uploading && nameValid && locationValid;

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > CLUB_LOGO_MAX_BYTES) {
      toast({
        title: t.socialEvents.createClub.logoTooLargeTitle,
        description: t.socialEvents.createClub.logoTooLargeBody,
        variant: "destructive",
      });
      return;
    }
    setLogoFile(f);
    setLogoCleared(false);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result));
    reader.readAsDataURL(f);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoCleared(true);
  }

  async function handleSave() {
    if (!clubData || !canSave) return;
    setSaving(true);
    try {
      let logoUrl: string | null | undefined = undefined;
      if (logoFile) {
        const result = await upload(logoFile);
        if (!result) {
          toast({
            title: t.socialEvents.createClub.logoUploadError,
            description: uploadErr ?? "",
            variant: "destructive",
          });
        } else {
          logoUrl = result.publicUrl;
        }
      } else if (logoCleared) {
        logoUrl = null;
      }

      const patch: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        location_text: location.trim(),
      };
      if (logoUrl !== undefined) patch.logo_url = logoUrl;

      const { error: updErr } = await supabase
        .from("clubs")
        .update(patch)
        .eq("id", clubData.club.id);
      if (updErr) {
        console.error("EditClub update error", updErr);
        toast({ title: t.common.error, description: updErr.message, variant: "destructive" });
        return;
      }

      // PR62 v2 — refetchType: 'all' required because App.tsx sets
      // refetchOnMount: false globally. See CreateClub for the
      // detailed rationale. Prefix invalidation handles the
      // user-scoped my-clubs key without needing user.id here.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["club", clubData.club.slug], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["my-clubs"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["clubs-list"], refetchType: "all" }),
      ]);

      toast({ title: edit.successTitle, description: edit.successBody });
      navigate(`/clb/${clubData.club.slug}/quan-ly`);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!clubData) return;
    if (archiveTyped.trim() !== clubData.club.name) return;
    setArchiving(true);
    try {
      const { error: archErr } = await supabase
        .from("clubs")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", clubData.club.id);
      if (archErr) {
        console.error("EditClub archive error", archErr);
        toast({ title: t.common.error, description: archErr.message, variant: "destructive" });
        return;
      }
      // PR62 v2 — refetchType: 'all' so the dropdown + public listing
      // drop the archived club immediately (inactive observers refetch
      // too) and the public /clb/:slug page swaps in the archived
      // banner on next visit even though refetchOnMount is false.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["club", clubData.club.slug], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["my-clubs"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["clubs-list"], refetchType: "all" }),
      ]);

      toast({ title: edit.archiveSuccessTitle, description: edit.archiveSuccessBody });
      navigate("/clubs");
    } finally {
      setArchiving(false);
      setArchiveOpen(false);
    }
  }

  const currentLogo = useMemo(() => {
    if (logoPreview) return logoPreview;
    if (logoCleared) return null;
    return clubData?.club.logo_url ?? null;
  }, [logoPreview, logoCleared, clubData]);

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="clubs" noindex>
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
      <TheLineLayout title={t.socialEvents.manage.noPermissionTitle} active="clubs" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{t.socialEvents.manage.noPermissionTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>
            {t.socialEvents.manage.noPermissionBody}
          </p>
        </div>
      </TheLineLayout>
    );
  }
  if (!clubData) {
    return (
      <TheLineLayout title={t.socialEvents.club.notFound} active="clubs" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout title={`${edit.pageTitle} — ${clubData.club.name}`} active="clubs" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">
            ◆{" "}
            <Link to={`/clb/${clubData.club.slug}/quan-ly`} style={{ color: "inherit", textDecoration: "none" }}>
              {clubData.club.name}
            </Link>
          </div>
          <h1>{edit.pageTitle}</h1>
        </header>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-1">
              <Label>{edit.slugLabel}</Label>
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground">
                /clb/{clubData.club.slug}
              </p>
              <p className="text-xs text-muted-foreground">{edit.slugImmutableHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-name">{edit.nameLabel} *</Label>
              <Input
                id="club-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
              {name.length > 0 && !nameValid && (
                <p className="text-xs text-destructive">{t.socialEvents.createClub.nameInvalid}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-desc">{edit.descriptionLabel}</Label>
              <Textarea
                id="club-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-location">{edit.locationLabel} *</Label>
              <Input
                id="club-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="club-logo">{edit.logoLabel}</Label>
              {currentLogo ? (
                <div className="flex items-start gap-3">
                  <img
                    src={currentLogo}
                    alt=""
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-md border border-border object-cover"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={clearLogo}>
                    <X className="mr-1 h-3.5 w-3.5" /> {t.socialEvents.createClub.logoRemove}
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="club-logo"
                  className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground hover:border-primary/50"
                >
                  <Upload className="h-4 w-4" />
                  <span>{t.socialEvents.createClub.logoUpload}</span>
                </label>
              )}
              <input
                id="club-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">{t.socialEvents.createClub.logoHint}</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                className="tl-btn green"
                disabled={!canSave}
                onClick={handleSave}
                style={{
                  opacity: canSave ? 1 : 0.5,
                  cursor: canSave ? "pointer" : "not-allowed",
                }}
              >
                {saving || uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving || uploading ? edit.saving : `${edit.save} →`}
              </button>
              <Link
                to={`/clb/${clubData.club.slug}/quan-ly`}
                className="tl-btn"
                style={{ textDecoration: "none" }}
              >
                {edit.cancel}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Danger zone — archive */}
        <Card className="mt-8 border-destructive/40">
          <CardContent className="space-y-3 pt-6">
            <h2 className="font-mono text-xs uppercase tracking-wider text-destructive">
              {edit.dangerZone}
            </h2>
            <h3 className="text-lg font-semibold">{edit.archiveHeading}</h3>
            <p className="text-sm text-muted-foreground">{edit.archiveBody}</p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setArchiveOpen(true)}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" /> {edit.archiveCta}
            </Button>
          </CardContent>
        </Card>

        {archiveOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !archiving && setArchiveOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{edit.archiveModalTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {edit.archiveModalBody.replace("{name}", clubData.club.name)}
              </p>
              <div className="mt-4 space-y-2">
                <Label htmlFor="archive-confirm">
                  {edit.archiveModalInputLabel.replace("{name}", clubData.club.name)}
                </Label>
                <Input
                  id="archive-confirm"
                  value={archiveTyped}
                  onChange={(e) => setArchiveTyped(e.target.value)}
                  autoFocus
                  disabled={archiving}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={archiving}
                  onClick={() => {
                    setArchiveOpen(false);
                    setArchiveTyped("");
                  }}
                >
                  {edit.cancel}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={archiveTyped.trim() !== clubData.club.name || archiving}
                  onClick={handleArchive}
                >
                  {archiving ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  {archiving ? edit.archiving : edit.archiveConfirmCta}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TheLineLayout>
  );
}
