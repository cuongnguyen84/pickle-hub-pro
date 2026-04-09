import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import {
  type SeededPlayer,
  type BracketPairing,
  resolveGroupConflicts,
} from '@/lib/quick-table-playoff';

interface PlayoffPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPairings: BracketPairing[];
  groupNames: Map<string, string>;
  onConfirm: (pairings: BracketPairing[]) => void;
}

export default function PlayoffPreviewDialog({
  open,
  onOpenChange,
  initialPairings,
  groupNames,
  onConfirm,
}: PlayoffPreviewDialogProps) {
  const { t } = useI18n();
  const [pairings, setPairings] = useState<BracketPairing[]>(initialPairings);
  const [selectedPlayer, setSelectedPlayer] = useState<{ pairIndex: number; side: 'player1' | 'player2' } | null>(null);

  const conflicts = useMemo(() => {
    return pairings
      .map((p, i) => (p.player1.sourceGroupId === p.player2.sourceGroupId ? i : -1))
      .filter(i => i >= 0);
  }, [pairings]);

  const hasConflicts = conflicts.length > 0;

  const handlePlayerClick = (pairIndex: number, side: 'player1' | 'player2') => {
    if (!selectedPlayer) {
      setSelectedPlayer({ pairIndex, side });
      return;
    }

    if (selectedPlayer.pairIndex === pairIndex) {
      setSelectedPlayer(null);
      return;
    }

    // Swap players
    const newPairings = pairings.map(p => ({ ...p }));
    const fromPair = newPairings[selectedPlayer.pairIndex];
    const toPair = newPairings[pairIndex];

    const fromPlayer = fromPair[selectedPlayer.side];
    const toPlayer = toPair[side];

    newPairings[selectedPlayer.pairIndex] = { ...fromPair, [selectedPlayer.side]: toPlayer };
    newPairings[pairIndex] = { ...toPair, [side]: fromPlayer };

    setPairings(newPairings);
    setSelectedPlayer(null);
  };

  const handleAutoResolve = () => {
    const result = resolveGroupConflicts(pairings);
    setPairings(result.pairings);
    setSelectedPlayer(null);
  };

  const handleConfirm = () => {
    onConfirm(pairings);
    onOpenChange(false);
  };

  const getGroupName = (groupId: string) => groupNames.get(groupId) || groupId.slice(0, 4);

  const renderPlayer = (player: SeededPlayer, pairIndex: number, side: 'player1' | 'player2') => {
    const isSelected = selectedPlayer?.pairIndex === pairIndex && selectedPlayer?.side === side;
    const isConflict = conflicts.includes(pairIndex);

    return (
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-left w-full transition-all text-sm',
          isSelected && 'ring-2 ring-primary bg-primary/10',
          isConflict && !isSelected && 'bg-destructive/10',
          !isSelected && !isConflict && 'hover:bg-muted/50'
        )}
        onClick={() => handlePlayerClick(pairIndex, side)}
      >
        <Badge variant="outline" className="text-xs shrink-0 w-8 justify-center">
          {player.seed}
        </Badge>
        <span className="truncate flex-1 font-medium">{player.name}</span>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {t.quickTable.playoffPreview.fromGroup} {getGroupName(player.sourceGroupId)}
        </Badge>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.quickTable.playoffPreview.title}</DialogTitle>
          <DialogDescription>{t.quickTable.playoffPreview.subtitle}</DialogDescription>
        </DialogHeader>

        {hasConflicts && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-destructive">{t.quickTable.playoffPreview.conflictWarning}</p>
              <p className="text-foreground-muted text-xs mt-0.5">{t.quickTable.playoffPreview.clickToSwap}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAutoResolve} className="gap-1 shrink-0">
              <Wand2 className="w-3 h-3" />
              {t.quickTable.playoffPreview.autoResolve}
            </Button>
          </div>
        )}

        {!hasConflicts && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-sm">{t.quickTable.playoffPreview.noConflicts}</span>
          </div>
        )}

        <div className="space-y-2">
          {pairings.map((pairing, i) => {
            const isConflict = conflicts.includes(i);
            return (
              <div
                key={i}
                className={cn(
                  'rounded-lg border p-2 space-y-1',
                  isConflict ? 'border-destructive/50' : 'border-border'
                )}
              >
                <div className="text-[10px] text-foreground-muted px-1">
                  {t.quickTable.playoff.match} {pairing.matchNumber}
                  {isConflict && (
                    <span className="text-destructive ml-2">⚠</span>
                  )}
                </div>
                {renderPlayer(pairing.player1, i, 'player1')}
                <div className="text-center text-[10px] text-foreground-muted">vs</div>
                {renderPlayer(pairing.player2, i, 'player2')}
              </div>
            );
          })}
        </div>

        <Button
          className="w-full"
          onClick={handleConfirm}
          disabled={hasConflicts}
        >
          <Check className="w-4 h-4 mr-2" />
          {t.quickTable.playoffPreview.confirmBracket}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
