import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Check, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { suggestGroupConfigs, distributePlayersToGroups } from '@/hooks/useQuickTable';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

interface GroupSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  isCreating: boolean;
  onConfirm: (groupCount: number, distribution: Array<Array<{ id: string; name: string }>>) => void;
}

export function GroupSetupDialog({
  open,
  onOpenChange,
  teams,
  isCreating,
  onConfirm,
}: GroupSetupDialogProps) {
  const [selectedGroupCount, setSelectedGroupCount] = useState<number | null>(null);

  const approvedTeams = useMemo(() => 
    teams.filter(t => t.status === 'approved'),
    [teams]
  );

  const teamCount = approvedTeams.length;

  // Use suggestGroupConfigs from Quick_tables
  const groupSuggestions = useMemo(() => 
    suggestGroupConfigs(teamCount),
    [teamCount]
  );

  // Preview distribution when a group count is selected
  const previewDistribution = useMemo(() => {
    if (!selectedGroupCount) return null;

    const teamsForDistribution = approvedTeams.map(t => ({
      id: t.id,
      name: t.team_name,
      team: undefined, // No sub-team concept in team match
      seed: t.seed || undefined,
    }));

    return distributePlayersToGroups(teamsForDistribution, selectedGroupCount);
  }, [selectedGroupCount, approvedTeams]);

  const handleConfirm = () => {
    if (!selectedGroupCount || !previewDistribution) return;
    onConfirm(selectedGroupCount, previewDistribution);
  };

  const getGroupName = (index: number) => {
    return `Bảng ${String.fromCharCode(65 + index)}`; // A, B, C, D...
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chia bảng thi đấu</DialogTitle>
          <DialogDescription>
            Chọn số bảng và xem trước cách chia đội ({teamCount} đội đã duyệt)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Group count selection */}
          <div className="space-y-3">
            <h4 className="font-medium">Chọn số bảng</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {groupSuggestions.map((suggestion) => (
                <Card
                  key={suggestion.groupCount}
                  className={cn(
                    "p-4 cursor-pointer transition-all hover:border-primary/50",
                    selectedGroupCount === suggestion.groupCount 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:bg-accent"
                  )}
                  onClick={() => setSelectedGroupCount(suggestion.groupCount)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-lg">
                        {suggestion.groupCount} bảng
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {suggestion.playersPerGroup[0]}-{suggestion.playersPerGroup[suggestion.playersPerGroup.length - 1]} đội/bảng
                      </div>
                    </div>
                    {suggestion.isRecommended && (
                      <Badge variant="secondary" className="text-xs">
                        Đề xuất
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {suggestion.reason}
                  </p>
                  {selectedGroupCount === suggestion.groupCount && (
                    <Check className="h-5 w-5 text-primary mt-2" />
                  )}
                </Card>
              ))}
            </div>

            {groupSuggestions.length === 0 && (
              <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <p className="text-sm">
                  Cần ít nhất 6 đội để chia bảng (mỗi bảng tối thiểu 3 đội)
                </p>
              </div>
            )}
          </div>

          {/* Preview distribution */}
          {previewDistribution && (
            <div className="space-y-3">
              <h4 className="font-medium">Xem trước phân bảng</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {previewDistribution.map((group, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="font-semibold">
                        {getGroupName(index)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {group.length} đội
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {group.map((team, teamIndex) => (
                        <li 
                          key={team.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {teamIndex + 1}
                          </span>
                          <span className="truncate">{team.name}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>

              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Đội được chia theo thứ tự hạt giống (snake draft) để cân bằng sức mạnh các bảng.
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedGroupCount || isCreating}
          >
            {isCreating ? 'Đang tạo...' : 'Xác nhận chia bảng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
