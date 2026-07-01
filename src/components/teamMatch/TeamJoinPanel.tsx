// ============================================================================
// TeamJoinPanel — player-side "join this team" action inside TeamDetailSheet.
// ----------------------------------------------------------------------------
// States:
//   • already on THIS team   → show request status (pending → withdraw, or in-team)
//   • already on ANOTHER team → blocked notice
//   • eligible to join        → gender + (DUPR eligibility) + "Join team" button
// Hidden for the organizer, the captain, and once registration has closed.
// ============================================================================

import { useState } from 'react';
import { Loader2, UserPlus, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useTeamMatchTeamManagement,
  useUserMembership,
} from '@/hooks/useTeamMatchTeams';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDuprConnection, useInvalidateDuprConnection } from '@/hooks/useDuprConnection';
import { DuprSsoModal } from '@/components/dupr/DuprSsoModal';
import { useI18n } from '@/i18n';

const card: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 14,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

interface TeamJoinPanelProps {
  teamId: string;
  teamName: string;
  tournamentId: string;
  teamStatus: string;
  tournamentStatus: string;
  isCaptain: boolean;
  requireDupr?: boolean;
  duprMaxMale?: number | null;
  duprMaxFemale?: number | null;
}

export function TeamJoinPanel({
  teamId,
  teamName,
  tournamentId,
  teamStatus,
  tournamentStatus,
  isCaptain,
  requireDupr = false,
  duprMaxMale = null,
  duprMaxFemale = null,
}: TeamJoinPanelProps) {
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === 'vi';
  const { profile } = useUserProfile();
  const { data: membership } = useUserMembership(tournamentId);
  const { joinTeam, isJoiningTeam, removeRosterMember, isRemovingMember } = useTeamMatchTeamManagement();

  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [showSso, setShowSso] = useState(false);

  // DUPR never blocks a player's join — they can join now and connect later.
  // The connect button is offered as a convenience (modal works inside the sheet).
  const { data: duprConn } = useDuprConnection();
  const invalidateDupr = useInvalidateDuprConnection();
  const duprMax = gender === 'female' ? duprMaxFemale : duprMaxMale;
  const playerDupr = duprConn?.doubles ?? duprConn?.singles ?? null;
  const duprConnected = !!duprConn?.ssoConnected && playerDupr != null;
  const duprMaxLabel = duprMax != null ? `≤ ${duprMax.toFixed(1)}` : null;

  const txt = {
    joinTitle: vi ? 'Tham gia đội này' : 'Join this team',
    joinHint: vi ? 'Gửi yêu cầu, đội trưởng sẽ duyệt bạn vào đội.' : 'Send a request — the captain approves you.',
    genderLabel: vi ? 'Giới tính' : 'Gender',
    male: vi ? 'Nam' : 'Male',
    female: vi ? 'Nữ' : 'Female',
    join: vi ? 'Tham gia đội' : 'Join team',
    pending: vi ? 'Yêu cầu của bạn đang chờ đội trưởng duyệt.' : 'Your request is awaiting the captain.',
    inTeam: vi ? 'Bạn đã ở trong đội này.' : "You're on this team.",
    withdraw: vi ? 'Huỷ yêu cầu' : 'Withdraw request',
    leaveTeam: vi ? 'Rời đội' : 'Leave team',
    onOtherTeam: (name: string) =>
      vi ? `Bạn đang ở đội "${name}" trong giải này.` : `You're already on "${name}" in this tournament.`,
    loginToJoin: vi ? 'Đăng nhập để tham gia đội.' : 'Log in to join a team.',
    duprConnected: (rating: number) =>
      vi ? `DUPR của bạn: ${rating.toFixed(2)}` : `Your DUPR: ${rating.toFixed(2)}`,
    duprLaterTitle: vi ? 'Tham gia trước, kết nối DUPR sau' : 'Join now, connect DUPR later',
    duprLater: (label: string | null) =>
      vi
        ? `Giải yêu cầu DUPR${label ? ` ${label}` : ''}. Bạn vẫn có thể tham gia đội ngay bây giờ và kết nối DUPR sau.`
        : `This tournament requires DUPR${label ? ` ${label}` : ''}. You can still join the team now and connect DUPR later.`,
    connectDupr: vi ? 'Kết nối DUPR' : 'Connect DUPR',
  };

  // Hidden only for this team's captain. The organizer can also join as a
  // player (creator ≠ excluded from playing).
  if (isCaptain) return null;
  // Registration closed → no join.
  if (tournamentStatus !== 'registration' && tournamentStatus !== 'setup') return null;

  if (!user) {
    return <div style={{ ...card, fontSize: 13, color: 'var(--tl-fg-3)' }}>{txt.loginToJoin}</div>;
  }

  // Already on a team in this tournament.
  if (membership) {
    if (membership.teamId === teamId) {
      const isPending = membership.status === 'pending';
      return (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tl-fg-2)' }}>
            {isPending ? (
              <Clock className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
            ) : (
              <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--tl-green)' }} />
            )}
            {isPending ? txt.pending : txt.inTeam}
          </div>
          <button
            type="button"
            className="tl-btn"
            onClick={() => removeRosterMember({ memberId: membership.id, teamId })}
            disabled={isRemovingMember}
            style={{ alignSelf: 'flex-start', color: 'var(--tl-live)', borderColor: 'rgba(255,65,54,0.35)' }}
          >
            {isRemovingMember && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? txt.withdraw : txt.leaveTeam}
          </button>
        </div>
      );
    }
    return (
      <div style={{ ...card, fontSize: 13, color: 'var(--tl-fg-3)' }}>{txt.onOtherTeam(membership.teamName)}</div>
    );
  }

  // Can only join an approved team.
  if (teamStatus !== 'approved') return null;

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <p style={{ fontWeight: 500, color: 'var(--tl-fg)', margin: 0, fontSize: 14.5 }}>{txt.joinTitle}</p>
        <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', marginTop: 4, margin: 0, lineHeight: 1.5 }}>{txt.joinHint}</p>
      </div>

      {requireDupr && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: 12,
            borderRadius: 'var(--tl-radius)',
            background: duprConnected ? 'rgba(34,197,94,0.08)' : 'var(--tl-surface)',
            border: `1px solid ${duprConnected ? 'rgba(34,197,94,0.4)' : 'var(--tl-border)'}`,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--tl-fg-2)',
          }}
        >
          {duprConnected ? (
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--tl-green)', flexShrink: 0, marginTop: 1 }} />
          ) : (
            <ShieldAlert className="h-4 w-4" style={{ color: 'var(--tl-gold)', flexShrink: 0, marginTop: 1 }} />
          )}
          {duprConnected ? (
            <span>{txt.duprConnected(playerDupr!)}</span>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--tl-fg)', marginBottom: 2 }}>{txt.duprLaterTitle}</div>
              <div style={{ marginBottom: 10 }}>{txt.duprLater(duprMaxLabel)}</div>
              <button
                type="button"
                className="tl-btn"
                onClick={() => setShowSso(true)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {txt.connectDupr}
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <label style={fieldLabel}>{txt.genderLabel}</label>
        <Select value={gender} onValueChange={(v) => setGender(v as 'male' | 'female')}>
          <SelectTrigger style={{ marginTop: 6 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">{txt.male}</SelectItem>
            <SelectItem value="female">{txt.female}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        className="tl-btn green"
        onClick={() =>
          joinTeam({
            teamId,
            tournamentId,
            playerName: profile?.display_name || (vi ? 'Người chơi' : 'Player'),
            gender,
          })
        }
        disabled={isJoiningTeam}
        style={{ justifyContent: 'center' }}
      >
        {isJoiningTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {txt.join}
      </button>

      <DuprSsoModal
        open={showSso}
        onClose={() => setShowSso(false)}
        onSuccess={() => {
          setShowSso(false);
          invalidateDupr();
        }}
      />
    </div>
  );
}
