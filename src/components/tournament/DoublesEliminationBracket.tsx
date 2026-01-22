import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Trophy, Radio, Play, Pencil, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Match, Team, useDoublesElimination } from '@/hooks/useDoublesElimination';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DoublesEliminationBracketProps {
  matches: Match[];
  teams: Team[];
  tournamentId?: string;
  onMatchClick?: (matchId: string) => void;
  showPreliminaryOnly?: boolean;
  showPlayoffOnly?: boolean;
  canEdit?: boolean;
  onScoreUpdated?: () => void;
  // Callback for optimistic updates - passes updated match data
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void;
  // Callback for R3 assignment notification
  onR3Assigned?: (tiedTeamsInfo?: { count: number; names: string[] }) => void;
}

const DoublesEliminationBracket = ({ 
  matches, 
  teams,
  tournamentId,
  onMatchClick,
  showPreliminaryOnly = false,
  showPlayoffOnly = false,
  canEdit = false,
  onScoreUpdated,
  onMatchUpdated,
  onR3Assigned
}: DoublesEliminationBracketProps) => {
  const { checkAndAssignR3 } = useDoublesElimination();
  const { toast } = useToast();
  const [isAssigningR3, setIsAssigningR3] = useState(false);
  
  const getTeam = (id: string | null): Team | undefined => 
    id ? teams.find(t => t.id === id) : undefined;

  const formatTeamName = (team: Team | undefined): string => {
    if (!team) return 'TBD';
    return team.team_name;
  };

  const { rounds, champion, loserMatches, r1Completed, r2Completed, r3NeedsAssignment } = useMemo(() => {
    if (matches.length === 0) return { 
      rounds: [], 
      champion: null, 
      loserMatches: [], 
      r1Completed: false, 
      r2Completed: false,
      r3NeedsAssignment: false 
    };

    const r1Matches = matches.filter(m => m.round_number === 1 && m.bracket_type === 'winner');
    const r2LoserMatches = matches.filter(m => m.round_number === 2 && m.bracket_type === 'loser');
    const r3Matches = matches.filter(m => m.round_number === 3);
    
    const r1CompletedCheck = r1Matches.length > 0 && r1Matches.every(m => m.status === 'completed');
    const r2CompletedCheck = r2LoserMatches.length > 0 && r2LoserMatches.every(m => m.status === 'completed');
    const r3NeedsAssignmentCheck = r3Matches.length > 0 && r3Matches.some(m => !m.team_a_id || !m.team_b_id);
    
    const mainBracketMatches = matches.filter(m => 
      (m.round_number >= 3 && (m.bracket_type === 'merged' || m.bracket_type === 'single')) ||
      m.round_type === 'final'
    ).filter(m => m.round_type !== 'third_place');

    const roundMap = new Map<number, Match[]>();
    
    if (r1Matches.length > 0) {
      roundMap.set(1, r1Matches.sort((a, b) => a.match_number - b.match_number));
    }
    
    mainBracketMatches.forEach(match => {
      const round = match.round_number;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    roundMap.forEach((roundMatches) => {
      roundMatches.sort((a, b) => a.match_number - b.match_number);
    });

    const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const roundsArray = roundNumbers.map(roundNum => {
      const roundMatches = roundMap.get(roundNum) || [];
      return { 
        roundNumber: roundNum, 
        matches: roundMatches,
        roundType: roundMatches[0]?.round_type || 'elimination'
      };
    });

    const finalMatch = matches.find(m => m.round_type === 'final');
    const champion = finalMatch?.winner_id ? getTeam(finalMatch.winner_id) : null;

    return { 
      rounds: roundsArray, 
      champion,
      loserMatches: r2LoserMatches.sort((a, b) => a.match_number - b.match_number),
      r1Completed: r1CompletedCheck,
      r2Completed: r2CompletedCheck,
      r3NeedsAssignment: r3NeedsAssignmentCheck
    };
  }, [matches, teams]);

  // Auto-trigger R3 assignment when R1+R2 are completed but R3 has no teams
  useEffect(() => {
    const autoAssign = async () => {
      if (r1Completed && r2Completed && r3NeedsAssignment && tournamentId && !isAssigningR3) {
        setIsAssigningR3(true);
        const result = await checkAndAssignR3(tournamentId);
        if (result.triggered) {
          onR3Assigned?.(result.tiedTeamsInfo);
          onScoreUpdated?.(); // Reload to show assignments
        }
        setIsAssigningR3(false);
      }
    };
    autoAssign();
  }, [r1Completed, r2Completed, r3NeedsAssignment, tournamentId]);

  // Manual trigger for R3 assignment
  const handleManualR3Assignment = async () => {
    if (!tournamentId) return;
    setIsAssigningR3(true);
    const result = await checkAndAssignR3(tournamentId);
    if (result.triggered) {
      toast({ title: "Đã phân vòng 3", description: "Các VĐV đã được phân vào vòng tiếp theo." });
      onR3Assigned?.(result.tiedTeamsInfo);
      onScoreUpdated?.();
    } else if (result.error === 'NOT_ALL_MATCHES_COMPLETED') {
      toast({ title: "Chưa hoàn thành", description: "Vui lòng hoàn thành tất cả trận đấu vòng 1 và vòng 2 trước.", variant: "destructive" });
    }
    setIsAssigningR3(false);
  };

  const getRoundLabel = (roundType: string, matchCount: number): string => {
    switch (roundType) {
      case 'winner_r1': return 'Vòng 1 (Winner)';
      case 'merge_r3': return 'Vòng 3 (Merge)';
      case 'quarterfinal': return 'Tứ kết';
      case 'semifinal': return 'Bán kết';
      case 'final': return 'Chung kết';
      case 'elimination':
        if (matchCount === 1) return 'Chung kết';
        if (matchCount === 2) return 'Bán kết';
        if (matchCount <= 4) return 'Tứ kết';
        if (matchCount <= 8) return 'Vòng 16';
        return `Vòng ${matchCount * 2}`;
      default: return `Vòng ${roundType}`;
    }
  };

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chưa có bracket. Hãy hoàn tất cài đặt để tạo bracket.
        </CardContent>
      </Card>
    );
  }

  const playoffRounds = rounds.filter(r => r.roundNumber >= 4);
  const r3Rounds = rounds.filter(r => r.roundNumber === 3);

  return (
    <div className="space-y-6">
      {!showPreliminaryOnly && champion && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-8 h-8 text-primary" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Vô địch</div>
                <div className="text-2xl font-bold text-primary">{formatTeamName(champion)}</div>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRELIMINARY VIEW */}
      {!showPlayoffOnly && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                r1Completed ? "bg-emerald-500" : "bg-muted-foreground/30"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                r1Completed ? "text-emerald-500" : "text-muted-foreground"
              )}>V1</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                r2Completed ? "bg-amber-500" : "bg-muted-foreground/30"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                r2Completed ? "text-amber-500" : "text-muted-foreground"
              )}>V2</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                !r3NeedsAssignment && r1Completed && r2Completed ? "bg-blue-500" : "bg-muted-foreground/30"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                !r3NeedsAssignment && r1Completed && r2Completed ? "text-blue-500" : "text-muted-foreground"
              )}>V3</span>
            </div>

            {/* Manual R3 assignment button */}
            {canEdit && r1Completed && r2Completed && r3NeedsAssignment && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleManualR3Assignment}
                disabled={isAssigningR3}
                className="ml-auto h-7 text-xs"
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", isAssigningR3 && "animate-spin")} />
                Phân vòng 3
              </Button>
            )}
          </div>

          {/* Horizontal bracket layout */}
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-6 min-w-max items-start">
              {/* R1 Winner Matches */}
              {rounds.find(r => r.roundNumber === 1) && (
                <div className="flex flex-col min-w-[280px]">
                  <div className="mb-3 pb-2 border-b border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-sm text-foreground">Vòng 1</span>
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {rounds.find(r => r.roundNumber === 1)?.matches.filter(m => m.status === 'completed').length || 0}/
                        {rounds.find(r => r.roundNumber === 1)?.matches.length || 0}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-3">Winner Bracket</p>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
                    {rounds.find(r => r.roundNumber === 1)?.matches.map((match) => (
                      <LoserBracketCard
                        key={match.id}
                        match={match}
                        allMatches={matches}
                        teamA={getTeam(match.team_a_id)}
                        teamB={getTeam(match.team_b_id)}
                        formatTeamName={formatTeamName}
                        sourceAMatchNum=""
                        sourceBMatchNum=""
                        canEdit={canEdit}
                        onScoreUpdated={onScoreUpdated}
                        onMatchUpdated={onMatchUpdated}
                        tournamentId={tournamentId}
                        onR3Assigned={onR3Assigned}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* R2 Loser Matches */}
              {loserMatches.length > 0 && (
                <div className="flex flex-col min-w-[280px]">
                  <div className="mb-3 pb-2 border-b border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 rounded-full bg-amber-500" />
                        <span className="font-semibold text-sm text-foreground">Vòng 2</span>
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {loserMatches.filter(m => m.status === 'completed').length}/{loserMatches.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-3">Loser Bracket</p>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
                    {loserMatches.map((match) => {
                      const sourceA = match.source_a as { type: string; match_index?: number } | null;
                      const sourceB = match.source_b as { type: string; match_index?: number } | null;
                      const matchANum = sourceA?.match_index !== undefined ? sourceA.match_index + 1 : '?';
                      const matchBNum = sourceB?.match_index !== undefined ? sourceB.match_index + 1 : '?';
                      
                      return (
                        <LoserBracketCard
                          key={match.id}
                          match={match}
                          allMatches={matches}
                          teamA={getTeam(match.team_a_id)}
                          teamB={getTeam(match.team_b_id)}
                          formatTeamName={formatTeamName}
                          sourceAMatchNum={matchANum}
                          sourceBMatchNum={matchBNum}
                          canEdit={canEdit}
                          onScoreUpdated={onScoreUpdated}
                          onMatchUpdated={onMatchUpdated}
                          tournamentId={tournamentId}
                          onR3Assigned={onR3Assigned}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* R3 Merge Matches */}
              <div className="flex flex-col min-w-[280px]">
                <div className="mb-3 pb-2 border-b border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 rounded-full bg-blue-500" />
                      <span className="font-semibold text-sm text-foreground">Vòng 3</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {r3Rounds[0]?.matches.filter(m => m.status === 'completed').length || 0}/
                      {r3Rounds[0]?.matches.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-3">Sơ loại cuối</p>
                </div>
                
                {r3NeedsAssignment && r1Completed && r2Completed ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-muted rounded-lg">
                    <RefreshCw className={cn(
                      "w-5 h-5 mb-2",
                      isAssigningR3 ? "animate-spin text-primary" : "text-muted-foreground"
                    )} />
                    <p className="text-xs text-muted-foreground">
                      {isAssigningR3 ? "Đang phân vòng..." : "Chờ phân vòng"}
                    </p>
                  </div>
                ) : r3Rounds.length > 0 && r3Rounds[0].matches.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {r3Rounds[0].matches.map((match) => (
                      <BracketMatchCard
                        key={match.id}
                        match={match}
                        allMatches={matches}
                        teamA={getTeam(match.team_a_id)}
                        teamB={getTeam(match.team_b_id)}
                        formatTeamName={formatTeamName}
                        isFinal={false}
                        canEdit={canEdit}
                        onScoreUpdated={onScoreUpdated}
                        onMatchUpdated={onMatchUpdated}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6 text-center border border-dashed border-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {!r1Completed || !r2Completed 
                        ? "Chờ V1 & V2" 
                        : "Không có trận"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAYOFF VIEW */}
      {!showPreliminaryOnly && playoffRounds.length > 0 && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-6 min-w-max items-stretch">
            {playoffRounds.map((round, roundIdx) => (
              <div key={round.roundNumber} className="flex flex-col min-w-[260px]">
                <div className="text-center mb-4">
                  <Badge 
                    variant={round.roundType === 'final' ? "default" : "outline"} 
                    className={cn(
                      "px-4 py-1",
                      round.roundType === 'final' && "bg-primary"
                    )}
                  >
                    {round.roundType === 'final' && <Trophy className="w-3 h-3 mr-1" />}
                    {getRoundLabel(round.roundType, round.matches.length)}
                    <span className="ml-2 opacity-70">({round.matches.length})</span>
                  </Badge>
                </div>

                <div 
                  className="flex flex-col flex-1"
                  style={{
                    justifyContent: 'space-around',
                    gap: roundIdx === 0 ? '0.75rem' : `${Math.pow(2, roundIdx) * 1.5}rem`
                  }}
                >
                  {round.matches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      allMatches={matches}
                      teamA={getTeam(match.team_a_id)}
                      teamB={getTeam(match.team_b_id)}
                      formatTeamName={formatTeamName}
                      isFinal={match.round_type === 'final'}
                      canEdit={canEdit}
                      onScoreUpdated={onScoreUpdated}
                      onMatchUpdated={onMatchUpdated}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPlayoffOnly && playoffRounds.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Vòng playoff sẽ bắt đầu sau khi hoàn thành vòng sơ loại.
          </CardContent>
        </Card>
      )}

      {!showPreliminaryOnly && matches.find(m => m.round_type === 'third_place') && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-4">Tranh hạng 3</h3>
          {(() => {
            const match = matches.find(m => m.round_type === 'third_place')!;
            return (
              <BracketMatchCard
                match={match}
                allMatches={matches}
                teamA={getTeam(match.team_a_id)}
                teamB={getTeam(match.team_b_id)}
                formatTeamName={formatTeamName}
                isFinal={false}
                canEdit={canEdit}
                onScoreUpdated={onScoreUpdated}
                onMatchUpdated={onMatchUpdated}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Helper to propagate loser to R2 match using match_index (0-based)
async function propagateLoserToR2(
  matchIndex: number, // 0-based index of R1 match
  loserId: string, 
  allMatches: Match[]
) {
  // Find R2 match where this loser should go based on match_index
  const r2Match = allMatches.find(m => {
    if (m.round_number !== 2 || m.bracket_type !== 'loser') return false;
    const sourceA = m.source_a as { type: string; match_index?: number } | null;
    const sourceB = m.source_b as { type: string; match_index?: number } | null;
    return sourceA?.match_index === matchIndex || sourceB?.match_index === matchIndex;
  });

  if (r2Match) {
    const sourceA = r2Match.source_a as { type: string; match_index?: number } | null;
    const updateField = sourceA?.match_index === matchIndex ? 'team_a_id' : 'team_b_id';
    
    await supabase
      .from('doubles_elimination_matches')
      .update({ [updateField]: loserId })
      .eq('id', r2Match.id);
  }
}

// Loser Bracket Card
interface LoserBracketCardProps {
  match: Match;
  allMatches: Match[];
  teamA: Team | undefined;
  teamB: Team | undefined;
  formatTeamName: (team: Team | undefined) => string;
  sourceAMatchNum: number | string;
  sourceBMatchNum: number | string;
  canEdit?: boolean;
  onScoreUpdated?: () => void;
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void;
  tournamentId?: string;
  onR3Assigned?: (tiedTeamsInfo?: { count: number; names: string[] }) => void;
}

const LoserBracketCard = ({
  match,
  allMatches,
  teamA,
  teamB,
  formatTeamName,
  sourceAMatchNum,
  sourceBMatchNum,
  canEdit = false,
  onScoreUpdated,
  onMatchUpdated,
  tournamentId,
  onR3Assigned
}: LoserBracketCardProps) => {
  const { checkAndAssignR3 } = useDoublesElimination();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editScoreA, setEditScoreA] = useState(match.score_a?.toString() || '0');
  const [editScoreB, setEditScoreB] = useState(match.score_b?.toString() || '0');
  const [saving, setSaving] = useState(false);
  
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isAWinner = match.winner_id === match.team_a_id && isCompleted;
  const isBWinner = match.winner_id === match.team_b_id && isCompleted;

  // "Sửa" button = inline edit
  const handleStartInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditScoreA(match.score_a?.toString() || '0');
    setEditScoreB(match.score_b?.toString() || '0');
    setIsEditing(true);
  };

  // "Chấm" button = go to scoring page
  const handleGoToScoringPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/tools/doubles-elimination/match/${match.id}/score`);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleSaveScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);

    const scoreA = parseInt(editScoreA) || 0;
    const scoreB = parseInt(editScoreB) || 0;
    const winnerId = scoreA > scoreB ? match.team_a_id : scoreB > scoreA ? match.team_b_id : null;
    const loserId = scoreA > scoreB ? match.team_b_id : scoreB > scoreA ? match.team_a_id : null;
    const isMatchComplete = scoreA !== scoreB;

    // Optimistic update - immediately update local state
    const matchUpdates: Partial<Match> = {
      score_a: scoreA,
      score_b: scoreB,
      winner_id: isMatchComplete ? winnerId : null,
      status: isMatchComplete ? 'completed' : 'live'
    };
    onMatchUpdated?.(match.id, matchUpdates);

    try {
      await supabase
        .from('doubles_elimination_matches')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          winner_id: isMatchComplete ? winnerId : null,
          status: isMatchComplete ? 'completed' : 'live'
        })
        .eq('id', match.id);

      // Mark loser as eliminated (R2 loser bracket = elimination)
      if (isMatchComplete && loserId) {
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number
          })
          .eq('id', loserId);
      }

      toast({ title: isMatchComplete ? "Đã lưu kết quả" : "Đã lưu điểm" });
      setIsEditing(false);

      // After R2 match completion, check if we need to assign R3
      if (isMatchComplete && match.round_number === 2 && tournamentId) {
        const result = await checkAndAssignR3(tournamentId);
        if (result.triggered) {
          onR3Assigned?.(result.tiedTeamsInfo);
          // Reload to show R3 assignments
          onScoreUpdated?.();
        }
      }
    } catch (error) {
      toast({ title: "Lỗi lưu điểm", variant: "destructive" });
      // Revert on error - trigger full reload
      onScoreUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all border-orange-200/50 dark:border-orange-800/50",
        isCompleted && "opacity-90",
        isLive && "border-red-500/50 ring-2 ring-red-500/20"
      )}
    >
      {/* Match header */}
      <div className={cn(
        "px-3 py-1.5 border-b flex items-center justify-between",
        isLive ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/50 dark:bg-muted/30"
      )}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Trận {match.match_number}</span>
          {match.court_number && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
              Sân {match.court_number}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLive && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4 animate-pulse">
              <Radio className="w-2 h-2 mr-0.5" />
              LIVE
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">
              Xong
            </Badge>
          )}
        </div>
      </div>
      
      {/* Teams */}
      <div className="divide-y divide-border/50">
        {/* Team A Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 transition-colors",
            isAWinner && "bg-primary/10 border-l-2 border-primary",
            !teamA && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            {teamA ? (
              <div className={cn(
                "font-medium text-sm truncate",
                isAWinner && "text-primary"
              )}>
                {formatTeamName(teamA)}
              </div>
            ) : sourceAMatchNum ? (
              <div className="text-muted-foreground text-sm italic">
                Thua trận {sourceAMatchNum}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm italic">TBD</div>
            )}
          </div>
          
          {/* Score A */}
          {isEditing ? (
            <Input
              type="number"
              value={editScoreA}
              onChange={(e) => setEditScoreA(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-14 h-8 text-center text-sm font-bold p-1"
              min={0}
            />
          ) : (
            <div className={cn(
              "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
              isAWinner ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {match.best_of > 1 ? match.games_won_a : match.score_a}
            </div>
          )}
          
          {isAWinner && !isEditing && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
        
        {/* Team B Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 transition-colors",
            isBWinner && "bg-primary/10 border-l-2 border-primary",
            !teamB && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            {teamB ? (
              <div className={cn(
                "font-medium text-sm truncate",
                isBWinner && "text-primary"
              )}>
                {formatTeamName(teamB)}
              </div>
            ) : sourceBMatchNum ? (
              <div className="text-muted-foreground text-sm italic">
                Thua trận {sourceBMatchNum}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm italic">TBD</div>
            )}
          </div>
          
          {/* Score B */}
          {isEditing ? (
            <Input
              type="number"
              value={editScoreB}
              onChange={(e) => setEditScoreB(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-14 h-8 text-center text-sm font-bold p-1"
              min={0}
            />
          ) : (
            <div className={cn(
              "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
              isBWinner ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {match.best_of > 1 ? match.games_won_b : match.score_b}
            </div>
          )}
          
          {isBWinner && !isEditing && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
      </div>

      {/* Edit Controls for BTC/Referee */}
      {canEdit && teamA && teamB && (
        <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={saving}
                className="h-7 px-2"
              >
                <X className="w-3 h-3 mr-1" />
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleSaveScore}
                disabled={saving}
                className="h-7 px-2"
              >
                <Check className="w-3 h-3 mr-1" />
                Lưu
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoToScoringPage}
                className="h-7 px-2"
              >
                <Play className="w-3 h-3 mr-1" />
                Chấm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStartInlineEdit}
                className="h-7 px-2"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Sửa
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

interface BracketMatchCardProps {
  match: Match;
  allMatches: Match[];
  teamA: Team | undefined;
  teamB: Team | undefined;
  formatTeamName: (team: Team | undefined) => string;
  isFinal: boolean;
  canEdit?: boolean;
  onScoreUpdated?: () => void;
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void;
}

const BracketMatchCard = ({ 
  match, 
  allMatches,
  teamA, 
  teamB, 
  formatTeamName,
  isFinal,
  canEdit = false,
  onScoreUpdated,
  onMatchUpdated
}: BracketMatchCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editScoreA, setEditScoreA] = useState(match.score_a?.toString() || '0');
  const [editScoreB, setEditScoreB] = useState(match.score_b?.toString() || '0');
  const [saving, setSaving] = useState(false);
  
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isAWinner = match.winner_id === match.team_a_id && isCompleted;
  const isBWinner = match.winner_id === match.team_b_id && isCompleted;

  // "Sửa" button = inline edit
  const handleStartInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditScoreA(match.score_a?.toString() || '0');
    setEditScoreB(match.score_b?.toString() || '0');
    setIsEditing(true);
  };

  // "Chấm" button = go to scoring page
  const handleGoToScoringPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/tools/doubles-elimination/match/${match.id}/score`);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleSaveScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);

    const scoreA = parseInt(editScoreA) || 0;
    const scoreB = parseInt(editScoreB) || 0;
    const winnerId = scoreA > scoreB ? match.team_a_id : scoreB > scoreA ? match.team_b_id : null;
    const loserId = scoreA > scoreB ? match.team_b_id : scoreB > scoreA ? match.team_a_id : null;
    const isMatchComplete = scoreA !== scoreB;

    // Optimistic update - immediately update local state
    const matchUpdates: Partial<Match> = {
      score_a: scoreA,
      score_b: scoreB,
      winner_id: isMatchComplete ? winnerId : null,
      status: isMatchComplete ? 'completed' : 'live'
    };
    onMatchUpdated?.(match.id, matchUpdates);

    try {
      await supabase
        .from('doubles_elimination_matches')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          winner_id: isMatchComplete ? winnerId : null,
          status: isMatchComplete ? 'completed' : 'live'
        })
        .eq('id', match.id);

      // For R1 winner matches, propagate loser to R2 loser bracket
      if (isMatchComplete && loserId && match.round_type === 'winner_r1') {
        // match_number is 1-based, convert to 0-based index
        const matchIndex = match.match_number - 1;
        await propagateLoserToR2(matchIndex, loserId, allMatches);
      }

      // Mark loser as eliminated if not R1
      if (isMatchComplete && loserId && match.round_type !== 'winner_r1') {
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number
          })
          .eq('id', loserId);
      }

      toast({ title: isMatchComplete ? "Đã lưu kết quả" : "Đã lưu điểm" });
      setIsEditing(false);
      // Don't call onScoreUpdated to avoid full reload
    } catch (error) {
      toast({ title: "Lỗi lưu điểm", variant: "destructive" });
      // Revert on error - trigger full reload
      onScoreUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all border-border/50",
        isFinal && "border-primary/30 shadow-lg ring-2 ring-primary/10",
        isCompleted && "opacity-90",
        isLive && "border-red-500/50 ring-2 ring-red-500/20"
      )}
    >
      {/* Match header */}
      <div className={cn(
        "px-3 py-1.5 border-b flex items-center justify-between",
        isLive ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/50"
      )}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Trận {match.match_number}</span>
          {match.court_number && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
              Sân {match.court_number}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLive && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4 animate-pulse">
              <Radio className="w-2 h-2 mr-0.5" />
              LIVE
            </Badge>
          )}
          {isFinal && (
            <Badge variant="default" className="text-xs py-0">
              <Trophy className="w-3 h-3 mr-1" />
              CK
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">
              Xong
            </Badge>
          )}
        </div>
      </div>
      
      {/* Teams */}
      <div className="divide-y divide-border/50">
        {/* Team A Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 min-h-[40px] transition-colors",
            isAWinner && "bg-primary/10 border-l-2 border-primary",
            !teamA && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-medium text-sm truncate",
              isAWinner && "text-primary",
              !teamA && "text-muted-foreground italic"
            )}>
              {formatTeamName(teamA)}
            </div>
          </div>
          
          {/* Score A */}
          {isEditing ? (
            <Input
              type="number"
              value={editScoreA}
              onChange={(e) => setEditScoreA(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-14 h-8 text-center text-sm font-bold p-1"
              min={0}
            />
          ) : (
            <div className={cn(
              "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
              isAWinner ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {match.best_of > 1 ? match.games_won_a : match.score_a}
            </div>
          )}
          
          {isAWinner && !isEditing && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
        
        {/* Team B Slot */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 min-h-[40px] transition-colors",
            isBWinner && "bg-primary/10 border-l-2 border-primary",
            !teamB && "bg-muted/20"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-medium text-sm truncate",
              isBWinner && "text-primary",
              !teamB && "text-muted-foreground italic"
            )}>
              {formatTeamName(teamB)}
            </div>
          </div>
          
          {/* Score B */}
          {isEditing ? (
            <Input
              type="number"
              value={editScoreB}
              onChange={(e) => setEditScoreB(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-14 h-8 text-center text-sm font-bold p-1"
              min={0}
            />
          ) : (
            <div className={cn(
              "w-10 h-8 flex items-center justify-center rounded text-sm font-bold",
              isBWinner ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {match.best_of > 1 ? match.games_won_b : match.score_b}
            </div>
          )}
          
          {isBWinner && !isEditing && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
      </div>

      {/* Game scores for BO3/BO5 */}
      {!isEditing && match.best_of > 1 && match.games && Array.isArray(match.games) && (match.games as any[]).length > 0 && (
        <div className="px-3 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground text-center">
          {(match.games as any[]).map((g: any, i: number) => (
            <span key={i}>
              {i > 0 && ' | '}
              <span className={g.winner === 'a' ? 'text-primary font-medium' : ''}>{g.score_a}</span>
              -
              <span className={g.winner === 'b' ? 'text-primary font-medium' : ''}>{g.score_b}</span>
            </span>
          ))}
        </div>
      )}

      {/* Edit Controls for BTC/Referee */}
      {canEdit && teamA && teamB && (
        <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={saving}
                className="h-7 px-2"
              >
                <X className="w-3 h-3 mr-1" />
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleSaveScore}
                disabled={saving}
                className="h-7 px-2"
              >
                <Check className="w-3 h-3 mr-1" />
                Lưu
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoToScoringPage}
                className="h-7 px-2"
              >
                <Play className="w-3 h-3 mr-1" />
                Chấm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStartInlineEdit}
                className="h-7 px-2"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Sửa
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

export default DoublesEliminationBracket;
