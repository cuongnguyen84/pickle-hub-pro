import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRegistration, type Team, type TeamFormData } from '@/hooks/useTeamRegistration';
import { usePairRequest, type PairRequest } from '@/hooks/usePairRequest';
import { useDuprConnection } from '@/hooks/useDuprConnection';
import type { SkillRatingSystem } from '@/hooks/useRegistration';
import { DuprEligibilityCheck } from '@/components/dupr/DuprEligibilityCheck';
import { DuprChip } from '@/components/dupr/DuprChip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  UserPlus, CheckCircle2, Clock, XCircle, AlertCircle, LogIn,
  Users, UserMinus, Handshake, Loader2, Bell,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation, useI18n } from '@/i18n';

interface DoublesRegistrationFormProps {
  tableId: string;
  tableName: string;
  shareId?: string;
  requiresSkillLevel?: boolean;
  registrationMessage?: string | null;
  existingTeam?: Team | null;
  allTeams?: Team[];
  tableStatus?: string;
  onRegistrationComplete?: () => void;
  // Sprint B1.4 — DUPR enforcement (table-level)
  ratingSource?: 'self' | 'dupr' | 'either';
  minDupr?: number | null;
  maxDupr?: number | null;
  isDoubles?: boolean;
  onConnectDupr?: () => void;
}

// ─── Shared tokens (mirror RegistrationForm.tsx) ─────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 22,
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

const requiredMarker: React.CSSProperties = {
  color: 'var(--tl-green)',
  marginLeft: 2,
};

const statusPillStyle = (kind: 'approved' | 'pending' | 'rejected' | 'info'): React.CSSProperties => {
  if (kind === 'approved') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'pending') return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
  if (kind === 'rejected') return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
  return { background: 'rgba(79, 155, 255, 0.12)', color: 'rgb(79, 155, 255)' };
};

const statusBannerStyle = (variant: 'approved' | 'pending' | 'rejected' | 'info'): React.CSSProperties => {
  if (variant === 'approved') {
    return {
      background: 'var(--tl-green-glow)',
      border: '1px solid rgba(0, 185, 107, 0.30)',
    };
  }
  if (variant === 'pending') {
    return {
      background: 'rgba(233, 182, 73, 0.10)',
      border: '1px solid rgba(233, 182, 73, 0.30)',
    };
  }
  if (variant === 'rejected') {
    return {
      background: 'rgba(255, 65, 54, 0.10)',
      border: '1px solid rgba(255, 65, 54, 0.30)',
    };
  }
  return {
    background: 'rgba(79, 155, 255, 0.10)',
    border: '1px solid rgba(79, 155, 255, 0.30)',
  };
};

const statusBannerIconColor = (variant: 'approved' | 'pending' | 'rejected' | 'info'): string => {
  if (variant === 'approved') return 'var(--tl-green)';
  if (variant === 'pending') return 'var(--tl-gold)';
  if (variant === 'rejected') return 'var(--tl-live)';
  return 'rgb(79, 155, 255)';
};

const skillDescPillStyle = (selected: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: 999,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11.5,
  fontWeight: 500,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  background: selected ? 'var(--tl-green-glow)' : 'transparent',
  border: `1px solid ${selected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
  color: selected ? 'var(--tl-green)' : 'var(--tl-fg-2)',
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
});

const ratingOptionStyle = (selected: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: 14,
  borderRadius: 'var(--tl-radius)',
  border: `1px solid ${selected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
  background: selected ? 'var(--tl-green-glow)' : 'var(--tl-bg)',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
});

const ratingRadioCircleStyle = (selected: boolean): React.CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: `2px solid ${selected ? 'var(--tl-green)' : 'var(--tl-border-2)'}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginTop: 2,
  background: selected ? 'var(--tl-green)' : 'transparent',
  transition: 'background 0.15s, border-color 0.15s',
});

const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// Inline status banner — shared by approved / pending / rejected / info
// states across the multiple flows in this component.
function StatusBanner({
  variant,
  icon,
  children,
}: {
  variant: 'approved' | 'pending' | 'rejected' | 'info';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...statusBannerStyle(variant),
        padding: 14,
        borderRadius: 'var(--tl-radius)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ color: statusBannerIconColor(variant), flexShrink: 0, marginTop: 2 }}>
        {icon}
      </span>
      <div style={{ fontSize: 13, color: 'var(--tl-fg-2)', flex: 1, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

export function DoublesRegistrationForm({
  tableId,
  tableName,
  shareId,
  requiresSkillLevel = true,
  registrationMessage,
  existingTeam,
  allTeams = [],
  tableStatus = 'setup',
  onRegistrationComplete,
  ratingSource = 'self',
  minDupr = null,
  maxDupr = null,
  isDoubles = true,
  onConnectDupr,
}: DoublesRegistrationFormProps) {
  const { user } = useAuth();
  const t = useTranslation();
  const { language } = useI18n();
  const { createTeam, removePartner, loading: teamLoading } = useTeamRegistration();
  const { data: duprConn } = useDuprConnection();
  const {
    getIncomingRequests,
    getOutgoingRequests,
    createPairRequest,
    respondToPairRequest,
    cancelPairRequest,
    loading: pairLoading,
  } = usePairRequest();
  const navigate = useNavigate();
  const location = useLocation();

  // Sprint B1.4 — DUPR enforcement helpers
  const allowDupr = ratingSource === 'dupr' || ratingSource === 'either';
  const enforceDupr = ratingSource === 'dupr';
  const userDupr = isDoubles ? duprConn?.doubles ?? null : duprConn?.singles ?? null;
  const hasSsoDupr = !!duprConn?.ssoConnected && userDupr != null;
  const userOutOfRange =
    userDupr != null &&
    ((minDupr != null && userDupr < minDupr) || (maxDupr != null && userDupr > maxDupr));

  const [displayName, setDisplayName] = useState('');
  const [team, setTeam] = useState('');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>(
    allowDupr && hasSsoDupr ? 'dupr' : 'none',
  );
  const [skillLevel, setSkillLevel] = useState(
    allowDupr && hasSsoDupr ? userDupr!.toFixed(2) : '',
  );
  const [skillDescription, setSkillDescription] = useState('');
  const [profileLink, setProfileLink] = useState('');
  const [otherSystemName, setOtherSystemName] = useState('');

  const [incomingRequests, setIncomingRequests] = useState<PairRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PairRequest[]>([]);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedTeamForPairing, setSelectedTeamForPairing] = useState<Team | null>(null);

  const loading = teamLoading || pairLoading;
  const isTableLocked = tableStatus !== 'setup';
  const youLabel = language === 'vi' ? 'Bạn' : 'You';

  useEffect(() => {
    if (existingTeam && user) {
      loadPairRequests();
    }
  }, [existingTeam, user]);

  const loadPairRequests = async () => {
    const [incoming, outgoing] = await Promise.all([
      getIncomingRequests(tableId),
      getOutgoingRequests(tableId),
    ]);
    setIncomingRequests(incoming);
    setOutgoingRequests(outgoing);
  };

  const handleLoginClick = () => {
    const returnUrl = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  const availableTeamsForPairing = allTeams.filter(t =>
    t.id !== existingTeam?.id &&
    t.player2_user_id === null &&
    t.team_status !== 'rejected' &&
    t.team_status !== 'removed' &&
    t.player1_user_id !== user?.id,
  );

  const handlePairRequest = (targetTeam: Team) => {
    setSelectedTeamForPairing(targetTeam);
    setConfirmDialogOpen(true);
  };

  const confirmPairRequest = async () => {
    if (!selectedTeamForPairing) return;

    const result = await createPairRequest(tableId, selectedTeamForPairing.id);
    if (result.success) {
      setConfirmDialogOpen(false);
      setSelectedTeamForPairing(null);
      loadPairRequests();
      onRegistrationComplete?.();
    }
  };

  const hasPendingRequestTo = (teamId: string) =>
    outgoingRequests.some(r => r.to_team_id === teamId);

  const hasIncomingRequestFrom = (teamId: string) =>
    incomingRequests.some(r => r.from_team_id === teamId);

  // ─── State 1: Not logged in ────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ ...surfaceCard, padding: '40px 28px', textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--tl-green-glow)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <LogIn className="w-7 h-7" style={{ color: 'var(--tl-green)' }} />
        </div>
        <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', marginBottom: 20, lineHeight: 1.5 }}>
          {t.quickTable.loginToRegister}
        </p>
        <button type="button" className="tl-btn green" onClick={handleLoginClick}>
          <LogIn className="w-4 h-4" />
          {t.quickTable.login}
        </button>
      </div>
    );
  }

  // ─── State 2: User is partner (player2) ────────────────────────────────
  if (existingTeam && existingTeam.player2_user_id === user.id) {
    const isApproved = existingTeam.btc_approved || existingTeam.team_status === 'approved';

    return (
      <div style={surfaceCard}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--tl-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Users className="w-5 h-5" style={{ color: 'var(--tl-green)' }} />
          <h2 style={sectionTitle}>{t.quickTable.yourTeam}</h2>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isApproved ? (
            <StatusBanner variant="approved" icon={<CheckCircle2 className="w-4 h-4" />}>
              <strong style={{ color: 'var(--tl-green)' }}>
                {t.quickTable.registration.approved}
              </strong>
            </StatusBanner>
          ) : (
            <StatusBanner variant="pending" icon={<Clock className="w-4 h-4" />}>
              <strong style={{ color: 'var(--tl-gold)' }}>
                {t.quickTable.registration.waitingApproval}
              </strong>
            </StatusBanner>
          )}

          <div
            style={{
              padding: 18,
              borderRadius: 'var(--tl-radius)',
              background: 'var(--tl-bg)',
              border: '1px solid var(--tl-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={fieldLabel}>{t.quickTable.statusHeader}</span>
              <TeamStatusPill status={existingTeam.team_status} btcApproved={existingTeam.btc_approved} t={t} />
            </div>

            <div style={{ borderTop: '1px solid var(--tl-border)' }} />

            <div>
              <p style={{ ...fieldLabel, marginBottom: 4 }}>{t.quickTable.teamLeader}</p>
              <p style={{ fontSize: 14, color: 'var(--tl-fg)', margin: 0 }}>
                {existingTeam.player1_display_name}
                {existingTeam.player1_team && (
                  <span style={{ color: 'var(--tl-fg-3)' }}> — {existingTeam.player1_team}</span>
                )}
              </p>
            </div>

            <div>
              <p style={{ ...fieldLabel, marginBottom: 4 }}>
                {t.quickTable.partner} ({youLabel})
              </p>
              <p style={{ fontSize: 14, color: 'var(--tl-fg)', margin: 0 }}>
                {existingTeam.player2_display_name}
                {existingTeam.player2_team && (
                  <span style={{ color: 'var(--tl-fg-3)' }}> — {existingTeam.player2_team}</span>
                )}
              </p>
            </div>
          </div>

          <StatusBanner variant="info" icon={<Users className="w-4 h-4" />}>
            {t.quickTable.waitingPartnerApproval} ({existingTeam.player1_display_name}) {t.quickTable.waitingForApproval}
          </StatusBanner>
        </div>
      </div>
    );
  }

  // ─── State 3: Team rejected / removed ──────────────────────────────────
  if (existingTeam && (existingTeam.team_status === 'rejected' || existingTeam.team_status === 'removed')) {
    return (
      <div style={{ ...surfaceCard, padding: '40px 28px', textAlign: 'center' }}>
        <XCircle className="w-12 h-12" style={{ color: 'var(--tl-live)', margin: '0 auto 12px' }} />
        <h3 style={{ ...sectionTitle, marginBottom: 4 }}>
          {t.quickTable.registration.rejected}
        </h3>
        {existingTeam.btc_notes && (
          <p style={{ fontSize: 14, color: 'var(--tl-fg-3)', marginTop: 8 }}>
            {t.quickTable.registration.rejectedMessage}: {existingTeam.btc_notes}
          </p>
        )}
      </div>
    );
  }

  // ─── State 4: User is team leader (player1) ────────────────────────────
  if (existingTeam && existingTeam.player1_user_id === user.id) {
    const hasPartner = existingTeam.player2_user_id !== null;
    const isApproved = existingTeam.btc_approved || existingTeam.team_status === 'approved';

    return (
      <div style={surfaceCard}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--tl-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Users className="w-5 h-5" style={{ color: 'var(--tl-green)' }} />
            <h2 style={sectionTitle}>{t.quickTable.yourTeam}</h2>
          </div>
          <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
            {t.quickTable.manageTeam}
          </p>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isApproved ? (
            <StatusBanner variant="approved" icon={<CheckCircle2 className="w-4 h-4" />}>
              <strong style={{ color: 'var(--tl-green)' }}>
                {t.quickTable.registration.approved}
              </strong>
            </StatusBanner>
          ) : (
            <StatusBanner variant="pending" icon={<Clock className="w-4 h-4" />}>
              <strong style={{ color: 'var(--tl-gold)' }}>
                {t.quickTable.registration.waitingApproval}
              </strong>
            </StatusBanner>
          )}

          {/* Incoming pair requests */}
          {incomingRequests.length > 0 && !hasPartner && (
            <StatusBanner variant="info" icon={<Bell className="w-4 h-4" />}>
              <div style={{ fontWeight: 600, color: 'rgb(79, 155, 255)', marginBottom: 10 }}>
                {t.quickTable.pairing.incomingRequests} ({incomingRequests.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: 10,
                      borderRadius: 'var(--tl-radius)',
                      background: 'var(--tl-bg-elev)',
                      border: '1px solid var(--tl-border)',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--tl-fg)' }}>
                      {req.from_team?.player1_display_name || (language === 'vi' ? 'VĐV' : 'Player')}
                      {req.from_team?.player1_team && (
                        <span style={{ color: 'var(--tl-fg-3)', marginLeft: 4 }}>
                          ({req.from_team.player1_team})
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="tl-btn green"
                        onClick={async () => {
                          const result = await respondToPairRequest(req.id, true);
                          if (result.success) {
                            onRegistrationComplete?.();
                            toast.success(t.quickTable.pairing.pairUp + '!');
                          }
                        }}
                        disabled={loading || isTableLocked}
                        style={{ padding: '5px 10px', fontSize: 12 }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {t.quickTable.pairing.accept}
                      </button>
                      <button
                        type="button"
                        className="tl-btn"
                        onClick={async () => {
                          const result = await respondToPairRequest(req.id, false);
                          if (result.success) {
                            loadPairRequests();
                          }
                        }}
                        disabled={loading || isTableLocked}
                        style={{ padding: '5px 10px', fontSize: 12 }}
                      >
                        <XCircle className="w-3 h-3" />
                        {t.quickTable.pairing.decline}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </StatusBanner>
          )}

          {/* Team status block */}
          <div
            style={{
              padding: 18,
              borderRadius: 'var(--tl-radius)',
              background: 'var(--tl-bg)',
              border: '1px solid var(--tl-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={fieldLabel}>{t.quickTable.statusHeader}</span>
              <TeamStatusPill status={existingTeam.team_status} btcApproved={existingTeam.btc_approved} t={t} />
            </div>

            <div style={{ borderTop: '1px solid var(--tl-border)' }} />

            <div>
              <p style={{ ...fieldLabel, marginBottom: 4 }}>
                {t.quickTable.teamLeader.replace(' (Đội trưởng)', '').replace(' (Team Leader)', '')} ({youLabel})
              </p>
              <p style={{ fontSize: 14, color: 'var(--tl-fg)', margin: 0 }}>
                {existingTeam.player1_display_name}
                {existingTeam.player1_team && (
                  <span style={{ color: 'var(--tl-fg-3)' }}> — {existingTeam.player1_team}</span>
                )}
              </p>
            </div>

            <div>
              <p style={{ ...fieldLabel, marginBottom: 4 }}>{t.quickTable.partner}</p>
              {hasPartner ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 14, color: 'var(--tl-fg)', margin: 0 }}>
                    {existingTeam.player2_display_name}
                    {existingTeam.player2_team && (
                      <span style={{ color: 'var(--tl-fg-3)' }}> — {existingTeam.player2_team}</span>
                    )}
                  </p>
                  {!isTableLocked && (
                    <button
                      type="button"
                      className="tl-btn"
                      onClick={async () => {
                        if (confirm(t.quickTable.removePartnerConfirm)) {
                          const success = await removePartner(existingTeam.id);
                          if (success) onRegistrationComplete?.();
                        }
                      }}
                      disabled={loading}
                      style={{ padding: '5px 10px', fontSize: 12, color: 'var(--tl-live)' }}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      {t.quickTable.remove}
                    </button>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--tl-gold)', margin: 0, fontWeight: 500 }}>
                  {t.quickTable.pairing.noPartner}
                </p>
              )}
            </div>
          </div>

          {/* Outgoing requests */}
          {outgoingRequests.length > 0 && !hasPartner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ ...fieldLabel, margin: 0 }}>
                {t.quickTable.pairing.outgoingRequests}
              </p>
              {outgoingRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 'var(--tl-radius)',
                    background: 'var(--tl-bg)',
                    border: '1px solid var(--tl-border)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--tl-fg-2)' }}>
                    {t.quickTable.pairing.waitingConfirm}:{' '}
                    <strong style={{ color: 'var(--tl-fg)' }}>{req.to_team?.player1_display_name}</strong>
                  </span>
                  <button
                    type="button"
                    className="tl-btn"
                    onClick={async () => {
                      const success = await cancelPairRequest(req.id);
                      if (success) loadPairRequests();
                    }}
                    disabled={loading}
                    style={{ padding: '4px 10px', fontSize: 12, color: 'var(--tl-live)' }}
                  >
                    {t.quickTable.pairing.cancel}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Available players for pairing */}
          {!hasPartner && !isTableLocked && availableTeamsForPairing.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ borderTop: '1px solid var(--tl-border)' }} />
              <h4
                style={{
                  ...sectionTitle,
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Handshake className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
                {t.quickTable.pairing.availablePlayers} ({availableTeamsForPairing.length})
              </h4>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {availableTeamsForPairing.map((tm) => {
                  const hasSentRequest = hasPendingRequestTo(tm.id);
                  const hasReceivedRequest = hasIncomingRequestFrom(tm.id);
                  const approved = tm.btc_approved || tm.team_status === 'approved';

                  return (
                    <div
                      key={tm.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: 12,
                        borderRadius: 'var(--tl-radius)',
                        background: 'var(--tl-bg)',
                        border: '1px solid var(--tl-border)',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            fontFamily: 'Instrument Serif, serif',
                            fontStyle: 'italic',
                            fontWeight: 400,
                            fontSize: 16,
                            color: 'var(--tl-fg)',
                            margin: 0,
                          }}
                        >
                          {tm.player1_display_name}
                        </p>
                        {tm.player1_team && (
                          <p
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 11,
                              color: 'var(--tl-fg-3)',
                              letterSpacing: '0.02em',
                              margin: '2px 0 0',
                            }}
                          >
                            {tm.player1_team}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {approved && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontSize: 10,
                                fontWeight: 500,
                                padding: '2px 7px',
                                borderRadius: 4,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                ...statusPillStyle('approved'),
                              }}
                            >
                              {t.quickTable.approved}
                            </span>
                          )}
                          {tm.player1_skill_level && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontSize: 10,
                                fontWeight: 500,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: 'var(--tl-surface)',
                                color: 'var(--tl-fg-2)',
                                border: '1px solid var(--tl-border)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {tm.player1_rating_system}: {tm.player1_skill_level}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasSentRequest ? (
                        <span
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontSize: 10.5,
                            fontWeight: 500,
                            padding: '3px 9px',
                            borderRadius: 4,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            ...statusPillStyle('pending'),
                          }}
                        >
                          {t.quickTable.pairing.waitingConfirm}
                        </span>
                      ) : hasReceivedRequest ? (
                        <span
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontSize: 10.5,
                            fontWeight: 500,
                            padding: '3px 9px',
                            borderRadius: 4,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            ...statusPillStyle('info'),
                          }}
                        >
                          {t.quickTable.pairing.waitingYourConfirm}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="tl-btn green"
                          onClick={() => handlePairRequest(tm)}
                          disabled={loading}
                          style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
                        >
                          <Handshake className="w-3.5 h-3.5" />
                          {t.quickTable.pairing.pairUp}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isTableLocked && (
            <StatusBanner variant="info" icon={<AlertCircle className="w-4 h-4" />}>
              {t.quickTable.pairing.teamLocked}
            </StatusBanner>
          )}
        </div>

        {/* Confirm pair dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.quickTable.pairing.confirmPair}</DialogTitle>
              <DialogDescription>
                {t.quickTable.pairing.confirmPairWith}{' '}
                <strong style={{ color: 'var(--tl-fg)' }}>
                  {selectedTeamForPairing?.player1_display_name}
                </strong>?
                {selectedTeamForPairing?.player1_team && (
                  <span> ({selectedTeamForPairing.player1_team})</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                className="tl-btn"
                onClick={() => setConfirmDialogOpen(false)}
              >
                {t.quickTable.pairing.cancel}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={confirmPairRequest}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.quickTable.pairing.sending}
                  </>
                ) : (
                  t.quickTable.pairing.confirm
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── State 5: New registration form ────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) return;

    if (ratingSystem === 'other' && !otherSystemName.trim()) {
      toast.error(t.quickTable.registration.systemName);
      return;
    }

    // Sprint B1.4 fix — enforce DUPR gates on doubles too
    if (enforceDupr && !hasSsoDupr) {
      toast.error(
        language === 'vi'
          ? 'Cần kết nối DUPR để đăng ký giải này'
          : 'You must connect DUPR to register for this tournament',
      );
      return;
    }
    if (userOutOfRange) {
      toast.error(
        language === 'vi'
          ? `DUPR của bạn (${userDupr!.toFixed(2)}) ngoài giới hạn của giải`
          : `Your DUPR (${userDupr!.toFixed(2)}) is outside the tournament range`,
      );
      return;
    }

    const formData: TeamFormData = {
      display_name: displayName,
      team: team || undefined,
      rating_system: ratingSystem,
      skill_level: skillLevel ? parseFloat(skillLevel) : undefined,
      profile_link: ratingSystem === 'other'
        ? `[${otherSystemName.trim()}] ${profileLink || ''}`.trim()
        : profileLink || undefined,
    };

    const result = await createTeam(tableId, formData);
    if (result) {
      onRegistrationComplete?.();
    }
  };

  const duprScoreLabel = `${t.quickTable.registration.duprScore} ${language === 'vi' ? '(VD: 3.25, 4.1)' : '(e.g. 3.25, 4.1)'}`;

  const ratingOptions: Array<{ value: SkillRatingSystem; title: string; desc: string }> = [
    {
      value: 'DUPR',
      title: t.quickTable.registration.dupr,
      desc: t.quickTable.registration.duprDesc,
    },
    {
      value: 'other',
      title: t.quickTable.registration.otherSystem,
      desc: t.quickTable.registration.otherSystemDesc,
    },
    {
      value: 'none',
      title: t.quickTable.registration.noRating,
      desc: t.quickTable.registration.noRatingDesc,
    },
  ];

  return (
    <div style={surfaceCard}>
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--tl-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <UserPlus className="w-5 h-5" style={{ color: 'var(--tl-green)' }} />
          <h2 style={sectionTitle}>{t.quickTable.registration.doublesTitle}</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
          {t.quickTable.registerDesc}{' '}
          <strong style={{ color: 'var(--tl-fg)' }}>{tableName}</strong>.{' '}
          {t.quickTable.registration.afterRegisterNote}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {registrationMessage && (
          <StatusBanner variant="pending" icon={<AlertCircle className="w-4 h-4" />}>
            {registrationMessage}
          </StatusBanner>
        )}

        {/* Sprint B1.4 fix — DUPR eligibility check (auto detect + verdict) */}
        <DuprEligibilityCheck
          ratingSource={ratingSource}
          isDoubles={isDoubles}
          minDupr={minDupr}
          maxDupr={maxDupr}
          onConnectDupr={onConnectDupr}
        />

        {/* Basic Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="space-y-2">
            <Label htmlFor="displayName" style={fieldLabel}>
              {t.quickTable.registration.displayName}
              <span style={requiredMarker}>*</span>
            </Label>
            <Input
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t.quickTable.registration.displayName}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team" style={fieldLabel}>
              {t.quickTable.registration.teamClub}
            </Label>
            <Input
              id="team"
              name="team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder={t.quickTable.exampleClub}
            />
          </div>
        </div>

        {/* Skill Level — DUPR-ready group.
            Sprint B1.4 fix (2026-05-27) — when the table is `dupr`-required,
            the user's rating has already been auto-fetched + verified by
            <DuprEligibilityCheck> above, so this picker is redundant and
            confusing. Hide it. Either + Self still render it. */}
        {ratingSource !== 'dupr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Label style={fieldLabel}>
            {t.quickTable.registration.skillLevel}
            {requiresSkillLevel && <span style={requiredMarker}>*</span>}
          </Label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ratingOptions.map((opt) => {
              const selected = ratingSystem === opt.value;
              return (
                <label
                  key={opt.value}
                  htmlFor={`rating-${opt.value}`}
                  style={ratingOptionStyle(selected)}
                >
                  <input
                    type="radio"
                    id={`rating-${opt.value}`}
                    name="ratingSystem"
                    value={opt.value}
                    checked={selected}
                    onChange={(e) => setRatingSystem(e.target.value as SkillRatingSystem)}
                    style={visuallyHiddenStyle}
                  />
                  <span style={ratingRadioCircleStyle(selected)}>
                    {selected && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--tl-bg)',
                        }}
                      />
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'Instrument Serif, serif',
                        fontStyle: 'italic',
                        fontWeight: 400,
                        fontSize: 17,
                        letterSpacing: '-0.01em',
                        color: 'var(--tl-fg)',
                        marginBottom: 2,
                      }}
                    >
                      {opt.title}
                    </div>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: 'var(--tl-fg-3)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {opt.desc}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {ratingSystem === 'DUPR' && (
            <div
              style={{
                paddingLeft: 16,
                borderLeft: '2px solid var(--tl-green)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="skillLevel" style={fieldLabel}>
                  {duprScoreLabel}
                </Label>
                <Input
                  id="skillLevel"
                  name="skillLevel"
                  type="number"
                  step="0.01"
                  min="1"
                  max="8"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  placeholder="3.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileLink" style={fieldLabel}>
                  {t.quickTable.registration.duprLink}
                </Label>
                <Input
                  id="profileLink"
                  name="profileLink"
                  type="url"
                  value={profileLink}
                  onChange={(e) => setProfileLink(e.target.value)}
                  placeholder={t.quickTable.exampleDuprLink}
                />
              </div>
            </div>
          )}

          {ratingSystem === 'other' && (
            <div
              style={{
                paddingLeft: 16,
                borderLeft: '2px solid var(--tl-green)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="otherSystemName" style={fieldLabel}>
                  {t.quickTable.registration.systemName}
                  <span style={requiredMarker}>*</span>
                </Label>
                <Input
                  id="otherSystemName"
                  name="otherSystemName"
                  value={otherSystemName}
                  onChange={(e) => setOtherSystemName(e.target.value)}
                  placeholder={t.quickTable.registration.systemNamePlaceholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillLevelOther" style={fieldLabel}>
                  {t.quickTable.registration.skillScore}
                </Label>
                <Input
                  id="skillLevelOther"
                  name="skillLevel"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  placeholder={t.quickTable.registration.skillScore}
                />
              </div>
            </div>
          )}

          {ratingSystem === 'none' && (
            <div
              style={{
                paddingLeft: 16,
                borderLeft: '2px solid var(--tl-green)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="skillDescription" style={fieldLabel}>
                  {t.quickTable.registration.skillDescription}
                </Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {t.quickTable.skillDescOptions.map((desc: string) => (
                    <span
                      key={desc}
                      onClick={() => setSkillDescription(desc)}
                      style={skillDescPillStyle(skillDescription === desc)}
                    >
                      {desc}
                    </span>
                  ))}
                </div>
                <Textarea
                  id="skillDescription"
                  name="skillDescription"
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  placeholder={t.quickTable.exampleSkillDesc}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
        )}

        {/* After-register note */}
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-bg)',
            border: '1px dashed var(--tl-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <Users className="w-4 h-4" style={{ color: 'var(--tl-green)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
            {t.quickTable.registration.afterRegisterNote}
          </p>
        </div>

        {/* Submit — Sprint B1.4 fix disables when DUPR rules block submit */}
        <button
          type="submit"
          className="tl-btn green"
          disabled={loading || userOutOfRange || (enforceDupr && !hasSsoDupr)}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? t.quickTable.registration.submitting : t.quickTable.registration.submit}
        </button>
      </form>
    </div>
  );
}

// W2.1b — token status pill for team state. Mirrors the anchor pattern
// from W2.1a RegisteredPlayersList so the visual language stays unified.
function TeamStatusPill({
  status,
  btcApproved,
  t,
}: {
  status: string;
  btcApproved: boolean;
  t: any;
}) {
  const baseStyle: React.CSSProperties = {
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
    whiteSpace: 'nowrap',
  };

  if (status === 'approved' || btcApproved) {
    return (
      <span style={{ ...baseStyle, ...statusPillStyle('approved') }}>
        <CheckCircle2 className="w-3 h-3" />
        {t.quickTable.approved}
      </span>
    );
  }
  if (status === 'rejected' || status === 'removed') {
    return (
      <span style={{ ...baseStyle, ...statusPillStyle('rejected') }}>
        <XCircle className="w-3 h-3" />
        {t.quickTable.rejected}
      </span>
    );
  }
  return (
    <span style={{ ...baseStyle, ...statusPillStyle('pending') }}>
      <Clock className="w-3 h-3" />
      {t.quickTable.pending}
    </span>
  );
}

export default DoublesRegistrationForm;
