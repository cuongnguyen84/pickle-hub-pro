import { useState } from 'react';
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
import { Loader2, Users, Gamepad2 } from 'lucide-react';
import { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

interface GenerateMatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  gameTemplatesCount: number;
  isGenerating: boolean;
  onConfirm: () => void;
}

export function GenerateMatchesDialog({
  open,
  onOpenChange,
  teams,
  gameTemplatesCount,
  isGenerating,
  onConfirm,
}: GenerateMatchesDialogProps) {
  const approvedTeams = teams.filter(t => t.status === 'approved');
  const n = approvedTeams.length;
  
  // Calculate number of matches in round-robin
  const numMatches = n > 1 ? (n * (n - 1)) / 2 : 0;
  const numRounds = n > 1 ? (n % 2 === 0 ? n - 1 : n) : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tạo lịch thi đấu?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isGenerating}>Hủy</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isGenerating || n < 2}
          >
            {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Tạo lịch
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
