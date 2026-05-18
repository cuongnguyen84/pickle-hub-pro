import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Crown, Trophy, Check, Pencil, Play, Radio, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';

export interface BracketMatch {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  score1: number | null;
  score2: number | null;
  winner_id: string | null;
  status: 'pending' | 'completed';
  playoff_round: number | null;
  playoff_match_number: number | null;
  bracket_position: string | null;
  next_match_id: string | null;
  next_match_slot: number | null;
  live_referee_id?: string | null;
  court_id?: number | null;
  court_name?: string | null;
}

export interface BracketPlayer {
  id: string;
  name: string;
  team?: string | null;
  seed?: number | null;
  is_wildcard?: boolean | null;
  group_id?: string | null;
}

interface PlayoffBracketProps {
  matches: BracketMatch[];
  players: BracketPlayer[];
  canEdit: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
  onCourtNameUpdate?: (matchId: string, courtName: string) => void;
  groupNames?: Map<string, string>;
}

const PlayoffBracket = ({ matches, players, canEdit, onScoreUpdate, onCourtNameUpdate, groupNames }: PlayoffBracketProps) => {
  const { t } = useI18n();

  const getPlayer = (id: string | null): BracketPlayer | undefined =>
    id ? players.find(p => p.id === id) : undefined;

  const formatPlayerName = (player: BracketPlayer | undefined): string => {
    if (!player) return 'TBD';
    if (player.seed) {
      return `${player.name} (${player.seed})`;
    }
    return player.name;
  };

  const { rounds, champion } = useMemo(() => {
    if (matches.length === 0) return { rounds: [], champion: null };

    const roundMap = new Map<number, BracketMatch[]>();
    matches.forEach(match => {
      const round = match.playoff_round ?? 0;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    roundMap.forEach((roundMatches) => {
      roundMatches.sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));
    });

    const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const roundsArray = roundNumbers.map(roundNum => {
      const roundMatches = roundMap.get(roundNum) || [];
      const matchCount = roundMatches.length;

      return { roundNumber: roundNum, matches: roundMatches, matchCount };
    });

    const lastRound = roundsArray[roundsArray.length - 1];
    const finalMatch = lastRound?.matches.length === 1 ? lastRound.matches[0] : null;
    const championPlayer = finalMatch?.winner_id ? getPlayer(finalMatch.winner_id) : null;

    return { rounds: roundsArray, champion: championPlayer };
  }, [matches, players]);

  const getGroupName = (player: BracketPlayer | undefined): string | null => {
    if (!player?.group_id || !groupNames) return null;
    return groupNames.get(player.group_id) || null;
  };

  const getRoundName = (matchCount: number): string => {
    if (matchCount === 1) return t.quickTable.playoff.final;
    if (matchCount === 2) return t.quickTable.playoff.semiFinal;
    if (matchCount <= 4) return t.quickTable.playoff.quarterFinal;
    if (matchCount <= 8) return t.quickTable.playoff.round16;
    return t.quickTable.playoff.round;
  };

  if (matches.length === 0) {
    return (
      <div className="tl-empty-card">
        <span className="tl-empty-card-mark">◌</span>
        <span className="tl-empty-card-label">{t.quickTable.playoff.noMatches}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Champion banner — editorial: single green Trophy accent + neutral serif name */}
      {champion && (
        <div
          className="tl-panel"
          style={{
            padding: '28px 24px',
            borderColor: 'var(--tl-border-2)',
            background:
              'linear-gradient(180deg, rgba(0,185,107,0.05) 0%, var(--tl-bg) 60%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <Trophy
              className="w-7 h-7"
              style={{ color: 'var(--tl-green)', flexShrink: 0 }}
            />
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 10.5,
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--tl-fg-3)',
                  marginBottom: 6,
                }}
              >
                {t.quickTable.playoff.champion}
              </div>
              <div
                style={{
                  fontFamily: 'Instrument Serif, serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 'clamp(28px, 4vw, 40px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                  color: 'var(--tl-fg)',
                }}
              >
                {formatPlayerName(champion)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto', paddingBottom: 16, margin: '0 -16px', padding: '0 16px 16px' }}>
        <div
          style={{
            display: 'flex',
            gap: 24,
            minWidth: 'max-content',
            alignItems: 'stretch',
          }}
        >
          {rounds.map((round, roundIdx) => {
            const isFinal = round.matchCount === 1;
            return (
              <div
                key={round.roundNumber}
                style={{ display: 'flex', flexDirection: 'column', minWidth: 280 }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 18,
                  }}
                >
                  <span
                    className={cn('tl-filter', isFinal && 'active')}
                    style={{ cursor: 'default' }}
                  >
                    {isFinal && (
                      <Trophy
                        className="w-3 h-3"
                        style={{ color: 'var(--tl-bg)' }}
                      />
                    )}
                    {getRoundName(round.matchCount)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    justifyContent: 'space-around',
                    gap: roundIdx === 0 ? 16 : Math.pow(2, roundIdx) * 32,
                  }}
                >
                  {round.matches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      player1={getPlayer(match.player1_id)}
                      player2={getPlayer(match.player2_id)}
                      canEdit={canEdit && !!match.player1_id && !!match.player2_id}
                      canEditCourt={canEdit}
                      onScoreUpdate={onScoreUpdate}
                      onCourtNameUpdate={onCourtNameUpdate}
                      getGroupName={getGroupName}
                      formatPlayerName={formatPlayerName}
                      isFinal={isFinal}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {rounds.length > 0 && rounds[rounds.length - 1].matchCount > 1 && (
            <div
              style={{ display: 'flex', flexDirection: 'column', minWidth: 280 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <span
                  className="tl-filter"
                  style={{
                    cursor: 'default',
                    borderStyle: 'dashed',
                    color: 'var(--tl-fg-4)',
                  }}
                >
                  {getRoundName(Math.floor(rounds[rounds.length - 1].matchCount / 2))}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    color: 'var(--tl-fg-3)',
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    padding: 16,
                    border: '1px dashed var(--tl-border)',
                    borderRadius: 'var(--tl-radius)',
                  }}
                >
                  {t.quickTable.playoff.enterNextRound}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface BracketMatchCardProps {
  match: BracketMatch;
  player1: BracketPlayer | undefined;
  player2: BracketPlayer | undefined;
  canEdit: boolean;
  canEditCourt: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
  onCourtNameUpdate?: (matchId: string, courtName: string) => void;
  getGroupName: (player: BracketPlayer | undefined) => string | null;
  formatPlayerName: (player: BracketPlayer | undefined) => string;
  isFinal: boolean;
  t: ReturnType<typeof useI18n>['t'];
}

const BracketMatchCard = ({
  match,
  player1,
  player2,
  canEdit,
  canEditCourt,
  onScoreUpdate,
  onCourtNameUpdate,
  getGroupName,
  formatPlayerName,
  isFinal,
  t,
}: BracketMatchCardProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [localScore1, setLocalScore1] = useState<string>(match.score1?.toString() ?? '');
  const [localScore2, setLocalScore2] = useState<string>(match.score2?.toString() ?? '');
  const [editingCourtName, setEditingCourtName] = useState(false);
  const [courtNameValue, setCourtNameValue] = useState(match.court_name ?? '');

  const score1Ref = useRef<HTMLInputElement>(null);
  const score2Ref = useRef<HTMLInputElement>(null);

  const isCompleted = match.status === 'completed';
  const isLive = !!match.live_referee_id;
  const isP1Winner = match.winner_id === match.player1_id && isCompleted;
  const isP2Winner = match.winner_id === match.player2_id && isCompleted;
  const hasCourtInfo = !!match.court_name || match.court_id != null;

  const handleStartEdit = useCallback(() => {
    setLocalScore1(match.score1?.toString() ?? '');
    setLocalScore2(match.score2?.toString() ?? '');
    setIsEditing(true);
  }, [match.score1, match.score2]);

  const handleSubmit = useCallback(() => {
    const score1 = parseInt(localScore1) || 0;
    const score2 = parseInt(localScore2) || 0;

    if (score1 === score2) {
      toast.error(t.quickTable.playoff.tieNotAllowed);
      return;
    }

    if (score1 > 0 || score2 > 0) {
      onScoreUpdate(match.id, score1, score2);
      setIsEditing(false);
    }
  }, [localScore1, localScore2, match.id, onScoreUpdate, t]);

  const handleCancel = useCallback(() => {
    setLocalScore1(match.score1?.toString() ?? '');
    setLocalScore2(match.score2?.toString() ?? '');
    setIsEditing(false);
  }, [match.score1, match.score2]);

  const handleCourtSave = useCallback(() => {
    const trimmedCourtName = courtNameValue.trim();
    if (!trimmedCourtName || !onCourtNameUpdate) {
      setCourtNameValue(match.court_name ?? '');
      setEditingCourtName(false);
      return;
    }

    onCourtNameUpdate(match.id, trimmedCourtName);
    setCourtNameValue(trimmedCourtName);
    setEditingCourtName(false);
  }, [courtNameValue, match.court_name, match.id, onCourtNameUpdate]);

  const handleScore1Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setLocalScore1(value);
  }, []);

  const handleScore2Change = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setLocalScore2(value);
  }, []);

  const handleOpenScoring = () => {
    navigate(`/matches/${match.id}/score`);
  };

  // ─── Token-driven styles ────────────────────────────────────────────────
  const cardBorderColor =
    isLive && !isCompleted ? 'rgba(255, 65, 54, 0.45)' : 'var(--tl-border)';

  const playerRowStyle = (isWinner: boolean, missing: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: isWinner
      ? 'var(--tl-green-glow)'
      : missing
        ? 'var(--tl-bg)'
        : 'transparent',
    borderBottom: '1px solid var(--tl-border)',
    transition: 'background 0.15s',
  });

  const playerNameStyle = (isWinner: boolean, missing: boolean): React.CSSProperties => ({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14,
    fontWeight: isWinner ? 600 : 500,
    color: missing
      ? 'var(--tl-fg-4)'
      : isWinner
        ? 'var(--tl-fg)'
        : 'var(--tl-fg-2)',
    fontStyle: missing ? 'italic' : 'normal',
  });

  const scoreBoxStyle = (isWinner: boolean): React.CSSProperties => ({
    width: 40,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    fontFamily: 'Geist Mono, ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 14,
    fontWeight: 700,
    background: isWinner ? 'var(--tl-surface-2)' : 'var(--tl-surface)',
    color: isWinner ? 'var(--tl-fg)' : 'var(--tl-fg-3)',
    border: `1px solid ${isWinner ? 'var(--tl-border-2)' : 'var(--tl-border)'}`,
    flexShrink: 0,
  });

  const scoreInputCls =
    'w-12 h-8 text-center text-sm p-1 rounded bg-background focus:outline-none';

  return (
    <div
      className="tl-panel"
      style={{
        borderColor: cardBorderColor,
        overflow: 'hidden',
      }}
    >
      {/* Header strip — match number + court + live + CK pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 12px',
          borderBottom: '1px solid var(--tl-border)',
          background: isLive && !isCompleted ? 'rgba(255, 65, 54, 0.06)' : 'var(--tl-bg-elev)',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              {t.quickTable.playoff.match} {match.playoff_match_number}
            </span>
            {isLive && !isCompleted && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'var(--tl-live)',
                  color: 'var(--tl-bg)',
                  animation: 'tl-pulse 1.6s ease-in-out infinite',
                }}
              >
                <Radio className="w-2 h-2" />
                LIVE
              </span>
            )}
          </div>

          {(hasCourtInfo || (canEditCourt && onCourtNameUpdate)) && (
            <div
              style={{
                marginTop: 4,
                minHeight: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.02em',
              }}
            >
              {editingCourtName && canEditCourt && onCourtNameUpdate ? (
                <>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <Input
                    className="h-6 w-24 text-[10px] px-1.5"
                    value={courtNameValue}
                    onChange={(e) => setCourtNameValue(e.target.value)}
                    onBlur={handleCourtSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCourtSave();
                      }
                    }}
                    placeholder={t.quickTable.view.courtNamePlaceholder}
                    autoFocus
                  />
                </>
              ) : hasCourtInfo ? (
                <>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {match.court_name || `${t.quickTable.view.court} ${match.court_id}`}
                  </span>
                  {canEditCourt && onCourtNameUpdate && (
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        color: 'var(--tl-fg-3)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setCourtNameValue(match.court_name ?? '');
                        setEditingCourtName(true);
                      }}
                      title={t.quickTable.view.courtName}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    color: 'var(--tl-fg-3)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 10.5,
                  }}
                  onClick={() => {
                    setCourtNameValue(match.court_name ?? '');
                    setEditingCourtName(true);
                  }}
                >
                  <MapPin className="w-3 h-3" />
                  <span style={{ textDecoration: 'underline', textDecorationStyle: 'dashed' }}>
                    {t.quickTable.view.courtName}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isFinal && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 3,
                background: 'var(--tl-green-glow)',
                color: 'var(--tl-green)',
                border: '1px solid rgba(0, 185, 107, 0.30)',
              }}
            >
              <Trophy className="w-3 h-3" />
              CK
            </span>
          )}
          {canEdit && player1 && player2 && (
            <>
              <button
                type="button"
                className="tl-btn"
                onClick={handleOpenScoring}
                title={t.quickTable.playoff.openScoring}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  ...(isLive
                    ? { background: 'var(--tl-live)', color: 'var(--tl-bg)', borderColor: 'var(--tl-live)' }
                    : {}),
                }}
              >
                <Play className="w-3 h-3" />
              </button>

              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="tl-btn"
                    onClick={handleCancel}
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="tl-btn green"
                    onClick={handleSubmit}
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    <Check className="w-3 h-3" />
                    {t.common.save}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="tl-btn"
                  onClick={handleStartEdit}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  <Pencil className="w-3 h-3" />
                  {isCompleted ? t.quickTable.playoff.editScore : t.quickTable.playoff.inputScore}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Player 1 row */}
      <div style={playerRowStyle(isP1Winner, !player1)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={playerNameStyle(isP1Winner, !player1)}>
            {formatPlayerName(player1)}
          </div>
          {player1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.02em',
              }}
            >
              {getGroupName(player1) && (
                <span>
                  {t.quickTable.playoff.group} {getGroupName(player1)}
                </span>
              )}
              {player1.is_wildcard && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: 'var(--tl-surface)',
                    border: '1px solid var(--tl-border)',
                    color: 'var(--tl-fg-3)',
                    fontSize: 9.5,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  WC
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ width: 48, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {isEditing && player1 ? (
            <input
              ref={score1Ref}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={scoreInputCls}
              style={{
                border: '1px solid var(--tl-border-2)',
                color: 'var(--tl-fg)',
                background: 'var(--tl-surface)',
              }}
              value={localScore1}
              onChange={handleScore1Change}
              onFocus={(e) => e.target.select()}
            />
          ) : (
            <div style={scoreBoxStyle(isP1Winner)}>{match.score1 ?? '–'}</div>
          )}
        </div>

        {isP1Winner && (
          <Crown
            className="w-4 h-4"
            style={{ color: 'var(--tl-green)', flexShrink: 0 }}
          />
        )}
      </div>

      {/* Player 2 row */}
      <div
        style={{
          ...playerRowStyle(isP2Winner, !player2),
          borderBottom: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={playerNameStyle(isP2Winner, !player2)}>
            {formatPlayerName(player2)}
          </div>
          {player2 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.02em',
              }}
            >
              {getGroupName(player2) && (
                <span>
                  {t.quickTable.playoff.group} {getGroupName(player2)}
                </span>
              )}
              {player2.is_wildcard && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: 'var(--tl-surface)',
                    border: '1px solid var(--tl-border)',
                    color: 'var(--tl-fg-3)',
                    fontSize: 9.5,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  WC
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ width: 48, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {isEditing && player2 ? (
            <input
              ref={score2Ref}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={scoreInputCls}
              style={{
                border: '1px solid var(--tl-border-2)',
                color: 'var(--tl-fg)',
                background: 'var(--tl-surface)',
              }}
              value={localScore2}
              onChange={handleScore2Change}
              onFocus={(e) => e.target.select()}
            />
          ) : (
            <div style={scoreBoxStyle(isP2Winner)}>{match.score2 ?? '–'}</div>
          )}
        </div>

        {isP2Winner && (
          <Crown
            className="w-4 h-4"
            style={{ color: 'var(--tl-green)', flexShrink: 0 }}
          />
        )}
      </div>
    </div>
  );
};

export default PlayoffBracket;
