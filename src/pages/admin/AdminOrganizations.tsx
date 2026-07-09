import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminOrganizations, useCreateOrganization, useUpdateOrganization, useDeleteOrganization } from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Building2, Trash2 } from "lucide-react";

interface OrganizationFormData {
  name: string;
  slug: string;
  logo_url: string;
  description: string;
}

export default function AdminOrganizations() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<any>(null);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: "",
    slug: "",
    logo_url: "",
    description: "",
  });

  const { data: organizations, isLoading } = useAdminOrganizations(searchQuery);
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();

  const resetForm = () => {
    setFormData({ name: "", slug: "", logo_url: "", description: "" });
    setEditingOrg(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (org: any) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url || "",
      description: org.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({ variant: "destructive", title: "Vui lòng điền đầy đủ thông tin" });
      return;
    }

    try {
      if (editingOrg) {
        await updateOrg.mutateAsync({
          id: editingOrg.id,
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          logo_url: formData.logo_url.trim() || null,
          description: formData.description.trim() || null,
        });
        toast({ title: "Cập nhật tổ chức thành công" });
      } else {
        await createOrg.mutateAsync({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          logo_url: formData.logo_url.trim() || null,
          description: formData.description.trim() || null,
        });
        toast({ title: "Tạo tổ chức thành công" });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Có lỗi xảy ra" });
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleDelete = async () => {
    if (!orgToDelete) return;
    try {
      await deleteOrg.mutateAsync(orgToDelete.id);
      toast({ title: "Xoá tổ chức thành công" });
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Không thể xoá tổ chức. Có thể đang có nội dung liên kết." });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t.admin.organizations}</h1>
            <p className="text-foreground-muted mt-1">Quản lý các tổ chức trong hệ thống</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {t.admin.organization.create}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingOrg ? t.admin.organization.edit : t.admin.organization.create}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.admin.organization.name}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: !editingOrg ? generateSlug(e.target.value) : formData.slug,
                      });
                    }}
                    placeholder="Tên tổ chức"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t.admin.organization.slug}</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="slug-to-chuc"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">{t.admin.organization.logo}</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t.admin.organization.description}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả về tổ chức"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <Input
            placeholder="Tìm kiếm tổ chức..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Organizations List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : organizations && organizations.length > 0 ? (
          <div className="grid gap-4">
            {organizations.map((org) => (
              <Card key={org.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-6 h-6 text-foreground-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{org.name}</h3>
                      <p className="text-sm text-foreground-muted">/{org.slug}</p>
                      {org.description && (
                        <p className="text-sm text-foreground-muted line-clamp-1 mt-1">{org.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(org)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setOrgToDelete(org);
                          setDeleteDialogOpen(true);
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
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
              <p className="text-foreground-muted">
                {searchQuery ? "Không tìm thấy tổ chức nào" : "Chưa có tổ chức nào"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá tổ chức</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xoá tổ chức <strong>{orgToDelete?.name}</strong>? 
              Hành động này không thể hoàn tác và có thể thất bại nếu tổ chức đang có nội dung liên kết.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrg.isPending}
            >
              {deleteOrg.isPending ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
