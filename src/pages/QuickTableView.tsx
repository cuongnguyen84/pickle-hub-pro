import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TheLineLayout } from '@/components/layout';
import { useQuickTable, type QuickTable, type QuickTableGroup, type QuickTablePlayer, type QuickTableMatch } from '@/hooks/useQuickTable';
import { useRefereeManagement } from '@/hooks/useRefereeManagement';
import { useRegistration, type Registration } from '@/hooks/useRegistration';
import { useTeamRegistration, type Team } from '@/hooks/useTeamRegistration';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Share2, Trophy, Check, ChevronRight, Swords, Settings, UserPlus, ArrowLeftRight,
  UserMinus, ClipboardList, MapPin, Trash2, RefreshCw,
} from 'lucide-react';
import QuickTablePlayoffView from '@/components/quicktable/QuickTablePlayoffView';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import RefereeManagement from '@/components/quicktable/RefereeManagement';
import QuickTableMatchRow from '@/components/quicktable/QuickTableMatchRow';
import RegistrationForm from '@/components/quicktable/RegistrationForm';
import RegistrationManager from '@/components/quicktable/RegistrationManager';
import RegisteredPlayersList from '@/components/quicktable/RegisteredPlayersList';
import EditCourtsDialog from '@/components/quicktable/EditCourtsDialog';
import DoublesRegistrationForm from '@/components/quicktable/DoublesRegistrationForm';
import TeamManager from '@/components/quicktable/TeamManager';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';
import { useI18n } from '@/i18n';
import PlayoffPreviewDialog from '@/components/quicktable/PlayoffPreviewDialog';
import {
  generateGlobalSeeding,
  generateSeededPairings,
  resolveGroupConflicts,
  BYE_PLAYER_ID,
  type BracketPairing,
} from '@/lib/quick-table-playoff';

import { useAdminAuth } from '@/hooks/useAdminAuth';

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 24,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 22,
  letterSpacing: '-0.015em',
  margin: 0,
  color: 'var(--tl-fg)',
};

const QuickTableView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    getTableByShareId, updateMatchScore, updatePlayerStats,
    getQualifiedPlayers, generatePlayoffBracket, createPlayoffMatches,
    markPlayersQualified, updateTableStatus, isGroupStageComplete, getWildcardCount,
    isPlayoffRoundComplete, createNextPlayoffRound, movePlayerToGroup,
    addPlayerToGroup, removePlayerFromGroup, regenerateGroupMatches,
    updateTableCourtSettings, reassignCourtsAndTimes, deleteTable,
    updateCourtName, pending,
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

  const [userRegistration, setUserRegistration] = useState<Registration | null>(null);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [registrationCount, setRegistrationCount] = useState(0);

  const {
    referees, loading: refereesLoading, userRole,
    addRefereeByEmail, removeReferee, refreshUserRole,
  } = useRefereeManagement(table?.id, table?.creator_user_id);

  const canManageTable = userRole.canManageTable;
  const canEditScores = userRole.canEditScores;

  const [showWildcardDialog, setShowWildcardDialog] = useState(false);
  const [selectedWildcards, setSelectedWildcards] = useState<string[]>([]);
  const [thirdPlacePlayers, setThirdPlacePlayers] = useState<QuickTablePlayer[]>([]);
  const [wildcardNeeded, setWildcardNeeded] = useState(0);

  const [showPlayoffPreview, setShowPlayoffPreview] = useState(false);
  const [previewPairings, setPreviewPairings] = useState<BracketPairing[]>([]);

  const [showTeam, setShowTeam] = useState(() => {
    if (!shareId) return false;
    const saved = localStorage.getItem(`quick-table-show-team-${shareId}`);
    return saved === 'true';
  });

  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<QuickTablePlayer | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [addToGroupId, setAddToGroupId] = useState<string>('');

  const [showEditCourtsDialog, setShowEditCourtsDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    if (!shareId) return;
    const data = await getTableByShareId(shareId);
    if (data) {
      setTable(data.table);
      setGroups(data.groups);
      setPlayers(data.players);
      setMatches(data.matches);

      if (data.table.requires_registration && user) {
        if (data.table.is_doubles) {
          const team = await getUserTeam(data.table.id);
          setUserTeam(team);

          const { data: teamsData } = await supabase
            .from('quick_table_teams')
            .select('*')
            .eq('table_id', data.table.id)
            .not('team_status', 'in', '(removed)')
            .order('created_at', { ascending: true });
          setAllTeams((teamsData || []) as Team[]);
        } else {
          const reg = await getUserRegistration(data.table.id);
          setUserRegistration(reg);
        }
      }

      if (data.table.requires_registration) {
        const pendingCount = await getPendingCount(data.table.id);
        setRegistrationCount(pendingCount);
      }

      if (data.table.status === 'playoff' || data.table.status === 'completed') {
        setActiveTab('playoff');
      } else if (data.table.requires_registration && data.table.status === 'setup') {
        setActiveTab('registration');
      }

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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [loadData]);

  useVisibilityRefresh(loadData, { minInterval: 5000, pollingInterval: 20000 });

  useEffect(() => {
    if (!table?.id) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`quick-table-${table.id}:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quick_table_matches', filter: `table_id=eq.${table.id}` },
          (payload) => { console.log('[Realtime] Match update:', payload); loadData(); },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quick_table_players', filter: `table_id=eq.${table.id}` },
          (payload) => { console.log('[Realtime] Player update:', payload); loadData(); },
        )
        .subscribe();
    } catch (err) {
      console.warn("[QuickTable] Realtime setup failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [table?.id]);

  useEffect(() => {
    if (table) {
      refreshUserRole();
    }
  }, [table?.id, refreshUserRole]);

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

    if (isPlayoff && match.playoff_round !== null) {
      const updatedData = await getTableByShareId(shareId!);
      if (updatedData) {
        const currentRound = match.playoff_round;
        const updatedMatches = updatedData.matches;

        if (isPlayoffRoundComplete(updatedMatches, currentRound)) {
          const nextRoundExists = updatedMatches.some(m =>
            m.is_playoff && m.playoff_round === currentRound + 1,
          );

          if (!nextRoundExists) {
            const newMatches = await createNextPlayoffRound(table.id, currentRound, updatedMatches);
            if (newMatches.length > 0) {
              toast.success(t.quickTable.view.nextRoundCreated);
            } else if (currentRound > 0) {
              const finalMatch = updatedMatches.find(m =>
                m.is_playoff && m.playoff_round === currentRound && m.status === 'completed',
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
    const shareUrl = `https://www.thepicklehub.net/tools/quick-tables/${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success(t.quickTable.view.shareSuccess);
  };

  const getPlayerById = (id: string | null) => players.find(p => p.id === id);

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
        if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
        return b.points_for - a.points_for;
      });
  };

  const groupStageComplete = isGroupStageComplete(matches);
  const playoffMatches = matches.filter(m => m.is_playoff);
  const hasPlayoff = playoffMatches.length > 0;

  const handleStartPlayoff = () => {
    if (!table || !table.group_count) return;

    if (table.group_count === 6) {
      try {
        const seeded = generateGlobalSeeding(groups, players, matches);
        const pairings = generateSeededPairings(seeded);
        const resolved = resolveGroupConflicts(pairings);
        setPreviewPairings(resolved.pairings);
        setShowPlayoffPreview(true);
      } catch {
        toast.error(t.quickTable.view.errorOccurred);
      }
      return;
    }

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
      await markPlayersQualified(qualified, wildcards);
      const bracketMatches = generatePlayoffBracket(table.group_count, qualified, wildcards, groups);
      await createPlayoffMatches(table.id, bracketMatches);
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

  const handleConfirmPlayoffPreview = async (confirmedPairings: BracketPairing[]) => {
    if (!table) return;

    try {
      const allSeededPlayers = new Map<string, BracketPairing['player1']>();
      for (const p of confirmedPairings) {
        if (p.player1.playerId !== BYE_PLAYER_ID) {
          allSeededPlayers.set(p.player1.playerId, p.player1);
        }
        if (p.player2.playerId !== BYE_PLAYER_ID) {
          allSeededPlayers.set(p.player2.playerId, p.player2);
        }
      }

      const qualifiedPlayers: QuickTablePlayer[] = [];
      const wildcardPlayers: QuickTablePlayer[] = [];

      for (const sp of allSeededPlayers.values()) {
        const player = players.find(pl => pl.id === sp.playerId);
        if (!player) continue;
        const updated = { ...player, playoff_seed: sp.seed };
        if (sp.tier === 'wildcard') {
          wildcardPlayers.push(updated);
        } else {
          qualifiedPlayers.push(updated);
        }
      }

      await markPlayersQualified(qualifiedPlayers, wildcardPlayers);

      const bracketMatches = confirmedPairings.map(p => ({
        player1: p.player1.playerId !== BYE_PLAYER_ID
          ? (players.find(pl => pl.id === p.player1.playerId) || null)
          : null,
        player2: p.player2.playerId !== BYE_PLAYER_ID
          ? (players.find(pl => pl.id === p.player2.playerId) || null)
          : null,
        bracketPosition: p.matchNumber <= 4 ? 'upper' : 'lower',
        matchNumber: p.matchNumber,
      }));

      await createPlayoffMatches(table.id, bracketMatches);
      await updateTableStatus(table.id, 'playoff');

      toast.success(t.quickTable.view.playoffCreated);
      await loadData();
      setActiveTab('playoff');
    } catch {
      toast.error(t.quickTable.view.errorOccurred);
    }
  };

  const handleMovePlayer = async () => {
    if (!selectedPlayer || !targetGroupId || !table) return;
    const oldGroupId = selectedPlayer.group_id;
    const success = await movePlayerToGroup(selectedPlayer.id, targetGroupId);
    if (success) {
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

  const handleSaveCourtsAndTime = async (newCourts: string[], newStartTime: string | null) => {
    if (!table) return;

    const courtsAsNumbers = newCourts.map(c => parseInt(c, 10)).filter(n => !isNaN(n));

    await updateTableCourtSettings(table.id, newCourts, newStartTime);
    await reassignCourtsAndTimes(table.id, courtsAsNumbers, newStartTime, groups, matches);

    toast.success(t.quickTable.view.courtsTimeUpdated);
    await loadData();
  };

  const handleDeleteTable = async () => {
    if (!table) return;
    if (!confirm(t.quickTable.view.deleteConfirmFull.replace('{name}', table.name))) {
      return;
    }

    const success = await deleteTable(table.id);
    if (success) {
      navigate('/tools/quick-tables');
    }
  };

  const canDeleteTable = isAdmin || (user && table?.creator_user_id === user.id);

  // ─── Loading + 404 states ────────────────────────────────────────────────
  if (loading) {
    return (
      <TheLineLayout title="Quick Table" noindex={true} active="lab">
        <div className="tl-shell">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              color: 'var(--tl-fg-3)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t.quickTable.view.loading}
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!table) {
    return (
      <TheLineLayout title="Quick Table" noindex={true} active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{t.quickTable.view.notFound}</h3>
            <Link to="/tools/quick-tables" className="tl-btn">
              ← {t.quickTable.view.goBack}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const statusKey = table.status;
  const statusLabel =
    statusKey === 'setup' ? t.quickTable.status.setup :
    statusKey === 'group_stage' ? t.quickTable.status.groupStage :
    statusKey === 'playoff' ? t.quickTable.status.playoff :
    statusKey === 'completed' ? t.quickTable.status.completed : statusKey;
  const statusPillColor =
    statusKey === 'completed' ? 'var(--tl-surface)' :
    statusKey === 'playoff' || statusKey === 'group_stage' ? 'var(--tl-green-glow)' :
    'rgba(233, 182, 73, 0.12)';
  const statusPillFg =
    statusKey === 'completed' ? 'var(--tl-fg-3)' :
    statusKey === 'playoff' || statusKey === 'group_stage' ? 'var(--tl-green)' :
    'var(--tl-gold)';

  return (
    <TheLineLayout
      title={`${table.name} | Quick Table`}
      description={`${table.name} – ${table.player_count} VĐV`}
      noindex={true}
      active="lab"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/quick-tables">Quick Tables</Link>
          <span className="sep">/</span>
          <span className="current">{table.name}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {table.format === 'round_robin' ? 'Round Robin' : 'Playoff'}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {players.length} {t.quickTable.players}
            {groups.length > 0 && (
              <>
                <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
                {groups.length} {t.quickTable.view.group}
              </>
            )}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
            <em className="tl-serif">{table.name}</em>
          </h1>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <span
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 4,
                background: statusPillColor,
                color: statusPillFg,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="tl-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label={language === 'vi' ? 'Tải lại' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" className="tl-btn" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {language === 'vi' ? 'Chia sẻ' : 'Share'}
                </span>
              </button>
              {canDeleteTable && (
                <button
                  type="button"
                  className="tl-btn"
                  onClick={handleDeleteTable}
                  disabled={pending.deleteTable}
                  style={{ color: 'var(--tl-live)', borderColor: 'var(--tl-border)' }}
                >
                  <Trash2 className={`w-4 h-4 ${pending.deleteTable ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{t.quickTable.view.deleteBtn}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Advance to Playoff banner */}
        {canManageTable && groupStageComplete && !hasPlayoff && table.status === 'group_stage' && (
          <section style={{ marginTop: 32 }}>
            <div
              style={{
                ...surfaceCard,
                borderColor: 'var(--tl-green)',
                background: 'var(--tl-green-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ ...sectionTitle, fontSize: 22, color: 'var(--tl-fg)' }}>
                  {t.quickTable.view.groupCompleteTitle}
                </h3>
                <p style={{ color: 'var(--tl-fg-2)', fontSize: 13.5, margin: '4px 0 0' }}>
                  {t.quickTable.view.groupCompleteDesc}
                </p>
              </div>
              <button type="button" className="tl-btn green" onClick={handleStartPlayoff}>
                <Swords className="w-4 h-4" />
                {t.quickTable.view.startPlayoff}
              </button>
            </div>
          </section>
        )}

        <section style={{ marginTop: 32, marginBottom: 56 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              {table.requires_registration && (
                <TabsTrigger value="registration">
                  <ClipboardList className="w-4 h-4 mr-1" />
                  {language === 'vi' ? 'Đăng ký' : 'Registration'}
                  {registrationCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">{registrationCount}</Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="groups">{t.quickTable.view.groupStage}</TabsTrigger>
              <TabsTrigger value="playoff" disabled={!hasPlayoff}>
                {t.quickTable.view.playoffTab}
                {hasPlayoff && (
                  <Badge variant="secondary" className="ml-2 text-xs">{playoffMatches.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Registration Tab */}
            {table.requires_registration && (
              <TabsContent value="registration" className="space-y-4">
                {canManageTable ? (
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
                    <RegisteredPlayersList tableId={table.id} isDoubles={table.is_doubles} />
                  </div>
                )}
              </TabsContent>
            )}

            {/* Groups Tab */}
            <TabsContent value="groups" className="space-y-6">
              {/* Toolbar — settings + edit groups */}
              {canManageTable && !hasPlayoff && (
                <div
                  style={{
                    ...surfaceCard,
                    padding: 14,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-team"
                      checked={showTeam}
                      onCheckedChange={(checked) => setShowTeam(!!checked)}
                    />
                    <Label htmlFor="show-team" className="text-sm cursor-pointer">
                      {t.quickTable.view.showTeam}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      className="tl-btn"
                      onClick={() => setShowEditCourtsDialog(true)}
                      style={{ fontSize: 12.5, padding: '7px 12px' }}
                    >
                      <MapPin className="w-4 h-4" />
                      {t.quickTable.view.courtTime}
                    </button>
                    {isEditingGroups ? (
                      <>
                        <button
                          type="button"
                          className="tl-btn"
                          onClick={() => { setAddToGroupId(groups[0]?.id || ''); setShowAddDialog(true); }}
                          style={{ fontSize: 12.5, padding: '7px 12px' }}
                        >
                          <UserPlus className="w-4 h-4" />
                          {t.quickTable.view.addPlayer}
                        </button>
                        <button
                          type="button"
                          className="tl-btn green"
                          onClick={() => setIsEditingGroups(false)}
                          style={{ fontSize: 12.5, padding: '7px 12px' }}
                        >
                          <Check className="w-4 h-4" />
                          {t.quickTable.view.done}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="tl-btn"
                        onClick={() => setIsEditingGroups(true)}
                        style={{ fontSize: 12.5, padding: '7px 12px' }}
                      >
                        <Settings className="w-4 h-4" />
                        {t.quickTable.view.editGroups}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {groups.length > 0 && (
                <Tabs defaultValue={groups[0]?.id} className="space-y-6">
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
                        <div style={surfaceCard}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              paddingBottom: 14,
                              borderBottom: '1px solid var(--tl-border)',
                              marginBottom: 4,
                            }}
                          >
                            <Trophy className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
                            <h3 style={{ ...sectionTitle, fontSize: 18 }}>{t.quickTable.view.standings}</h3>
                          </div>
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
                                <TableRow key={player.id} className={cn(idx < 2 && hasPlayoff && "bg-primary/5")}>
                                  <TableCell className="font-medium">
                                    {idx + 1}
                                    {idx < 2 && hasPlayoff && (
                                      <ChevronRight className="inline w-3 h-3 ml-1" style={{ color: 'var(--tl-green)' }} />
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
                                  <TableCell className="text-center font-semibold" style={{ color: 'var(--tl-green)' }}>
                                    {player.matches_won}
                                  </TableCell>
                                  <TableCell className="text-center">{player.matches_played}</TableCell>
                                  <TableCell
                                    className="text-center font-medium"
                                    style={{
                                      color:
                                        player.point_diff > 0 ? 'var(--tl-green)' :
                                        player.point_diff < 0 ? 'var(--tl-live)' :
                                        'var(--tl-fg-2)',
                                    }}
                                  >
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
                        </div>

                        {/* Matches */}
                        <div style={surfaceCard}>
                          <div
                            style={{
                              paddingBottom: 14,
                              borderBottom: '1px solid var(--tl-border)',
                              marginBottom: 16,
                            }}
                          >
                            <h3 style={{ ...sectionTitle, fontSize: 18 }}>{t.quickTable.view.matchList}</h3>
                          </div>
                          <div className="space-y-3">
                            {groupMatches.map((match, idx) => (
                              <QuickTableMatchRow
                                key={match.id}
                                match={match}
                                index={idx}
                                player1={getPlayerById(match.player1_id)}
                                player2={getPlayerById(match.player2_id)}
                                canEdit={canEditScores && !hasPlayoff}
                                onScoreUpdate={(s1, s2) => handleScoreUpdate(match.id, s1, s2)}
                                onCourtNameUpdate={(courtName) => updateCourtName(match.id, courtName).then(() => loadData())}
                                formatPlayerName={formatPlayerName}
                              />
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </TabsContent>

            {/* Playoff Tab */}
            <TabsContent value="playoff" className="space-y-6">
              {hasPlayoff && !canEditScores && table.status !== 'completed' && (
                <div
                  style={{
                    ...surfaceCard,
                    background: 'var(--tl-bg)',
                    padding: 14,
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0 }}>
                    {t.quickTable.view.onlyCreatorCanScore}
                  </p>
                </div>
              )}
              {hasPlayoff && (
                <QuickTablePlayoffView
                  matches={playoffMatches}
                  players={players}
                  groups={groups}
                  canEdit={canEditScores}
                  onScoreUpdate={(matchId, s1, s2) => handleScoreUpdate(matchId, s1, s2, true)}
                  onCourtNameUpdate={(matchId, courtName) => updateCourtName(matchId, courtName).then(() => loadData())}
                />
              )}
            </TabsContent>
          </Tabs>
        </section>

        {canManageTable && (
          <section style={{ marginBottom: 56 }}>
            <RefereeManagement
              referees={referees}
              loading={refereesLoading}
              onAddReferee={addRefereeByEmail}
              onRemoveReferee={removeReferee}
            />
          </section>
        )}

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
                const shortId = player.id.substring(0, 6);

                return (
                  <label
                    key={player.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedWildcards.includes(player.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
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

        <PlayoffPreviewDialog
          open={showPlayoffPreview}
          onOpenChange={setShowPlayoffPreview}
          initialPairings={previewPairings}
          groupNames={(() => {
            const map = new Map<string, string>();
            groups.forEach(g => map.set(g.id, g.name));
            return map;
          })()}
          onConfirm={handleConfirmPlayoffPreview}
        />

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

        <EditCourtsDialog
          open={showEditCourtsDialog}
          onOpenChange={setShowEditCourtsDialog}
          currentCourts={table.courts || []}
          currentStartTime={table.start_time}
          onSave={handleSaveCourtsAndTime}
        />
      </div>
    </TheLineLayout>
  );
};

export default QuickTableView;
