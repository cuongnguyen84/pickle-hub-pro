import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminTournaments, useCreateTournament, useUpdateTournament } from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trophy, Calendar, Layers, Star } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { ParentTournament } from "@/hooks/useParentTournament";

interface TournamentFormData {
  name: string;
  slug: string;
  start_date: string;
  end_date: string;
  status: "upcoming" | "ongoing" | "ended";
  description: string;
}

export default function AdminTournaments() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<any>(null);
  const [formData, setFormData] = useState<TournamentFormData>({
    name: "",
    slug: "",
    start_date: "",
    end_date: "",
    status: "upcoming",
    description: "",
  });

  const { data: tournaments, isLoading } = useAdminTournaments();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      start_date: "",
      end_date: "",
      status: "upcoming",
      description: "",
    });
    setEditingTournament(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tournament: any) => {
    setEditingTournament(tournament);
    setFormData({
      name: tournament.name,
      slug: tournament.slug,
      start_date: tournament.start_date || "",
      end_date: tournament.end_date || "",
      status: tournament.status,
      description: tournament.description || "",
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
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        description: formData.description.trim() || null,
      };

      if (editingTournament) {
        await updateTournament.mutateAsync({ id: editingTournament.id, ...payload });
        toast({ title: "Cập nhật giải đấu thành công" });
      } else {
        await createTournament.mutateAsync(payload);
        toast({ title: "Tạo giải đấu thành công" });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ongoing":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{t.tournament.ongoing}</Badge>;
      case "ended":
        return <Badge variant="secondary">{t.tournament.ended}</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">{t.tournament.upcoming}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t.admin.tournaments}</h1>
            <p className="text-foreground-muted mt-1">Quản lý các giải đấu</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {t.admin.tournament.create}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTournament ? t.admin.tournament.edit : t.admin.tournament.create}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.admin.tournament.name}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: !editingTournament ? generateSlug(e.target.value) : formData.slug,
                      });
                    }}
                    placeholder="Tên giải đấu"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t.admin.tournament.slug}</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="slug-giai-dau"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">{t.admin.tournament.startDate}</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">{t.admin.tournament.endDate}</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t.admin.tournament.status}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as "upcoming" | "ongoing" | "ended" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">{t.tournament.upcoming}</SelectItem>
                      <SelectItem value="ongoing">{t.tournament.ongoing}</SelectItem>
                      <SelectItem value="ended">{t.tournament.ended}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t.admin.tournament.description}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả giải đấu"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createTournament.isPending || updateTournament.isPending}
                  >
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tournaments List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : tournaments && tournaments.length > 0 ? (
          <div className="grid gap-4">
            {tournaments.map((tournament) => (
              <Card key={tournament.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{tournament.name}</h3>
                        {getStatusBadge(tournament.status)}
                      </div>
                      <p className="text-sm text-foreground-muted">/{tournament.slug}</p>
                      {(tournament.start_date || tournament.end_date) && (
                        <div className="flex items-center gap-1 text-sm text-foreground-muted mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {tournament.start_date && format(new Date(tournament.start_date), "dd/MM/yyyy")}
                          {tournament.start_date && tournament.end_date && " - "}
                          {tournament.end_date && format(new Date(tournament.end_date), "dd/MM/yyyy")}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(tournament)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Trophy className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
              <p className="text-foreground-muted">Chưa có giải đấu nào</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
