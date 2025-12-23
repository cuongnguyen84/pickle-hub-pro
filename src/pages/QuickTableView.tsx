import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { useQuickTable, type QuickTable, type QuickTableGroup, type QuickTablePlayer, type QuickTableMatch } from '@/hooks/useQuickTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Share2, Trophy, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const QuickTableView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const { getTableByShareId, updateMatchScore, updatePlayerStats, isOwner } = useQuickTable();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [groups, setGroups] = useState<QuickTableGroup[]>([]);
  const [players, setPlayers] = useState<QuickTablePlayer[]>([]);
  const [matches, setMatches] = useState<QuickTableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const loadData = async () => {
    if (!shareId) return;
    const data = await getTableByShareId(shareId);
    if (data) {
      setTable(data.table);
      setGroups(data.groups);
      setPlayers(data.players);
      setMatches(data.matches);
      setCanEdit(isOwner(data.table));
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [shareId]);

  const handleScoreUpdate = async (matchId: string, score1: number, score2: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !match.group_id || !table) return;

    await updateMatchScore(matchId, score1, score2);
    await updatePlayerStats(table.id, match.group_id);
    await loadData();
    toast.success('Đã cập nhật kết quả');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Đã sao chép link!');
  };

  const getPlayerById = (id: string | null) => players.find(p => p.id === id);

  const getGroupStandings = (groupId: string) => {
    return players
      .filter(p => p.group_id === groupId)
      .sort((a, b) => {
        if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
        return b.point_diff - a.point_diff;
      });
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
        <div className="container-wide py-8 text-center">
          <h1 className="text-xl font-bold mb-2">Không tìm thấy bảng đấu</h1>
          <Link to="/quick-tables"><Button variant="outline">Quay lại</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container-wide py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">{table.name}</h1>
            <div className="flex items-center gap-2 text-foreground-secondary">
              <Badge variant="outline">
                {table.format === 'round_robin' ? 'Round Robin' : 'Playoff'}
              </Badge>
              <span>{players.length} người chơi</span>
              {groups.length > 0 && <span>• {groups.length} bảng</span>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Chia sẻ
          </Button>
        </div>

        {/* Groups Tabs */}
        {groups.length > 0 && (
          <Tabs defaultValue={groups[0]?.id} className="space-y-4">
            <TabsList>
              {groups.map(group => (
                <TabsTrigger key={group.id} value={group.id}>
                  Bảng {group.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {groups.map(group => {
              const standings = getGroupStandings(group.id);
              const groupMatches = matches.filter(m => m.group_id === group.id);

              return (
                <TabsContent key={group.id} value={group.id} className="space-y-6">
                  {/* Standings */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        Bảng xếp hạng
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Người chơi</TableHead>
                            <TableHead className="text-center w-16">Thắng</TableHead>
                            <TableHead className="text-center w-16">Trận</TableHead>
                            <TableHead className="text-center w-20">Hiệu số</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {standings.map((player, idx) => (
                            <TableRow key={player.id}>
                              <TableCell className="font-medium">{idx + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{player.name}</span>
                                  {player.team && (
                                    <span className="text-foreground-muted ml-2 text-sm">
                                      ({player.team})
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-semibold text-primary">
                                {player.matches_won}
                              </TableCell>
                              <TableCell className="text-center">{player.matches_played}</TableCell>
                              <TableCell className={cn(
                                "text-center font-medium",
                                player.point_diff > 0 ? "text-green-500" : 
                                player.point_diff < 0 ? "text-red-500" : ""
                              )}>
                                {player.point_diff > 0 ? '+' : ''}{player.point_diff}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Matches */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Danh sách trận đấu</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {groupMatches.map((match, idx) => {
                        const p1 = getPlayerById(match.player1_id);
                        const p2 = getPlayerById(match.player2_id);
                        const isCompleted = match.status === 'completed';

                        return (
                          <div 
                            key={match.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border",
                              isCompleted ? "bg-muted/30 border-border" : "border-border-subtle"
                            )}
                          >
                            <span className="text-sm text-foreground-muted w-6">{idx + 1}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <span className={cn("flex-1 text-right", match.winner_id === match.player1_id && "font-semibold text-primary")}>
                                {p1?.name || '?'}
                              </span>
                              
                              {canEdit && !isCompleted ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    className="w-14 text-center"
                                    min={0}
                                    placeholder="0"
                                    onBlur={(e) => {
                                      const s1 = parseInt(e.target.value) || 0;
                                      const s2Input = e.target.parentElement?.querySelector('input:last-of-type') as HTMLInputElement;
                                      const s2 = parseInt(s2Input?.value) || 0;
                                      if (s1 > 0 || s2 > 0) handleScoreUpdate(match.id, s1, s2);
                                    }}
                                  />
                                  <span className="text-foreground-muted">-</span>
                                  <Input
                                    type="number"
                                    className="w-14 text-center"
                                    min={0}
                                    placeholder="0"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-1 rounded bg-muted">
                                  <span className={cn(match.winner_id === match.player1_id && "font-bold")}>
                                    {match.score1 ?? '-'}
                                  </span>
                                  <span className="text-foreground-muted">:</span>
                                  <span className={cn(match.winner_id === match.player2_id && "font-bold")}>
                                    {match.score2 ?? '-'}
                                  </span>
                                </div>
                              )}
                              
                              <span className={cn("flex-1", match.winner_id === match.player2_id && "font-semibold text-primary")}>
                                {p2?.name || '?'}
                              </span>
                            </div>
                            
                            {isCompleted ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-foreground-muted" />
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default QuickTableView;
