import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useDoublesElimination, Tournament } from "@/hooks/useDoublesElimination";
import { Plus, Trophy, Calendar, Users, Eye, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export default function DoublesEliminationList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getUserTournaments } = useDoublesElimination();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTournaments();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadTournaments = async () => {
    setLoading(true);
    const data = await getUserTournaments();
    setTournaments(data);
    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return 'Đang cài đặt';
      case 'ongoing': return 'Đang diễn ra';
      case 'completed': return 'Đã hoàn thành';
      default: return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case 'ongoing': return 'default';
      case 'completed': return 'secondary';
      default: return 'outline';
    }
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'bo1': return 'BO1';
      case 'bo3': return 'BO3';
      case 'bo5': return 'BO5';
      default: return format;
    }
  };

  return (
    <MainLayout>
      <DynamicMeta 
        title="Doubles Elimination - Công cụ chia bảng"
        description="Tạo và quản lý giải đấu Doubles Elimination cho Pickleball"
      />
      
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Doubles Elimination</h1>
            <p className="text-muted-foreground">
              Thể thức loại trực tiếp có nhánh thua cho giải 32+ đội
            </p>
          </div>
          
          {user && (
            <Button onClick={() => navigate('/tools/doubles-elimination/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo giải mới
            </Button>
          )}
        </div>

        {!user ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Đăng nhập để tạo giải đấu</h3>
              <p className="text-muted-foreground mb-4">
                Bạn cần đăng nhập để tạo và quản lý các giải đấu Doubles Elimination
              </p>
              <Button onClick={() => navigate('/login')}>
                Đăng nhập
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Chưa có giải đấu nào</h3>
              <p className="text-muted-foreground mb-4">
                Tạo giải đấu Doubles Elimination đầu tiên của bạn
              </p>
              <Button onClick={() => navigate('/tools/doubles-elimination/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Tạo giải mới
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tournaments.map((tournament) => (
              <Card 
                key={tournament.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/tools/doubles-elimination/${tournament.share_id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{tournament.name}</h3>
                        <Badge variant={getStatusVariant(tournament.status)}>
                          {getStatusLabel(tournament.status)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {tournament.team_count} đội
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          Vòng ngoài: {getFormatLabel(tournament.early_rounds_format)} | 
                          Bán kết+: {getFormatLabel(tournament.finals_format)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: vi })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        Xem
                      </Button>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Về thể thức Doubles Elimination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Doubles Elimination</strong> là thể thức loại trực tiếp cải tiến, 
              cho phép các đội có cơ hội thứ hai sau khi thua ở vòng đầu.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Round 1:</strong> Tất cả đội thi đấu. Thua → xuống nhánh thua</li>
              <li><strong>Round 2:</strong> Đội thua R1 đấu nhau. Thua lần 2 → loại</li>
              <li><strong>Round 3:</strong> Hợp nhất nhánh thắng + thua, chuẩn hóa về 2^n đội</li>
              <li><strong>Round 4+:</strong> Single Elimination chuẩn đến chung kết</li>
            </ul>
            <p>
              Số đội tối thiểu: <strong>32 đội</strong>. 
              Gợi ý: 32, 40, 48, 64, 80, 96, 128 đội.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
