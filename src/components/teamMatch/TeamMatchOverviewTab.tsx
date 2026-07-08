import { useEffect, useState } from 'react';
import { Mail, LayoutGrid, Trophy, Play, AlertTriangle, MapPin, Gauge, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  RegisteredTeamsSummary,
  TeamOverviewCard,
  AllTeamsOverview,
} from '@/components/teamMatch';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

// ─── W2.4b shared tokens (mirror MatchList/PlayoffBracket from #103) ─────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const sectionDescription: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--tl-fg-2)',
  marginTop: 4,
};

const warningStripe: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginTop: 12,
  padding: '8px 10px',
  borderRadius: 'var(--tl-radius)',
  background: 'rgba(233, 182, 73, 0.08)',
  border: '1px solid rgba(233, 182, 73, 0.35)',
  color: 'var(--tl-fg-2)',
  fontSize: 12.5,
};

// Đồng hồ đếm ngược tới 00:00 ngày tổ chức — 4 ô Ngày/Giờ/Phút/Giây, tick mỗi giây.
function CountdownChips({ target, language }: { target: Date; language: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target.getTime() - now;
  if (diff <= 0) return null;
  const values = [
    Math.floor(diff / 86400000),
    Math.floor(diff / 3600000) % 24,
    Math.floor(diff / 60000) % 60,
    Math.floor(diff / 1000) % 60,
  ];
  const units = language === 'vi' ? ['Ngày', 'Giờ', 'Phút', 'Giây'] : ['Days', 'Hrs', 'Min', 'Sec'];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {values.map((v, i) => (
        <div
          key={units[i]}
          style={{
            flex: 1,
            maxWidth: 84,
            textAlign: 'center',
            padding: '10px 0 8px',
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-green-glow)',
            border: '1px solid rgba(0, 185, 107, 0.30)',
          }}
        >
          <div
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--tl-green)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {String(v).padStart(2, '0')}
          </div>
          <div
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--tl-fg-3)',
              marginTop: 4,
            }}
          >
            {units[i]}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TeamMatchOverviewTabProps {
  tournament: {
    id: string;
    format: string;
    status: string;
    team_roster_size: number;
    team_count: number;
    top_per_group?: number;
    event_date?: string | null;
    location?: string | null;
    require_dupr?: boolean;
    dupr_max_male?: number | null;
    dupr_max_female?: number | null;
  };
  isOwner: boolean;
  userTeam: TeamMatchTeam | null;
  displayTeams: TeamMatchTeam[];
  hasMatches: boolean;
  hasGroups: boolean;
  approvedTeamsCount: number;
  pendingTeamsCount: number;
  canStartGroupSetup: boolean;
  onTeamClick: (team: TeamMatchTeam) => void;
  onGenerateMatches: () => void;
  onShowInviteTeam: () => void;
  onShowGroupSetup: () => void;
  onShowSESetup: () => void;
}

export function TeamMatchOverviewTab({
  tournament,
  isOwner,
  userTeam,
  displayTeams,
  hasMatches,
  hasGroups,
  approvedTeamsCount,
  pendingTeamsCount,
  canStartGroupSetup,
  onTeamClick,
  onGenerateMatches,
  onShowInviteTeam,
  onShowGroupSetup,
  onShowSESetup,
}: TeamMatchOverviewTabProps) {
  const { t, language } = useI18n();
  const isGroupPlayoffFormat = tournament.format === 'rr_playoff';
  const isSingleElimination = tournament.format === 'single_elimination';

  // Thanh slot: đội đã đăng ký (chưa bị từ chối) / tổng slot BTC cài đặt.
  const totalSlots = tournament.team_count;
  const filledSlots = displayTeams.length;
  const slotPct = totalSlots > 0 ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : 0;
  const eventTarget = tournament.event_date ? new Date(`${tournament.event_date}T00:00:00`) : null;
  const eventIsToday = eventTarget ? eventTarget.toDateString() === new Date().toDateString() : false;
  const fmtDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  const duprText = tournament.require_dupr
    ? language === 'vi'
      ? `DUPR Nam ≤ ${(tournament.dupr_max_male ?? 0).toFixed(2)} · Nữ ≤ ${(tournament.dupr_max_female ?? 0).toFixed(2)}`
      : `DUPR Male ≤ ${(tournament.dupr_max_male ?? 0).toFixed(2)} · Female ≤ ${(tournament.dupr_max_female ?? 0).toFixed(2)}`
    : null;

  const infoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13.5,
    color: 'var(--tl-fg-2)',
  };

  const renderActionCard = (
    description: string,
    actions: React.ReactNode,
    warnings: string[] = [],
  ) => (
    <section style={{ ...surfaceCard, padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h3 style={sectionTitle}>{t.teamMatch.view.btcActionsTitle}</h3>
        <p style={sectionDescription}>{description}</p>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {actions}
      </div>
      {warnings.map((msg, idx) => (
        <div key={idx} style={warningStripe}>
          <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: 'var(--tl-gold)', flexShrink: 0 }} />
          <span>{msg}</span>
        </div>
      ))}
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Thời gian & địa điểm — highlight + đếm ngược tới ngày tổ chức */}
      {(tournament.event_date || tournament.location) && (
        <section style={{ ...surfaceCard, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--tl-green)',
            }}
          >
            ◆ {language === 'vi' ? 'Thời gian & địa điểm' : 'When & where'}
          </div>
          {tournament.event_date && (
            <div
              style={{
                fontFamily: 'Instrument Serif, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 24,
                letterSpacing: '-0.015em',
                lineHeight: 1.15,
                color: 'var(--tl-fg)',
              }}
            >
              {fmtDate(tournament.event_date)}
            </div>
          )}
          {eventTarget && eventTarget.getTime() > Date.now() && (
            <CountdownChips target={eventTarget} language={language} />
          )}
          {eventIsToday && (
            <span
              style={{
                alignSelf: 'flex-start',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--tl-green)',
                background: 'var(--tl-green-glow)',
                borderRadius: 999,
                padding: '5px 12px',
              }}
            >
              {language === 'vi' ? '🎾 Hôm nay!' : '🎾 Today!'}
            </span>
          )}
          {tournament.location && (
            <div style={{ ...infoRowStyle, fontSize: 15.5, fontWeight: 600, color: 'var(--tl-fg)' }}>
              <MapPin className="h-4.5 w-4.5" style={{ width: 18, height: 18, color: 'var(--tl-green)', flexShrink: 0 }} />
              <span>{tournament.location}</span>
            </div>
          )}
        </section>
      )}

      {/* Thông tin giải: yêu cầu DUPR · thanh slot */}
      <section style={{ ...surfaceCard, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {duprText && (
          <div style={infoRowStyle}>
            <Gauge className="h-4 w-4" style={{ color: 'var(--tl-gold)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{duprText}</span>
          </div>
        )}
        <div>
          <div style={{ ...infoRowStyle, justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users className="h-4 w-4" style={{ color: 'var(--tl-green)', flexShrink: 0 }} />
              {language === 'vi' ? 'Slot đội' : 'Team slots'}
            </span>
            <strong style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13, color: filledSlots >= totalSlots ? 'var(--tl-live)' : 'var(--tl-fg)' }}>
              {filledSlots}/{totalSlots}
            </strong>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--tl-border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${slotPct}%`,
                borderRadius: 999,
                background: filledSlots >= totalSlots ? 'var(--tl-live)' : 'var(--tl-green)',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      </section>

      {userTeam && !isOwner && (
        <>
          <TeamOverviewCard
            team={userTeam}
            maxRosterSize={tournament.team_roster_size}
            totalTeamsRegistered={displayTeams.length}
          />
          <AllTeamsOverview
            teams={displayTeams}
            tournamentId={tournament.id}
            maxRosterSize={tournament.team_roster_size}
          />
        </>
      )}

      {isOwner && displayTeams.length > 0 && (
        <RegisteredTeamsSummary
          teams={displayTeams}
          maxRosterSize={tournament.team_roster_size}
          isOwner={isOwner}
          tournamentId={tournament.id}
          hasMatches={hasMatches}
          onTeamClick={onTeamClick}
          // Group/single-elim schedule from Chia bảng / bracket, not a flat
          // all-teams RR — only offer the flat generator for plain round robin.
          onGenerateMatches={isGroupPlayoffFormat || isSingleElimination ? undefined : onGenerateMatches}
        />
      )}

      {!isOwner && !userTeam && displayTeams.length > 0 && (
        <RegisteredTeamsSummary
          teams={displayTeams}
          maxRosterSize={tournament.team_roster_size}
          isOwner={false}
          tournamentId={tournament.id}
          onTeamClick={onTeamClick}
        />
      )}

      {/* Group Playoff format actions */}
      {isOwner && isGroupPlayoffFormat && tournament.status === 'registration' && !hasGroups && (
        renderActionCard(
          pendingTeamsCount > 0
            ? t.teamMatch.view.approvePendingFirst.replace('{count}', String(pendingTeamsCount))
            : t.teamMatch.view.inviteOrSchedule,
          (
            <>
              <button type="button" className="tl-btn" onClick={onShowInviteTeam}>
                <Mail className="h-4 w-4" />
                {t.teamMatch.view.inviteTeamBtn}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={onShowGroupSetup}
                disabled={!canStartGroupSetup}
                style={!canStartGroupSetup ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <LayoutGrid className="h-4 w-4" />
                {t.teamMatch.view.createGroupsBtn} ({approvedTeamsCount} {t.teamMatch.teams})
              </button>
            </>
          ),
          [
            ...(pendingTeamsCount > 0 ? [t.teamMatch.view.approveAllBeforeBracket] : []),
            ...(approvedTeamsCount < 6 && pendingTeamsCount === 0 ? [t.teamMatch.view.needMin6Groups] : []),
          ],
        )
      )}

      {/* Single Elimination format actions */}
      {isOwner && isSingleElimination && tournament.status === 'registration' && !hasMatches && (
        renderActionCard(
          pendingTeamsCount > 0
            ? t.teamMatch.view.approvePendingBracket.replace('{count}', String(pendingTeamsCount))
            : t.teamMatch.view.inviteOrBracket,
          (
            <>
              <button type="button" className="tl-btn" onClick={onShowInviteTeam}>
                <Mail className="h-4 w-4" />
                {t.teamMatch.view.inviteTeamBtn}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={onShowSESetup}
                disabled={pendingTeamsCount > 0 || approvedTeamsCount < 4}
                style={pendingTeamsCount > 0 || approvedTeamsCount < 4 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <Trophy className="h-4 w-4" />
                {t.teamMatch.view.generateBracketBtn} ({approvedTeamsCount} {t.teamMatch.teams})
              </button>
            </>
          ),
          pendingTeamsCount > 0 ? [t.teamMatch.view.approveAllBeforeBracket] : [],
        )
      )}

      {/* Round Robin format actions */}
      {isOwner && !isGroupPlayoffFormat && !isSingleElimination && tournament.status === 'registration' && !hasMatches && (
        renderActionCard(
          t.teamMatch.view.inviteOrSchedule,
          (
            <>
              <button type="button" className="tl-btn" onClick={onShowInviteTeam}>
                <Mail className="h-4 w-4" />
                {t.teamMatch.view.inviteTeamBtn}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={onGenerateMatches}
                disabled={approvedTeamsCount < 2}
                style={approvedTeamsCount < 2 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <Play className="h-4 w-4" />
                {t.teamMatch.view.createScheduleBtn}
              </button>
            </>
          ),
        )
      )}
    </div>
  );
}
