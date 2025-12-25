import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuickTable, type QuickTable } from '@/hooks/useQuickTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ArrowRight, Shuffle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [players, setPlayers] = useState<PlayerInput[]>(() => 
    approvedPlayers.map((p, idx) => ({
      id: `approved-${idx}`,
      name: p.name,
      team: p.team || '',
      seed: p.skill?.toString() || '',
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

  const handleSubmit = async () => {
    // Validate
    const filledPlayers = players.filter(p => p.name.trim());
    if (filledPlayers.length < 2) {
      toast.error('Cần ít nhất 2 người chơi');
      return;
    }

    setSaving(true);

    try {
      // Add players to database
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error('Failed to add players');

      // If round robin, create groups and assign players
      if (table.format === 'round_robin' && table.group_count) {
        const groups = await createGroups(table.id, table.group_count);
        if (groups.length === 0) throw new Error('Failed to create groups');

        await assignPlayersToGroups(createdPlayers, groups);

        // Refresh players with group assignments
        const refreshed = await getTableByShareId(shareId);
        if (!refreshed) throw new Error('Failed to refresh data');

        // Create matches for each group
        for (const group of groups) {
          const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
          if (groupPlayers.length >= 2) {
            await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id));
          }
        }

        // Update table status
        await updateTableStatus(table.id, 'group_stage');
      } else {
        // Large playoff - will be handled differently
        await updateTableStatus(table.id, 'group_stage');
      }

      toast.success('Đã tạo bảng đấu thành công!');
      onOpenChange(false);
      navigate(`/quick-tables/${shareId}`);
    } catch (error) {
      console.error('Error setting up table:', error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

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

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
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

          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Mẹo chia bảng tốt:</p>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li>• Nhập Team để tránh cùng team vào cùng bảng</li>
                  <li>• Đánh số Seed (1 = mạnh nhất) để rải hạt giống đều các bảng</li>
                  <li>• Hệ thống sẽ tự động chia người chơi vào các bảng đều nhau</li>
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
            onClick={handleSubmit}
            disabled={saving || players.filter(p => p.name.trim()).length < 2}
          >
            {saving ? 'Đang xử lý...' : 'Tạo bảng đấu'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
