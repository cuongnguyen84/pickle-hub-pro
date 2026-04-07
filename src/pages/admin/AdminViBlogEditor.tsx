import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminViBlogPostById,
  useCreateViBlogPost,
  useUpdateViBlogPost,
  type ViBlogPostInsert,
  type FaqItem,
} from "@/hooks/useViBlogPosts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Eye, Save } from "lucide-react";
import { normalizeImageUrl } from "@/lib/url-utils";

const CATEGORIES = [
  { value: "beginner", label: "Người mới" },
  { value: "rules", label: "Luật chơi" },
  { value: "equipment", label: "Thiết bị" },
  { value: "local", label: "Việt Nam" },
  { value: "tournament", label: "Giải đấu" },
  { value: "news", label: "Tin tức" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminViBlogEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: existingPost, isLoading } = useAdminViBlogPostById(isEdit ? id : undefined);
  const createMutation = useCreateViBlogPost();
  const updateMutation = useUpdateViBlogPost();

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [alternateEnSlug, setAlternateEnSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [autoSlug, setAutoSlug] = useState(true);

  useEffect(() => {
    if (existingPost) {
      setSlug(existingPost.slug);
      setTitle(existingPost.title);
      setMetaTitle(existingPost.meta_title);
      setMetaDescription(existingPost.meta_description);
      setExcerpt(existingPost.excerpt || "");
      setContentHtml(existingPost.content_html);
      setCoverImageUrl(existingPost.cover_image_url || "");
      setCategory(existingPost.category || "");
      setTagsInput((existingPost.tags || []).join(", "));
      setFocusKeyword(existingPost.focus_keyword || "");
      setFaqItems((existingPost.faq_items as FaqItem[]) || []);
      setAlternateEnSlug(existingPost.alternate_en_slug || "");
      setStatus(existingPost.status);
      setAutoSlug(false);
    }
  }, [existingPost]);

  useEffect(() => {
    if (autoSlug && title) {
      setSlug(slugify(title));
    }
  }, [title, autoSlug]);

  const buildPostData = useCallback(
    (overrideStatus?: string): ViBlogPostInsert => {
      const finalStatus = overrideStatus || status;
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return {
        slug,
        title,
        meta_title: metaTitle,
        meta_description: metaDescription,
        excerpt: excerpt || null,
        content_html: contentHtml,
        cover_image_url: coverImageUrl || null,
        author_name: "ThePickleHub",
        category: category || null,
        tags: tags.length > 0 ? tags : null,
        focus_keyword: focusKeyword || null,
        faq_items: faqItems.length > 0 ? faqItems : null,
        related_post_slugs: null,
        alternate_en_slug: alternateEnSlug || null,
        status: finalStatus,
        published_at:
          finalStatus === "published" && (!isEdit || existingPost?.status !== "published")
            ? new Date().toISOString()
            : existingPost?.published_at || null,
      };
    },
    [slug, title, metaTitle, metaDescription, excerpt, contentHtml, coverImageUrl, category, tagsInput, focusKeyword, faqItems, alternateEnSlug, status, isEdit, existingPost],
  );

  const handleSave = (overrideStatus?: string) => {
    if (!slug || !title || !metaTitle || !metaDescription || !contentHtml) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }
    if (metaTitle.length > 60) {
      toast.error("Meta title phải ≤ 60 ký tự");
      return;
    }

    const postData = buildPostData(overrideStatus);

    if (isEdit && id) {
      updateMutation.mutate(
        { id, ...postData },
        {
          onSuccess: () => {
            toast.success("Đã lưu bài viết");
            navigate("/admin/vi-blog");
          },
          onError: (err) => toast.error(`Lỗi: ${err.message}`),
        },
      );
    } else {
      createMutation.mutate(postData, {
        onSuccess: () => {
          toast.success("Đã tạo bài viết");
          navigate("/admin/vi-blog");
        },
        onError: (err) => toast.error(`Lỗi: ${err.message}`),
      });
    }
  };

  const addFaqItem = () => setFaqItems([...faqItems, { question: "", answer: "" }]);
  const removeFaqItem = (index: number) => setFaqItems(faqItems.filter((_, i) => i !== index));
  const updateFaqItem = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqItems];
    updated[index] = { ...updated[index], [field]: value };
    setFaqItems(updated);
  };

  if (isEdit && isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/vi-blog")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {isEdit ? "Chỉnh sửa bài viết" : "Tạo bài viết mới"}
          </h1>
        </div>

        <div className="grid gap-6">
          {/* Title */}
          <div className="space-y-2">
            <Label>Tiêu đề (H1) *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pickleball là gì? Hướng dẫn toàn diện..." />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label>Slug *</Label>
            <div className="flex gap-2">
              <Input
                value={slug}
                onChange={(e) => {
                  setAutoSlug(false);
                  setSlug(e.target.value);
                }}
                placeholder="pickleball-la-gi"
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => { setAutoSlug(true); setSlug(slugify(title)); }}>
                Auto
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">URL: /vi/blog/{slug}</p>
          </div>

          {/* Meta Title */}
          <div className="space-y-2">
            <Label>
              Meta Title * <span className={metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}>({metaTitle.length}/60)</span>
            </Label>
            <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Pickleball là gì? Hướng dẫn A-Z 2026" />
          </div>

          {/* Meta Description */}
          <div className="space-y-2">
            <Label>
              Meta Description *{" "}
              <span className={metaDescription.length < 120 || metaDescription.length > 160 ? "text-destructive" : "text-muted-foreground"}>
                ({metaDescription.length}/160)
              </span>
            </Label>
            <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} placeholder="120-160 ký tự..." />
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Label>Tóm tắt</Label>
            <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="1-2 câu tóm tắt cho blog index" />
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Ảnh cover (URL)</Label>
            <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
            {coverImageUrl && (
              <img src={normalizeImageUrl(coverImageUrl)} alt="Cover preview" className="h-32 object-cover rounded-lg border border-border" />
            )}
          </div>

          {/* Category + Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags (phân cách bằng dấu phẩy)</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="pickleball, luật chơi, 2026" />
            </div>
          </div>

          {/* Focus Keyword */}
          <div className="space-y-2">
            <Label>Focus Keyword</Label>
            <Input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} placeholder="pickleball là gì" />
          </div>

          {/* Alternate EN Slug */}
          <div className="space-y-2">
            <Label>Slug bài EN tương đương (hreflang)</Label>
            <Input value={alternateEnSlug} onChange={(e) => setAlternateEnSlug(e.target.value)} placeholder="what-is-pickleball" />
          </div>

          {/* Content HTML */}
          <div className="space-y-2">
            <Label>Nội dung HTML * <span className="text-muted-foreground">({contentHtml.length} chars)</span></Label>
            <Textarea
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              rows={20}
              placeholder="<h2>Giới thiệu</h2><p>Pickleball là...</p>"
              className="font-mono text-sm"
            />
          </div>

          {/* FAQ Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>FAQ (cho FAQPage Schema)</Label>
              <Button variant="outline" size="sm" onClick={addFaqItem}>
                <Plus className="w-3 h-3 mr-1" /> Thêm FAQ
              </Button>
            </div>
            {faqItems.map((item, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">FAQ #{i + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeFaqItem(i)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  onChange={(e) => updateFaqItem(i, "question", e.target.value)}
                  placeholder="Câu hỏi..."
                />
                <Textarea
                  value={item.answer}
                  onChange={(e) => updateFaqItem(i, "answer", e.target.value)}
                  rows={2}
                  placeholder="Trả lời..."
                />
              </div>
            ))}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Nháp</SelectItem>
                <SelectItem value="published">Đã đăng</SelectItem>
                <SelectItem value="archived">Lưu trữ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
            <Button onClick={() => handleSave()} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button variant="secondary" onClick={() => handleSave("published")} disabled={isSaving}>
              Xuất bản
            </Button>
            {isEdit && slug && (
              <a href={`/vi/blog/${slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <Eye className="w-4 h-4 mr-2" /> Xem trước
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
