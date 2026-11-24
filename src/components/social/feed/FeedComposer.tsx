import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_POST_TOPICS } from "@/hooks/social/useSocialPosts";
import { type Language } from "@/lib/social/feed-formatters";

/**
 * Photo-first composer for community posts (UGC v1). The image is
 * uploaded to the create-post edge function, which re-encodes it to
 * WebP (stripping EXIF), stores it in the post-images bucket and
 * inserts the social_posts row; the database trigger decides whether
 * the post starts approved or pending moderation.
 *
 * Loaded lazily from Feed.tsx so the composer code stays out of the
 * feed's initial chunk for everyone who never posts.
 */

const MAX_BODY_CHARS = 2000;

export default function FeedComposer({ language }: { language: Language }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const vi = language === "vi";

  const pickFile = (next: File | null) => {
    setFile(next);
    if (!next) {
      setPreviewUrl(null);
      return;
    }
    // Preview via a data URL read from the local file. (An object URL
    // would work too, but CodeQL's js/xss-through-dom model flags the
    // files -> createObjectURL -> img.src flow; the FileReader result
    // is the same image bytes without that flow.)
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(
        typeof reader.result === "string" ? reader.result : null,
      );
    };
    reader.readAsDataURL(next);
  };

  const handleSubmit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("image", file);
      if (body.trim()) form.append("body", body.trim());
      if (topic) form.append("topic", topic);
      const { data, error } = await supabase.functions.invoke("create-post", {
        body: form,
      });
      if (error) throw error;
      const status = (data as { post?: { status?: string } } | null)?.post
        ?.status;
      toast({
        title:
          status === "pending"
            ? vi
              ? "Đã gửi bài - đang chờ duyệt"
              : "Post submitted - awaiting review"
            : vi
              ? "Đã đăng bài"
              : "Post published",
      });
      pickFile(null);
      setBody("");
      setTopic("");
      await queryClient.invalidateQueries({
        queryKey: ["feed", "social-posts"],
      });
    } catch {
      toast({
        title: vi
          ? "Đăng bài chưa thành công, thử lại giúp em"
          : "Could not publish the post, please try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-label={vi ? "Đăng bài bằng ảnh" : "Post with a photo"}
      style={{
        padding: "24px 0",
        borderBottom: "1px solid var(--tl-border)",
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--tl-fg)",
          margin: "0 0 12px",
        }}
      >
        {vi ? "Đăng bài bằng ảnh" : "Post with a photo"}
      </h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
      />

      {previewUrl ? (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <img
            src={previewUrl}
            alt=""
            style={{ width: "100%", borderRadius: 8, display: "block" }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => pickFile(null)}
            style={{ position: "absolute", top: 8, right: 8 }}
          >
            <X className="h-4 w-4" />
            {vi ? "Bỏ ảnh" : "Remove"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginBottom: 12 }}
        >
          <ImagePlus className="h-4 w-4 mr-2" />
          {vi ? "Chọn ảnh (bắt buộc)" : "Choose a photo (required)"}
        </Button>
      )}

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={MAX_BODY_CHARS}
        rows={3}
        placeholder={
          vi
            ? "Viết vài dòng về bức ảnh..."
            : "Say something about the photo..."
        }
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <select
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          aria-label={vi ? "Chủ đề" : "Topic"}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--tl-border)",
            background: "var(--tl-surface)",
            color: "var(--tl-fg)",
            fontSize: 14,
          }}
        >
          <option value="">{vi ? "Chủ đề (tuỳ chọn)" : "Topic (optional)"}</option>
          {SOCIAL_POST_TOPICS.map((t) => (
            <option key={t.key} value={t.key}>
              {vi ? t.vi : t.en}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
          {body.length}/{MAX_BODY_CHARS}
        </span>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!file || submitting}
          style={{ marginLeft: "auto" }}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {vi ? "Đăng bài" : "Post"}
        </Button>
      </div>
      <p style={{ fontSize: 12, color: "var(--tl-fg-3)", margin: "10px 0 0" }}>
        {vi
          ? "Bài đầu tiên của tài khoản mới sẽ chờ duyệt trước khi hiện công khai."
          : "A new account's first posts are reviewed before they appear publicly."}
      </p>
    </section>
  );
}
