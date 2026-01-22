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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shuffle, Hand, Trophy, ArrowRight, GripVertical, AlertTriangle } from 'lucide-react';
import { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

interface SingleEliminationSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  hasThirdPlaceMatch: boolean;
  isCreating: boolean;
  onConfirm: (pairingType: 'random' | 'manual', manualPairings?: Array<{ team1Id: string; team2Id: string }>) => void;
}

type PairingType = 'random' | 'manual';

export function SingleEliminationSetupDialog({
  open,
  onOpenChange,
  teams,
  hasThirdPlaceMatch,
  isCreating,
  onConfirm,
}: SingleEliminationSetupDialogProps) {
  const [pairingType, setPairingType] = useState<PairingType>('random');
  const [manualPairings, setManualPairings] = useState<Array<{ team1Id: string; team2Id: string }>>([]);
  const [step, setStep] = useState<'select' | 'manual'>('select');

  const approvedTeams = useMemo(() => 
    teams.filter(t => t.status === 'approved'),
    [teams]
  );

  const matchCount = approvedTeams.length / 2;

  // Generate random pairings preview
  const randomPairingsPreview = useMemo(() => {
    const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
    const pairings: Array<{ team1: TeamMatchTeam; team2: TeamMatchTeam }> = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        pairings.push({ team1: shuffled[i], team2: shuffled[i + 1] });
      }
    }
    return pairings;
  }, [approvedTeams]);

  // Initialize manual pairings with empty slots
  const initializeManualPairings = () => {
    const emptyPairings: Array<{ team1Id: string; team2Id: string }> = [];
    for (let i = 0; i < matchCount; i++) {
      emptyPairings.push({ team1Id: '', team2Id: '' });
    }
    setManualPairings(emptyPairings);
  };

  // Get unassigned teams for manual selection
  const unassignedTeams = useMemo(() => {
    const assignedIds = new Set(
      manualPairings.flatMap(p => [p.team1Id, p.team2Id]).filter(Boolean)
    );
    return approvedTeams.filter(t => !assignedIds.has(t.id));
  }, [approvedTeams, manualPairings]);

  // Check if all pairings are complete
  const allPairingsComplete = useMemo(() => {
    return manualPairings.every(p => p.team1Id && p.team2Id);
  }, [manualPairings]);

  const handleProceed = () => {
    if (pairingType === 'manual') {
      initializeManualPairings();
      setStep('manual');
    } else {
      onConfirm('random');
    }
  };

  const handleManualConfirm = () => {
    if (allPairingsComplete) {
      onConfirm('manual', manualPairings);
    }
  };

  const handleAssignTeam = (pairingIndex: number, slot: 'team1Id' | 'team2Id', teamId: string) => {
    setManualPairings(prev => {
      const updated = [...prev];
      updated[pairingIndex] = { ...updated[pairingIndex], [slot]: teamId };
      return updated;
    });
  };

  const handleRemoveTeam = (pairingIndex: number, slot: 'team1Id' | 'team2Id') => {
    setManualPairings(prev => {
      const updated = [...prev];
      updated[pairingIndex] = { ...updated[pairingIndex], [slot]: '' };
      return updated;
    });
  };

  const getTeamName = (teamId: string) => {
    return approvedTeams.find(t => t.id === teamId)?.team_name || '';
  };

  const getRoundName = () => {
    const count = approvedTeams.length;
    if (count === 2) return 'Chung kết';
    if (count === 4) return 'Bán kết';
    if (count === 8) return 'Tứ kết';
    if (count === 16) return 'Vòng 1/8';
    return `Vòng 1`;
  };

  // Manual pairing step
  if (step === 'manual') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hand className="h-5 w-5" />
              Xếp cặp thủ công - {getRoundName()}
            </DialogTitle>
            <DialogDescription>
              Chọn đội cho từng cặp đấu. Kéo thả hoặc click để chọn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Unassigned teams */}
            {unassignedTeams.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Đội chưa xếp ({unassignedTeams.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {unassignedTeams.map(team => (
                    <Badge
                      key={team.id}
                      variant="secondary"
                      className="px-3 py-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {team.team_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Pairing slots */}
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">
                Các cặp đấu ({matchCount} trận)
              </Label>
              {manualPairings.map((pairing, index) => (
                <Card key={index} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-16">
                        Trận {index + 1}
                      </span>
                      
                      {/* Team 1 slot */}
                      <div className="flex-1">
                        {pairing.team1Id ? (
                          <div className="flex items-center gap-2 p-2 bg-background rounded border">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{getTeamName(pairing.team1Id)}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveTeam(index, 'team1Id')}
                              className="h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        ) : (
                          <select
                            className="w-full p-2 border rounded bg-background text-sm"
                            value=""
                            onChange={(e) => handleAssignTeam(index, 'team1Id', e.target.value)}
                          >
                            <option value="">Chọn đội...</option>
                            {unassignedTeams.map(team => (
                              <option key={team.id} value={team.id}>
                                {team.team_name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <span className="text-muted-foreground font-bold">vs</span>

                      {/* Team 2 slot */}
                      <div className="flex-1">
                        {pairing.team2Id ? (
                          <div className="flex items-center gap-2 p-2 bg-background rounded border">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{getTeamName(pairing.team2Id)}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveTeam(index, 'team2Id')}
                              className="h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        ) : (
                          <select
                            className="w-full p-2 border rounded bg-background text-sm"
                            value=""
                            onChange={(e) => handleAssignTeam(index, 'team2Id', e.target.value)}
                          >
                            <option value="">Chọn đội...</option>
                            {unassignedTeams.map(team => (
                              <option key={team.id} value={team.id}>
                                {team.team_name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Warning about bracket changes */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Sau khi tạo bracket, không thể thay đổi cặp đấu. Hãy kiểm tra kỹ!
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('select')}>
              Quay lại
            </Button>
            <Button 
              onClick={handleManualConfirm}
              disabled={!allPairingsComplete || isCreating}
            >
              {isCreating ? 'Đang tạo...' : 'Tạo Bracket'}
              <Trophy className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Selection step
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Sinh Bracket - Single Elimination
          </DialogTitle>
          <DialogDescription>
            Chọn cách ghép cặp đấu cho {approvedTeams.length} đội
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={pairingType}
            onValueChange={(v) => setPairingType(v as PairingType)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="random" id="pairing-random" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pairing-random" className="font-semibold cursor-pointer">
                    Bốc thăm ngẫu nhiên
                  </Label>
                  <Shuffle className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Hệ thống sẽ tự động xáo trộn và ghép cặp ngẫu nhiên
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="manual" id="pairing-manual" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pairing-manual" className="font-semibold cursor-pointer">
                    Xếp thủ công
                  </Label>
                  <Hand className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  BTC tự chọn đội cho từng cặp đấu
                </p>
              </div>
            </div>
          </RadioGroup>

          {/* Preview for random */}
          {pairingType === 'random' && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Ví dụ cặp đấu (sẽ xáo lại khi tạo)</Label>
              <div className="space-y-2">
                {randomPairingsPreview.slice(0, 4).map((pairing, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                    <span className="font-medium">{pairing.team1.team_name}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-medium">{pairing.team2.team_name}</span>
                  </div>
                ))}
                {randomPairingsPreview.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{randomPairingsPreview.length - 4} trận khác...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Third place match info */}
          {hasThirdPlaceMatch && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <Trophy className="h-4 w-4 text-primary mt-0.5" />
              <p className="text-sm">
                Sẽ có trận <strong>tranh hạng 3</strong> giữa 2 đội thua bán kết
              </p>
            </div>
          )}

          {/* Info about bracket structure */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• {getRoundName()} → {approvedTeams.length === 4 ? 'Chung kết' : '...'} → Vô địch</p>
            <p>• {matchCount} trận vòng 1</p>
            <p>• Thua 1 trận = bị loại</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleProceed} disabled={isCreating}>
            {pairingType === 'manual' ? 'Tiếp tục xếp cặp' : isCreating ? 'Đang tạo...' : 'Tạo Bracket'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
