import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Check, Clock, Pencil, Play, Radio, MapPin } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { QuickTableMatch, QuickTablePlayer } from '@/hooks/useQuickTable';

interface QuickTableMatchRowProps {
  match: QuickTableMatch;
  index: number;
  player1: QuickTablePlayer | undefined;
  player2: QuickTablePlayer | undefined;
  canEdit: boolean;
  onScoreUpdate: (score1: number, score2: number) => void;
  onCourtNameUpdate?: (courtName: string) => void;
  formatPlayerName: (player: QuickTablePlayer | undefined) => string;
}

export default function QuickTableMatchRow({
  match, index, player1, player2, canEdit, onScoreUpdate, onCourtNameUpdate, formatPlayerName,
}: QuickTableMatchRowProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [s1, setS1] = useState<string>(match.score1?.toString() ?? '');
  const [s2, setS2] = useState<string>(match.score2?.toString() ?? '');
  const [editingCourtName, setEditingCourtName] = useState(false);
  const [courtNameValue, setCourtNameValue] = useState(match.court_name ?? '');
  const isCompleted = match.status === 'completed';
  const isLive = !!('live_referee_id' in match && match.live_referee_id);

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
    navigate(`/tools/quick-tables/referee/${match.id}`);
  };

  // ─── Token-driven container styling ──────────────────────────────────────
  const rowBackground =
    isLive && !isCompleted ? 'rgba(255, 65, 54, 0.08)' :
    isCompleted && !isEditing ? 'var(--tl-bg)' :
    'var(--tl-bg)';
  const rowBorderColor =
    isLive && !isCompleted ? 'rgba(255, 65, 54, 0.45)' :
    'var(--tl-border)';

  const winnerColor = 'var(--tl-green)';
  const playerNameStyle = (isWinner: boolean): React.CSSProperties => ({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 14.5,
    fontWeight: isWinner ? 700 : 500,
    color: isWinner ? winnerColor : 'var(--tl-fg)',
  });

  const scoreCellStyle = (isWinner: boolean): React.CSSProperties => ({
    fontSize: 14.5,
    fontWeight: isWinner ? 700 : 500,
    color: isWinner ? winnerColor : 'var(--tl-fg)',
    fontVariantNumeric: 'tabular-nums',
  });

  const metaTextStyle: React.CSSProperties = {
    fontFamily: 'Geist Mono, ui-monospace, monospace',
    fontSize: 10.5,
    color: 'var(--tl-fg-3)',
    letterSpacing: '0.02em',
    lineHeight: 1.4,
  };

  const courtNameInputStyle = "w-20 h-5 text-[10px] px-1 py-0";

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 'var(--tl-radius)',
        border: `1px solid ${rowBorderColor}`,
        background: rowBackground,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      className="sm:flex-row sm:items-center sm:gap-3 sm:p-3"
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 16,
            flexShrink: 0,
          }}
          className="sm:w-14"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--tl-fg-3)',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {index + 1}
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
          <div style={{ display: 'flex', flexDirection: 'column', ...metaTextStyle }}>
            {(match.court_name || match.court_id != null) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <MapPin className="w-3 h-3" />
                {match.court_name || `${t.quickTable.view.court} ${match.court_id}`}
              </span>
            )}
            {!match.court_name && match.court_id == null && canEdit && onCourtNameUpdate && (
              editingCourtName ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Input
                    className={courtNameInputStyle}
                    value={courtNameValue}
                    onChange={(e) => setCourtNameValue(e.target.value)}
                    onBlur={() => {
                      if (courtNameValue.trim()) {
                        onCourtNameUpdate(courtNameValue.trim());
                      }
                      setEditingCourtName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && courtNameValue.trim()) {
                        onCourtNameUpdate(courtNameValue.trim());
                        setEditingCourtName(false);
                      }
                    }}
                    placeholder={t.quickTable.view.courtNamePlaceholder}
                    autoFocus
                  />
                </span>
              ) : (
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    color: 'var(--tl-fg-3)',
                    cursor: 'pointer',
                    font: 'inherit',
                    ...metaTextStyle,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)'; }}
                  onClick={() => setEditingCourtName(true)}
                >
                  <MapPin className="w-3 h-3" />
                  <span style={{ textDecoration: 'underline', textDecorationStyle: 'dashed' }}>
                    {t.quickTable.view.courtName}
                  </span>
                </button>
              )
            )}
            {(match.court_name || match.court_id != null) && canEdit && onCourtNameUpdate && !editingCourtName && (
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  color: 'var(--tl-fg-3)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dashed',
                  ...metaTextStyle,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)'; }}
                onClick={() => {
                  setCourtNameValue(match.court_name ?? '');
                  setEditingCourtName(true);
                }}
              >
                <Pencil className="w-2.5 h-2.5 inline mr-0.5" />
              </button>
            )}
            {editingCourtName && (match.court_name || match.court_id != null) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Input
                  className={courtNameInputStyle}
                  value={courtNameValue}
                  onChange={(e) => setCourtNameValue(e.target.value)}
                  onBlur={() => {
                    if (courtNameValue.trim()) {
                      onCourtNameUpdate?.(courtNameValue.trim());
                    }
                    setEditingCourtName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && courtNameValue.trim()) {
                      onCourtNameUpdate?.(courtNameValue.trim());
                      setEditingCourtName(false);
                    }
                  }}
                  placeholder={t.quickTable.view.courtNamePlaceholder}
                  autoFocus
                />
              </span>
            )}
            {match.start_at && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Clock className="w-3 h-3" />
                {match.start_at}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...playerNameStyle(match.winner_id === match.player1_id), textAlign: 'right' }}>
            {formatPlayerName(player1)}
          </span>

          {!isEditing && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--tl-surface)',
                border: '1px solid var(--tl-border)',
                minWidth: 56,
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={scoreCellStyle(match.winner_id === match.player1_id)}>
                {match.score1 ?? '–'}
              </span>
              <span style={{ color: 'var(--tl-fg-4)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>:</span>
              <span style={scoreCellStyle(match.winner_id === match.player2_id)}>
                {match.score2 ?? '–'}
              </span>
            </div>
          )}

          <span style={playerNameStyle(match.winner_id === match.player2_id)}>
            {formatPlayerName(player2)}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {canEdit && (
          <>
            {isEditing ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
                  <Input
                    type="number"
                    className="w-14 sm:w-16 h-9 text-center text-base p-1"
                    min={0}
                    value={s1}
                    onChange={(e) => setS1(e.target.value)}
                    autoFocus
                  />
                  <span style={{ color: 'var(--tl-fg-3)', fontWeight: 500 }}>–</span>
                  <Input
                    type="number"
                    className="w-14 sm:w-16 h-9 text-center text-base p-1"
                    min={0}
                    value={s2}
                    onChange={(e) => setS2(e.target.value)}
                  />
                </div>
                <button type="button" className="tl-btn" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleCancel}>
                  {t.quickTable.view.cancelEdit}
                </button>
                <button type="button" className="tl-btn green" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={handleSubmit}>
                  <Check className="w-4 h-4" />
                  {t.quickTable.view.saveScore}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="tl-btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: 11.5,
                    ...(isLive
                      ? { background: 'var(--tl-live)', color: 'var(--tl-bg)', borderColor: 'var(--tl-live)' }
                      : {}),
                  }}
                  onClick={handleOpenScoring}
                  title={t.quickTable.view.openScoringPage}
                >
                  <Play className="w-3 h-3" />
                  <span className="hidden sm:inline">{t.quickTable.view.openScoringPage}</span>
                </button>
                <button
                  type="button"
                  className="tl-btn"
                  style={{ padding: '6px 10px', fontSize: 11.5 }}
                  onClick={isCompleted ? handleStartEdit : handleOpenScoring}
                >
                  <Pencil className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {isCompleted ? t.quickTable.view.editInlineScore : t.quickTable.view.inputInlineScore}
                  </span>
                </button>
              </>
            )}
          </>
        )}
        {!canEdit && (
          isCompleted ? (
            <Check className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
          ) : isLive ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 7px',
                borderRadius: 3,
                background: 'var(--tl-live)',
                color: 'var(--tl-bg)',
                animation: 'tl-pulse 1.6s ease-in-out infinite',
              }}
            >
              <Radio className="w-3 h-3" />
              LIVE
            </span>
          ) : (
            <Clock className="w-4 h-4" style={{ color: 'var(--tl-fg-3)' }} />
          )
        )}
      </div>
    </div>
  );
}
