import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Users, AlertTriangle, Check, User, Zap } from 'lucide-react';
import { useTeamMatchMatch, useTeamMatchMatchManagement, TeamMatchMatch, TeamMatchGame } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchTeam, TeamMatchRosterMember } from '@/hooks/useTeamMatchTeams';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface LineupSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: TeamMatchMatch | null;
  teamId: string;
  tournamentId: string;
  isMatchStarted?: boolean;
  hasDreambreaker?: boolean;
  isOwner?: boolean; // BTC can edit any team's lineup at any time
}

const GAME_TYPE_LABELS: Record<string, string> = {
  WD: 'Đôi Nữ',
  MD: 'Đôi Nam',
  MX: 'Đôi Nam Nữ',
  WS: 'Đơn Nữ',
  MS: 'Đơn Nam',
};

const GAME_TYPE_REQUIREMENTS: Record<string, { male: number; female: number; total: number }> = {
  WD: { male: 0, female: 2, total: 2 },
  MD: { male: 2, female: 0, total: 2 },
  MX: { male: 1, female: 1, total: 2 },
  WS: { male: 0, female: 1, total: 1 },
  MS: { male: 1, female: 0, total: 1 },
};

// Dreambreaker is fixed: 4 players (any gender mix), singles format
const DREAMBREAKER_PLAYER_COUNT = 4;

export function LineupSelectionSheet({ 
  open, 
  onOpenChange, 
  match, 
  teamId,
  tournamentId,
  isMatchStarted = false,
  hasDreambreaker = false,
  isOwner = false,
}: LineupSelectionSheetProps) {
  const { games, isLoading } = useTeamMatchMatch(match?.id);
  const { roster, isLoading: rosterLoading } = useTeamMatchTeam(teamId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Track selections: gameId -> array of roster member ids
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // Dreambreaker lineup is stored separately on match level
  const [dreambreakerLineup, setDreambreakerLineup] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isTeamA = match?.team_a_id === teamId;
  const lineupField = isTeamA ? 'lineup_team_a' : 'lineup_team_b';
  const submittedField = isTeamA ? 'lineup_a_submitted' : 'lineup_b_submitted';
  const isSubmitted = match && match[submittedField];

  // Separate regular games and dreambreaker games
  const regularGames = games.filter(g => !g.is_dreambreaker);
  const dreambreakerGame = games.find(g => g.is_dreambreaker);

  // Initialize selections from existing lineups
  useEffect(() => {
    if (games.length > 0) {
      const initialSelections: Record<string, string[]> = {};
      games.forEach(game => {
        if (!game.is_dreambreaker) {
          const existingLineup = isTeamA ? game.lineup_team_a : game.lineup_team_b;
          initialSelections[game.id] = existingLineup || [];
        }
      });
      setSelections(initialSelections);
      
      // Initialize dreambreaker lineup
      if (dreambreakerGame) {
        const existingDbLineup = isTeamA ? dreambreakerGame.lineup_team_a : dreambreakerGame.lineup_team_b;
        setDreambreakerLineup(existingDbLineup || []);
      }
      
      setHasChanges(false);
    }
  }, [games, isTeamA, dreambreakerGame]);

  const togglePlayer = (gameId: string, playerId: string, gameType: string) => {
    setSelections(prev => {
      const current = prev[gameId] || [];
      const requirements = GAME_TYPE_REQUIREMENTS[gameType];
      
      if (current.includes(playerId)) {
        return { ...prev, [gameId]: current.filter(id => id !== playerId) };
      } else {
        if (current.length < requirements.total) {
          return { ...prev, [gameId]: [...current, playerId] };
        }
        return prev;
      }
    });
    setHasChanges(true);
  };

  const toggleDreambreakerPlayer = (playerId: string) => {
    setDreambreakerLineup(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        if (prev.length < DREAMBREAKER_PLAYER_COUNT) {
          return [...prev, playerId];
        }
        return prev;
      }
    });
    setHasChanges(true);
  };

  const validateSelections = () => {
    const errors: string[] = [];
    
    // Validate regular games
    regularGames.forEach((game, index) => {
      const selected = selections[game.id] || [];
      const requirements = GAME_TYPE_REQUIREMENTS[game.game_type];
      
      if (selected.length !== requirements.total) {
        errors.push(`Ván ${index + 1} (${GAME_TYPE_LABELS[game.game_type]}): Cần chọn ${requirements.total} VĐV`);
        return;
      }
      
      const selectedPlayers = roster.filter(r => selected.includes(r.id));
      const maleCount = selectedPlayers.filter(p => p.gender === 'male').length;
      const femaleCount = selectedPlayers.filter(p => p.gender === 'female').length;
      
      if (maleCount !== requirements.male || femaleCount !== requirements.female) {
        errors.push(`Ván ${index + 1} (${GAME_TYPE_LABELS[game.game_type]}): Cần ${requirements.male} nam và ${requirements.female} nữ`);
      }
    });

    // Validate dreambreaker if exists
    if (dreambreakerGame && dreambreakerLineup.length !== DREAMBREAKER_PLAYER_COUNT) {
      errors.push(`Dreambreaker: Cần chọn đúng ${DREAMBREAKER_PLAYER_COUNT} VĐV`);
    }
    
    return errors;
  };

  const handleSave = async () => {
    if (!match) return;
    
    const errors = validateSelections();
    if (errors.length > 0) {
      toast({
        title: 'Chưa đủ điều kiện',
        description: errors.join('\n'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update each regular game's lineup
      for (const game of regularGames) {
        const { error } = await supabase
          .from('team_match_games')
          .update({
            [lineupField]: selections[game.id] || [],
          })
          .eq('id', game.id);

        if (error) throw error;
      }

      // Update dreambreaker game lineup if exists
      if (dreambreakerGame) {
        const { error } = await supabase
          .from('team_match_games')
          .update({
            [lineupField]: dreambreakerLineup,
          })
          .eq('id', dreambreakerGame.id);

        if (error) throw error;
      }

      // Mark lineup as submitted
      const { error: matchError } = await supabase
        .from('team_match_matches')
        .update({
          [submittedField]: true,
        })
        .eq('id', match.id);

      if (matchError) throw matchError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['team-match-games', match.id] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-match', match.id] });

      toast({
        title: 'Đã lưu',
        description: 'Đã cập nhật đội hình thành công',
      });
      setHasChanges(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  const teamAName = (match.team_a as any)?.team_name || 'TBD';
  const teamBName = (match.team_b as any)?.team_name || 'TBD';
  const myTeamName = isTeamA ? teamAName : teamBName;
  const opponentName = isTeamA ? teamBName : teamAName;
  const validationErrors = validateSelections();
  const isComplete = validationErrors.length === 0;
  // BTC can always edit, Captain can edit if not started and not submitted
  const canEdit = isOwner || (!isMatchStarted && !isSubmitted);

  const getRoundLabel = () => {
    if (match.is_playoff && match.playoff_round) {
      if (match.playoff_round === 1) return 'Chung kết';
      if (match.playoff_round === 2) return 'Bán kết';
      if (match.playoff_round === 3) return 'Tứ kết';
      return `Vòng ${match.playoff_round}`;
    }
    return match.round_number ? `Vòng ${match.round_number}` : '';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Chọn đội hình - {getRoundLabel()}
          </SheetTitle>
          <SheetDescription>
            {myTeamName} vs {opponentName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status badges */}
          <div className="flex gap-2">
            {isSubmitted && (
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Đã line up
              </Badge>
            )}
            {isMatchStarted && (
              <Badge variant="secondary">
                Đã khóa (vòng đấu đang diễn ra)
              </Badge>
            )}
          </div>

          {isSubmitted && !isMatchStarted && (
            <Alert>
              <AlertDescription>
                Bạn đã gửi đội hình. Liên hệ BTC nếu cần thay đổi.
              </AlertDescription>
            </Alert>
          )}

          {(isLoading || rosterLoading) && (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}

          {/* Regular Games List */}
          {!isLoading && !rosterLoading && regularGames.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Các ván đấu chính
              </h3>
              {regularGames.map((game, index) => {
                const selected = selections[game.id] || [];
                const requirements = GAME_TYPE_REQUIREMENTS[game.game_type];
                const selectedPlayers = roster.filter(r => selected.includes(r.id));
                
                const eligiblePlayers = roster.filter(player => {
                  const currentMales = selectedPlayers.filter(p => p.gender === 'male').length;
                  const currentFemales = selectedPlayers.filter(p => p.gender === 'female').length;
                  
                  if (selected.includes(player.id)) return true;
                  if (player.gender === 'male' && currentMales < requirements.male) return true;
                  if (player.gender === 'female' && currentFemales < requirements.female) return true;
                  
                  return false;
                });

                return (
                  <Card key={game.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          Ván {index + 1}: {game.display_name || GAME_TYPE_LABELS[game.game_type]}
                        </CardTitle>
                        <Badge variant={selected.length === requirements.total ? 'default' : 'secondary'}>
                          {selected.length}/{requirements.total}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cần: {requirements.male} nam, {requirements.female} nữ
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {roster.map(player => {
                        const isSelected = selected.includes(player.id);
                        const canSelect = eligiblePlayers.includes(player) || isSelected;
                        
                        return (
                          <div
                            key={player.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isSelected ? 'bg-primary/10 border-primary' : 'bg-background'
                            } ${!canEdit ? 'opacity-70' : canSelect ? 'cursor-pointer hover:bg-muted' : 'opacity-40'}`}
                            onClick={() => {
                              if (canEdit && canSelect) {
                                togglePlayer(game.id, player.id, game.game_type);
                              }
                            }}
                          >
                            <Checkbox 
                              checked={isSelected}
                              disabled={!canEdit || !canSelect}
                              className="pointer-events-none"
                            />
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium text-base">{player.player_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {player.gender === 'male' ? 'Nam' : 'Nữ'}
                                {player.is_captain && ' • Đội trưởng'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Dreambreaker Section */}
          {!isLoading && !rosterLoading && dreambreakerGame && (
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Dreambreaker – Singles (4 Players)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Chọn 4 VĐV thi đấu đơn cho Dreambreaker. Rally Scoring. Tự do chọn nam/nữ.
              </p>
              
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Đội hình Dreambreaker
                    </CardTitle>
                    <Badge variant={dreambreakerLineup.length === DREAMBREAKER_PLAYER_COUNT ? 'default' : 'secondary'}>
                      {dreambreakerLineup.length}/{DREAMBREAKER_PLAYER_COUNT}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {roster.map(player => {
                    const isSelected = dreambreakerLineup.includes(player.id);
                    const canSelect = isSelected || dreambreakerLineup.length < DREAMBREAKER_PLAYER_COUNT;
                    
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isSelected ? 'bg-amber-500/10 border-amber-500' : 'bg-background'
                        } ${!canEdit ? 'opacity-70' : canSelect ? 'cursor-pointer hover:bg-muted' : 'opacity-40'}`}
                        onClick={() => {
                          if (canEdit && canSelect) {
                            toggleDreambreakerPlayer(player.id);
                          }
                        }}
                      >
                        <Checkbox 
                          checked={isSelected}
                          disabled={!canEdit || !canSelect}
                          className="pointer-events-none"
                        />
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-base">{player.player_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.gender === 'male' ? 'Nam' : 'Nữ'}
                            {player.is_captain && ' • Đội trưởng'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Validation errors */}
          {!isComplete && validationErrors.length > 0 && hasChanges && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          {canEdit && (
            <Button 
              onClick={handleSave} 
              className="w-full"
              disabled={isSaving || !isComplete}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Lưu đội hình
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}