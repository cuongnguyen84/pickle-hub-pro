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
import { Trophy, AlertTriangle, Info } from 'lucide-react';
import { TeamStanding, PlayoffPairing } from '@/hooks/useTeamMatchStandings';

interface PlayoffSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standings: TeamStanding[];
  hasGroups: boolean;
  generatePlayoffSeeding: (teamCount: number) => { 
    seeds: { teamId: string; seed: number; groupId?: string; groupRank?: number; standing: TeamStanding }[]; 
    pairings: PlayoffPairing[] 
  };
  isCreating: boolean;
  onConfirm: (teamCount: number) => void;
}

export function PlayoffSetupDialog({
  open,
  onOpenChange,
  standings,
  hasGroups,
  generatePlayoffSeeding,
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

  // Get playoff seeding for selected count
  const playoffSeeding = useMemo(() => {
    if (!selectedCount) return null;
    return generatePlayoffSeeding(selectedCount);
  }, [selectedCount, generatePlayoffSeeding]);

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

  const getGroupLabel = (standing: TeamStanding) => {
    if (!standing.groupName || !standing.groupRank) return '';
    return `(${standing.groupName.replace('Bảng ', '')}${standing.groupRank})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Tạo vòng Playoff
          </DialogTitle>
          <DialogDescription>
            Chọn số đội tham gia vòng Playoff. 
            {hasGroups 
              ? ' Nhất bảng này sẽ gặp nhì bảng kia.' 
              : ' Các đội sẽ được chọn theo thứ hạng BXH.'}
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

          {/* Cross-group seeding explanation */}
          {hasGroups && selectedCount && selectedCount >= 4 && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <span>
                {selectedCount >= 8 
                  ? 'Cặp 1A vs 2B và 1B vs 2A sẽ ở 2 nhánh riêng, chỉ gặp nhau ở Chung kết.'
                  : 'Nhất bảng A gặp nhì bảng B, nhất bảng B gặp nhì bảng A.'}
              </span>
            </div>
          )}

          {/* Preview qualifying teams */}
          {playoffSeeding && playoffSeeding.seeds.length > 0 && (
            <Card className="border-primary/30">
              <CardContent className="py-3">
                <p className="text-sm font-medium mb-2">Đội vào Playoff:</p>
                <div className="space-y-1 text-sm">
                  {playoffSeeding.seeds.map((seed, index) => (
                    <div key={seed.teamId} className="flex justify-between">
                      <span className={index < 2 ? 'font-medium' : ''}>
                        {index + 1}. {seed.standing.team.team_name}
                        {hasGroups && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            {getGroupLabel(seed.standing)}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {seed.standing.won}T-{seed.standing.lost}B
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seeding preview with pairings */}
          {playoffSeeding && playoffSeeding.pairings.length > 0 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-medium mb-2">Ghép cặp vòng đầu:</p>
                <div className="space-y-1 text-sm">
                  {playoffSeeding.pairings.map((pairing, index) => (
                    <div 
                      key={index} 
                      className={`flex justify-between items-center py-1.5 px-2 rounded ${
                        pairing.bracketSide === 'left' 
                          ? 'bg-blue-500/10' 
                          : 'bg-orange-500/10'
                      }`}
                    >
                      <span className="text-xs">
                        Trận {index + 1}
                        {selectedCount && selectedCount >= 8 && (
                          <span className="ml-1 opacity-60">
                            ({pairing.bracketSide === 'left' ? 'Nhánh A' : 'Nhánh B'})
                          </span>
                        )}
                      </span>
                      <span className="text-xs">
                        <span className="font-medium">
                          {pairing.team1.standing.team.team_name}
                          {hasGroups && (
                            <span className="text-muted-foreground ml-0.5">
                              {getGroupLabel(pairing.team1.standing)}
                            </span>
                          )}
                        </span>
                        <span className="mx-2 text-muted-foreground">vs</span>
                        <span className="font-medium">
                          {pairing.team2.standing.team.team_name}
                          {hasGroups && (
                            <span className="text-muted-foreground ml-0.5">
                              {getGroupLabel(pairing.team2.standing)}
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  ))}
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