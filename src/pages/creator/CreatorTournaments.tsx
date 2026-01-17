import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Calendar, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useTeamMatch } from "@/hooks/useTeamMatch";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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

export default function CreatorTournaments() {
  const { myTournaments, isLoading } = useTeamMatch();

  return (
    <CreatorLayout
      title="Quản lý Tournaments"
      actions={
        <Button asChild>
          <Link to="/team-match/setup">
            <Plus className="w-4 h-4 mr-2" />
            Tạo Tournament
          </Link>
        </Button>
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
              <Button asChild size="sm">
                <Link to="/team-match/setup">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo Tournament đầu tiên
                </Link>
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
