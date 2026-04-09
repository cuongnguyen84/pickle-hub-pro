import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout';
import { useQuickTable, type QuickTable, type QuickTableGroup, type QuickTablePlayer, type QuickTableMatch } from '@/hooks/useQuickTable';
import { useRefereeManagement } from '@/hooks/useRefereeManagement';
import { useRegistration, type Registration } from '@/hooks/useRegistration';
import { useTeamRegistration, type Team } from '@/hooks/useTeamRegistration';
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
import { Share2, Trophy, Check, Clock, ChevronRight, Swords, Pencil, Settings, UserPlus, ArrowLeftRight, UserMinus, X, Radio, Play, ClipboardList, MapPin, Trash2, RefreshCw } from 'lucide-react';
import QuickTablePlayoffView from '@/components/quicktable/QuickTablePlayoffView';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import RefereeManagement from '@/components/quicktable/RefereeManagement';
import QuickTableMatchRow from '@/components/quicktable/QuickTableMatchRow';
import RegistrationForm from '@/components/quicktable/RegistrationForm';
import RegistrationManager from '@/components/quicktable/RegistrationManager';
import ApprovedPlayersList from '@/components/quicktable/ApprovedPlayersList';
import RegisteredPlayersList from '@/components/quicktable/RegisteredPlayersList';
import EditCourtsDialog from '@/components/quicktable/EditCourtsDialog';
import DoublesRegistrationForm from '@/components/quicktable/DoublesRegistrationForm';
import TeamManager from '@/components/quicktable/TeamManager';
import { AIAssistantButton } from '@/components/ai';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';
import { useI18n } from '@/i18n';
import PlayoffPreviewDialog from '@/components/quicktable/PlayoffPreviewDialog';
import {
  generateGlobalSeeding,
  generateSeededPairings,
  resolveGroupConflicts,
  type BracketPairing,
} from '@/lib/quick-table-playoff';

import { useAdminAuth } from '@/hooks/useAdminAuth';

const QuickTableView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { 
    getTableByShareId, updateMatchScore, updatePlayerStats, isOwner,
    getQualifiedPlayers, generatePlayoffBracket, createPlayoffMatches, 
    markPlayersQualified, updateTableStatus, isGroupStageComplete, getWildcardCount,
    isPlayoffRoundComplete, createNextPlayoffRound, movePlayerToGroup,
    addPlayerToGroup, removePlayerFromGroup, regenerateGroupMatches,
    updateTableCourtSettings, reassignCourtsAndTimes, deleteTable
  } = useQuickTable();
  const { isAdmin } = useAdminAuth();
  const { user } = useAuth();
  const { getUserRegistration, getPendingCount } = useRegistration();
  const { getUserTeam } = useTeamRegistration();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [groups, setGroups] = useState<QuickTableGroup[]>([]);
  const [players, setPlayers] = useState<QuickTablePlayer[]>([]);
  const [matches, setMatches] = useState<QuickTableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'groups');

  // Registration state
  const [userRegistration, setUserRegistration] = useState<Registration | null>(null);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
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

  // Playoff preview dialog state (6-group seeded bracket)
  const [showPlayoffPreview, setShowPlayoffPreview] = useState(false);
  const [previewPairings, setPreviewPairings] = useState<BracketPairing[]>([]);

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
  
  // Edit courts dialog
  const [showEditCourtsDialog, setShowEditCourtsDialog] = useState(false);
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        if (data.table.is_doubles) {
          // For doubles: load user's team
          const team = await getUserTeam(data.table.id);
          setUserTeam(team);
          
          // Load all teams for pairing list
          const { data: teamsData } = await supabase
            .from('quick_table_teams')
            .select('*')
            .eq('table_id', data.table.id)
            .not('team_status', 'in', '(removed)')
            .order('created_at', { ascending: true });
          setAllTeams((teamsData || []) as Team[]);
        } else {
          // For singles: load user's registration
          const reg = await getUserRegistration(data.table.id);
          setUserRegistration(reg);
        }
      }
      
      // Load pending registration count for creators
      if (data.table.requires_registration) {
        const pendingCount = await getPendingCount(data.table.id);
        setRegistrationCount(pendingCount);
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
                toast.success(t.quickTable.view.nextRoundCreated);
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

  useEffect(() => { loadData(); }, [shareId, user]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [loadData]);

  // Layer 1 & 2: Visibility-change auto-refresh + polling fallback
  useVisibilityRefresh(loadData, { minInterval: 5000, pollingInterval: 20000 });

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
              toast.success(t.quickTable.view.nextRoundCreated);
            } else if (currentRound > 0) {
              // Final completed - mark as done
              const finalMatch = updatedMatches.find(m => 
                m.is_playoff && m.playoff_round === currentRound && m.status === 'completed'
              );
              const roundMatches = updatedMatches.filter(m => m.is_playoff && m.playoff_round === currentRound);
              if (roundMatches.length === 1 && finalMatch) {
                await updateTableStatus(table.id, 'completed');
                toast.success(t.quickTable.view.tournamentCompleted);
              }
            }
          }
        }
      }
    }
    
    await loadData();
    toast.success(t.quickTable.view.scoreUpdated);
  };

  const handleShare = () => {
    const shareUrl = `https://share.thepicklehub.net/quick-table/${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success(t.quickTable.view.shareSuccess);
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

      toast.success(t.quickTable.view.playoffCreated);
      await loadData();
      setActiveTab('playoff');
    } catch (error) {
      console.error('Error creating playoff:', error);
      toast.error(t.quickTable.view.errorOccurred);
    }
  };

  const handleConfirmWildcards = () => {
    if (selectedWildcards.length !== wildcardNeeded) {
      toast.error(t.quickTable.view.selectExactly.replace('{count}', String(wildcardNeeded)));
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
      
      toast.success(t.quickTable.view.movedSuccess);
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
      toast.success(t.quickTable.view.addedSuccess);
      await loadData();
    }
    setShowAddDialog(false);
    setNewPlayerName('');
    setNewPlayerTeam('');
  };

  const handleRemovePlayer = async (player: QuickTablePlayer) => {
    if (!table || !player.group_id) return;
    if (!confirm(t.quickTable.view.removeConfirm.replace('{name}', player.name))) return;
    
    const success = await removePlayerFromGroup(player.id);
    if (success) {
      const remainingPlayers = players.filter(p => p.group_id === player.group_id && p.id !== player.id);
      await regenerateGroupMatches(table.id, player.group_id, remainingPlayers.map(p => p.id));
      toast.success(t.quickTable.view.removedSuccess);
      await loadData();
    }
  };

  // Handle courts and time update
  const handleSaveCourtsAndTime = async (newCourts: string[], newStartTime: string | null) => {
    if (!table) return;
    
    // Convert string[] to number[] for reassign function
    const courtsAsNumbers = newCourts.map(c => parseInt(c, 10)).filter(n => !isNaN(n));
    
    // Update table settings
    await updateTableCourtSettings(table.id, newCourts, newStartTime);
    
    // Reassign courts and times to all matches
    await reassignCourtsAndTimes(table.id, courtsAsNumbers, newStartTime, groups, matches);
    
    toast.success(t.quickTable.view.courtsTimeUpdated);
    await loadData();
  };

  // Handle delete table
  const handleDeleteTable = async () => {
    if (!table) return;
    if (!confirm(t.quickTable.view.deleteConfirmFull.replace('{name}', table.name))) {
      return;
    }
    
    const success = await deleteTable(table.id);
    if (success) {
      navigate('/quick-tables');
    }
  };

  // Check if user can delete this table
  const canDeleteTable = isAdmin || (user && table?.creator_user_id === user.id);

  if (loading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-foreground-muted">{t.quickTable.view.loading}</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!table) {
    return (
      <MainLayout>
        <div className="container-wide py-8 text-center">
          <h1 className="text-xl font-bold mb-2">{t.quickTable.view.notFound}</h1>
          <Link to="/tools/quick-tables"><Button variant="outline">{t.quickTable.view.goBack}</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container-wide py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2 flex-wrap">
              {table.name}
              <AIAssistantButton 
                screenName="quick-table-view" 
                stepName={table.status === 'playoff' ? 'playoff' : 'group'}
                contextData={{ 
                  status: table.status,
                  playerCount: players.length,
                  groupCount: groups.length,
                  playoffReady: groupStageComplete,
                }}
              />
            </h1>
            <div className="flex items-center gap-2 text-foreground-secondary flex-wrap text-sm">
              <Badge variant="outline" className="text-xs">
                {table.format === 'round_robin' ? 'Round Robin' : 'Playoff'}
              </Badge>
              <Badge variant={table.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                {table.status === 'setup' && t.quickTable.status.setup}
                {table.status === 'group_stage' && t.quickTable.status.groupStage}
                {table.status === 'playoff' && t.quickTable.status.playoff}
                {table.status === 'completed' && t.quickTable.status.completed}
              </Badge>
              <span className="text-xs">{players.length} {t.quickTable.players}</span>
              {groups.length > 0 && <span className="text-xs">• {groups.length} {t.quickTable.view.group}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t.quickTable.view.shareSuccess.replace('!', '')}</span>
            </Button>
            {canDeleteTable && (
              <Button variant="outline" size="sm" onClick={handleDeleteTable} className="text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t.quickTable.view.deleteBtn}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Advance to Playoff Button */}
        {canManageTable && groupStageComplete && !hasPlayoff && table.status === 'group_stage' && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t.quickTable.view.groupCompleteTitle}</h3>
                  <p className="text-sm text-foreground-secondary">
                    {t.quickTable.view.groupCompleteDesc}
                  </p>
                </div>
                <Button onClick={handleStartPlayoff}>
                  <Swords className="w-4 h-4 mr-2" />
                  {t.quickTable.view.startPlayoff}
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
            <TabsTrigger value="groups">{t.quickTable.view.groupStage}</TabsTrigger>
            <TabsTrigger value="playoff" disabled={!hasPlayoff}>
              {t.quickTable.view.playoffTab}
              {hasPlayoff && <Badge variant="secondary" className="ml-2 text-xs">{playoffMatches.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Registration Tab */}
          {table.requires_registration && (
            <TabsContent value="registration" className="space-y-4">
              {canManageTable ? (
                // BTC view: show appropriate manager based on doubles/singles
                table.is_doubles ? (
                  <TeamManager 
                    tableId={table.id}
                    shareId={shareId}
                    table={table}
                    onPendingCountChange={setRegistrationCount}
                  />
                ) : (
                  <RegistrationManager 
                    tableId={table.id}
                    shareId={shareId}
                    table={table}
                    onPendingCountChange={setRegistrationCount}
                  />
                )
              ) : (
                <div className="space-y-4">
                  {/* Player view: show appropriate form based on doubles/singles */}
                  {table.is_doubles ? (
                    <DoublesRegistrationForm
                      tableId={table.id}
                      shareId={shareId || ''}
                      tableName={table.name}
                      requiresSkillLevel={table.requires_skill_level}
                      registrationMessage={table.registration_message}
                      existingTeam={userTeam}
                      allTeams={allTeams}
                      tableStatus={table.status}
                      onRegistrationComplete={loadData}
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
                  {/* Show all registered players/teams for public viewers */}
                  <RegisteredPlayersList tableId={table.id} isDoubles={table.is_doubles} />
                </div>
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
                      <Label htmlFor="show-team" className="text-sm cursor-pointer">{t.quickTable.view.showTeam}</Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowEditCourtsDialog(true)}>
                      <MapPin className="w-4 h-4 mr-1" />
                      {t.quickTable.view.courtTime}
                    </Button>
                    {isEditingGroups ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setAddToGroupId(groups[0]?.id || ''); setShowAddDialog(true); }}>
                          <UserPlus className="w-4 h-4 mr-1" />
                          {t.quickTable.view.addPlayer}
                        </Button>
                        <Button size="sm" onClick={() => setIsEditingGroups(false)}>
                          <Check className="w-4 h-4 mr-1" />
                          {t.quickTable.view.done}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setIsEditingGroups(true)}>
                        <Settings className="w-4 h-4 mr-1" />
                        {t.quickTable.view.editGroups}
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
                      {t.quickTable.view.group} {group.name}
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
                            {t.quickTable.view.standings}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>{t.quickTable.view.player}</TableHead>
                                <TableHead className="text-center w-16">{t.quickTable.view.wins}</TableHead>
                                <TableHead className="text-center w-16">{t.quickTable.view.matches}</TableHead>
                                <TableHead className="text-center w-20">{t.quickTable.view.pointDiff}</TableHead>
                                {isEditingGroups && <TableHead className="w-24 text-center">{t.quickTable.view.actions}</TableHead>}
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
                                          title={t.quickTable.view.movePlayer}
                                        >
                                          <ArrowLeftRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => handleRemovePlayer(player)}
                                          title={t.quickTable.view.removePlayer}
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
                          <CardTitle className="text-base">{t.quickTable.view.matchList}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {groupMatches.map((match, idx) => (
                            <QuickTableMatchRow
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
                    {t.quickTable.view.onlyCreatorCanScore}
                  </p>
                </CardContent>
              </Card>
            )}
            {hasPlayoff && (
              <QuickTablePlayoffView
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
              <DialogTitle>{t.quickTable.view.wildcardTitle}</DialogTitle>
              <DialogDescription>
                {t.quickTable.view.wildcardDesc.replace('{count}', String(wildcardNeeded))}
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
                        {t.quickTable.view.group} {groupName} • {player.matches_won} {t.quickTable.view.winsLabel} • {t.quickTable.view.pointDiffLabel}: {player.point_diff > 0 ? '+' : ''}{player.point_diff}
                      </div>
                    </div>
                    {idx === 0 && <Badge variant="secondary">{t.quickTable.view.recommended}</Badge>}
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWildcardDialog(false)}>
                {t.quickTable.view.cancel}
              </Button>
              <Button 
                onClick={handleConfirmWildcards}
                disabled={selectedWildcards.length !== wildcardNeeded}
              >
                {t.quickTable.view.confirm} ({selectedWildcards.length}/{wildcardNeeded})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Player Dialog */}
        <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.quickTable.view.movePlayer}</DialogTitle>
              <DialogDescription>{t.quickTable.view.moveToGroup.replace('{name}', selectedPlayer?.name || '')}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>{t.quickTable.view.selectTargetGroup}</Label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger><SelectValue placeholder={t.quickTable.view.selectGroup} /></SelectTrigger>
                <SelectContent>
                  {groups.filter(g => g.id !== selectedPlayer?.group_id).map(g => (
                    <SelectItem key={g.id} value={g.id}>{t.quickTable.view.group} {g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMoveDialog(false)}>{t.quickTable.view.cancel}</Button>
              <Button onClick={handleMovePlayer} disabled={!targetGroupId}>{t.quickTable.view.move}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Player Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.quickTable.view.addPlayerTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>{t.quickTable.view.addPlayerName}</Label>
                <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder={t.quickTable.view.enterName} />
              </div>
              <div>
                <Label>{t.quickTable.view.addPlayerTeam}</Label>
                <Input value={newPlayerTeam} onChange={(e) => setNewPlayerTeam(e.target.value)} placeholder={t.quickTable.view.enterTeam} />
              </div>
              <div>
                <Label>{t.quickTable.view.addToGroup}</Label>
                <Select value={addToGroupId} onValueChange={setAddToGroupId}>
                  <SelectTrigger><SelectValue placeholder={t.quickTable.view.selectGroup} /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{t.quickTable.view.group} {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t.quickTable.view.cancel}</Button>
              <Button onClick={handleAddPlayer} disabled={!newPlayerName.trim() || !addToGroupId}>{t.quickTable.view.add}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Courts Dialog */}
        <EditCourtsDialog
          open={showEditCourtsDialog}
          onOpenChange={setShowEditCourtsDialog}
          currentCourts={table.courts || []}
          currentStartTime={table.start_time}
          onSave={handleSaveCourtsAndTime}
        />
      </div>
    </MainLayout>
  );
};

export default QuickTableView;
