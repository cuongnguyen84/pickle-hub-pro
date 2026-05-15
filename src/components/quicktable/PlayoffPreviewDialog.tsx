import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Check, Wand2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  type SeededPlayer,
  type BracketPairing,
  resolveGroupConflicts,
  BYE_PLAYER_ID,
} from '@/lib/quick-table-playoff';

interface PlayoffPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPairings: BracketPairing[];
  groupNames: Map<string, string>;
  onConfirm: (pairings: BracketPairing[]) => void;
}

const seedBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  padding: '2px 0',
  borderRadius: 4,
  border: '1px solid var(--tl-border)',
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  flexShrink: 0,
  letterSpacing: '0.04em',
};

const groupBadge: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 9.5,
  fontWeight: 500,
  padding: '2px 6px',
  borderRadius: 3,
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  flexShrink: 0,
};

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

  useEffect(() => {
    setPairings(initialPairings);
  }, [initialPairings]);

  const conflicts = useMemo(() => {
    return pairings
      .map((p, i) => {
        if (p.player1.playerId === BYE_PLAYER_ID || p.player2.playerId === BYE_PLAYER_ID) return -1;
        return p.player1.sourceGroupId === p.player2.sourceGroupId ? i : -1;
      })
      .filter(i => i >= 0);
  }, [pairings]);

  const hasConflicts = conflicts.length > 0;

  const isBye = (player: SeededPlayer) => player.playerId === BYE_PLAYER_ID;

  const handlePlayerClick = (pairIndex: number, side: 'player1' | 'player2') => {
    const player = pairings[pairIndex][side];
    if (isBye(player)) return;

    if (!selectedPlayer) {
      setSelectedPlayer({ pairIndex, side });
      return;
    }

    if (selectedPlayer.pairIndex === pairIndex) {
      setSelectedPlayer(null);
      return;
    }

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
    if (isBye(player)) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            width: '100%',
            opacity: 0.5,
          }}
        >
          <span style={seedBadge}>{player.seed}</span>
          <span
            style={{
              flex: 1,
              fontStyle: 'italic',
              fontWeight: 500,
              color: 'var(--tl-fg-3)',
              fontSize: 13,
            }}
          >
            BYE
          </span>
        </div>
      );
    }

    const isSelected = selectedPlayer?.pairIndex === pairIndex && selectedPlayer?.side === side;
    const isConflict = conflicts.includes(pairIndex);

    const buttonBg =
      isSelected ? 'var(--tl-green-glow)' :
      isConflict ? 'rgba(255, 65, 54, 0.10)' :
      'transparent';
    const buttonBorder =
      isSelected ? 'var(--tl-green)' :
      isConflict ? 'rgba(255, 65, 54, 0.35)' :
      'transparent';

    return (
      <button
        type="button"
        onClick={() => handlePlayerClick(pairIndex, side)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          width: '100%',
          textAlign: 'left',
          background: buttonBg,
          border: `1px solid ${buttonBorder}`,
          color: 'var(--tl-fg)',
          font: 'inherit',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isSelected && !isConflict) {
            (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected && !isConflict) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }
        }}
      >
        <span style={seedBadge}>{player.seed}</span>
        <span
          style={{
            flex: 1,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.name}
        </span>
        <span style={groupBadge}>
          {t.quickTable.playoffPreview.fromGroup} {getGroupName(player.sourceGroupId)}
        </span>
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

        {hasConflicts ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 'var(--tl-radius)',
              background: 'rgba(255, 65, 54, 0.10)',
              border: '1px solid rgba(255, 65, 54, 0.35)',
            }}
          >
            <AlertTriangle
              className="w-4 h-4"
              style={{ color: 'var(--tl-live)', flexShrink: 0 }}
            />
            <div style={{ flex: 1, fontSize: 13 }}>
              <p
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--tl-live)',
                  margin: 0,
                }}
              >
                {t.quickTable.playoffPreview.conflictWarning}
              </p>
              <p style={{ color: 'var(--tl-fg-3)', fontSize: 12, margin: '2px 0 0' }}>
                {t.quickTable.playoffPreview.clickToSwap}
              </p>
            </div>
            <button
              type="button"
              className="tl-btn"
              onClick={handleAutoResolve}
              style={{ flexShrink: 0, padding: '6px 10px', fontSize: 12 }}
            >
              <Wand2 className="w-3 h-3" />
              {t.quickTable.playoffPreview.autoResolve}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 'var(--tl-radius)',
              background: 'var(--tl-green-glow)',
              border: '1px solid rgba(0, 185, 107, 0.30)',
            }}
          >
            <Check className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
            <span style={{ fontSize: 13, color: 'var(--tl-fg-2)' }}>
              {t.quickTable.playoffPreview.noConflicts}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pairings.map((pairing, i) => {
            const isConflict = conflicts.includes(i);
            return (
              <div
                key={i}
                style={{
                  borderRadius: 'var(--tl-radius)',
                  border: `1px solid ${isConflict ? 'rgba(255, 65, 54, 0.45)' : 'var(--tl-border)'}`,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  background: 'var(--tl-bg-elev)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 10,
                    color: 'var(--tl-fg-3)',
                    padding: '0 4px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.quickTable.playoff.match} {pairing.matchNumber}
                  {isConflict && (
                    <span style={{ color: 'var(--tl-live)', marginLeft: 6 }}>⚠</span>
                  )}
                </div>
                {renderPlayer(pairing.player1, i, 'player1')}
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 10,
                    color: 'var(--tl-fg-4)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  vs
                </div>
                {renderPlayer(pairing.player2, i, 'player2')}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="tl-btn green"
          onClick={handleConfirm}
          disabled={hasConflicts}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}
        >
          <Check className="w-4 h-4" />
          {t.quickTable.playoffPreview.confirmBracket}
        </button>
      </DialogContent>
    </Dialog>
  );
}
