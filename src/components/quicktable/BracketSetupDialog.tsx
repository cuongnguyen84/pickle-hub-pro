import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuickTable, type QuickTable } from '@/hooks/useQuickTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ArrowRight, Shuffle, Users, Wand2, Hand } from 'lucide-react';
import { toast } from 'sonner';
import { ManualGroupAssignment } from './ManualGroupAssignment';

interface PlayerInput {
  id: string;
  name: string;
  team: string;
  seed: string;
}

interface BracketSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: QuickTable;
  shareId: string;
  approvedPlayers: {
    name: string;
    team: string | null;
    skill: number | null;
  }[];
}

type AssignmentMode = 'auto' | 'manual';
type Step = 'input' | 'assignment';

export function BracketSetupDialog({ 
  open, 
  onOpenChange, 
  table, 
  shareId,
  approvedPlayers 
}: BracketSetupDialogProps) {
  const navigate = useNavigate();
  const { addPlayers, createGroups, assignPlayersToGroups, createGroupMatches, updateTableStatus, getTableByShareId } = useQuickTable();
  
  const [saving, setSaving] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('auto');
  const [step, setStep] = useState<Step>('input');
  const [players, setPlayers] = useState<PlayerInput[]>(() => 
    approvedPlayers.map((p, idx) => ({
      id: `approved-${idx}`,
      name: p.name,
      team: p.team || '',
      seed: '',
    }))
  );

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addPlayerSlot = () => {
    setPlayers(prev => [
      ...prev,
      { id: `new-${prev.length}`, name: '', team: '', seed: '' }
    ]);
  };

  const removePlayerSlot = (index: number) => {
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const shufflePlayers = () => {
    setPlayers(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const filledPlayers = players.filter(p => p.name.trim());

  // Handle proceeding to assignment step
  const handleProceedToAssignment = () => {
    if (filledPlayers.length < 2) {
      toast.error('Cần ít nhất 2 người chơi');
      return;
    }

    // For manual mode with round robin, go to assignment step
    if (assignmentMode === 'manual' && table.format === 'round_robin' && table.group_count) {
      setStep('assignment');
    } else {
      // Auto mode - submit directly
      handleAutoSubmit();
    }
  };

  // Auto assignment submit (original logic)
  const handleAutoSubmit = async () => {
    setSaving(true);

    try {
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error('Failed to add players');

      if (table.format === 'round_robin' && table.group_count) {
        const groups = await createGroups(table.id, table.group_count);
        if (groups.length === 0) throw new Error('Failed to create groups');

        await assignPlayersToGroups(createdPlayers, groups);

        const refreshed = await getTableByShareId(shareId);
        if (!refreshed) throw new Error('Failed to refresh data');

        for (const group of groups) {
          const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
          if (groupPlayers.length >= 2) {
            await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id));
          }
        }

        await updateTableStatus(table.id, 'group_stage');
      } else {
        await updateTableStatus(table.id, 'group_stage');
      }

      toast.success('Đã tạo bảng đấu thành công!');
      onOpenChange(false);
      navigate(`/tools/quick-tables/${shareId}?tab=groups`);
    } catch (error) {
      console.error('Error setting up table:', error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  // Manual assignment complete handler
  const handleManualAssignmentComplete = async (groupAssignments: Map<number, PlayerInput[]>) => {
    if (!table.group_count) return;

    setSaving(true);

    try {
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error('Failed to add players');

      const playerMap = new Map<string, typeof createdPlayers[0]>();
      filledPlayers.forEach((inputPlayer, index) => {
        playerMap.set(inputPlayer.id, createdPlayers[index]);
      });

      const groups = await createGroups(table.id, table.group_count);
      if (groups.length === 0) throw new Error('Failed to create groups');

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const group = groups[groupIndex];
        const assignedInputPlayers = groupAssignments.get(groupIndex) || [];
        
        const playersToAssign = assignedInputPlayers
          .map(ip => playerMap.get(ip.id))
          .filter(Boolean) as typeof createdPlayers;

        if (playersToAssign.length > 0) {
          await assignPlayersToGroups(playersToAssign, [group]);
        }
      }

      const refreshed = await getTableByShareId(shareId);
      if (!refreshed) throw new Error('Failed to refresh data');

      for (const group of groups) {
        const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
        if (groupPlayers.length >= 2) {
          await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id));
        }
      }

      await updateTableStatus(table.id, 'group_stage');

      toast.success('Đã chia bảng thủ công thành công!');
      onOpenChange(false);
      navigate(`/tools/quick-tables/${shareId}?tab=groups`);
    } catch (error) {
      console.error('Error setting up table with manual assignment:', error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  // Render manual assignment step
  if (step === 'assignment' && table.group_count) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hand className="w-5 h-5" />
              Chia bảng thủ công - {table.name}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">
                  {table.format === 'round_robin' ? 'Round Robin' : 'Playoff đông người'}
                </Badge>
                <Badge variant="outline">{table.group_count} bảng</Badge>
                <span>•</span>
                <span>{filledPlayers.length} VĐV</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <ManualGroupAssignment
            players={filledPlayers}
            groupCount={table.group_count}
            onComplete={handleManualAssignmentComplete}
            onCancel={() => setStep('input')}
          />
          
          {saving && (
            <div className="text-center text-muted-foreground">
              Đang xử lý...
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chia bảng - {table.name}</DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                {table.format === 'round_robin' ? 'Round Robin' : 'Playoff đông người'}
              </Badge>
              {table.group_count && (
                <Badge variant="outline">{table.group_count} bảng</Badge>
              )}
              <span>•</span>
              <span>{players.length} VĐV đã duyệt</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Danh sách VĐV</h3>
            <Button variant="outline" size="sm" onClick={shufflePlayers}>
              <Shuffle className="w-4 h-4 mr-2" />
              Xáo trộn
            </Button>
          </div>

          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {players.map((player, index) => (
              <div key={player.id} className="flex items-center gap-2">
                <span className="w-6 text-sm text-muted-foreground text-center flex-shrink-0">
                  {index + 1}
                </span>
                <Input
                  value={player.name}
                  onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                  placeholder="Tên VĐV *"
                  className="flex-1 min-w-0 h-9"
                />
                <Input
                  value={player.team}
                  onChange={(e) => updatePlayer(index, 'team', e.target.value)}
                  placeholder="Team"
                  className="w-20 h-9 flex-shrink-0"
                />
                <Input
                  type="number"
                  value={player.seed}
                  onChange={(e) => updatePlayer(index, 'seed', e.target.value)}
                  placeholder="Seed"
                  className="w-16 h-9 flex-shrink-0"
                  min={1}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePlayerSlot(index)}
                  disabled={players.length <= 2}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0 h-9 w-9"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={addPlayerSlot} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Thêm VĐV
          </Button>

          {/* Assignment Mode Selection - Only for round robin */}
          {table.format === 'round_robin' && table.group_count && (
            <div className="pt-3 border-t border-border">
              <Label className="text-sm font-medium mb-3 block">Phương thức chia bảng</Label>
              <RadioGroup
                value={assignmentMode}
                onValueChange={(value) => setAssignmentMode(value as AssignmentMode)}
                className="grid grid-cols-2 gap-3"
              >
                <div className="relative">
                  <RadioGroupItem
                    value="auto"
                    id="dialog-mode-auto"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="dialog-mode-auto"
                    className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                  >
                    <Wand2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Tự động</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Chia đều, tránh cùng team
                      </p>
                    </div>
                  </Label>
                </div>
                <div className="relative">
                  <RadioGroupItem
                    value="manual"
                    id="dialog-mode-manual"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="dialog-mode-manual"
                    className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                  >
                    <Hand className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Thủ công</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tự chọn VĐV vào từng bảng
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Mẹo chia bảng tốt:</p>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li>• Nhập Team để tránh cùng team vào cùng bảng</li>
                  <li>• Đánh số Seed (1 = mạnh nhất) để rải hạt giống đều các bảng</li>
                  {assignmentMode === 'auto' && (
                    <li>• Hệ thống sẽ tự động chia người chơi vào các bảng đều nhau</li>
                  )}
                  {assignmentMode === 'manual' && (
                    <li>• Bạn sẽ tự phân VĐV vào từng bảng ở bước tiếp theo</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleProceedToAssignment}
            disabled={saving || filledPlayers.length < 2}
          >
            {saving 
              ? 'Đang xử lý...' 
              : assignmentMode === 'manual' && table.format === 'round_robin' && table.group_count 
                ? 'Tiếp tục chia bảng' 
                : 'Tạo bảng đấu'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
