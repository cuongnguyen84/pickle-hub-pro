import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useI18n } from "@/i18n";
import { useForumCategories, ForumCategory } from "@/hooks/useForumCategories";
import { useForumPosts, useDeleteForumPost, useTogglePinPost } from "@/hooks/useForumPosts";
import { useToggleHidePost } from "@/hooks/useForumPost";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FolderOpen, MessageSquare, Pin, EyeOff, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";

export default function AdminForum() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = language === "vi" ? viLocale : enUS;

  const { data: categories = [], isLoading: catLoading } = useForumCategories();
  const { data: posts = [], isLoading: postsLoading } = useForumPosts({ limit: 50 });

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ForumCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catNameEn, setCatNameEn] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catOrder, setCatOrder] = useState(0);
  const [catSaving, setCatSaving] = useState(false);

  // Delete category dialog
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [catDeleting, setCatDeleting] = useState(false);

  const deletePost = useDeleteForumPost();
  const togglePin = useTogglePinPost();
  const toggleHide = useToggleHidePost();

  // Category CRUD
  const openNewCat = () => {
    setEditingCat(null);
    setCatName("");
    setCatNameEn("");
    setCatSlug("");
    setCatOrder(categories.length);
    setCatDialogOpen(true);
  };

  const openEditCat = (cat: ForumCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatNameEn((cat as any).name_en || "");
    setCatSlug(cat.slug);
    setCatOrder(cat.display_order);
    setCatDialogOpen(true);
  };

  const handleSaveCat = async () => {
    setCatSaving(true);
    try {
      const payload = {
        name: catName,
        name_en: catNameEn || null,
        slug: catSlug || catName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        display_order: catOrder,
      };

      if (editingCat) {
        const { error } = await supabase
          .from("forum_categories")
          .update(payload)
          .eq("id", editingCat.id);
        if (error) throw error;
        toast({ title: "Đã cập nhật danh mục" });
      } else {
        const { error } = await supabase
          .from("forum_categories")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Đã tạo danh mục" });
      }
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setCatDialogOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Có lỗi xảy ra" });
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async () => {
    if (!deletingCatId) return;
    setCatDeleting(true);
    try {
      const { error } = await supabase
        .from("forum_categories")
        .delete()
        .eq("id", deletingCatId);
      if (error) throw error;
      toast({ title: "Đã xóa danh mục" });
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setDeletingCatId(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Có lỗi xảy ra" });
    } finally {
      setCatDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.forum.title}</h1>
          <p className="text-muted-foreground mt-1">Quản lý danh mục và kiểm duyệt bài viết</p>
        </div>

        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Danh mục ({categories.length})
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Bài viết ({posts.length})
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={openNewCat}>
                <Plus className="w-4 h-4" />
                Thêm danh mục
              </Button>
            </div>

            {catLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Chưa có danh mục nào
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <Card key={cat.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cat.name}</span>
                          {(cat as any).name_en && (
                            <Badge variant="outline" className="text-xs">EN: {(cat as any).name_en}</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">/{cat.slug}</Badge>
                          <span className="text-xs text-muted-foreground">#{cat.display_order}</span>
                        </div>
                        {cat.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCat(cat)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingCatId(cat.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            {postsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Chưa có bài viết nào
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <Card key={post.id} className={(post as any).is_hidden ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {post.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                            {(post as any).is_hidden && (
                              <Badge variant="destructive" className="text-xs">Đã ẩn</Badge>
                            )}
                            <h3 className="font-medium text-sm truncate">{post.title}</h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{post.author_name}</span>
                            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale })}</span>
                            {post.category_name && <Badge variant="outline" className="text-xs py-0">{post.category_name}</Badge>}
                            <span>{post.like_count} thích</span>
                            <span>{post.comment_count} bình luận</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => togglePin.mutate({ postId: post.id, isPinned: post.is_pinned })}
                            title={post.is_pinned ? "Bỏ ghim" : "Ghim"}
                          >
                            <Pin className={`w-4 h-4 ${post.is_pinned ? "text-primary" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleHide.mutate({ postId: post.id, isHidden: !!(post as any).is_hidden })}
                            title={(post as any).is_hidden ? "Hiện bài" : "Ẩn bài"}
                          >
                            {(post as any).is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm("Bạn có chắc muốn xóa bài viết này?")) {
                                deletePost.mutate(post.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Sửa danh mục" : "Thêm danh mục"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên (VN)</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ví dụ: Kỹ thuật" />
            </div>
            <div>
              <Label>Tên (EN)</Label>
              <Input value={catNameEn} onChange={(e) => setCatNameEn(e.target.value)} placeholder="e.g. Technique" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="ky-thuat" />
            </div>
            <div>
              <Label>Thứ tự hiển thị</Label>
              <Input type="number" value={catOrder} onChange={(e) => setCatOrder(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSaveCat} disabled={catSaving || !catName.trim()}>
              {catSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deletingCatId} onOpenChange={(open) => !open && setDeletingCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa danh mục</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa danh mục này? Bài viết thuộc danh mục sẽ không bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {catDeleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
