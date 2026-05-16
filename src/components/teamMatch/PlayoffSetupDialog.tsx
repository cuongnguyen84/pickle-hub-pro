import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trophy, AlertTriangle, Info } from 'lucide-react';
import { TeamStanding, PlayoffPairing } from '@/hooks/useTeamMatchStandings';
import { useI18n } from '@/i18n';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

interface PlayoffSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standings: TeamStanding[];
  hasGroups: boolean;
  generatePlayoffSeeding: (teamCount: number) => {
    seeds: { teamId: string; seed: number; groupId?: string; groupRank?: number; standing: TeamStanding }[];
    pairings: PlayoffPairing[];
  };
  isCreating: boolean;
  onConfirm: (teamCount: number) => void;
}

export function PlayoffSetupDialog({
  open,
  onOpenChange,
  standings,
  hasGroups,
  generatePlayoffSeeding,
  isCreating,
  onConfirm,
}: PlayoffSetupDialogProps) {
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const { language } = useI18n();

  const txt = {
    title: language === 'vi' ? 'Tạo vòng Playoff' : 'Create playoffs',
    descBase: language === 'vi'
      ? 'Chọn số đội tham gia vòng Playoff.'
      : 'Pick the number of teams in the playoff bracket.',
    descGroups: language === 'vi'
      ? 'Nhất bảng này sẽ gặp nhì bảng kia.'
      : '1st of each group will face the 2nd of the other group.',
    descRanks: language === 'vi'
      ? 'Các đội sẽ được chọn theo thứ hạng BXH.'
      : 'Teams are seeded by overall standings.',
    teamCountLabel: language === 'vi' ? 'Số đội vào Playoff' : 'Playoff team count',
    teamsLabel: (n: number) => language === 'vi' ? `${n} đội` : `${n} teams`,
    final: language === 'vi' ? 'Chung kết' : 'Final',
    semi: language === 'vi' ? 'Bán kết → Chung kết' : 'Semis → Final',
    quarter: language === 'vi' ? 'Tứ kết → Bán kết → Chung kết' : 'Quarters → Semis → Final',
    eighth: language === 'vi'
      ? 'Vòng 1/8 → Tứ kết → Bán kết → Chung kết'
      : 'R16 → Quarters → Semis → Final',
    nRounds: (n: number) => language === 'vi' ? `${n} vòng` : `${n} rounds`,
    crossSeedFinal: language === 'vi'
      ? 'Cặp 1A vs 2B và 1B vs 2A sẽ ở 2 nhánh riêng, chỉ gặp nhau ở Chung kết.'
      : '1A vs 2B and 1B vs 2A live in separate halves and only meet in the Final.',
    crossSeedSmall: language === 'vi'
      ? 'Nhất bảng A gặp nhì bảng B, nhất bảng B gặp nhì bảng A.'
      : '1A vs 2B and 1B vs 2A.',
    qualifyingTeams: language === 'vi' ? 'Đội vào Playoff:' : 'Qualifying teams:',
    firstRoundPairings: language === 'vi' ? 'Ghép cặp vòng đầu:' : 'Round-1 pairings:',
    matchLabel: (n: number) => language === 'vi' ? `Trận ${n}` : `Match ${n}`,
    bracketA: language === 'vi' ? 'Nhánh A' : 'Bracket A',
    bracketB: language === 'vi' ? 'Nhánh B' : 'Bracket B',
    winLossShort: (won: number, lost: number) =>
      language === 'vi' ? `${won}T-${lost}B` : `${won}W-${lost}L`,
    warning: language === 'vi'
      ? 'Sau khi tạo Playoff, bạn không thể thay đổi số đội hoặc thứ hạng seed.'
      : 'Once playoffs are created, you cannot change the team count or seeding.',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    create: language === 'vi' ? 'Tạo Playoff' : 'Create playoffs',
    creating: language === 'vi' ? 'Đang tạo…' : 'Creating…',
  };

  // Calculate valid playoff sizes (powers of 2, up to total teams)
  const validPlayoffSizes = useMemo(() => {
    const totalTeams = standings.length;
    const sizes: number[] = [];
    let power = 1;
    while (power <= totalTeams) {
      sizes.push(power);
      power *= 2;
    }
    // Remove 1 as you need at least 2 teams
    return sizes.filter(s => s >= 2);
  }, [standings.length]);

  // Get playoff seeding for selected count
  const playoffSeeding = useMemo(() => {
    if (!selectedCount) return null;
    return generatePlayoffSeeding(selectedCount);
  }, [selectedCount, generatePlayoffSeeding]);

  const handleConfirm = () => {
    if (selectedCount) {
      onConfirm(selectedCount);
    }
  };

  const getRoundName = (teamCount: number) => {
    switch (teamCount) {
      case 2: return txt.final;
      case 4: return txt.semi;
      case 8: return txt.quarter;
      case 16: return txt.eighth;
      default: return txt.nRounds(Math.log2(teamCount));
    }
  };

  const getGroupLabel = (standing: TeamStanding) => {
    if (!standing.groupName || !standing.groupRank) return '';
    const stripped = standing.groupName.replace(/^(Bảng |Group )/, '');
    return `(${stripped}${standing.groupRank})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>
            <Trophy className="h-5 w-5" style={{ color: 'var(--tl-gold)' }} />
            {txt.title}
          </DialogTitle>
          <DialogDescription
            style={{
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--tl-fg-3)',
            }}
          >
            {txt.descBase} {hasGroups ? txt.descGroups : txt.descRanks}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Team count selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={fieldLabel}>{txt.teamCountLabel}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {validPlayoffSizes.map((size) => {
                const checked = selectedCount === size;
                return (
                  <label
                    key={size}
                    htmlFor={`playoff-size-${size}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 'var(--tl-radius)',
                      border: `1px solid ${checked ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                      background: checked ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                      position: 'relative',
                    }}
                  >
                    <input
                      type="radio"
                      id={`playoff-size-${size}`}
                      name="playoff-size"
                      value={size}
                      checked={checked}
                      onChange={() => setSelectedCount(size)}
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: 'hidden',
                        clip: 'rect(0,0,0,0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'Instrument Serif, serif',
                        fontStyle: 'italic',
                        fontSize: 17,
                        color: 'var(--tl-fg)',
                      }}
                    >
                      {txt.teamsLabel(size)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--tl-fg-3)',
                      }}
                    >
                      {getRoundName(size)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Cross-group seeding explanation */}
          {hasGroups && selectedCount && selectedCount >= 4 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 'var(--tl-radius)',
                background: 'rgba(120, 165, 255, 0.08)',
                border: '1px solid rgba(120, 165, 255, 0.35)',
                color: 'var(--tl-fg-2)',
                fontSize: 13,
              }}
            >
              <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'rgba(120, 165, 255, 1)' }} />
              <span>
                {selectedCount >= 8 ? txt.crossSeedFinal : txt.crossSeedSmall}
              </span>
            </div>
          )}

          {/* Preview qualifying teams */}
          {playoffSeeding && playoffSeeding.seeds.length > 0 && (
            <div style={{ ...surfaceCard, padding: 12 }}>
              <p style={{ ...fieldLabel, margin: '0 0 8px' }}>{txt.qualifyingTeams}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {playoffSeeding.seeds.map((seed, index) => (
                  <div
                    key={seed.teamId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--tl-fg)',
                    }}
                  >
                    <span style={{ fontWeight: index < 2 ? 600 : 400 }}>
                      {index + 1}. {seed.standing.team.team_name}
                      {hasGroups && (
                        <span style={{ color: 'var(--tl-fg-3)', marginLeft: 4, fontSize: 12 }}>
                          {getGroupLabel(seed.standing)}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        color: 'var(--tl-fg-3)',
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 12,
                      }}
                    >
                      {txt.winLossShort(seed.standing.won, seed.standing.lost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seeding preview with pairings */}
          {playoffSeeding && playoffSeeding.pairings.length > 0 && (
            <div style={{ ...surfaceCard, padding: 12 }}>
              <p style={{ ...fieldLabel, margin: '0 0 8px' }}>{txt.firstRoundPairings}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {playoffSeeding.pairings.map((pairing, index) => {
                  const bracketColor = pairing.bracketSide === 'left'
                    ? 'rgba(120, 165, 255, 0.10)'
                    : 'rgba(255, 165, 99, 0.10)';
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: bracketColor,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                          fontSize: 11,
                          color: 'var(--tl-fg-3)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {txt.matchLabel(index + 1)}
                        {selectedCount && selectedCount >= 8 && (
                          <span style={{ opacity: 0.7, marginLeft: 6 }}>
                            ({pairing.bracketSide === 'left' ? txt.bracketA : txt.bracketB})
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--tl-fg)' }}>
                        <span style={{ fontWeight: 600 }}>
                          {pairing.team1.standing.team.team_name}
                          {hasGroups && (
                            <span style={{ color: 'var(--tl-fg-3)', marginLeft: 2 }}>
                              {getGroupLabel(pairing.team1.standing)}
                            </span>
                          )}
                        </span>
                        <span style={{ margin: '0 8px', color: 'var(--tl-fg-3)' }}>vs</span>
                        <span style={{ fontWeight: 600 }}>
                          {pairing.team2.standing.team.team_name}
                          {hasGroups && (
                            <span style={{ color: 'var(--tl-fg-3)', marginLeft: 2 }}>
                              {getGroupLabel(pairing.team2.standing)}
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warning */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '12px 14px',
              borderRadius: 'var(--tl-radius)',
              background: 'rgba(233, 182, 73, 0.08)',
              border: '1px solid rgba(233, 182, 73, 0.35)',
              color: 'var(--tl-fg-2)',
              fontSize: 13,
            }}
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--tl-gold)' }} />
            <span>{txt.warning}</span>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            className="tl-btn"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {txt.cancel}
          </button>
          <button
            type="button"
            className="tl-btn green"
            onClick={handleConfirm}
            disabled={!selectedCount || isCreating}
          >
            {isCreating ? txt.creating : txt.create}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
