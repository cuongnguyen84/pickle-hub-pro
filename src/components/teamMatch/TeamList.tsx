import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Check, X, Trash2, Crown, ChevronRight } from 'lucide-react';
import { useTeamMatchTeams, useTeamMatchTeamManagement, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

interface TeamListProps {
  tournamentId: string;
  isOwner: boolean;
  onTeamClick?: (team: TeamMatchTeam) => void;
}

export function TeamList({ tournamentId, isOwner, onTeamClick }: TeamListProps) {
  const { data: teams, isLoading } = useTeamMatchTeams(tournamentId);
  const { updateTeamStatus, deleteTeam, isUpdatingStatus, isDeletingTeam } = useTeamMatchTeamManagement();

  const handleApprove = async (teamId: string) => {
    await updateTeamStatus({ teamId, status: 'approved', tournamentId });
  };

  const handleReject = async (teamId: string) => {
    await updateTeamStatus({ teamId, status: 'rejected', tournamentId });
  };

  const handleDelete = async (teamId: string) => {
    await deleteTeam({ teamId, tournamentId });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Chưa có đội nào đăng ký</p>
        </CardContent>
      </Card>
    );
  }

  const pendingTeams = teams.filter((t) => t.status === 'pending');
  const approvedTeams = teams.filter((t) => t.status === 'approved');
  const rejectedTeams = teams.filter((t) => t.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Pending teams (BTC view) */}
      {isOwner && pendingTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Chờ duyệt ({pendingTeams.length})
          </h3>
          {pendingTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isOwner={isOwner}
              onApprove={() => handleApprove(team.id)}
              onReject={() => handleReject(team.id)}
              onDelete={() => handleDelete(team.id)}
              onClick={() => onTeamClick?.(team)}
              isProcessing={isUpdatingStatus || isDeletingTeam}
            />
          ))}
        </div>
      )}

      {/* Approved teams */}
      {approvedTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Đã duyệt ({approvedTeams.length})
          </h3>
          {approvedTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isOwner={isOwner}
              onDelete={() => handleDelete(team.id)}
              onClick={() => onTeamClick?.(team)}
              isProcessing={isDeletingTeam}
            />
          ))}
        </div>
      )}

      {/* Rejected teams (BTC view) */}
      {isOwner && rejectedTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Từ chối ({rejectedTeams.length})
          </h3>
          {rejectedTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isOwner={isOwner}
              onApprove={() => handleApprove(team.id)}
              onDelete={() => handleDelete(team.id)}
              onClick={() => onTeamClick?.(team)}
              isProcessing={isUpdatingStatus || isDeletingTeam}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TeamCardProps {
  team: TeamMatchTeam;
  isOwner: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  isProcessing?: boolean;
}

function TeamCard({
  team,
  isOwner,
  onApprove,
  onReject,
  onDelete,
  onClick,
  isProcessing,
}: TeamCardProps) {
  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{team.team_name}</span>
                {team.seed && (
                  <Badge variant="outline" className="text-xs">
                    Seed #{team.seed}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={STATUS_COLORS[team.status]}>
                  {STATUS_LABELS[team.status]}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isOwner && team.status === 'pending' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={onApprove}
                  disabled={isProcessing}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700 hover:bg-red-100"
                  onClick={onReject}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}

            {isOwner && team.status === 'rejected' && (
              <Button
                variant="ghost"
                size="icon"
                className="text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={onApprove}
                disabled={isProcessing}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}

            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xóa đội?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn có chắc muốn xóa đội "{team.team_name}"? Hành động này không thể hoàn tác.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Xóa
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
