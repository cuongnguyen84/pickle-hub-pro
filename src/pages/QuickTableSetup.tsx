import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { useQuickTable, type QuickTablePlayer, type QuickTableGroup, type QuickTable } from '@/hooks/useQuickTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ArrowRight, Shuffle, Users } from 'lucide-react';
import { toast } from 'sonner';

interface PlayerInput {
  id: string;
  name: string;
  team: string;
  seed: string;
}

const QuickTableSetup = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { getTableByShareId, addPlayers, createGroups, assignPlayersToGroups, createGroupMatches, updateTableStatus, isOwner } = useQuickTable();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<PlayerInput[]>([]);

  useEffect(() => {
    const loadTable = async () => {
      if (!shareId) return;
      
      setLoading(true);
      const data = await getTableByShareId(shareId);
      
      if (data) {
        setTable(data.table);
        
        // If already has players, redirect to view
        if (data.players.length > 0) {
          navigate(`/quick-tables/${shareId}`);
          return;
        }
        
        // Initialize empty player slots
        const initialPlayers: PlayerInput[] = Array.from(
          { length: data.table.player_count },
          (_, i) => ({
            id: `new-${i}`,
            name: '',
            team: '',
            seed: '',
          })
        );
        setPlayers(initialPlayers);
      }
      
      setLoading(false);
    };

    loadTable();
  }, [shareId, getTableByShareId, navigate]);

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
    if (!table) return;

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
        const refreshed = await getTableByShareId(shareId!);
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
        await updateTableStatus(table.id, 'group_stage'); // First round
      }

      toast.success('Đã tạo bảng đấu thành công!');
      navigate(`/quick-tables/${shareId}`);
    } catch (error) {
      console.error('Error setting up table:', error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-foreground-muted">Đang tải...</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!table) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">Không tìm thấy bảng đấu</h1>
            <p className="text-foreground-secondary">Bảng đấu không tồn tại hoặc đã bị xóa.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">{table.name}</h1>
            <div className="flex items-center gap-2 text-foreground-secondary">
              <Badge variant="outline">
                {table.format === 'round_robin' ? 'Round Robin' : 'Playoff đông người'}
              </Badge>
              {table.group_count && (
                <Badge variant="outline">{table.group_count} bảng</Badge>
              )}
              <span>•</span>
              <span>{table.player_count} người chơi</span>
            </div>
          </div>

          {/* Player Input */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Nhập danh sách người chơi</CardTitle>
                  <CardDescription>
                    Nhập tên, CLB/nhóm (tùy chọn), và hạt giống (tùy chọn)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={shufflePlayers}>
                  <Shuffle className="w-4 h-4 mr-2" />
                  Xáo trộn
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-2">
                    <span className="w-8 text-sm text-foreground-muted text-center">
                      {index + 1}
                    </span>
                    <Input
                      value={player.name}
                      onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                      placeholder="Tên người chơi *"
                      className="flex-1"
                    />
                    <Input
                      value={player.team}
                      onChange={(e) => updatePlayer(index, 'team', e.target.value)}
                      placeholder="CLB/Nhóm"
                      className="w-28"
                    />
                    <Input
                      type="number"
                      value={player.seed}
                      onChange={(e) => updatePlayer(index, 'seed', e.target.value)}
                      placeholder="Seed"
                      className="w-20"
                      min={1}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlayerSlot(index)}
                      disabled={players.length <= 2}
                      className="text-foreground-muted hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border-subtle">
                <Button variant="outline" onClick={addPlayerSlot} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm người chơi
                </Button>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium">Mẹo chia bảng tốt:</p>
                    <ul className="text-foreground-secondary mt-1 space-y-1">
                      <li>• Nhập CLB/Nhóm để tránh người cùng nhóm vào cùng bảng</li>
                      <li>• Đánh số Seed (1 = mạnh nhất) để rải hạt giống đều các bảng</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={saving || players.filter(p => p.name.trim()).length < 2}
                >
                  {saving ? 'Đang xử lý...' : 'Tạo bảng đấu và chia bảng'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default QuickTableSetup;
