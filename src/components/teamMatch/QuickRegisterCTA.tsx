// ============================================================================
// QuickRegisterCTA — one-tap team registration for a tournament.
// ----------------------------------------------------------------------------
//   • 0 master teams  → "Create team & register" (opens dialog, create mode)
//   • 1 master team   → "Register: {name}" — registers in ONE tap (copies the
//                       full master roster). For require_dupr tournaments it
//                       shows the captain's DUPR eligibility inline and blocks
//                       the button when out of range / not connected.
//   • >1 master teams → "Register team" (opens dialog, use-existing mode)
//
// Edge cases (multi-team pick, trimming an over-sized roster) fall back to the
// dialog. Shown only when the parent has already decided the user can register.
// ============================================================================

import { useState } from 'react';
import { Loader2, Plus, Users } from 'lucide-react';
import { useMasterTeams, useMasterTeamWithRoster } from '@/hooks/useMasterTeams';
import { useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useDuprConnection, useInvalidateDuprConnection } from '@/hooks/useDuprConnection';
import { DuprEligibilityCheck } from '@/components/dupr/DuprEligibilityCheck';
import { DuprSsoModal } from '@/components/dupr/DuprSsoModal';
import { isDuprEligible } from '@/lib/duprEligibility';
import { useI18n } from '@/i18n';

const card: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderStyle: 'dashed',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 18,
};

interface QuickRegisterCTAProps {
  tournamentId: string;
  requireDupr?: boolean;
  duprMaxMale?: number | null;
  duprMaxFemale?: number | null;
  /** Open the full dialog in a given mode for multi-team / roster-edit cases. */
  onOpenDialog: (mode: 'create' | 'use-existing') => void;
  onSuccess?: () => void;
}

export function QuickRegisterCTA({
  tournamentId,
  requireDupr = false,
  duprMaxMale = null,
  duprMaxFemale = null,
  onOpenDialog,
  onSuccess,
}: QuickRegisterCTAProps) {
  const { language } = useI18n();
  const vi = language === 'vi';
  const { data: masterTeams, isLoading } = useMasterTeams();
  const { registerExistingTeam, isRegisteringExisting } = useTeamMatchTeamManagement();

  const singleTeam = masterTeams?.length === 1 ? masterTeams[0] : null;
  const { roster, isLoading: isLoadingRoster } = useMasterTeamWithRoster(singleTeam?.id);

  // DUPR gating (captain = logged-in user, MLP is doubles-only).
  const { data: duprConn } = useDuprConnection();
  const invalidateDupr = useInvalidateDuprConnection();
  const [showSso, setShowSso] = useState(false);
  const captainGender = roster.find((m) => m.is_captain)?.gender ?? 'male';
  const duprMax = captainGender === 'female' ? duprMaxFemale : duprMaxMale;
  const captainDupr = duprConn?.doubles ?? duprConn?.singles ?? null;
  const duprConnected = !!duprConn?.ssoConnected && captainDupr != null;
  const duprEligible = isDuprEligible({
    requireDupr,
    connected: duprConnected,
    rating: captainDupr,
    max: duprMax,
  });

  const txt = {
    register: (name: string) => (vi ? `Đăng ký: ${name}` : `Register: ${name}`),
    createAndRegister: vi ? 'Tạo đội & đăng ký' : 'Create team & register',
    registerTeam: vi ? 'Đăng ký đội' : 'Register team',
    createHint: vi ? 'Tạo đội của bạn để tham gia giải đấu này' : 'Create your team to join this tournament',
    oneTapHint: vi ? 'Đăng ký nhanh đội của bạn — chỉ một chạm' : 'Register your team in one tap',
    pickHint: vi ? 'Chọn một trong các đội của bạn' : 'Pick one of your teams',
    otherTeam: vi ? 'Đội khác / chỉnh thành viên' : 'Other team / edit roster',
  };

  const handleOneTap = async () => {
    if (!singleTeam || !duprEligible) return;
    await registerExistingTeam({
      tournamentId,
      masterTeam: { id: singleTeam.id, team_name: singleTeam.team_name },
      roster: roster.map((m) => ({
        player_name: m.player_name,
        gender: m.gender,
        skill_level: m.skill_level,
        user_id: m.user_id,
        is_captain: m.is_captain,
      })),
    });
    onSuccess?.();
  };

  if (isLoading) {
    return (
      <div style={{ ...card, display: 'flex', justifyContent: 'center' }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
      </div>
    );
  }

  // ─── No team yet → create ────────────────────────────────────────────────
  if (!masterTeams || masterTeams.length === 0) {
    return (
      <Row hint={txt.createHint}>
        <button type="button" className="tl-btn green" onClick={() => onOpenDialog('create')}>
          <Plus className="w-4 h-4" />
          {txt.createAndRegister}
        </button>
      </Row>
    );
  }

  // ─── Many teams → let the dialog handle the pick ─────────────────────────
  if (masterTeams.length > 1) {
    return (
      <Row hint={txt.pickHint}>
        <button type="button" className="tl-btn green" onClick={() => onOpenDialog('use-existing')}>
          <Users className="w-4 h-4" />
          {txt.registerTeam}
        </button>
      </Row>
    );
  }

  // ─── Exactly one team → one-tap register ─────────────────────────────────
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {requireDupr && (
        <DuprEligibilityCheck
          ratingSource="dupr"
          isDoubles
          allowSinglesFallback
          maxDupr={duprMax}
          onConnectDupr={() => setShowSso(true)}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0, lineHeight: 1.5 }}>{txt.oneTapHint}</p>
        <button
          type="button"
          className="tl-btn green"
          onClick={handleOneTap}
          disabled={isRegisteringExisting || isLoadingRoster || !duprEligible}
        >
          {(isRegisteringExisting || isLoadingRoster) && <Loader2 className="h-4 w-4 animate-spin" />}
          {txt.register(singleTeam!.team_name)}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onOpenDialog('use-existing')}
        style={{
          alignSelf: 'flex-start',
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 12.5,
          color: 'var(--tl-fg-3)',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {txt.otherTeam}
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

function Row({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0, lineHeight: 1.5 }}>{hint}</p>
      {children}
    </div>
  );
}
