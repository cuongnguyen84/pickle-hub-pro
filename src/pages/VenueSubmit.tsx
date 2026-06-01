// ============================================================================
// VenueSubmit (`/san/them`) — crowd-sourced "add a court" form.
// ----------------------------------------------------------------------------
// Auth-gated (RLS: venues_auth_insert requires created_by = auth.uid()).
// Anonymous viewers bounce to /login with a redirect param. On submit we
// generate a unique slug ("<name>-<city>", matching the seed rows), INSERT
// the venue with is_verified = false, then navigate to /san/<slug>.
//
// Coordinates are intentionally NOT collected here — VenueDetail's
// "Chỉ đường" button falls back to a Google Maps address search, so the
// venue is useful immediately; an admin/geocoder can backfill lat/lng later.
// ============================================================================

import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { useNoindex } from "@/hooks/useNoindex";
import { slugifyVenue, surfaceLabel, SURFACE_OPTIONS } from "@/lib/venues";

async function resolveUniqueSlug(base: string): Promise<string> {
  const safeBase = base || "san";
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? safeBase : `${safeBase}-${i + 1}`;
    const { data } = await supabase
      .from("venues")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${safeBase}-${Date.now().toString(36).slice(-4)}`;
}

export default function VenueSubmit() {
  useNoindex();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useI18n();
  const { user, loading: authLoading } = useAuth();

  const vi = language === "vi";

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [numCourts, setNumCourts] = useState("");
  const [isIndoor, setIsIndoor] = useState(false);
  const [surface, setSurface] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nameValid = name.trim().length >= 2 && name.trim().length <= 120;
  const addressValid = address.trim().length >= 3;
  const cityValid = city.trim().length >= 2;
  const canSubmit = !submitting && nameValid && addressValid && cityValid;

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const base = slugifyVenue(name.trim(), city.trim());
      const slug = await resolveUniqueSlug(base);

      const parsedCourts = parseInt(numCourts, 10);
      const courts = Number.isFinite(parsedCourts) && parsedCourts >= 0 ? parsedCourts : null;

      const { error } = await supabase.from("venues").insert({
        slug,
        name: name.trim(),
        address: address.trim(),
        district: district.trim() === "" ? null : district.trim(),
        city: city.trim(),
        country: "VN",
        num_courts: courts,
        surface_type: surface === "" ? null : surface,
        is_indoor: isIndoor,
        phone: phone.trim() === "" ? null : phone.trim(),
        website: website.trim() === "" ? null : website.trim(),
        is_verified: false,
        created_by: user.id,
      });

      if (error) {
        console.error("VenueSubmit: insert error", error);
        toast({
          title: vi ? "Không thể thêm sân" : "Could not add court",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["venues-list"], refetchType: "all" });
      toast({
        title: vi ? "Đã thêm sân!" : "Court added!",
        description: vi
          ? "Cảm ơn bạn đã đóng góp cho cộng đồng."
          : "Thanks for contributing to the community.",
      });
      navigate(`/san/${slug}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <TheLineLayout title={vi ? "Đang tải…" : "Loading…"} active="venues" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (!user) {
    return <Navigate to={buildLoginRedirect("/san/them")} replace />;
  }

  return (
    <TheLineLayout title={vi ? "Thêm sân Pickleball" : "Add a pickleball court"} active="venues" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {vi ? "Sân chơi" : "Courts"}</div>
          <h1>{vi ? "Thêm sân mới" : "Add a new court"}</h1>
        </header>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="v-name">{vi ? "Tên sân" : "Court name"} *</Label>
              <Input
                id="v-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={vi ? "VD: Sân Pickleball Tăng Bạt Hổ" : "e.g. Tang Bat Ho Pickleball"}
                maxLength={120}
                required
              />
              {name.length > 0 && !nameValid && (
                <p className="text-xs text-destructive">
                  {vi ? "Tên sân cần 2–120 ký tự." : "Name must be 2–120 characters."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-address">{vi ? "Địa chỉ" : "Address"} *</Label>
              <Input
                id="v-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={vi ? "Số nhà, tên đường…" : "Street address…"}
                maxLength={200}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="v-district">{vi ? "Quận / Huyện" : "District"}</Label>
                <Input
                  id="v-district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={vi ? "VD: Hai Bà Trưng" : "e.g. District 1"}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-city">{vi ? "Tỉnh / Thành phố" : "City"} *</Label>
                <Input
                  id="v-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={vi ? "VD: Hà Nội" : "e.g. Hanoi"}
                  maxLength={100}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="v-courts">{vi ? "Số sân" : "Number of courts"}</Label>
                <Input
                  id="v-courts"
                  type="number"
                  min={0}
                  value={numCourts}
                  onChange={(e) => setNumCourts(e.target.value)}
                  placeholder="4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-surface">{vi ? "Mặt sân" : "Surface"}</Label>
                <select
                  id="v-surface"
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{vi ? "— Chọn —" : "— Select —"}</option>
                  {SURFACE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {surfaceLabel(s, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isIndoor}
                onChange={(e) => setIsIndoor(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {vi ? "Sân trong nhà (indoor)" : "Indoor court"}
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="v-phone">{vi ? "Số điện thoại" : "Phone"}</Label>
                <Input
                  id="v-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-website">Website / Facebook</Label>
                <Input
                  id="v-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                  maxLength={300}
                />
              </div>
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {submitting
                ? vi ? "Đang lưu…" : "Saving…"
                : `${vi ? "Thêm sân" : "Add court"} →`}
            </button>

            <div className="rounded-md border border-blue-400/30 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              ⓘ{" "}
              {vi
                ? "Sân mới sẽ hiển thị ngay và được đánh dấu “chưa xác minh” cho đến khi quản trị viên kiểm tra."
                : "New courts appear immediately and are marked “unverified” until an admin reviews them."}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              <Link to="/san" className="hover:underline">
                ← {vi ? "Về danh sách sân" : "Back to courts"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </TheLineLayout>
  );
}
