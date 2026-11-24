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
 * Photo-first composer for community posts (UGC v1). The picked image
 * is normalized in the browser before upload (canvas re-encode to WebP
 * at <=1600px, which also strips EXIF and accepts whatever format the
 * phone hands over - HEIC included); the create-post edge function
 * validates the bytes (magic-byte sniff), stores them in the
 * post-images bucket and inserts the social_posts row; the database
 * trigger decides whether the post starts approved or pending
 * moderation.
 *
 * Loaded lazily from Feed.tsx so the composer code stays out of the
 * feed's initial chunk for everyone who never posts.
 */

const MAX_BODY_CHARS = 2000;
const MAX_UPLOAD_LONG_EDGE = 1600;

/**
 * Re-encode the picked file to WebP <=1600px via canvas. Any failure
 * (an ancient browser, an undecodable file) falls back to the original
 * file - the server still validates and may accept it as-is.
 */
async function normalizeImageForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > MAX_UPLOAD_LONG_EDGE
      ? MAX_UPLOAD_LONG_EDGE / longEdge
      : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82)
    );
    if (!blob) return file;
    return new File([blob], "post.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Specific, user-readable messages per create-post error code. */
const POST_ERROR_MESSAGES: Record<string, { vi: string; en: string }> = {
  image_type_not_allowed: {
    vi: "Định dạng ảnh chưa được hỗ trợ - hãy chọn ảnh JPG, PNG hoặc WebP",
    en: "That image format is not supported - please pick a JPG, PNG or WebP image",
  },
  image_undecodable: {
    vi: "Không đọc được file ảnh này - hãy thử một ảnh khác",
    en: "That image file could not be read - please try another one",
  },
  image_too_large: {
    vi: "Ảnh vượt quá 10 MB - hãy chọn ảnh nhỏ hơn",
    en: "The image is over 10 MB - please pick a smaller one",
  },
  image_dimensions_too_large: {
    vi: "Ảnh có kích thước quá lớn - hãy chọn ảnh nhỏ hơn",
    en: "The image dimensions are too large - please pick a smaller one",
  },
  image_required: {
    vi: "Hãy chọn một ảnh trước khi đăng",
    en: "Please choose a photo before posting",
  },
  body_too_long: {
    vi: "Nội dung vượt quá 2000 ký tự",
    en: "The caption is over 2000 characters",
  },
  unauthorized: {
    vi: "Phiên đăng nhập đã hết hạn - hãy đăng nhập lại",
    en: "Your session has expired - please sign in again",
  },
  upload_failed: {
    vi: "Tải ảnh lên chưa thành công - hãy thử lại",
    en: "The image upload failed - please try again",
  },
  insert_failed: {
    vi: "Lưu bài chưa thành công - hãy thử lại",
    en: "The post could not be saved - please try again",
  },
};

/** Pull the function's `{ error: code }` out of a supabase-js invoke error. */
async function readPostErrorCode(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const parsed = (await ctx.json()) as { error?: unknown };
      return typeof parsed?.error === "string" ? parsed.error : null;
    }
  } catch {
    // Not a function error with a JSON body - fall through to generic.
  }
  return null;
}

export default function FeedComposer({
  language,
  variant = "inline",
  onPosted,
}: {
  language: Language;
  /** "sheet" drops the in-feed section chrome (the sheet header carries
   * the title) when the composer is hosted inside the post sheet. */
  variant?: "inline" | "sheet";
  /** Called after a successful post (the sheet host closes itself). */
  onPosted?: () => void;
}) {
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
      const uploadFile = await normalizeImageForUpload(file);
      const form = new FormData();
      form.append("image", uploadFile);
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
      onPosted?.();
    } catch (err) {
      // Surface the function's specific error code (image format, size,
      // upload...) instead of one generic line for every failure - the
      // generic-only toast is what made the 2026-11-24 failure
      // undiagnosable from the user's screenshot.
      const code = await readPostErrorCode(err);
      const specific = code ? POST_ERROR_MESSAGES[code] : undefined;
      toast({
        title: specific
          ? vi
            ? specific.vi
            : specific.en
          : vi
            ? `Đăng bài chưa thành công, thử lại giúp em${code ? ` (mã: ${code})` : ""}`
            : `Could not publish the post, please try again${code ? ` (code: ${code})` : ""}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inSheet = variant === "sheet";

  return (
    <section
      aria-label={vi ? "Đăng bài bằng ảnh" : "Post with a photo"}
      style={
        inSheet
          ? { padding: 0 }
          : {
              padding: "24px 0",
              borderBottom: "1px solid var(--tl-border)",
            }
      }
    >
      {!inSheet && (
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
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
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
