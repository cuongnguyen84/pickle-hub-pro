import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Users, AlertCircle } from 'lucide-react';
import { suggestGroupConfigs, distributePlayersToGroups } from '@/hooks/useQuickTable';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
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
  fontSize: 10.5,
  fontWeight: 500,
  padding: '3px 9px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  border: '1px solid var(--tl-border)',
};

interface GroupSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  isCreating: boolean;
  onConfirm: (groupCount: number, distribution: Array<Array<{ id: string; name: string }>>) => void;
}

export function GroupSetupDialog({
  open,
  onOpenChange,
  teams,
  isCreating,
  onConfirm,
}: GroupSetupDialogProps) {
  const [selectedGroupCount, setSelectedGroupCount] = useState<number | null>(null);
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;

  const approvedTeams = useMemo(() =>
    teams.filter(t => t.status === 'approved'),
    [teams]
  );

  const teamCount = approvedTeams.length;

  const txt = {
    title: c.groupSetupTitle,
    desc: language === 'vi'
      ? `Chọn số bảng và xem trước cách chia đội (${teamCount} đội đã duyệt)`
      : `Pick number of groups and preview the distribution (${teamCount} approved teams)`,
    chooseGroups: language === 'vi' ? 'Chọn số bảng' : 'Pick group count',
    nGroups: (n: number) => language === 'vi' ? `${n} bảng` : `${n} groups`,
    teamsPerGroupRange: (min: number, max: number) =>
      language === 'vi' ? `${min}-${max} đội/bảng` : `${min}-${max} teams/group`,
    recommended: language === 'vi' ? 'Đề xuất' : 'Recommended',
    notEnoughTeams: language === 'vi'
      ? 'Cần ít nhất 6 đội để chia bảng (mỗi bảng tối thiểu 3 đội)'
      : 'Need at least 6 teams to create groups (minimum 3 teams per group)',
    preview: language === 'vi' ? 'Xem trước phân bảng' : 'Preview distribution',
    groupName: (i: number) =>
      language === 'vi'
        ? `Bảng ${String.fromCharCode(65 + i)}`
        : `Group ${String.fromCharCode(65 + i)}`,
    teamCount: (n: number) => language === 'vi' ? `${n} đội` : `${n} teams`,
    snakeHint: language === 'vi'
      ? 'Đội được chia theo thứ tự hạt giống (snake draft) để cân bằng sức mạnh các bảng.'
      : 'Teams are distributed in snake-draft seed order for balanced strength.',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    confirm: language === 'vi' ? 'Xác nhận chia bảng' : 'Confirm groups',
    processing: language === 'vi' ? 'Đang tạo…' : 'Creating…',
  };

  // Use suggestGroupConfigs from Quick_tables
  const groupSuggestions = useMemo(() =>
    suggestGroupConfigs(teamCount),
    [teamCount]
  );

  // Preview distribution when a group count is selected
  const previewDistribution = useMemo(() => {
    if (!selectedGroupCount) return null;

    const teamsForDistribution = approvedTeams.map(t => ({
      id: t.id,
      name: t.team_name,
      team: undefined,
      seed: t.seed || undefined,
    }));

    return distributePlayersToGroups(teamsForDistribution, selectedGroupCount);
  }, [selectedGroupCount, approvedTeams]);

  const handleConfirm = () => {
    if (!selectedGroupCount || !previewDistribution) return;
    onConfirm(selectedGroupCount, previewDistribution);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>{txt.title}</DialogTitle>
          <DialogDescription
            style={{
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--tl-fg-3)',
            }}
          >
            {txt.desc}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '8px 0' }}>
          {/* Group count selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 style={fieldLabel}>{txt.chooseGroups}</h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 10,
              }}
            >
              {groupSuggestions.map((suggestion) => {
                const checked = selectedGroupCount === suggestion.groupCount;
                return (
                  <label
                    key={suggestion.groupCount}
                    htmlFor={`group-count-${suggestion.groupCount}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
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
                      id={`group-count-${suggestion.groupCount}`}
                      name="group-count"
                      value={suggestion.groupCount}
                      checked={checked}
                      onChange={() => setSelectedGroupCount(suggestion.groupCount)}
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
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: 'Instrument Serif, serif',
                            fontStyle: 'italic',
                            fontSize: 19,
                            color: 'var(--tl-fg)',
                            lineHeight: 1.1,
                          }}
                        >
                          {txt.nGroups(suggestion.groupCount)}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--tl-fg-3)',
                            marginTop: 2,
                          }}
                        >
                          {txt.teamsPerGroupRange(
                            suggestion.playersPerGroup[0],
                            suggestion.playersPerGroup[suggestion.playersPerGroup.length - 1],
                          )}
                        </div>
                      </div>
                      {suggestion.isRecommended && (
                        <span style={tinyPill}>{txt.recommended}</span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 11.5,
                        color: 'var(--tl-fg-3)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {suggestion.reason}
                    </p>
                    {checked && (
                      <Check
                        className="h-4 w-4"
                        style={{ color: 'var(--tl-green)', alignSelf: 'flex-end' }}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            {groupSuggestions.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 'var(--tl-radius)',
                  background: 'rgba(233, 182, 73, 0.08)',
                  border: '1px solid rgba(233, 182, 73, 0.35)',
                  color: 'var(--tl-fg-2)',
                  fontSize: 13,
                }}
              >
                <AlertCircle className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
                <p style={{ margin: 0 }}>{txt.notEnoughTeams}</p>
              </div>
            )}
          </div>

          {/* Preview distribution */}
          {previewDistribution && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={fieldLabel}>{txt.preview}</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {previewDistribution.map((group, index) => (
                  <div key={index} style={{ ...surfaceCard, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ ...tinyPill, background: 'var(--tl-bg-elev)' }}>
                        {txt.groupName(index)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--tl-fg-3)' }}>
                        {txt.teamCount(group.length)}
                      </span>
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {group.map((team, teamIndex) => (
                        <li
                          key={team.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            color: 'var(--tl-fg)',
                          }}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 999,
                              background: 'var(--tl-surface)',
                              color: 'var(--tl-fg-2)',
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {teamIndex + 1}
                          </span>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {team.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--tl-fg-3)',
                  margin: 0,
                }}
              >
                <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{txt.snakeHint}</span>
              </p>
            </div>
          )}
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
            disabled={!selectedGroupCount || isCreating}
          >
            {isCreating ? txt.processing : txt.confirm}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
