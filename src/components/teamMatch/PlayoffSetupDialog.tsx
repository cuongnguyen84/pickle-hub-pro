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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, AlertTriangle } from 'lucide-react';
import { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

interface TeamStanding {
  team: TeamMatchTeam;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
}

interface PlayoffSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standings: TeamStanding[];
  isCreating: boolean;
  onConfirm: (teamCount: number) => void;
}

export function PlayoffSetupDialog({
  open,
  onOpenChange,
  standings,
  isCreating,
  onConfirm,
}: PlayoffSetupDialogProps) {
  const [selectedCount, setSelectedCount] = useState<number | null>(null);

  // Calculate valid playoff sizes (powers of 2, up to total teams)
  const validPlayoffSizes = useMemo(() => {
    const totalTeams = standings.length;
    const sizes: number[] = [];
    let power = 1;
    while (power <= totalTeams) {
      sizes.push(power);
      power *= 2;
    }
    // Remove 1 as you need at least 2 teams
    return sizes.filter(s => s >= 2);
  }, [standings.length]);

  // Get teams that would qualify for selected playoff size
  const qualifyingTeams = useMemo(() => {
    if (!selectedCount) return [];
    return standings.slice(0, selectedCount);
  }, [standings, selectedCount]);

  const handleConfirm = () => {
    if (selectedCount) {
      onConfirm(selectedCount);
    }
  };

  const getRoundName = (teamCount: number) => {
    switch (teamCount) {
      case 2: return 'Chung kết';
      case 4: return 'Bán kết → Chung kết';
      case 8: return 'Tứ kết → Bán kết → Chung kết';
      case 16: return 'Vòng 1/8 → Tứ kết → Bán kết → Chung kết';
      default: return `${Math.log2(teamCount)} vòng`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Tạo vòng Playoff
          </DialogTitle>
          <DialogDescription>
            Chọn số đội tham gia vòng Playoff. Các đội sẽ được chọn theo thứ hạng BXH vòng tròn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team count selection */}
          <div className="space-y-2">
            <Label>Số đội vào Playoff</Label>
            <RadioGroup
              value={selectedCount?.toString() || ''}
              onValueChange={(value) => setSelectedCount(parseInt(value))}
            >
              {validPlayoffSizes.map((size) => (
                <div key={size} className="flex items-center space-x-2">
                  <RadioGroupItem value={size.toString()} id={`size-${size}`} />
                  <Label htmlFor={`size-${size}`} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{size} đội</span>
                      <span className="text-sm text-muted-foreground">
                        {getRoundName(size)}
                      </span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Preview qualifying teams */}
          {selectedCount && qualifyingTeams.length > 0 && (
            <Card className="border-primary/30">
              <CardContent className="py-3">
                <p className="text-sm font-medium mb-2">Đội vào Playoff:</p>
                <div className="space-y-1 text-sm">
                  {qualifyingTeams.map((standing, index) => (
                    <div key={standing.team.id} className="flex justify-between">
                      <span className={index < 3 ? 'font-medium' : ''}>
                        {index + 1}. {standing.team.team_name}
                      </span>
                      <span className="text-muted-foreground">
                        {standing.won}T-{standing.lost}B
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seeding preview */}
          {selectedCount && selectedCount >= 2 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-medium mb-2">Ghép cặp vòng đầu:</p>
                <div className="space-y-1 text-sm">
                  {Array.from({ length: selectedCount / 2 }).map((_, index) => {
                    const seed1 = index + 1;
                    const seed2 = selectedCount - index;
                    const team1 = qualifyingTeams[seed1 - 1];
                    const team2 = qualifyingTeams[seed2 - 1];
                    return (
                      <div key={index} className="flex justify-between items-center py-1 px-2 bg-muted/50 rounded">
                        <span>
                          Trận {index + 1}:
                        </span>
                        <span className="text-xs">
                          <span className="font-medium">{team1?.team.team_name || `Hạng ${seed1}`}</span>
                          <span className="mx-2 text-muted-foreground">vs</span>
                          <span className="font-medium">{team2?.team.team_name || `Hạng ${seed2}`}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-yellow-500/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <span>
              Sau khi tạo Playoff, bạn không thể thay đổi số đội hoặc thứ hạng seed.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedCount || isCreating}
          >
            {isCreating ? 'Đang tạo...' : 'Tạo Playoff'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}