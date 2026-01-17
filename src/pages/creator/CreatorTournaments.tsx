import { useState } from "react";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trophy, Calendar, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTeamMatch, CreateTournamentInput } from "@/hooks/useTeamMatch";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  registration: "bg-blue-500/20 text-blue-400",
  group_stage: "bg-yellow-500/20 text-yellow-400",
  playoff: "bg-orange-500/20 text-orange-400",
  completed: "bg-green-500/20 text-green-400",
};

const statusLabels: Record<string, string> = {
  draft: "Nháp",
  registration: "Đăng ký",
  group_stage: "Vòng bảng",
  playoff: "Playoff",
  completed: "Hoàn thành",
};

const defaultGameTemplates = [
  { order_index: 0, game_type: 'WD' as const, display_name: 'Đôi Nữ', scoring_type: 'rally21' as const },
  { order_index: 1, game_type: 'MD' as const, display_name: 'Đôi Nam', scoring_type: 'rally21' as const },
  { order_index: 2, game_type: 'MX' as const, display_name: 'Đôi Nam Nữ', scoring_type: 'rally21' as const },
];

export default function CreatorTournaments() {
  const navigate = useNavigate();
  const { myTournaments, isLoading, createTournament, isCreating } = useTeamMatch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    team_roster_size: 6 as 4 | 6 | 8,
    team_count: 4,
    format: "round_robin" as "round_robin" | "single_elimination" | "rr_playoff",
    require_registration: true,
    has_dreambreaker: true,
    require_min_games_per_player: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    try {
      const input: CreateTournamentInput = {
        name: formData.name.trim(),
        team_roster_size: formData.team_roster_size,
        team_count: formData.team_count,
        format: formData.format,
        require_registration: formData.require_registration,
        has_dreambreaker: formData.has_dreambreaker,
        require_min_games_per_player: formData.require_min_games_per_player,
        game_templates: defaultGameTemplates,
      };

      const tournament = await createTournament(input);
      setDialogOpen(false);
      // Navigate to tournament view
      navigate(`/team-match/${tournament.share_id}`);
    } catch (error) {
      // Error handled in hook
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      team_roster_size: 6,
      team_count: 4,
      format: "round_robin",
      require_registration: true,
      has_dreambreaker: true,
      require_min_games_per_player: false,
    });
  };

  return (
    <CreatorLayout
      title="Quản lý Tournaments"
      actions={
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Tạo Tournament
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tạo Team Match Tournament</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên giải đấu *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Giải Pickleball Đội 2025"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số đội</Label>
                  <Select
                    value={formData.team_count.toString()}
                    onValueChange={(v) => setFormData({ ...formData, team_count: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n} đội</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Số thành viên/đội</Label>
                  <Select
                    value={formData.team_roster_size.toString()}
                    onValueChange={(v) => setFormData({ ...formData, team_roster_size: parseInt(v) as 4 | 6 | 8 })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 người</SelectItem>
                      <SelectItem value="6">6 người</SelectItem>
                      <SelectItem value="8">8 người</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Thể thức</Label>
                <Select
                  value={formData.format}
                  onValueChange={(v) => setFormData({ ...formData, format: v as typeof formData.format })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Vòng tròn (Round Robin)</SelectItem>
                    <SelectItem value="single_elimination">Loại trực tiếp</SelectItem>
                    <SelectItem value="rr_playoff">Vòng bảng + Playoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dreambreaker">Cho phép Dreambreaker</Label>
                  <Switch
                    id="dreambreaker"
                    checked={formData.has_dreambreaker}
                    onCheckedChange={(c) => setFormData({ ...formData, has_dreambreaker: c })}
                  />
                </div>
                <p className="text-xs text-foreground-muted">
                  Dreambreaker: 4 ván đơn rally scoring khi hòa 2-2
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Đang tạo..." : "Tạo giải đấu"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground-secondary text-sm">Tổng số</p>
                <p className="text-2xl font-bold text-foreground">
                  {myTournaments?.length || 0}
                </p>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground-secondary text-sm">Đang diễn ra</p>
                <p className="text-2xl font-bold text-foreground">
                  {myTournaments?.filter(t => 
                    t.status === 'group_stage' || t.status === 'playoff'
                  ).length || 0}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Tournaments List */}
        <div className="glass-card">
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-foreground">
              Danh sách Tournaments
            </h2>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center text-foreground-secondary">
              Đang tải...
            </div>
          ) : !myTournaments?.length ? (
            <div className="p-8 text-center">
              <Trophy className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
              <p className="text-foreground-secondary mb-4">
                Bạn chưa có tournament nào
              </p>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tạo Tournament đầu tiên
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {myTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  to={`/team-match/${tournament.share_id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">
                        {tournament.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                        <Users className="w-3.5 h-3.5" />
                        <span>{tournament.team_count} đội</span>
                        <span>•</span>
                        <span>
                          {format(new Date(tournament.created_at || ''), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className={statusColors[tournament.status || 'draft']}>
                    {statusLabels[tournament.status || 'draft']}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </CreatorLayout>
  );
}
