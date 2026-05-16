import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Shuffle, Hand, Trophy, ArrowRight, GripVertical, AlertTriangle } from 'lucide-react';
import { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
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

const tinyPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: 4,
  letterSpacing: '0.04em',
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  border: '1px solid var(--tl-border)',
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
};

const selectBase: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13.5,
  color: 'var(--tl-fg)',
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius)',
  padding: '7px 10px',
  outline: 'none',
  width: '100%',
  height: 36,
  boxSizing: 'border-box',
};

interface SingleEliminationSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  hasThirdPlaceMatch: boolean;
  isCreating: boolean;
  onConfirm: (pairingType: 'random' | 'manual', manualPairings?: Array<{ team1Id: string; team2Id: string }>) => void;
}

type PairingType = 'random' | 'manual';

export function SingleEliminationSetupDialog({
  open,
  onOpenChange,
  teams,
  hasThirdPlaceMatch,
  isCreating,
  onConfirm,
}: SingleEliminationSetupDialogProps) {
  const [pairingType, setPairingType] = useState<PairingType>('random');
  const [manualPairings, setManualPairings] = useState<Array<{ team1Id: string; team2Id: string }>>([]);
  const [step, setStep] = useState<'select' | 'manual'>('select');
  const { language } = useI18n();

  const approvedTeams = useMemo(() =>
    teams.filter(t => t.status === 'approved'),
    [teams]
  );

  const matchCount = approvedTeams.length / 2;

  const txt = {
    selectTitle: language === 'vi'
      ? 'Sinh Bracket — Single Elimination'
      : 'Generate bracket — Single elimination',
    selectDesc: language === 'vi'
      ? `Chọn cách ghép cặp đấu cho ${approvedTeams.length} đội`
      : `Pick the pairing method for ${approvedTeams.length} teams`,
    manualTitle: (round: string) =>
      language === 'vi' ? `Xếp cặp thủ công — ${round}` : `Manual pairing — ${round}`,
    manualDesc: language === 'vi'
      ? 'Chọn đội cho từng cặp đấu.'
      : 'Pick teams for each match.',
    unassignedLabel: (n: number) =>
      language === 'vi' ? `Đội chưa xếp (${n})` : `Unassigned teams (${n})`,
    pairingsLabel: (n: number) =>
      language === 'vi' ? `Các cặp đấu (${n} trận)` : `Match pairings (${n} matches)`,
    matchN: (n: number) => language === 'vi' ? `Trận ${n}` : `Match ${n}`,
    pickTeamPh: language === 'vi' ? 'Chọn đội...' : 'Pick team...',
    bracketWarning: language === 'vi'
      ? 'Sau khi tạo bracket, không thể thay đổi cặp đấu. Hãy kiểm tra kỹ!'
      : 'Once the bracket is created, pairings cannot be changed. Double-check before proceeding.',
    back: language === 'vi' ? 'Quay lại' : 'Back',
    creatingBtn: language === 'vi' ? 'Đang tạo…' : 'Creating…',
    createBracket: language === 'vi' ? 'Tạo Bracket' : 'Create bracket',
    random: language === 'vi' ? 'Bốc thăm ngẫu nhiên' : 'Random draw',
    randomDesc: language === 'vi'
      ? 'Hệ thống sẽ tự động xáo trộn và ghép cặp ngẫu nhiên'
      : 'The system will shuffle and pair teams randomly',
    manual: language === 'vi' ? 'Xếp thủ công' : 'Manual pairing',
    manualMethodDesc: language === 'vi'
      ? 'BTC tự chọn đội cho từng cặp đấu'
      : 'You pick the teams for each match yourself',
    previewLabel: language === 'vi'
      ? 'Ví dụ cặp đấu (sẽ xáo lại khi tạo)'
      : 'Preview pairings (will reshuffle on create)',
    moreMatches: (n: number) => language === 'vi' ? `+${n} trận khác...` : `+${n} more matches...`,
    thirdPlace: language === 'vi'
      ? 'Sẽ có trận tranh hạng 3 giữa 2 đội thua bán kết'
      : 'A 3rd-place match will be played between the semifinal losers',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    proceedManual: language === 'vi' ? 'Tiếp tục xếp cặp' : 'Continue to pairing',
    final: language === 'vi' ? 'Chung kết' : 'Final',
    semi: language === 'vi' ? 'Bán kết' : 'Semis',
    quarter: language === 'vi' ? 'Tứ kết' : 'Quarters',
    r16: language === 'vi' ? 'Vòng 1/8' : 'Round of 16',
    r1: language === 'vi' ? 'Vòng 1' : 'Round 1',
    losesOne: language === 'vi' ? 'Thua 1 trận = bị loại' : 'One loss = elimination',
    firstRound: (n: number) =>
      language === 'vi' ? `${n} trận vòng 1` : `${n} round-1 matches`,
    champion: language === 'vi' ? 'Vô địch' : 'Champion',
  };

  // Generate random pairings preview
  const randomPairingsPreview = useMemo(() => {
    const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
    const pairings: Array<{ team1: TeamMatchTeam; team2: TeamMatchTeam }> = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        pairings.push({ team1: shuffled[i], team2: shuffled[i + 1] });
      }
    }
    return pairings;
  }, [approvedTeams]);

  // Initialize manual pairings with empty slots
  const initializeManualPairings = () => {
    const emptyPairings: Array<{ team1Id: string; team2Id: string }> = [];
    for (let i = 0; i < matchCount; i++) {
      emptyPairings.push({ team1Id: '', team2Id: '' });
    }
    setManualPairings(emptyPairings);
  };

  // Get unassigned teams for manual selection
  const unassignedTeams = useMemo(() => {
    const assignedIds = new Set(
      manualPairings.flatMap(p => [p.team1Id, p.team2Id]).filter(Boolean)
    );
    return approvedTeams.filter(t => !assignedIds.has(t.id));
  }, [approvedTeams, manualPairings]);

  // Check if all pairings are complete
  const allPairingsComplete = useMemo(() => {
    return manualPairings.every(p => p.team1Id && p.team2Id);
  }, [manualPairings]);

  const handleProceed = () => {
    if (pairingType === 'manual') {
      initializeManualPairings();
      setStep('manual');
    } else {
      onConfirm('random');
    }
  };

  const handleManualConfirm = () => {
    if (allPairingsComplete) {
      onConfirm('manual', manualPairings);
    }
  };

  const handleAssignTeam = (pairingIndex: number, slot: 'team1Id' | 'team2Id', teamId: string) => {
    setManualPairings(prev => {
      const updated = [...prev];
      updated[pairingIndex] = { ...updated[pairingIndex], [slot]: teamId };
      return updated;
    });
  };

  const handleRemoveTeam = (pairingIndex: number, slot: 'team1Id' | 'team2Id') => {
    setManualPairings(prev => {
      const updated = [...prev];
      updated[pairingIndex] = { ...updated[pairingIndex], [slot]: '' };
      return updated;
    });
  };

  const getTeamName = (teamId: string) => {
    return approvedTeams.find(t => t.id === teamId)?.team_name || '';
  };

  const getRoundName = () => {
    const count = approvedTeams.length;
    if (count === 2) return txt.final;
    if (count === 4) return txt.semi;
    if (count === 8) return txt.quarter;
    if (count === 16) return txt.r16;
    return txt.r1;
  };

  // Manual pairing step
  if (step === 'manual') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={sectionTitle}>
              <Hand className="h-5 w-5" style={{ color: 'var(--tl-fg-2)' }} />
              {txt.manualTitle(getRoundName())}
            </DialogTitle>
            <DialogDescription
              style={{
                marginTop: 4,
                fontFamily: 'inherit',
                fontSize: 13,
                color: 'var(--tl-fg-3)',
              }}
            >
              {txt.manualDesc}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '8px 0' }}>
            {/* Unassigned teams */}
            {unassignedTeams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={fieldLabel}>{txt.unassignedLabel(unassignedTeams.length)}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {unassignedTeams.map(team => (
                    <span
                      key={team.id}
                      style={tinyPill}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--tl-surface)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                      }}
                    >
                      {team.team_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pairing slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={fieldLabel}>{txt.pairingsLabel(matchCount)}</label>
              {manualPairings.map((pairing, index) => (
                <div key={index} style={{ ...surfaceCard, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        ...fieldLabel,
                        width: 64,
                        flexShrink: 0,
                      }}
                    >
                      {txt.matchN(index + 1)}
                    </span>

                    {/* Team 1 slot */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {pairing.team1Id ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            background: 'var(--tl-bg)',
                            borderRadius: 'var(--tl-radius)',
                            border: '1px solid var(--tl-border)',
                            color: 'var(--tl-fg)',
                            fontSize: 13,
                          }}
                        >
                          <GripVertical className="h-4 w-4" style={{ color: 'var(--tl-fg-3)' }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getTeamName(pairing.team1Id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTeam(index, 'team1Id')}
                            style={{
                              width: 22,
                              height: 22,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--tl-fg-3)',
                              cursor: 'pointer',
                              fontSize: 14,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <select
                          name={`pairing-${index}-team1`}
                          style={selectBase}
                          value=""
                          onChange={(e) => handleAssignTeam(index, 'team1Id', e.target.value)}
                        >
                          <option value="">{txt.pickTeamPh}</option>
                          {unassignedTeams.map(team => (
                            <option key={team.id} value={team.id}>
                              {team.team_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <span
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 12,
                        color: 'var(--tl-fg-3)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      vs
                    </span>

                    {/* Team 2 slot */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {pairing.team2Id ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            background: 'var(--tl-bg)',
                            borderRadius: 'var(--tl-radius)',
                            border: '1px solid var(--tl-border)',
                            color: 'var(--tl-fg)',
                            fontSize: 13,
                          }}
                        >
                          <GripVertical className="h-4 w-4" style={{ color: 'var(--tl-fg-3)' }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getTeamName(pairing.team2Id)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTeam(index, 'team2Id')}
                            style={{
                              width: 22,
                              height: 22,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--tl-fg-3)',
                              cursor: 'pointer',
                              fontSize: 14,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <select
                          name={`pairing-${index}-team2`}
                          style={selectBase}
                          value=""
                          onChange={(e) => handleAssignTeam(index, 'team2Id', e.target.value)}
                        >
                          <option value="">{txt.pickTeamPh}</option>
                          {unassignedTeams.map(team => (
                            <option key={team.id} value={team.id}>
                              {team.team_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning about bracket changes */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--tl-radius)',
                background: 'rgba(233, 182, 73, 0.08)',
                border: '1px solid rgba(233, 182, 73, 0.35)',
                color: 'var(--tl-fg-2)',
                fontSize: 13,
              }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--tl-gold)' }} />
              <p style={{ margin: 0 }}>{txt.bracketWarning}</p>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="tl-btn"
              onClick={() => setStep('select')}
              disabled={isCreating}
            >
              {txt.back}
            </button>
            <button
              type="button"
              className="tl-btn green"
              onClick={handleManualConfirm}
              disabled={!allPairingsComplete || isCreating}
            >
              {isCreating ? txt.creatingBtn : txt.createBracket}
              <Trophy className="h-4 w-4" />
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Selection step
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>
            <Trophy className="h-5 w-5" style={{ color: 'var(--tl-gold)' }} />
            {txt.selectTitle}
          </DialogTitle>
          <DialogDescription
            style={{
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--tl-fg-3)',
            }}
          >
            {txt.selectDesc}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['random', 'manual'] as const).map((mode) => {
              const checked = pairingType === mode;
              const Icon = mode === 'random' ? Shuffle : Hand;
              const titleStr = mode === 'random' ? txt.random : txt.manual;
              const descStr = mode === 'random' ? txt.randomDesc : txt.manualMethodDesc;
              return (
                <label
                  key={mode}
                  htmlFor={`pairing-${mode}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: 14,
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
                    id={`pairing-${mode}`}
                    name="pairing-type"
                    value={mode}
                    checked={checked}
                    onChange={() => setPairingType(mode)}
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
                  <Icon
                    className="h-5 w-5"
                    style={{
                      color: checked ? 'var(--tl-green)' : 'var(--tl-fg-2)',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <div>
                    <p
                      style={{
                        fontFamily: 'Instrument Serif, serif',
                        fontStyle: 'italic',
                        fontSize: 17,
                        color: 'var(--tl-fg)',
                        margin: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {titleStr}
                    </p>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: 'var(--tl-fg-3)',
                        margin: '4px 0 0',
                        lineHeight: 1.4,
                      }}
                    >
                      {descStr}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Preview for random */}
          {pairingType === 'random' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={fieldLabel}>{txt.previewLabel}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {randomPairingsPreview.slice(0, 4).map((pairing, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      padding: '8px 10px',
                      borderRadius: 'var(--tl-radius)',
                      background: 'var(--tl-surface)',
                      color: 'var(--tl-fg)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{pairing.team1.team_name}</span>
                    <span style={{ color: 'var(--tl-fg-3)' }}>vs</span>
                    <span style={{ fontWeight: 600 }}>{pairing.team2.team_name}</span>
                  </div>
                ))}
                {randomPairingsPreview.length > 4 && (
                  <p style={{ fontSize: 12, color: 'var(--tl-fg-3)', margin: 0 }}>
                    {txt.moreMatches(randomPairingsPreview.length - 4)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Third place match info */}
          {hasThirdPlaceMatch && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 'var(--tl-radius)',
                background: 'var(--tl-green-glow)',
                border: '1px solid var(--tl-green)',
                color: 'var(--tl-fg)',
                fontSize: 13,
              }}
            >
              <Trophy className="h-4 w-4 mt-0.5" style={{ color: 'var(--tl-green)' }} />
              <p style={{ margin: 0 }}>{txt.thirdPlace}</p>
            </div>
          )}

          {/* Info about bracket structure */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 12.5,
              color: 'var(--tl-fg-3)',
            }}
          >
            <p style={{ margin: 0 }}>
              • {getRoundName()} → {approvedTeams.length === 4 ? txt.final : '...'} → {txt.champion}
            </p>
            <p style={{ margin: 0 }}>• {txt.firstRound(matchCount)}</p>
            <p style={{ margin: 0 }}>• {txt.losesOne}</p>
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
            onClick={handleProceed}
            disabled={isCreating}
          >
            {pairingType === 'manual'
              ? txt.proceedManual
              : isCreating
                ? txt.creatingBtn
                : txt.createBracket}
            <ArrowRight className="h-4 w-4" />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
