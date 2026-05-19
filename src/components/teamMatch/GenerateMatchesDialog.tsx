import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Users, Gamepad2, AlertTriangle } from 'lucide-react';
import { TeamMatchTeam, TeamMatchRosterMember } from '@/hooks/useTeamMatchTeams';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
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

interface GenerateMatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  gameTemplatesCount: number;
  maxRosterSize: number;
  isGenerating: boolean;
  onConfirm: () => void;
}

export function GenerateMatchesDialog({
  open,
  onOpenChange,
  teams,
  gameTemplatesCount,
  maxRosterSize,
  isGenerating,
  onConfirm,
}: GenerateMatchesDialogProps) {
  const { language } = useI18n();
  const approvedTeams = teams.filter(t => t.status === 'approved');
  const n = approvedTeams.length;

  // Calculate number of matches in round-robin
  const numMatches = n > 1 ? (n * (n - 1)) / 2 : 0;
  const numRounds = n > 1 ? (n % 2 === 0 ? n - 1 : n) : 0;

  const txt = {
    title: language === 'vi' ? 'Tạo lịch thi đấu?' : 'Generate schedule?',
    intro: language === 'vi'
      ? 'Hệ thống sẽ tự động tạo lịch thi đấu vòng tròn cho các đội đã được duyệt.'
      : 'The system will auto-generate a round-robin schedule for all approved teams.',
    teams: (count: number) => language === 'vi' ? `${count} đội` : `${count} teams`,
    matches: (count: number) => language === 'vi' ? `${count} trận` : `${count} matches`,
    rounds: (count: number) => language === 'vi' ? `${count} vòng` : `${count} rounds`,
    games: (count: number) => language === 'vi' ? `${count} ván/trận` : `${count} games/match`,
    needMinTeams: language === 'vi'
      ? 'Cần ít nhất 2 đội đã được duyệt để tạo lịch thi đấu'
      : 'Need at least 2 approved teams to generate a schedule',
    incompleteTitle: language === 'vi'
      ? 'Không thể tạo lịch — Có đội chưa đủ người'
      : 'Cannot generate — some teams are incomplete',
    teamMissing: (name: string, current: number, max: number) =>
      language === 'vi'
        ? `${name}: ${current}/${max} VĐV`
        : `${name}: ${current}/${max} players`,
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    confirm: language === 'vi' ? 'Xác nhận' : 'Confirm',
  };

  // Fetch rosters to check completeness
  const { data: allRosters } = useQuery({
    queryKey: ['team-match-all-rosters-check', approvedTeams.map(t => t.id).join(',')],
    queryFn: async () => {
      if (approvedTeams.length === 0) return {};

      const { data, error } = await supabase
        .from('team_match_roster')
        .select('*')
        .in('team_id', approvedTeams.map(t => t.id));

      if (error) throw error;

      const grouped: Record<string, TeamMatchRosterMember[]> = {};
      (data as TeamMatchRosterMember[]).forEach(member => {
        if (!grouped[member.team_id]) {
          grouped[member.team_id] = [];
        }
        grouped[member.team_id].push(member);
      });
      return grouped;
    },
    enabled: open && approvedTeams.length > 0,
  });

  // Check which teams are incomplete
  const incompleteTeams = approvedTeams.filter(team => {
    const rosterCount = allRosters?.[team.id]?.length || 0;
    return rosterCount < maxRosterSize;
  });

  const hasIncompleteTeams = incompleteTeams.length > 0;
  const canGenerate = n >= 2 && !hasIncompleteTeams;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle style={sectionTitle}>{txt.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--tl-fg-2)', lineHeight: 1.5 }}>
                {txt.intro}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={tinyPill}>
                  <Users className="h-3 w-3" />
                  {txt.teams(n)}
                </span>
                <span style={tinyPill}>
                  <Gamepad2 className="h-3 w-3" />
                  {txt.matches(numMatches)}
                </span>
                <span style={tinyPill}>{txt.rounds(numRounds)}</span>
                {gameTemplatesCount > 0 && (
                  <span style={tinyPill}>{txt.games(gameTemplatesCount)}</span>
                )}
              </div>

              {n < 2 && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--tl-live)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {txt.needMinTeams}
                </p>
              )}

              {/* Warning for incomplete teams */}
              {hasIncompleteTeams && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--tl-radius)',
                    background: 'rgba(255, 65, 54, 0.08)',
                    border: '1px solid rgba(255, 65, 54, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--tl-live)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{txt.incompleteTitle}</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 12,
                      color: 'var(--tl-fg-2)',
                      lineHeight: 1.6,
                    }}
                  >
                    {incompleteTeams.map(team => {
                      const rosterCount = allRosters?.[team.id]?.length || 0;
                      return (
                        <li key={team.id}>
                          {txt.teamMissing(team.team_name, rosterCount, maxRosterSize)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel
            disabled={isGenerating}
            className="flex-1 tl-btn"
            style={{ minHeight: 36 }}
          >
            {txt.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isGenerating || !canGenerate}
            className="flex-1 tl-btn green"
            style={{ minHeight: 36 }}
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            {txt.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
