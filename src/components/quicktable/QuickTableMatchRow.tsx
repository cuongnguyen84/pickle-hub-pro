import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, Pencil, Play, Radio, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import type { QuickTableMatch, QuickTablePlayer } from '@/hooks/useQuickTable';

interface QuickTableMatchRowProps {
  match: QuickTableMatch;
  index: number;
  player1: QuickTablePlayer | undefined;
  player2: QuickTablePlayer | undefined;
  canEdit: boolean;
  onScoreUpdate: (score1: number, score2: number) => void;
  formatPlayerName: (player: QuickTablePlayer | undefined) => string;
}

export default function QuickTableMatchRow({ match, index, player1, player2, canEdit, onScoreUpdate, formatPlayerName }: QuickTableMatchRowProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [s1, setS1] = useState<string>(match.score1?.toString() ?? '');
  const [s2, setS2] = useState<string>(match.score2?.toString() ?? '');
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
    navigate(`/matches/${match.id}/score`);
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border",
        isCompleted && !isEditing ? "bg-muted/30 border-border" : "border-border-subtle",
        isLive && !isCompleted && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-center gap-1 sm:gap-3 flex-1">
        <div className="flex flex-col items-start gap-0.5 min-w-[1rem] sm:w-14 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-foreground-muted">{index + 1}</span>
            {isLive && !isCompleted && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 animate-pulse">
                <Radio className="w-2 h-2 mr-0.5" />
                LIVE
              </Badge>
            )}
          </div>
          <div className="flex flex-col text-[10px] sm:text-[11px] text-foreground-muted leading-tight">
            {match.court_id != null && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {t.quickTable.view.court} {match.court_id}
              </span>
            )}
            {match.start_at && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {match.start_at}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-2">
          <span className={cn(
            "flex-1 text-right truncate text-sm sm:text-base font-medium",
            match.winner_id === match.player1_id && "text-primary font-bold"
          )}>
            {formatPlayerName(player1)}
          </span>

          {!isEditing && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded bg-muted min-w-[50px] sm:min-w-[60px] justify-center flex-shrink-0">
              <span className={cn("text-sm sm:text-base font-medium", match.winner_id === match.player1_id && "font-bold")}>
                {match.score1 ?? '-'}
              </span>
              <span className="text-foreground-muted">:</span>
              <span className={cn("text-sm sm:text-base font-medium", match.winner_id === match.player2_id && "font-bold")}>
                {match.score2 ?? '-'}
              </span>
            </div>
          )}

          <span className={cn(
            "flex-1 truncate text-sm sm:text-base font-medium",
            match.winner_id === match.player2_id && "text-primary font-bold"
          )}>
            {formatPlayerName(player2)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-1 flex-shrink-0">
        {canEdit && (
          <>
            {isEditing ? (
              <>
                <div className="flex items-center gap-1 mr-2">
                  <Input
                    type="number"
                    className="w-14 sm:w-16 h-9 text-center text-base p-1"
                    min={0}
                    value={s1}
                    onChange={(e) => setS1(e.target.value)}
                    autoFocus
                  />
                  <span className="text-foreground-muted font-medium">-</span>
                  <Input
                    type="number"
                    className="w-14 sm:w-16 h-9 text-center text-base p-1"
                    min={0}
                    value={s2}
                    onChange={(e) => setS2(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="sm" className="h-9 px-3 text-sm" onClick={handleCancel}>
                  {t.quickTable.view.cancelEdit}
                </Button>
                <Button size="sm" className="h-9 px-3 text-sm" onClick={handleSubmit}>
                  <Check className="w-4 h-4 mr-1" />
                  {t.quickTable.view.saveScore}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={isLive ? "destructive" : "outline"}
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={handleOpenScoring}
                  title={t.quickTable.view.openScoringPage}
                >
                  <Play className="w-3 h-3 sm:mr-1" />
                  <span className="hidden sm:inline">{t.quickTable.view.openScoringPage}</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={handleStartEdit}>
                  <Pencil className="w-3 h-3 sm:mr-1" />
                  <span className="hidden sm:inline">{isCompleted ? t.quickTable.view.editInlineScore : t.quickTable.view.inputInlineScore}</span>
                </Button>
              </>
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
}
