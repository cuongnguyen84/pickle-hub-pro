// ============================================================================
// FindPlayers (`/tim-ban-choi`) — "tìm kèo" board: browse open play requests
// and post your own. Auth-gated, noindex (private utility). No public user
// directory (by design). Contact = in-app DM with the request author
// (get_or_create_dm RPC -> /tin-nhan).
// ============================================================================

import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, MapPin, Plus, Search } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sbFindPlayers as supabase } from "@/lib/find-players";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { useNoindex } from "@/hooks/useNoindex";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { type PlayRequest, playerName } from "@/lib/find-players";

const BANDS = [
  { key: "u2.5", label: "< 2.5", min: 0, max: 2.5 },
  { key: "2.5", label: "2.5 – 3.0", min: 2.5, max: 3.0 },
  { key: "3.0", label: "3.0 – 3.5", min: 3.0, max: 3.5 },
  { key: "3.5", label: "3.5 – 4.0", min: 3.5, max: 4.0 },
  { key: "4.0", label: "4.0+", min: 4.0, max: 99 },
];

export default function FindPlayers() {
  const { language } = useI18n();
  const vi = language === "vi";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useNoindex();

  const [city, setCity] = useState("");

  // post-request form
  const [showForm, setShowForm] = useState(false);
  const [fNote, setFNote] = useState("");
  const [fCity, setFCity] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fBand, setFBand] = useState<string | null>(null);
  const [fWhen, setFWhen] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: requests, isLoading: reqLoading } = useQuery<PlayRequest[]>({
    queryKey: ["play-requests", city],
    queryFn: async () => {
      let q = supabase
        .from("play_requests")
        .select(
          "id, author_id, city, district, venue_id, skill_min, skill_max, play_at, note, status, created_at, author:profiles!play_requests_author_id_fkey(username,display_name,avatar_url,profile_slug), venue:venues!play_requests_venue_id_fkey(slug,name)",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      const c = city.trim().replace(/[,.()*"%_]/g, " ").trim();
      if (c) q = q.ilike("city", `%${c}%`);
      const { data, error } = await q;
      if (error) {
        console.error("FindPlayers: requests", error);
        return [];
      }
      return (data as unknown as PlayRequest[]) ?? [];
    },
    enabled: Boolean(user),
    staleTime: 20_000,
  });

  if (authLoading) {
    return (
      <TheLineLayout title={vi ? "Tìm bạn chơi" : "Find players"} active="players" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (!user) return <Navigate to={buildLoginRedirect("/tim-ban-choi")} replace />;

  async function startDm(otherId: string) {
    if (!user || otherId === user.id) return;
    const { data, error } = await supabase.rpc("get_or_create_dm", { p_other: otherId });
    if (error || !data) {
      toast({ title: vi ? "Không mở được cuộc trò chuyện" : "Could not open chat", variant: "destructive" });
      return;
    }
    navigate(`/tin-nhan?c=${data}`);
  }

  async function submitRequest() {
    if (!user || fNote.trim().length < 5) return;
    setPosting(true);
    try {
      const b = fBand ? BANDS.find((x) => x.key === fBand) : null;
      const { error } = await supabase.from("play_requests").insert({
        author_id: user.id,
        city: fCity.trim() || null,
        district: fDistrict.trim() || null,
        skill_min: b ? b.min : null,
        skill_max: b && b.max < 90 ? b.max : null,
        play_at: fWhen ? new Date(fWhen).toISOString() : null,
        note: fNote.trim(),
        status: "open",
      });
      if (error) {
        toast({ title: vi ? "Không đăng được" : "Could not post", description: error.message, variant: "destructive" });
        return;
      }
      setFNote(""); setFWhen(""); setFBand(null); setFDistrict(""); setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["play-requests"] });
      toast({ title: vi ? "Đã đăng tìm kèo!" : "Posted!" });
    } finally {
      setPosting(false);
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`;

  return (
    <TheLineLayout
      title={vi ? "Tìm bạn chơi Pickleball | ThePickleHub" : "Find pickleball players | ThePickleHub"}
      description={vi ? "Đăng tìm kèo pickleball theo trình và khu vực, nhắn tin trực tiếp trong app." : "Post a pickleball game request by skill and area, message directly in-app."}
      active="players"
      noindex
    >
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 880, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {vi ? "Cộng đồng" : "Community"}</div>
          <h1>{vi ? "Tìm kèo" : "Find a game"}</h1>
          <p>{vi ? "Đăng tin tìm người chơi cùng — chọn khu vực, trình và thời gian. Nhắn tin trực tiếp trong app." : "Post a request to find partners — pick area, level and time. Message in-app."}</p>
        </header>

        {/* Messages link */}
        <div className="mb-5 flex items-center justify-end border-b border-border pb-3">
          <Link to="/tin-nhan" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <MessageCircle className="h-4 w-4" /> {vi ? "Tin nhắn của tôi" : "My messages"}
          </Link>
        </div>

        {/* Post request */}
        {showForm ? (
          <div className="mb-5 rounded-md border border-border bg-card p-4 space-y-3">
            <Textarea value={fNote} onChange={(e) => setFNote(e.target.value)} rows={2} maxLength={300} placeholder={vi ? "Bạn muốn chơi thế nào? (VD: cần 2 bạn trình 3.0 tối nay ở sân Tăng Bạt Hổ)" : "What game are you looking for?"} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input value={fCity} onChange={(e) => setFCity(e.target.value)} placeholder={vi ? "Thành phố" : "City"} maxLength={60} />
              <Input value={fDistrict} onChange={(e) => setFDistrict(e.target.value)} placeholder={vi ? "Quận/Huyện" : "District"} maxLength={60} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{vi ? "Trình:" : "Level:"}</span>
              <button type="button" onClick={() => setFBand(null)} className={chip(fBand === null)}>{vi ? "Mọi trình" : "Any"}</button>
              {BANDS.map((b) => <button key={b.key} type="button" onClick={() => setFBand(b.key)} className={chip(fBand === b.key)}>{b.label}</button>)}
            </div>
            <Input type="datetime-local" value={fWhen} onChange={(e) => setFWhen(e.target.value)} className="sm:max-w-xs" />
            <div className="flex gap-2">
              <button type="button" className="tl-btn green" disabled={posting || fNote.trim().length < 5} onClick={submitRequest} style={{ opacity: posting || fNote.trim().length < 5 ? 0.5 : 1 }}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {vi ? "Đăng" : "Post"}
              </button>
              <button type="button" className="tl-btn" onClick={() => setShowForm(false)}>{vi ? "Huỷ" : "Cancel"}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="tl-btn green mb-5" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> {vi ? "Đăng tìm kèo" : "Post a game request"}</button>
        )}

        {/* City filter */}
        <div className="mb-4 relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={vi ? "Lọc theo khu vực (VD: Hà Nội)" : "Filter by city (e.g. Hanoi)"} className="pl-9" />
        </div>

        {/* Requests list */}
        {reqLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (requests ?? []).length > 0 ? (
          <div className="space-y-3">
            {(requests ?? []).map((r) => {
              const an = r.author ? playerName(r.author) : "—";
              const range = r.skill_min != null ? `${r.skill_min}${r.skill_max != null ? `–${r.skill_max}` : "+"}` : null;
              return (
                <div key={r.id} className="rounded-md border border-border bg-card p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{an}</span>
                    {[r.district, r.city].filter(Boolean).length > 0 && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{[r.district, r.city].filter(Boolean).join(", ")}</span>}
                    {range && <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{vi ? "Trình" : "DUPR"} {range}</span>}
                    {r.play_at && <span>{new Date(r.play_at).toLocaleString(vi ? "vi-VN" : "en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                  <p className="text-sm">{r.note}</p>
                  {r.author_id !== user.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      <button type="button" onClick={() => startDm(r.author_id)} className="tl-btn green" style={{ textDecoration: "none" }}>
                        <MessageCircle className="h-4 w-4" /> {vi ? "Nhắn tin nhận kèo" : "Message to join"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">{vi ? "Chưa có tin tìm kèo nào. Đăng tin đầu tiên!" : "No game requests yet. Post the first one!"}</div>
        )}
      </div>
    </TheLineLayout>
  );
}
