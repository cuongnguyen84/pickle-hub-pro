import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gamepad2, Trophy, Clock, Play, ClipboardList, Check, AlertTriangle, Users, Radio } from 'lucide-react';
import { useTeamMatchMatches, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchGroups, TeamMatchGroup } from '@/hooks/useTeamMatchGroups';
import { useI18n } from '@/i18n';

interface GroupMatchListProps {
  tournamentId: string;
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound?: (roundNumber: number, groupId?: string) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}

export function GroupMatchList({ 
  tournamentId, 
  userTeamId, 
  isOwner,
  canEditScores,
  onMatchClick, 
  onLineupClick, 
  onStartRound,
  onScoreMatch,
}: GroupMatchListProps) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: groups, isLoading: isLoadingGroups } = useTeamMatchGroups(tournamentId);
  const { t } = useI18n();
  const c = t.teamMatchComponents;

  const STATUS_CONFIG = {
    pending: { label: c.notStarted, color: 'bg-muted text-muted-foreground', icon: Clock },
    lineup: { label: c.liningUp, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: ClipboardList },
    in_progress: { label: c.live, color: 'bg-destructive/10 text-destructive border-destructive/20', icon: Radio },
    completed: { label: c.ended, color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: Trophy },
  };

  if (isLoadingMatches || isLoadingGroups) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t.teamMatch.view.noMatches}</p>
          <p className="text-sm mt-1">{c.noMatchesCreateSchedule}</p>
        </CardContent>
      </Card>
    );
  }

  // Group matches by group_id
  const roundRobinMatches = matches.filter(m => !m.is_playoff);
  const matchesByGroup = new Map<string, TeamMatchMatch[]>();
  
  roundRobinMatches.forEach(match => {
    const groupId = match.group_id || 'no-group';
    if (!matchesByGroup.has(groupId)) {
      matchesByGroup.set(groupId, []);
    }
    matchesByGroup.get(groupId)!.push(match);
  });

  // Sort groups by display_order
  const sortedGroups = groups?.sort((a, b) => a.display_order - b.display_order) || [];

  if (sortedGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{c.noGroupsYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue={sortedGroups[0]?.id} className="w-full">
      <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
        {sortedGroups.map((group) => (
          <TabsTrigger key={group.id} value={group.id} className="flex-1 min-w-[100px]">
            {group.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {sortedGroups.map((group) => (
        <TabsContent key={group.id} value={group.id} className="mt-4">
          <GroupMatches
            group={group}
            matches={matchesByGroup.get(group.id) || []}
            userTeamId={userTeamId}
            isOwner={isOwner}
            canEditScores={canEditScores}
            statusConfig={STATUS_CONFIG}
            c={c}
            onMatchClick={onMatchClick}
            onLineupClick={onLineupClick}
            onStartRound={(round) => onStartRound?.(round, group.id)}
            onScoreMatch={onScoreMatch}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Sub-component for matches within a group
function GroupMatches({
  group,
  matches,
  userTeamId,
  isOwner,
  canEditScores,
  statusConfig,
  c,
  onMatchClick,
  onLineupClick,
  onStartRound,
  onScoreMatch,
}: {
  group: TeamMatchGroup;
  matches: TeamMatchMatch[];
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  statusConfig: any;
  c: any;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound?: (roundNumber: number) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}) {
  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>{c.noMatchesInGroup} {group.name}</p>
        </CardContent>
      </Card>
    );
  }

  // Group by round
  const matchesByRound = matches.reduce((acc, match) => {
    const round = match.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, TeamMatchMatch[]>);

  const rounds = Object.keys(matchesByRound).map(Number).filter(r => r > 0).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {rounds.map((round) => {
        const roundMatches = matchesByRound[round];
        
        const allLineupsSubmitted = roundMatches.every(match => 
          match.lineup_a_submitted && match.lineup_b_submitted
        );
        
        const roundStarted = roundMatches.some(match => 
          match.status === 'in_progress' || match.status === 'completed'
        );
        
        const missingLineups: string[] = [];
        roundMatches.forEach(match => {
          if (!match.lineup_a_submitted && match.team_a) {
            missingLineups.push((match.team_a as any)?.team_name || 'Team A');
          }
          if (!match.lineup_b_submitted && match.team_b) {
            missingLineups.push((match.team_b as any)?.team_name || 'Team B');
          }
        });

        return (
          <div key={round}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-muted-foreground">{c.roundLabel} {round}</h4>
              
              {isOwner && !roundStarted && (
                <div className="flex items-center gap-2">
                  {allLineupsSubmitted ? (
                    <Button 
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => onStartRound?.(round)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {c.startRound}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {c.waitingLineup}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            {isOwner && !roundStarted && missingLineups.length > 0 && (
              <Alert className="mb-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {c.missingLineup} {missingLineups.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {roundMatches.map((match) => {
                const config = statusConfig[match.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
                const matchStarted = match.status === 'in_progress' || match.status === 'completed';
                
                const needsLineupA = !match.lineup_a_submitted && !matchStarted;
                const needsLineupB = !match.lineup_b_submitted && !matchStarted;
                
                const canLineupA = needsLineupA && (isOwner || match.team_a_id === userTeamId);
                const canLineupB = needsLineupB && (isOwner || match.team_b_id === userTeamId);
                
                const isTeamA = match.team_a_id === userTeamId;
                const myLineupSubmitted = isMyMatch && (isTeamA ? match.lineup_a_submitted : match.lineup_b_submitted);
                
                return (
                  <Card 
                    key={match.id} 
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${isMyMatch ? 'border-primary/30 bg-primary/5' : ''}`}
                    onClick={() => onMatchClick?.(match)}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {/* Team A */}
                            <div className={`flex-1 text-right text-sm ${match.winner_team_id === match.team_a_id ? 'font-bold' : ''} ${match.team_a_id === userTeamId ? 'text-primary' : ''}`}>
                              <span>
                                {(match.team_a as any)?.team_name || 'TBD'}
                              </span>
                              {match.lineup_a_submitted && (
                                <Check className="h-3 w-3 inline-block ml-1 text-green-600" />
                              )}
                            </div>
                            
                            {/* Score */}
                            <div className="flex items-center gap-1 px-3 py-1 bg-muted rounded min-w-[70px] justify-center">
                              <span className={`text-lg font-bold ${match.winner_team_id === match.team_a_id ? 'text-green-600' : ''}`}>
                                {match.games_won_a}
                              </span>
                              <span className="text-muted-foreground">-</span>
                              <span className={`text-lg font-bold ${match.winner_team_id === match.team_b_id ? 'text-green-600' : ''}`}>
                                {match.games_won_b}
                              </span>
                            </div>
                            
                            {/* Team B */}
                            <div className={`flex-1 text-sm ${match.winner_team_id === match.team_b_id ? 'font-bold' : ''} ${match.team_b_id === userTeamId ? 'text-primary' : ''}`}>
                              {match.lineup_b_submitted && (
                                <Check className="h-3 w-3 inline-block mr-1 text-green-600" />
                              )}
                              <span>
                                {(match.team_b as any)?.team_name || 'TBD'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-3 flex flex-col items-end gap-1">
                          <Badge 
                            variant="outline" 
                            className={`${config.color} text-xs ${match.status === 'in_progress' ? 'animate-pulse' : ''}`}
                          >
                            <StatusIcon className={`h-3 w-3 mr-1 ${match.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                            {config.label}
                          </Badge>
                          
                          {/* BTC lineup buttons */}
                          {isOwner && (canLineupA || canLineupB) && (
                            <div className="flex gap-1">
                              {canLineupA && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLineupClick?.(match, match.team_a_id!);
                                  }}
                                >
                                  <ClipboardList className="h-3 w-3 mr-1" />
                                  A
                                </Button>
                              )}
                              {canLineupB && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLineupClick?.(match, match.team_b_id!);
                                  }}
                                >
                                  <ClipboardList className="h-3 w-3 mr-1" />
                                  B
                                </Button>
                              )}
                            </div>
                          )}
                          
                          {/* Captain lineup button */}
                          {!isOwner && isMyMatch && !myLineupSubmitted && !matchStarted && (
                            <Button 
                              variant="default" 
                              size="sm"
                              className="text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLineupClick?.(match, userTeamId);
                              }}
                            >
                              <ClipboardList className="h-3 w-3 mr-1" />
                              Line up
                            </Button>
                          )}
                          
                          {/* Captain already lined up badge */}
                          {!isOwner && myLineupSubmitted && !matchStarted && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              {c.lineupDone}
                            </Badge>
                          )}
                          
                          {/* Referee Score Button */}
                          {canEditScores && (
                            (match.lineup_a_submitted && match.lineup_b_submitted) || 
                            match.status === 'in_progress' || 
                            match.status === 'completed'
                          ) && (
                            <Button 
                              variant="default" 
                              size="sm"
                              className="text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScoreMatch?.(match);
                              }}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {c.scoreBtn}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
