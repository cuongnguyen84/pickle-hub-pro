import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2, Users, Trophy, Calendar, Settings, Gamepad2, Copy, Check } from 'lucide-react';
import { useTeamMatchTournament } from '@/hooks/useTeamMatch';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  setup: 'bg-muted text-muted-foreground',
  registration: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ongoing: 'bg-green-500/10 text-green-500 border-green-500/20',
  completed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  setup: 'Đang thiết lập',
  registration: 'Đang đăng ký',
  ongoing: 'Đang diễn ra',
  completed: 'Đã kết thúc',
};

const FORMAT_LABELS: Record<string, string> = {
  round_robin: 'Vòng tròn',
  single_elimination: 'Loại trực tiếp',
  rr_playoff: 'Vòng tròn + Playoff',
};

export default function TeamMatchView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: tournament, isLoading, error } = useTeamMatchTournament(id);

  const isOwner = tournament?.created_by === user?.id;

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/tools/team-match/${tournament?.share_id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Đã sao chép link!' });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container max-w-4xl py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !tournament) {
    return (
      <MainLayout>
        <div className="container max-w-4xl py-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Không tìm thấy giải đấu</h1>
          <p className="text-muted-foreground mb-6">
            Giải đấu này không tồn tại hoặc đã bị xóa
          </p>
          <Button onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại danh sách
          </Button>
        </div>
      </MainLayout>
    );
  }

  const shareUrl = `${window.location.origin}/tools/team-match/${tournament.share_id}`;

  return (
    <MainLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <Badge variant="outline" className={STATUS_COLORS[tournament.status]}>
                {STATUS_LABELS[tournament.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: vi })}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {tournament.team_count} đội × {tournament.team_roster_size} người
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {FORMAT_LABELS[tournament.format]}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Sao chép link
            </Button>
            {isOwner && (
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Cài đặt
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="teams">Đội</TabsTrigger>
            <TabsTrigger value="matches">Trận đấu</TabsTrigger>
            <TabsTrigger value="standings">Xếp hạng</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Thông tin đội
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số đội:</span>
                    <span className="font-medium">{tournament.team_count} đội</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Roster:</span>
                    <span className="font-medium">{tournament.team_roster_size} người/đội</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đăng ký:</span>
                    <span className="font-medium">
                      {tournament.require_registration ? 'Yêu cầu đăng ký' : 'Không yêu cầu'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    Thể thức
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format:</span>
                    <span className="font-medium">{FORMAT_LABELS[tournament.format]}</span>
                  </div>
                  {tournament.format === 'rr_playoff' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Playoff:</span>
                      <span className="font-medium">{tournament.playoff_team_count} đội</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DreamBreaker:</span>
                    <span className="font-medium">
                      {tournament.has_dreambreaker ? 'Có' : 'Không'}
                    </span>
                  </div>
                  {tournament.has_dreambreaker && tournament.dreambreaker_game_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loại DB:</span>
                      <span className="font-medium">{tournament.dreambreaker_game_type}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick actions for owner */}
            {isOwner && tournament.status === 'setup' && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Bước tiếp theo</CardTitle>
                  <CardDescription>
                    Giải đấu đang ở trạng thái thiết lập
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button>
                    <Users className="h-4 w-4 mr-2" />
                    Thêm đội
                  </Button>
                  <Button variant="outline">
                    Mở đăng ký
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="teams" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có đội nào</p>
                {isOwner && (
                  <Button variant="outline" className="mt-4">
                    <Users className="h-4 w-4 mr-2" />
                    Thêm đội đầu tiên
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có trận đấu nào</p>
                <p className="text-sm mt-1">Thêm đội để bắt đầu tạo lịch thi đấu</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có dữ liệu xếp hạng</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
