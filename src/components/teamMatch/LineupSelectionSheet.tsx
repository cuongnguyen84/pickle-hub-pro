import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, Users, AlertTriangle, Check, User, Zap } from 'lucide-react';
import { useTeamMatchMatch, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';

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

const GAME_TYPE_REQUIREMENTS: Record<string, { male: number; female: number; total: number }> = {
  WD: { male: 0, female: 2, total: 2 },
  MD: { male: 2, female: 0, total: 2 },
  MX: { male: 1, female: 1, total: 2 },
  WS: { male: 0, female: 1, total: 1 },
  MS: { male: 1, female: 0, total: 1 },
};

// Dreambreaker is fixed: 4 players (any gender mix), singles format
const DREAMBREAKER_PLAYER_COUNT = 4;

// ─── W2.4c shared tokens ─────────────────────────────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const statusPillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '3px 9px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

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
  const { language } = useI18n();

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

  const GAME_TYPE_LABELS: Record<string, string> = useMemo(() => (
    language === 'vi'
      ? { WD: 'Đôi Nữ', MD: 'Đôi Nam', MX: 'Đôi Nam Nữ', WS: 'Đơn Nữ', MS: 'Đơn Nam' }
      : { WD: 'WD', MD: 'MD', MX: 'Mixed', WS: 'WS', MS: 'MS' }
  ), [language]);

  const txt = {
    title: language === 'vi' ? 'Chọn đội hình' : 'Select lineup',
    submittedBadge: language === 'vi' ? 'Đã line up' : 'Lineup done',
    lockedBadge: language === 'vi' ? 'Đã khóa' : 'Locked',
    lockedHint: language === 'vi'
      ? 'Bạn đã gửi đội hình. Liên hệ BTC nếu cần thay đổi.'
      : 'Lineup submitted. Contact the organizer to change it.',
    regularGamesTitle: language === 'vi' ? 'Các ván đấu chính' : 'Main games',
    gameNum: (n: number) => language === 'vi' ? `Ván ${n}` : `Game ${n}`,
    needsLabel: (male: number, female: number) =>
      language === 'vi'
        ? `Cần: ${male} nam, ${female} nữ`
        : `Needs: ${male} male, ${female} female`,
    dreambreakerTitle: language === 'vi'
      ? 'Dreambreaker – Singles (4 VĐV)'
      : 'Dreambreaker – Singles (4 players)',
    dreambreakerHint: language === 'vi'
      ? 'Chọn 4 VĐV thi đấu đơn cho Dreambreaker. Rally Scoring. Tự do chọn nam/nữ.'
      : 'Pick 4 players for the Dreambreaker singles. Rally scoring. Any gender mix.',
    dreambreakerLineupTitle: language === 'vi' ? 'Đội hình Dreambreaker' : 'Dreambreaker lineup',
    male: language === 'vi' ? 'Nam' : 'Male',
    female: language === 'vi' ? 'Nữ' : 'Female',
    captain: language === 'vi' ? 'Đội trưởng' : 'Captain',
    saveLineup: language === 'vi' ? 'Lưu đội hình' : 'Save lineup',
    tbd: 'TBD',
    finalLabel: language === 'vi' ? 'Chung kết' : 'Final',
    semiLabel: language === 'vi' ? 'Bán kết' : 'Semi-final',
    quarterLabel: language === 'vi' ? 'Tứ kết' : 'Quarter-final',
    roundLabel: (n: number) => language === 'vi' ? `Vòng ${n}` : `Round ${n}`,
    // Validation messages
    validateNeedTotal: (gameIdx: number, label: string, total: number) =>
      language === 'vi'
        ? `Ván ${gameIdx} (${label}): Cần chọn ${total} VĐV`
        : `Game ${gameIdx} (${label}): Need to pick ${total} players`,
    validateGenderMix: (gameIdx: number, label: string, male: number, female: number) =>
      language === 'vi'
        ? `Ván ${gameIdx} (${label}): Cần ${male} nam và ${female} nữ`
        : `Game ${gameIdx} (${label}): Need ${male} male and ${female} female`,
    validateDreambreaker: language === 'vi'
      ? `Dreambreaker: Cần chọn đúng ${DREAMBREAKER_PLAYER_COUNT} VĐV`
      : `Dreambreaker: Need exactly ${DREAMBREAKER_PLAYER_COUNT} players`,
    // Toasts
    toastIncompleteTitle: language === 'vi' ? 'Chưa đủ điều kiện' : 'Not enough selections',
    toastSavedTitle: language === 'vi' ? 'Đã lưu' : 'Saved',
    toastSavedDesc: language === 'vi' ? 'Đã cập nhật đội hình thành công' : 'Lineup updated successfully',
    toastErrorTitle: language === 'vi' ? 'Lỗi' : 'Error',
  };

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
      const label = GAME_TYPE_LABELS[game.game_type] || game.game_type;

      if (selected.length !== requirements.total) {
        errors.push(txt.validateNeedTotal(index + 1, label, requirements.total));
        return;
      }

      const selectedPlayers = roster.filter(r => selected.includes(r.id));
      const maleCount = selectedPlayers.filter(p => p.gender === 'male').length;
      const femaleCount = selectedPlayers.filter(p => p.gender === 'female').length;

      if (maleCount !== requirements.male || femaleCount !== requirements.female) {
        errors.push(txt.validateGenderMix(index + 1, label, requirements.male, requirements.female));
      }
    });

    // Validate dreambreaker if exists
    if (dreambreakerGame && dreambreakerLineup.length !== DREAMBREAKER_PLAYER_COUNT) {
      errors.push(txt.validateDreambreaker);
    }

    return errors;
  };

  const handleSave = async () => {
    if (!match) return;

    const errors = validateSelections();
    if (errors.length > 0) {
      toast({
        title: txt.toastIncompleteTitle,
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
          } as TablesUpdate<'team_match_games'>)
          .eq('id', game.id);

        if (error) throw error;
      }

      // Update dreambreaker game lineup if exists
      if (dreambreakerGame) {
        const { error } = await supabase
          .from('team_match_games')
          .update({
            [lineupField]: dreambreakerLineup,
          } as TablesUpdate<'team_match_games'>)
          .eq('id', dreambreakerGame.id);

        if (error) throw error;
      }

      // Mark lineup as submitted
      const { error: matchError } = await supabase
        .from('team_match_matches')
        .update({
          [submittedField]: true,
        } as TablesUpdate<'team_match_matches'>)
        .eq('id', match.id);

      if (matchError) throw matchError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['team-match-games', match.id] });
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-match', match.id] });

      toast({
        title: txt.toastSavedTitle,
        description: txt.toastSavedDesc,
      });
      setHasChanges(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: txt.toastErrorTitle,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  const teamAName = (match.team_a as any)?.team_name || txt.tbd;
  const teamBName = (match.team_b as any)?.team_name || txt.tbd;
  const myTeamName = isTeamA ? teamAName : teamBName;
  const opponentName = isTeamA ? teamBName : teamAName;
  const validationErrors = validateSelections();
  const isComplete = validationErrors.length === 0;
  // BTC can always edit, Captain can edit if not started and not submitted
  const canEdit = isOwner || (!isMatchStarted && !isSubmitted);

  const getRoundLabel = () => {
    if (match.is_playoff && match.playoff_round) {
      if (match.playoff_round === 1) return txt.finalLabel;
      if (match.playoff_round === 2) return txt.semiLabel;
      if (match.playoff_round === 3) return txt.quarterLabel;
      return txt.roundLabel(match.playoff_round);
    }
    return match.round_number ? txt.roundLabel(match.round_number) : '';
  };

  const roundLabel = getRoundLabel();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              ...sectionTitle,
              fontSize: 20,
            }}
          >
            <Users className="h-5 w-5" style={{ color: 'var(--tl-fg-2)' }} />
            {txt.title}
            {roundLabel && (
              <span style={{ ...fieldLabel, marginLeft: 4 }}>— {roundLabel}</span>
            )}
          </SheetTitle>
          <SheetDescription
            style={{
              ...fieldLabel,
              marginTop: 4,
              textTransform: 'none',
              letterSpacing: '0.01em',
              fontFamily: 'Instrument Serif, serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--tl-fg-2)',
            }}
          >
            {myTeamName} vs {opponentName}
          </SheetDescription>
        </SheetHeader>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Status badges */}
          {(isSubmitted || isMatchStarted) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {isSubmitted && (
                <span
                  style={{
                    ...statusPillBase,
                    background: 'var(--tl-green-glow)',
                    color: 'var(--tl-green)',
                  }}
                >
                  <Check className="h-3 w-3" />
                  {txt.submittedBadge}
                </span>
              )}
              {isMatchStarted && (
                <span
                  style={{
                    ...statusPillBase,
                    background: 'var(--tl-surface)',
                    color: 'var(--tl-fg-2)',
                  }}
                >
                  {txt.lockedBadge}
                </span>
              )}
            </div>
          )}

          {isSubmitted && !isMatchStarted && (
            <div
              style={{
                ...surfaceCard,
                padding: '10px 12px',
                background: 'rgba(120, 165, 255, 0.06)',
                borderColor: 'var(--tl-border)',
                fontSize: 13,
                color: 'var(--tl-fg-2)',
              }}
            >
              {txt.lockedHint}
            </div>
          )}

          {(isLoading || rosterLoading) && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Loader2
                className="h-6 w-6 animate-spin mx-auto"
                style={{ color: 'var(--tl-fg-3)' }}
              />
            </div>
          )}

          {/* Regular Games List */}
          {!isLoading && !rosterLoading && regularGames.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ ...fieldLabel, fontSize: 11 }}>{txt.regularGamesTitle}</h3>
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

                const isFull = selected.length === requirements.total;
                const countPillStyle: React.CSSProperties = isFull
                  ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }
                  : { background: 'var(--tl-surface)', color: 'var(--tl-fg-2)' };

                return (
                  <div key={game.id} style={{ ...surfaceCard, padding: 14 }}>
                    <header style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <h4 style={{ ...sectionTitle, fontSize: 16 }}>
                          {txt.gameNum(index + 1)}: {game.display_name || GAME_TYPE_LABELS[game.game_type] || game.game_type}
                        </h4>
                        <span style={{ ...statusPillBase, ...countPillStyle }}>
                          {selected.length}/{requirements.total}
                        </span>
                      </div>
                      <p style={{ ...fieldLabel, marginTop: 4, fontSize: 11, color: 'var(--tl-fg-3)' }}>
                        {txt.needsLabel(requirements.male, requirements.female)}
                      </p>
                    </header>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {roster.map(player => {
                        const isSelected = selected.includes(player.id);
                        const canSelect = eligiblePlayers.includes(player) || isSelected;

                        const rowBg = isSelected
                          ? 'var(--tl-green-glow)'
                          : 'var(--tl-surface)';
                        const rowBorder = isSelected
                          ? '1px solid var(--tl-green-dim)'
                          : '1px solid var(--tl-border)';
                        const rowOpacity = !canEdit ? 0.7 : canSelect ? 1 : 0.4;
                        const rowCursor = canEdit && canSelect ? 'pointer' : 'default';

                        return (
                          <div
                            key={player.id}
                            onClick={() => {
                              if (canEdit && canSelect) {
                                togglePlayer(game.id, player.id, game.game_type);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 12px',
                              borderRadius: 'var(--tl-radius)',
                              background: rowBg,
                              border: rowBorder,
                              opacity: rowOpacity,
                              cursor: rowCursor,
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={!canEdit || !canSelect}
                              className="pointer-events-none"
                            />
                            <User className="h-4 w-4" style={{ color: 'var(--tl-fg-3)' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  fontFamily: 'Instrument Serif, serif',
                                  fontStyle: 'italic',
                                  fontSize: 16,
                                  letterSpacing: '-0.01em',
                                  color: 'var(--tl-fg)',
                                  margin: 0,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {player.player_name}
                              </p>
                              <p
                                style={{
                                  ...fieldLabel,
                                  fontSize: 10.5,
                                  color: 'var(--tl-fg-3)',
                                  marginTop: 2,
                                  textTransform: 'none',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {player.gender === 'male' ? txt.male : txt.female}
                                {player.is_captain && ` • ${txt.captain}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dreambreaker Section */}
          {!isLoading && !rosterLoading && dreambreakerGame && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap className="h-5 w-5" style={{ color: 'var(--tl-gold)' }} />
                <h3 style={{ ...sectionTitle, fontSize: 17 }}>{txt.dreambreakerTitle}</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', margin: 0 }}>
                {txt.dreambreakerHint}
              </p>

              <div
                style={{
                  ...surfaceCard,
                  padding: 14,
                  background: 'rgba(233, 182, 73, 0.06)',
                  borderColor: 'rgba(233, 182, 73, 0.35)',
                }}
              >
                <header style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <h4 style={{ ...sectionTitle, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
                      {txt.dreambreakerLineupTitle}
                    </h4>
                    <span
                      style={{
                        ...statusPillBase,
                        background:
                          dreambreakerLineup.length === DREAMBREAKER_PLAYER_COUNT
                            ? 'rgba(233, 182, 73, 0.18)'
                            : 'var(--tl-surface)',
                        color:
                          dreambreakerLineup.length === DREAMBREAKER_PLAYER_COUNT
                            ? 'var(--tl-gold)'
                            : 'var(--tl-fg-2)',
                      }}
                    >
                      {dreambreakerLineup.length}/{DREAMBREAKER_PLAYER_COUNT}
                    </span>
                  </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {roster.map(player => {
                    const isSelected = dreambreakerLineup.includes(player.id);
                    const canSelect =
                      isSelected || dreambreakerLineup.length < DREAMBREAKER_PLAYER_COUNT;

                    const rowBg = isSelected
                      ? 'rgba(233, 182, 73, 0.16)'
                      : 'var(--tl-surface)';
                    const rowBorder = isSelected
                      ? '1px solid var(--tl-gold)'
                      : '1px solid var(--tl-border)';
                    const rowOpacity = !canEdit ? 0.7 : canSelect ? 1 : 0.4;
                    const rowCursor = canEdit && canSelect ? 'pointer' : 'default';

                    return (
                      <div
                        key={player.id}
                        onClick={() => {
                          if (canEdit && canSelect) {
                            toggleDreambreakerPlayer(player.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 'var(--tl-radius)',
                          background: rowBg,
                          border: rowBorder,
                          opacity: rowOpacity,
                          cursor: rowCursor,
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={!canEdit || !canSelect}
                          className="pointer-events-none"
                        />
                        <User className="h-4 w-4" style={{ color: 'var(--tl-fg-3)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontSize: 16,
                              letterSpacing: '-0.01em',
                              color: 'var(--tl-fg)',
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {player.player_name}
                          </p>
                          <p
                            style={{
                              ...fieldLabel,
                              fontSize: 10.5,
                              color: 'var(--tl-fg-3)',
                              marginTop: 2,
                              textTransform: 'none',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {player.gender === 'male' ? txt.male : txt.female}
                            {player.is_captain && ` • ${txt.captain}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {!isComplete && validationErrors.length > 0 && hasChanges && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--tl-radius)',
                background: 'rgba(255, 65, 54, 0.08)',
                border: '1px solid rgba(255, 65, 54, 0.35)',
                color: 'var(--tl-fg-2)',
                fontSize: 13,
              }}
            >
              <AlertTriangle
                className="h-4 w-4 mt-0.5 flex-shrink-0"
                style={{ color: 'var(--tl-live)' }}
              />
              <ul
                style={{
                  listStyle: 'disc',
                  listStylePosition: 'inside',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Save Button */}
          {canEdit && (
            <button
              type="button"
              className="tl-btn green"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
              onClick={handleSave}
              disabled={isSaving || !isComplete}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {txt.saveLineup}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
