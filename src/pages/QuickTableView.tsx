import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout';
import { useQuickTable, type QuickTable, type QuickTableGroup, type QuickTablePlayer, type QuickTableMatch } from '@/hooks/useQuickTable';
import { useRefereeManagement } from '@/hooks/useRefereeManagement';
import { useRegistration, type Registration } from '@/hooks/useRegistration';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Share2, Trophy, Check, Clock, ChevronRight, Swords, Pencil, Settings, UserPlus, ArrowLeftRight, UserMinus, X, Radio, Play, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PlayoffBracket from '@/components/tournament/PlayoffBracket';
import RefereeManagement from '@/components/quicktable/RefereeManagement';
import RegistrationForm from '@/components/quicktable/RegistrationForm';
import RegistrationManager from '@/components/quicktable/RegistrationManager';

const QuickTableView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const { user } = useAuth();
  const { 
    getTableByShareId, updateMatchScore, updatePlayerStats, isOwner,
    getQualifiedPlayers, generatePlayoffBracket, createPlayoffMatches, 
    markPlayersQualified, updateTableStatus, isGroupStageComplete, getWildcardCount,
    isPlayoffRoundComplete, createNextPlayoffRound, movePlayerToGroup,
    addPlayerToGroup, removePlayerFromGroup, regenerateGroupMatches
  } = useQuickTable();
  const { getUserRegistration } = useRegistration();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [groups, setGroups] = useState<QuickTableGroup[]>([]);
  const [players, setPlayers] = useState<QuickTablePlayer[]>([]);
  const [matches, setMatches] = useState<QuickTableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('groups');

  // Registration state
  const [userRegistration, setUserRegistration] = useState<Registration | null>(null);
  const [registrationCount, setRegistrationCount] = useState(0);

  // Referee management hook
  const {
    referees,
    loading: refereesLoading,
    userRole,
    addRefereeByEmail,
    removeReferee,
    refreshUserRole,
  } = useRefereeManagement(table?.id, table?.creator_user_id);

  // canEdit = creator only for structure changes
  // canEditScores = creator OR referee for score changes
  const canManageTable = userRole.canManageTable;
  const canEditScores = userRole.canEditScores;

  // Wildcard selection
  const [showWildcardDialog, setShowWildcardDialog] = useState(false);
  const [selectedWildcards, setSelectedWildcards] = useState<string[]>([]);
  const [thirdPlacePlayers, setThirdPlacePlayers] = useState<QuickTablePlayer[]>([]);
  const [wildcardNeeded, setWildcardNeeded] = useState(0);

  // Team visibility - persisted in localStorage
  const [showTeam, setShowTeam] = useState(() => {
    if (!shareId) return false;
    const saved = localStorage.getItem(`quick-table-show-team-${shareId}`);
    return saved === 'true';
  });

  // Edit groups mode
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<QuickTablePlayer | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [addToGroupId, setAddToGroupId] = useState<string>('');

  const loadData = async () => {
    if (!shareId) return;
    const data = await getTableByShareId(shareId);
    if (data) {
      setTable(data.table);
      setGroups(data.groups);
      setPlayers(data.players);
      setMatches(data.matches);
      
      // Load user registration if requires_registration
      if (data.table.requires_registration && user) {
        const reg = await getUserRegistration(data.table.id);
        setUserRegistration(reg);
      }
      
      // Set active tab based on status
      if (data.table.status === 'playoff' || data.table.status === 'completed') {
        setActiveTab('playoff');
      } else if (data.table.requires_registration && data.table.status === 'setup') {
        setActiveTab('registration');
      }

      // Auto-check and create next playoff round if current round is complete
      if (data.table.status === 'playoff') {
        const playoffMatches = data.matches.filter(m => m.is_playoff);
        if (playoffMatches.length > 0) {
          const maxRound = Math.max(...playoffMatches.map(m => m.playoff_round || 0));
          const roundMatches = playoffMatches.filter(m => m.playoff_round === maxRound);
          const allCompleted = roundMatches.every(m => m.status === 'completed');
          
          if (allCompleted && roundMatches.length > 1) {
            const nextRoundExists = playoffMatches.some(m => m.playoff_round === maxRound + 1);
            if (!nextRoundExists) {
              const newMatches = await createNextPlayoffRound(data.table.id, maxRound, data.matches);
              if (newMatches.length > 0) {
                toast.success('Đã tạo vòng tiếp theo!');
                const refreshedData = await getTableByShareId(shareId);
                if (refreshedData) {
                  setMatches(refreshedData.matches);
                }
              }
            }
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [shareId]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!table?.id) return;

    const channel = supabase
      .channel(`quick-table-${table.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_table_matches',
          filter: `table_id=eq.${table.id}`
        },
        (payload) => {
          console.log('[Realtime] Match update:', payload);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_table_players',
          filter: `table_id=eq.${table.id}`
        },
        (payload) => {
          console.log('[Realtime] Player update:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table?.id]);

  // Refresh user role when table changes
  useEffect(() => {
    if (table) {
      refreshUserRole();
    }
  }, [table?.id, refreshUserRole]);

  // Persist showTeam setting
  useEffect(() => {
    if (shareId) {
      localStorage.setItem(`quick-table-show-team-${shareId}`, showTeam.toString());
    }
  }, [showTeam, shareId]);

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

  // Format player name with optional team display
  const formatPlayerName = useCallback((player: QuickTablePlayer | undefined): string => {
    if (!player) return 'TBD';
    let name = player.name;
    if (player.seed) {
      name = `${player.name} (${player.seed})`;
    }
    if (showTeam && player.team) {
      name = `${name} — ${player.team}`;
    }
    return name;
  }, [showTeam]);

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

  // Edit groups handlers
  const handleMovePlayer = async () => {
    if (!selectedPlayer || !targetGroupId || !table) return;
    const oldGroupId = selectedPlayer.group_id;
    const success = await movePlayerToGroup(selectedPlayer.id, targetGroupId);
    if (success) {
      // Regenerate matches for affected groups
      const oldGroupPlayers = players.filter(p => p.group_id === oldGroupId && p.id !== selectedPlayer.id);
      const newGroupPlayers = [...players.filter(p => p.group_id === targetGroupId), selectedPlayer];
      
      if (oldGroupId) await regenerateGroupMatches(table.id, oldGroupId, oldGroupPlayers.map(p => p.id));
      await regenerateGroupMatches(table.id, targetGroupId, newGroupPlayers.map(p => p.id));
      
      toast.success('Đã chuyển VĐV');
      await loadData();
    }
    setShowMoveDialog(false);
    setSelectedPlayer(null);
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim() || !addToGroupId || !table) return;
    const newPlayer = await addPlayerToGroup(table.id, addToGroupId, { name: newPlayerName, team: newPlayerTeam });
    if (newPlayer) {
      const groupPlayers = [...players.filter(p => p.group_id === addToGroupId), newPlayer];
      await regenerateGroupMatches(table.id, addToGroupId, groupPlayers.map(p => p.id));
      toast.success('Đã thêm VĐV');
      await loadData();
    }
    setShowAddDialog(false);
    setNewPlayerName('');
    setNewPlayerTeam('');
  };

  const handleRemovePlayer = async (player: QuickTablePlayer) => {
    if (!table || !player.group_id) return;
    if (!confirm(`Xóa ${player.name} khỏi bảng?`)) return;
    
    const success = await removePlayerFromGroup(player.id);
    if (success) {
      const remainingPlayers = players.filter(p => p.group_id === player.group_id && p.id !== player.id);
      await regenerateGroupMatches(table.id, player.group_id, remainingPlayers.map(p => p.id));
      toast.success('Đã xóa VĐV');
      await loadData();
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
        {canManageTable && groupStageComplete && !hasPlayoff && table.status === 'group_stage' && (
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
          <TabsList className="flex-wrap h-auto gap-1">
            {table.requires_registration && (
              <TabsTrigger value="registration">
                <ClipboardList className="w-4 h-4 mr-1" />
                Đăng ký
                {registrationCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{registrationCount}</Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="groups">Vòng bảng</TabsTrigger>
            <TabsTrigger value="playoff" disabled={!hasPlayoff}>
              Playoff
              {hasPlayoff && <Badge variant="secondary" className="ml-2 text-xs">{playoffMatches.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Registration Tab */}
          {table.requires_registration && (
            <TabsContent value="registration" className="space-y-4">
              {canManageTable ? (
                <RegistrationManager 
                  tableId={table.id} 
                  onApprovedPlayersChange={setRegistrationCount}
                />
              ) : (
                <RegistrationForm
                  tableId={table.id}
                  tableName={table.name}
                  requiresSkillLevel={table.requires_skill_level}
                  registrationMessage={table.registration_message}
                  existingRegistration={userRegistration}
                  onRegistrationComplete={loadData}
                />
              )}
            </TabsContent>
          )}

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            {/* Settings Row */}
            {canManageTable && !hasPlayoff && (
              <Card className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show-team"
                        checked={showTeam}
                        onCheckedChange={(checked) => setShowTeam(!!checked)}
                      />
                      <Label htmlFor="show-team" className="text-sm cursor-pointer">Hiện Team</Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingGroups ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setAddToGroupId(groups[0]?.id || ''); setShowAddDialog(true); }}>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Thêm VĐV
                        </Button>
                        <Button size="sm" onClick={() => setIsEditingGroups(false)}>
                          <Check className="w-4 h-4 mr-1" />
                          Xong
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setIsEditingGroups(true)}>
                        <Settings className="w-4 h-4 mr-1" />
                        Sửa bảng
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}
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
                                {isEditingGroups && <TableHead className="w-24 text-center">Thao tác</TableHead>}
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
                                      <span className="font-medium">{formatPlayerName(player)}</span>
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
                                  {isEditingGroups && (
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => {
                                            setSelectedPlayer(player);
                                            setTargetGroupId(groups.find(g => g.id !== group.id)?.id || '');
                                            setShowMoveDialog(true);
                                          }}
                                          title="Chuyển bảng"
                                        >
                                          <ArrowLeftRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => handleRemovePlayer(player)}
                                          title="Xóa VĐV"
                                        >
                                          <UserMinus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
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
                              canEdit={canEditScores && !hasPlayoff}
                              onScoreUpdate={(s1, s2) => handleScoreUpdate(match.id, s1, s2)}
                              formatPlayerName={formatPlayerName}
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
            {/* Login notice for non-editors */}
            {hasPlayoff && !canEditScores && table.status !== 'completed' && (
              <Card className="border-border/50 bg-muted/20">
                <CardContent className="py-3">
                  <p className="text-sm text-foreground-muted text-center">
                    Chỉ người tạo bảng hoặc trọng tài mới có thể nhập điểm.
                  </p>
                </CardContent>
              </Card>
            )}
            {hasPlayoff && (
              <PlayoffBracketView
                matches={playoffMatches}
                players={players}
                groups={groups}
                canEdit={canEditScores}
                onScoreUpdate={(matchId, s1, s2) => handleScoreUpdate(matchId, s1, s2, true)}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Referee Management - Only visible to creator */}
        {canManageTable && (
          <div className="mt-6">
            <RefereeManagement
              referees={referees}
              loading={refereesLoading}
              onAddReferee={addRefereeByEmail}
              onRemoveReferee={removeReferee}
            />
          </div>
        )}

        {/* Wildcard Selection Dialog */}
        <Dialog open={showWildcardDialog} onOpenChange={setShowWildcardDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chọn Wildcard</DialogTitle>
              <DialogDescription>
                Chọn {wildcardNeeded} người hạng 3 xuất sắc nhất để vào Playoff
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
              {thirdPlacePlayers.map((player, idx) => {
                const groupName = groups.find(g => g.id === player.group_id)?.name || '';
                // Create unique identifier using player id (short version)
                const shortId = player.id.substring(0, 6);
                
                return (
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
                      <div className="font-medium">
                        {player.name}
                        {player.seed && <span className="text-foreground-secondary"> ({player.seed})</span>}
                        <span className="text-foreground-muted text-xs ml-2">#{shortId}</span>
                      </div>
                      <div className="text-sm text-foreground-secondary">
                        Bảng {groupName} • {player.matches_won} thắng • Hiệu số: {player.point_diff > 0 ? '+' : ''}{player.point_diff}
                      </div>
                    </div>
                    {idx === 0 && <Badge variant="secondary">Khuyến nghị</Badge>}
                  </label>
                );
              })}
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

        {/* Move Player Dialog */}
        <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chuyển VĐV</DialogTitle>
              <DialogDescription>Chuyển {selectedPlayer?.name} sang bảng khác</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Chọn bảng đích</Label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger><SelectValue placeholder="Chọn bảng" /></SelectTrigger>
                <SelectContent>
                  {groups.filter(g => g.id !== selectedPlayer?.group_id).map(g => (
                    <SelectItem key={g.id} value={g.id}>Bảng {g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Hủy</Button>
              <Button onClick={handleMovePlayer} disabled={!targetGroupId}>Chuyển</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Player Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm VĐV mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Tên VĐV</Label>
                <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Nhập tên" />
              </div>
              <div>
                <Label>Team (không bắt buộc)</Label>
                <Input value={newPlayerTeam} onChange={(e) => setNewPlayerTeam(e.target.value)} placeholder="Nhập team" />
              </div>
              <div>
                <Label>Thêm vào bảng</Label>
                <Select value={addToGroupId} onValueChange={setAddToGroupId}>
                  <SelectTrigger><SelectValue placeholder="Chọn bảng" /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>Bảng {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Hủy</Button>
              <Button onClick={handleAddPlayer} disabled={!newPlayerName.trim() || !addToGroupId}>Thêm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

// Match Row Component with View/Edit mode
interface MatchRowProps {
  match: QuickTableMatch;
  index: number;
  player1: QuickTablePlayer | undefined;
  player2: QuickTablePlayer | undefined;
  canEdit: boolean;
  onScoreUpdate: (score1: number, score2: number) => void;
  formatPlayerName: (player: QuickTablePlayer | undefined) => string;
}

const MatchRow = ({ match, index, player1, player2, canEdit, onScoreUpdate, formatPlayerName }: MatchRowProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [s1, setS1] = useState<string>(match.score1?.toString() ?? '');
  const [s2, setS2] = useState<string>(match.score2?.toString() ?? '');
  const isCompleted = match.status === 'completed';
  const isLive = !!(match as any).live_referee_id;

  const handleStartEdit = () => {
    setS1(match.score1?.toString() ?? '');
    setS2(match.score2?.toString() ?? '');
    setIsEditing(true);
  };

  const handleSubmit = () => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    if (score1 > 0 || score2 > 0) {
      onScoreUpdate(score1, score2);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setS1(match.score1?.toString() ?? '');
    setS2(match.score2?.toString() ?? '');
    setIsEditing(false);
  };

  const handleOpenScoring = () => {
    navigate(`/matches/${match.id}/score`);
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border",
        isCompleted && !isEditing ? "bg-muted/30 border-border" : "border-border-subtle",
        isLive && !isCompleted && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-center gap-1 w-8 sm:w-10 flex-shrink-0">
        <span className="text-sm text-foreground-muted">{index + 1}</span>
        {isLive && !isCompleted && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 animate-pulse">
            <Radio className="w-2 h-2 mr-0.5" />
            LIVE
          </Badge>
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-2">
        <span className={cn(
          "flex-1 text-right truncate text-sm",
          match.winner_id === match.player1_id && "font-semibold text-primary"
        )}>
          {formatPlayerName(player1)}
        </span>
        
        {isEditing ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Input
              type="number"
              className="w-12 sm:w-14 h-8 text-center text-sm p-1"
              min={0}
              value={s1}
              onChange={(e) => setS1(e.target.value)}
              autoFocus
            />
            <span className="text-foreground-muted">-</span>
            <Input
              type="number"
              className="w-12 sm:w-14 h-8 text-center text-sm p-1"
              min={0}
              value={s2}
              onChange={(e) => setS2(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 rounded bg-muted min-w-[50px] sm:min-w-[60px] justify-center flex-shrink-0">
            <span className={cn("text-sm", match.winner_id === match.player1_id && "font-bold")}>
              {match.score1 ?? '-'}
            </span>
            <span className="text-foreground-muted">:</span>
            <span className={cn("text-sm", match.winner_id === match.player2_id && "font-bold")}>
              {match.score2 ?? '-'}
            </span>
          </div>
        )}
        
        <span className={cn(
          "flex-1 truncate text-sm",
          match.winner_id === match.player2_id && "font-semibold text-primary"
        )}>
          {formatPlayerName(player2)}
        </span>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {canEdit && (
          <>
            {/* Scoring button - always visible for editors */}
            <Button 
              variant={isLive ? "destructive" : "outline"}
              size="sm" 
              className="h-7 px-2 text-xs"
              onClick={handleOpenScoring}
              title="Mở trang chấm điểm"
            >
              <Play className="w-3 h-3" />
              <span className="hidden sm:inline ml-1">Chấm</span>
            </Button>
            
            {isEditing ? (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={handleCancel}
                >
                  Hủy
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 px-2 text-xs"
                  onClick={handleSubmit}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Lưu
                </Button>
              </>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={handleStartEdit}
              >
                <Pencil className="w-3 h-3 mr-1" />
                {isCompleted ? 'Sửa' : 'Nhập'}
              </Button>
            )}
          </>
        )}
        {!canEdit && (
          isCompleted ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : isLive ? (
            <Badge variant="destructive" className="text-xs animate-pulse">
              <Radio className="w-3 h-3 mr-1" />
              LIVE
            </Badge>
          ) : (
            <Clock className="w-4 h-4 text-foreground-muted" />
          )
        )}
      </div>
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

  // Add seed info to players for bracket display
  const playersWithSeed = useMemo(() => {
    return players.map(p => ({
      ...p,
      seed: p.seed ?? undefined,
    }));
  }, [players]);

  return (
    <PlayoffBracket
      matches={uniqueMatches}
      players={playersWithSeed}
      canEdit={canEdit}
      onScoreUpdate={onScoreUpdate}
      groupNames={groupNames}
    />
  );
};

export default QuickTableView;
