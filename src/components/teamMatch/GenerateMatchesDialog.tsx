import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Gamepad2, AlertTriangle } from 'lucide-react';
import { TeamMatchTeam, TeamMatchRosterMember } from '@/hooks/useTeamMatchTeams';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GenerateMatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  gameTemplatesCount: number;
  maxRosterSize: number;
  isGenerating: boolean;
  onConfirm: () => void;
}

export function GenerateMatchesDialog({
  open,
  onOpenChange,
  teams,
  gameTemplatesCount,
  maxRosterSize,
  isGenerating,
  onConfirm,
}: GenerateMatchesDialogProps) {
  const approvedTeams = teams.filter(t => t.status === 'approved');
  const n = approvedTeams.length;
  
  // Calculate number of matches in round-robin
  const numMatches = n > 1 ? (n * (n - 1)) / 2 : 0;
  const numRounds = n > 1 ? (n % 2 === 0 ? n - 1 : n) : 0;

  // Fetch rosters to check completeness
  const { data: allRosters } = useQuery({
    queryKey: ['team-match-all-rosters-check', approvedTeams.map(t => t.id).join(',')],
    queryFn: async () => {
      if (approvedTeams.length === 0) return {};
      
      const { data, error } = await supabase
        .from('team_match_roster')
        .select('*')
        .in('team_id', approvedTeams.map(t => t.id));
      
      if (error) throw error;
      
      const grouped: Record<string, TeamMatchRosterMember[]> = {};
      (data as TeamMatchRosterMember[]).forEach(member => {
        if (!grouped[member.team_id]) {
          grouped[member.team_id] = [];
        }
        grouped[member.team_id].push(member);
      });
      return grouped;
    },
    enabled: open && approvedTeams.length > 0,
  });

  // Check which teams are incomplete
  const incompleteTeams = approvedTeams.filter(team => {
    const rosterCount = allRosters?.[team.id]?.length || 0;
    return rosterCount < maxRosterSize;
  });

  const hasIncompleteTeams = incompleteTeams.length > 0;
  const canGenerate = n >= 2 && !hasIncompleteTeams;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle>Tạo lịch thi đấu?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm">
                Hệ thống sẽ tự động tạo lịch thi đấu vòng tròn cho các đội đã được duyệt.
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {n} đội
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Gamepad2 className="h-3 w-3" />
                  {numMatches} trận
                </Badge>
                <Badge variant="secondary">
                  {numRounds} vòng
                </Badge>
                {gameTemplatesCount > 0 && (
                  <Badge variant="secondary">
                    {gameTemplatesCount} ván/trận
                  </Badge>
                )}
              </div>

              {n < 2 && (
                <p className="text-destructive text-sm">
                  ⚠️ Cần ít nhất 2 đội đã được duyệt để tạo lịch thi đấu
                </p>
              )}

              {/* Warning for incomplete teams */}
              {hasIncompleteTeams && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Không thể tạo lịch - Có đội chưa đủ người</span>
                  </div>
                  <ul className="text-xs text-destructive/80 space-y-1 ml-6">
                    {incompleteTeams.map(team => {
                      const rosterCount = allRosters?.[team.id]?.length || 0;
                      return (
                        <li key={team.id}>
                          • {team.team_name}: {rosterCount}/{maxRosterSize} VĐV
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel disabled={isGenerating} className="flex-1">Hủy</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isGenerating || !canGenerate}
            className="flex-1"
          >
            {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Xác nhận
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
