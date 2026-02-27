import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useForumCategories } from "@/hooks/useForumCategories";
import { useCreateForumPost } from "@/hooks/useForumPosts";
import { ForumImageUpload } from "@/components/forum";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/MainLayout";
import { getLoginUrl } from "@/lib/auth-config";

const ForumPostCreate = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: categories = [] } = useForumCategories();
  const createPost = useCreateForumPost();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isQA, setIsQA] = useState(false);

  if (!user) {
    return (
      <MainLayout>
        <div className="container-wide max-w-2xl py-12 text-center">
          <p className="text-muted-foreground mb-4">{t.forum.loginToPost}</p>
          <Button asChild>
            <Link to={getLoginUrl("/forum/new")}>{t.nav.login}</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
      if (!tags.includes(tag) && tags.length < 5) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    }
  };

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    createPost.mutate(
      {
        title: title.trim(),
        content: content.trim(),
        category_id: categoryId || undefined,
        tags,
        image_urls: images,
        is_qa: isQA,
        user_id: user.id,
      },
      {
        onSuccess: (data) => {
          toast({ title: t.forum.publishSuccess });
          navigate(`/forum/post/${data.id}`);
        },
      }
    );
  };

  return (
    <MainLayout>
      <div className="container-wide max-w-2xl py-6 space-y-6">
        <Link to="/forum" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          {t.forum.backToForum}
        </Link>

        <h1 className="text-2xl font-bold">{t.forum.newPost}</h1>

        <div className="space-y-4">
          <div>
            <Label>{t.forum.postTitle}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.forum.postTitlePlaceholder}
              maxLength={200}
            />
          </div>

          <div>
            <Label>{t.forum.selectCategory}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t.forum.selectCategory} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t.forum.postContent}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.forum.postContentPlaceholder}
              rows={8}
            />
          </div>

          <div>
            <Label>{t.forum.addTags}</Label>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={t.forum.addTagsPlaceholder}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button onClick={() => setTags(tags.filter((t) => t !== tag))}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <ForumImageUpload images={images} onChange={setImages} />

          <div className="flex items-center gap-2">
            <Switch checked={isQA} onCheckedChange={setIsQA} id="qa-toggle" />
            <Label htmlFor="qa-toggle">{t.forum.markAsQA}</Label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !content.trim() || createPost.isPending}
            className="w-full"
          >
            {createPost.isPending ? t.forum.publishing : t.forum.publish}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default ForumPostCreate;
