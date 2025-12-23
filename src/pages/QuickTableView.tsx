import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { useQuickTable, type QuickTable, type QuickTableGroup, type QuickTablePlayer, type QuickTableMatch } from '@/hooks/useQuickTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Share2, Trophy, Check, Clock, ChevronRight, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PlayoffBracket from '@/components/tournament/PlayoffBracket';

const QuickTableView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const { 
    getTableByShareId, updateMatchScore, updatePlayerStats, isOwner,
    getQualifiedPlayers, generatePlayoffBracket, createPlayoffMatches, 
    markPlayersQualified, updateTableStatus, isGroupStageComplete, getWildcardCount,
    isPlayoffRoundComplete, createNextPlayoffRound
  } = useQuickTable();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [groups, setGroups] = useState<QuickTableGroup[]>([]);
  const [players, setPlayers] = useState<QuickTablePlayer[]>([]);
  const [matches, setMatches] = useState<QuickTableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('groups');

  // Wildcard selection
  const [showWildcardDialog, setShowWildcardDialog] = useState(false);
  const [selectedWildcards, setSelectedWildcards] = useState<string[]>([]);
  const [thirdPlacePlayers, setThirdPlacePlayers] = useState<QuickTablePlayer[]>([]);
  const [wildcardNeeded, setWildcardNeeded] = useState(0);

  const loadData = async () => {
    if (!shareId) return;
    const data = await getTableByShareId(shareId);
    if (data) {
      setTable(data.table);
      setGroups(data.groups);
      setPlayers(data.players);
      setMatches(data.matches);
      setCanEdit(isOwner(data.table));
      
      // Set active tab based on status
      if (data.table.status === 'playoff' || data.table.status === 'completed') {
        setActiveTab('playoff');
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [shareId]);

  const handleScoreUpdate = async (matchId: string, score1: number, score2: number, isPlayoff: boolean = false) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !table) return;

    await updateMatchScore(matchId, score1, score2);
    
    if (!isPlayoff && match.group_id) {
      await updatePlayerStats(table.id, match.group_id);
    }
    
    // For playoff: check if round is complete and create next round
    if (isPlayoff && match.playoff_round !== null) {
      // Reload to get updated match statuses
      const updatedData = await getTableByShareId(shareId!);
      if (updatedData) {
        const currentRound = match.playoff_round;
        const updatedMatches = updatedData.matches;
        
        // Check if current round is complete
        if (isPlayoffRoundComplete(updatedMatches, currentRound)) {
          // Check if next round doesn't exist yet
          const nextRoundExists = updatedMatches.some(m => 
            m.is_playoff && m.playoff_round === currentRound + 1
          );
          
          if (!nextRoundExists) {
            const newMatches = await createNextPlayoffRound(table.id, currentRound, updatedMatches);
            if (newMatches.length > 0) {
              toast.success('Đã tạo vòng tiếp theo!');
            } else if (currentRound > 0) {
              // Final completed - mark as done
              const finalMatch = updatedMatches.find(m => 
                m.is_playoff && m.playoff_round === currentRound && m.status === 'completed'
              );
              const roundMatches = updatedMatches.filter(m => m.is_playoff && m.playoff_round === currentRound);
              if (roundMatches.length === 1 && finalMatch) {
                await updateTableStatus(table.id, 'completed');
                toast.success('Giải đấu đã hoàn tất! 🎉');
              }
            }
          }
        }
      }
    }
    
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

  const groupStageComplete = isGroupStageComplete(matches);
  const playoffMatches = matches.filter(m => m.is_playoff);
  const hasPlayoff = playoffMatches.length > 0;

  // Start playoff process
  const handleStartPlayoff = () => {
    if (!table || !table.group_count) return;

    const { qualified, thirdPlace } = getQualifiedPlayers(groups, players, 2);
    const needed = getWildcardCount(table.group_count);

    if (needed > 0) {
      setThirdPlacePlayers(thirdPlace.sort((a, b) => {
        if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
        return b.point_diff - a.point_diff;
      }));
      setWildcardNeeded(needed);
      setSelectedWildcards([]);
      setShowWildcardDialog(true);
    } else {
      createPlayoffWithWildcards(qualified, []);
    }
  };

  const createPlayoffWithWildcards = async (qualified: QuickTablePlayer[], wildcards: QuickTablePlayer[]) => {
    if (!table || !table.group_count) return;

    try {
      // Mark players
      await markPlayersQualified(qualified, wildcards);

      // Generate bracket
      const bracketMatches = generatePlayoffBracket(table.group_count, qualified, wildcards, groups);

      // Create matches
      await createPlayoffMatches(table.id, bracketMatches);

      // Update status
      await updateTableStatus(table.id, 'playoff');

      toast.success('Đã tạo vòng Playoff!');
      await loadData();
      setActiveTab('playoff');
    } catch (error) {
      console.error('Error creating playoff:', error);
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleConfirmWildcards = () => {
    if (selectedWildcards.length !== wildcardNeeded) {
      toast.error(`Vui lòng chọn đúng ${wildcardNeeded} người`);
      return;
    }

    const { qualified } = getQualifiedPlayers(groups, players, 2);
    const wildcards = thirdPlacePlayers.filter(p => selectedWildcards.includes(p.id));
    
    setShowWildcardDialog(false);
    createPlayoffWithWildcards(qualified, wildcards);
  };

  // Get round name
  const getRoundName = (matchCount: number): string => {
    if (matchCount <= 1) return 'Chung kết';
    if (matchCount <= 2) return 'Bán kết';
    if (matchCount <= 4) return 'Tứ kết';
    if (matchCount <= 8) return 'Vòng 16';
    return 'Vòng loại';
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
            <div className="flex items-center gap-2 text-foreground-secondary flex-wrap">
              <Badge variant="outline">
                {table.format === 'round_robin' ? 'Round Robin' : 'Playoff'}
              </Badge>
              <Badge variant={table.status === 'completed' ? 'default' : 'outline'}>
                {table.status === 'setup' && 'Đang thiết lập'}
                {table.status === 'group_stage' && 'Vòng bảng'}
                {table.status === 'playoff' && 'Playoff'}
                {table.status === 'completed' && 'Hoàn thành'}
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

        {/* Advance to Playoff Button */}
        {canEdit && groupStageComplete && !hasPlayoff && table.status === 'group_stage' && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Vòng bảng đã hoàn tất!</h3>
                  <p className="text-sm text-foreground-secondary">
                    Tất cả trận đấu đã có kết quả. Bạn có thể chuyển sang vòng Playoff.
                  </p>
                </div>
                <Button onClick={handleStartPlayoff}>
                  <Swords className="w-4 h-4 mr-2" />
                  Bắt đầu Playoff
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="groups">Vòng bảng</TabsTrigger>
            <TabsTrigger value="playoff" disabled={!hasPlayoff}>
              Playoff
              {hasPlayoff && <Badge variant="secondary" className="ml-2 text-xs">{playoffMatches.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            {groups.length > 0 && (
              <Tabs defaultValue={groups[0]?.id} className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1">
                  {groups.map(group => (
                    <TabsTrigger key={group.id} value={group.id} className="px-4">
                      Bảng {group.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {groups.map(group => {
                  const standings = getGroupStandings(group.id);
                  const groupMatches = matches.filter(m => m.group_id === group.id && !m.is_playoff);

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
                                <TableRow key={player.id} className={cn(
                                  idx < 2 && hasPlayoff && "bg-primary/5"
                                )}>
                                  <TableCell className="font-medium">
                                    {idx + 1}
                                    {idx < 2 && hasPlayoff && (
                                      <ChevronRight className="inline w-3 h-3 ml-1 text-primary" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{player.name}</span>
                                      {player.team && (
                                        <span className="text-foreground-muted text-sm">
                                          ({player.team})
                                        </span>
                                      )}
                                      {player.is_wildcard && (
                                        <Badge variant="outline" className="text-xs">WC</Badge>
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
                          {groupMatches.map((match, idx) => (
                            <MatchRow
                              key={match.id}
                              match={match}
                              index={idx}
                              player1={getPlayerById(match.player1_id)}
                              player2={getPlayerById(match.player2_id)}
                              canEdit={canEdit && !hasPlayoff}
                              onScoreUpdate={(s1, s2) => handleScoreUpdate(match.id, s1, s2)}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </TabsContent>

          {/* Playoff Tab */}
          <TabsContent value="playoff" className="space-y-6">
            {/* Login notice for non-owners */}
            {hasPlayoff && !canEdit && table.status !== 'completed' && (
              <Card className="border-border/50 bg-muted/20">
                <CardContent className="py-3">
                  <p className="text-sm text-foreground-muted text-center">
                    Chỉ người tạo bảng mới có thể nhập điểm. Vui lòng đăng nhập nếu bạn là chủ bảng.
                  </p>
                </CardContent>
              </Card>
            )}
            {hasPlayoff && (
              <PlayoffBracketView
                matches={playoffMatches}
                players={players}
                groups={groups}
                canEdit={canEdit}
                onScoreUpdate={(matchId, s1, s2) => handleScoreUpdate(matchId, s1, s2, true)}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Wildcard Selection Dialog */}
        <Dialog open={showWildcardDialog} onOpenChange={setShowWildcardDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chọn Wildcard</DialogTitle>
              <DialogDescription>
                Chọn {wildcardNeeded} người hạng 3 xuất sắc nhất để vào Playoff
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {thirdPlacePlayers.map((player, idx) => (
                <label
                  key={player.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    selectedWildcards.includes(player.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={selectedWildcards.includes(player.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        if (selectedWildcards.length < wildcardNeeded) {
                          setSelectedWildcards([...selectedWildcards, player.id]);
                        }
                      } else {
                        setSelectedWildcards(selectedWildcards.filter(id => id !== player.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{player.name}</div>
                    <div className="text-sm text-foreground-secondary">
                      Bảng {groups.find(g => g.id === player.group_id)?.name} • 
                      {player.matches_won} thắng • Hiệu số: {player.point_diff > 0 ? '+' : ''}{player.point_diff}
                    </div>
                  </div>
                  {idx === 0 && <Badge variant="secondary">Khuyến nghị</Badge>}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWildcardDialog(false)}>
                Hủy
              </Button>
              <Button 
                onClick={handleConfirmWildcards}
                disabled={selectedWildcards.length !== wildcardNeeded}
              >
                Xác nhận ({selectedWildcards.length}/{wildcardNeeded})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

// Match Row Component
interface MatchRowProps {
  match: QuickTableMatch;
  index: number;
  player1: QuickTablePlayer | undefined;
  player2: QuickTablePlayer | undefined;
  canEdit: boolean;
  onScoreUpdate: (score1: number, score2: number) => void;
}

const MatchRow = ({ match, index, player1, player2, canEdit, onScoreUpdate }: MatchRowProps) => {
  const [s1, setS1] = useState<string>('');
  const [s2, setS2] = useState<string>('');
  const isCompleted = match.status === 'completed';

  const handleSubmit = () => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    if (score1 > 0 || score2 > 0) {
      onScoreUpdate(score1, score2);
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        isCompleted ? "bg-muted/30 border-border" : "border-border-subtle"
      )}
    >
      <span className="text-sm text-foreground-muted w-6">{index + 1}</span>
      <div className="flex-1 flex items-center gap-2">
        <span className={cn("flex-1 text-right truncate", match.winner_id === match.player1_id && "font-semibold text-primary")}>
          {player1?.name || 'TBD'}
        </span>
        
        {canEdit && !isCompleted ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="w-14 text-center"
              min={0}
              value={s1}
              onChange={(e) => setS1(e.target.value)}
              onBlur={handleSubmit}
            />
            <span className="text-foreground-muted">-</span>
            <Input
              type="number"
              className="w-14 text-center"
              min={0}
              value={s2}
              onChange={(e) => setS2(e.target.value)}
              onBlur={handleSubmit}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-muted min-w-[60px] justify-center">
            <span className={cn(match.winner_id === match.player1_id && "font-bold")}>
              {match.score1 ?? '-'}
            </span>
            <span className="text-foreground-muted">:</span>
            <span className={cn(match.winner_id === match.player2_id && "font-bold")}>
              {match.score2 ?? '-'}
            </span>
          </div>
        )}
        
        <span className={cn("flex-1 truncate", match.winner_id === match.player2_id && "font-semibold text-primary")}>
          {player2?.name || 'TBD'}
        </span>
      </div>
      
      {isCompleted ? (
        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-foreground-muted flex-shrink-0" />
      )}
    </div>
  );
};

// Wrapper for new PlayoffBracket component
interface PlayoffBracketViewProps {
  matches: QuickTableMatch[];
  players: QuickTablePlayer[];
  groups: QuickTableGroup[];
  canEdit: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
}

const PlayoffBracketView = ({ matches, players, groups, canEdit, onScoreUpdate }: PlayoffBracketViewProps) => {
  // Create group name map
  const groupNames = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, g.name));
    return map;
  }, [groups]);

  // Filter out duplicate matches (keep unique by playoff_match_number)
  const uniqueMatches = useMemo(() => {
    const seen = new Set<number>();
    return matches.filter(m => {
      const num = m.playoff_match_number || 0;
      if (seen.has(num)) return false;
      seen.add(num);
      return true;
    }).sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));
  }, [matches]);

  return (
    <PlayoffBracket
      matches={uniqueMatches}
      players={players}
      canEdit={canEdit}
      onScoreUpdate={onScoreUpdate}
      groupNames={groupNames}
    />
  );
};

export default QuickTableView;
