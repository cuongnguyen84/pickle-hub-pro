import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

/**
 * /admin/embeds — lazy v1 of the Instagram embed feature.
 *
 * Admin pastes a reel link (+ optional caption/author/thumbnail URL) and
 * the row shows up as an out-linking card on /feed Trending. No download,
 * no re-hosting — see feed_embeds migration header for the rationale.
 * If click-through proves demand, v2 swaps manual fields for the official
 * IG oEmbed API.
 */

type EmbedRow = {
  id: string;
  url: string;
  caption: string | null;
  author_name: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  published_at: string;
};

type SourceRow = {
  id: string;
  username: string;
  active: boolean;
  auto_publish: boolean;
  last_checked_at: string | null;
  last_error: string | null;
};

/** Same regex as FeedEmbedCard/feed-embeds-sync — keeps dedupe consistent
 *  between hand-pasted reels and auto-ingested ones. */
function shortcodeFromUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Accepts "@name", "name", or a pasted profile URL. */
function usernameFromInput(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, "");
  const fromUrl = trimmed.match(
    /instagram\.com\/([A-Za-z0-9._]+)\/?(?:\?.*)?$/
  );
  const name = fromUrl ? fromUrl[1] : trimmed;
  return /^[A-Za-z0-9._]{1,30}$/.test(name) ? name.toLowerCase() : null;
}

export default function AdminEmbeds() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [author, setAuthor] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-feed-embeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_embeds")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as EmbedRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-feed-embeds"] });
    qc.invalidateQueries({ queryKey: ["feed", "embeds"] });
  };

  const addEmbed = useMutation({
    mutationFn: async () => {
      const trimmed = url.trim();
      if (!/^https:\/\/(www\.)?instagram\.com\//.test(trimmed)) {
        throw new Error("Link phải là https://www.instagram.com/…");
      }
      const { error } = await supabase.from("feed_embeds").insert({
        url: trimmed,
        shortcode: shortcodeFromUrl(trimmed),
        caption: caption.trim() || null,
        author_name: author.trim().replace(/^@/, "") || null,
        thumbnail_url: thumbnail.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setUrl("");
      setCaption("");
      setAuthor("");
      setThumbnail("");
      invalidate();
      toast({ title: "Đã thêm reel vào feed" });
    },
    onError: (e: Error) => {
      toast({ title: "Không thêm được", description: e.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (vars: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("feed_embeds")
        .update({ is_active: vars.is_active })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Đã cập nhật" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_embeds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Đã xoá" });
    },
  });

  // ----- Auto-ingest sources (feed-embeds-sync cron) -----
  const [sourceInput, setSourceInput] = useState("");
  const { data: sources } = useQuery({
    queryKey: ["admin-feed-embed-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_embed_sources")
        .select("*")
        .order("username");
      if (error) throw error;
      return data as SourceRow[];
    },
  });
  const invalidateSources = () =>
    qc.invalidateQueries({ queryKey: ["admin-feed-embed-sources"] });

  const addSource = useMutation({
    mutationFn: async () => {
      const username = usernameFromInput(sourceInput);
      if (!username) throw new Error("Dán link profile hoặc username hợp lệ");
      const { error } = await supabase
        .from("feed_embed_sources")
        .insert({ username });
      if (error) throw error;
    },
    onSuccess: () => {
      setSourceInput("");
      invalidateSources();
      toast({ title: "Đã thêm nguồn — cron sẽ quét trong vòng 1 giờ" });
    },
    onError: (e: Error) => {
      toast({ title: "Không thêm được", description: e.message, variant: "destructive" });
    },
  });

  const toggleSource = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("feed_embed_sources")
        .update({ active: vars.active })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSources();
      toast({ title: "Đã cập nhật nguồn" });
    },
  });

  const removeSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("feed_embed_sources")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateSources();
      toast({ title: "Đã xoá nguồn" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Instagram reels</h1>
          <p className="text-sm text-muted-foreground">
            Dán link reel → hiện card trên /feed Trending, bấm vào mở Instagram.
            Không tải video về (bản quyền + IG ToS).
          </p>
        </div>

        {/* === Add form === */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input
              placeholder="https://www.instagram.com/reel/… (bắt buộc)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Input
              placeholder="Caption hiển thị trên card (tuỳ chọn)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="flex gap-3">
              <Input
                placeholder="Tên tác giả, vd: picklehighlights (tuỳ chọn)"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
              <Input
                placeholder="URL ảnh thumbnail (tuỳ chọn)"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
              />
            </div>
            <Button
              onClick={() => addEmbed.mutate()}
              disabled={addEmbed.isPending || !url.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm vào feed
            </Button>
          </CardContent>
        </Card>

        {/* === Auto-ingest sources === */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Nguồn tự động</h2>
              <p className="text-sm text-muted-foreground">
                Cron mỗi giờ quét reel mới của các tài khoản này qua Instagram
                Graph API (tài khoản đích phải là Business/Creator). Cần secret{" "}
                <code>IG_ACCESS_TOKEN</code> + <code>IG_USER_ID</code> trên edge
                function <code>feed-embeds-sync</code>.
              </p>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Link profile hoặc username, vd: instagram.com/thedinkpickleball"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
              />
              <Button
                onClick={() => addSource.mutate()}
                disabled={addSource.isPending || !sourceInput.trim()}
                className="shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm nguồn
              </Button>
            </div>
            <div className="space-y-2">
              {sources?.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 border rounded p-3"
                >
                  <Badge
                    variant={s.active ? "default" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {s.active ? "active" : "paused"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">@{s.username}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.last_checked_at
                        ? `Quét ${formatDistanceToNow(new Date(s.last_checked_at), { addSuffix: true, locale: vi })}`
                        : "Chưa quét lần nào"}
                      {s.last_error ? ` · lỗi: ${s.last_error.slice(0, 80)}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleSource.mutate({ id: s.id, active: !s.active })
                      }
                    >
                      {s.active ? "Tạm dừng" : "Bật"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeSource.mutate(s.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* === List === */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">
              Đã thêm ({rows?.length ?? 0})
            </h2>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (rows?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có reel nào. Dán link đầu tiên ở trên.
              </p>
            ) : (
              <div className="space-y-2">
                {rows?.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 border rounded p-3"
                  >
                    {row.thumbnail_url && (
                      <img
                        src={row.thumbnail_url}
                        alt=""
                        className="w-10 h-12 object-cover rounded shrink-0"
                      />
                    )}
                    <Badge
                      variant={row.is_active ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {row.is_active ? "active" : "hidden"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">
                        {row.caption || row.url}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.author_name ? `@${row.author_name} · ` : ""}
                        {formatDistanceToNow(new Date(row.published_at), {
                          addSuffix: true,
                          locale: vi,
                        })}{" "}
                        ·{" "}
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          mở IG
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleActive.mutate({
                            id: row.id,
                            is_active: !row.is_active,
                          })
                        }
                      >
                        {row.is_active ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove.mutate(row.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
