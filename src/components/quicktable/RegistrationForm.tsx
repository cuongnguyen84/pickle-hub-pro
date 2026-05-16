import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRegistration, type RegistrationFormData, type Registration, type SkillRatingSystem } from '@/hooks/useRegistration';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, CheckCircle2, Clock, XCircle, AlertCircle, LogIn, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation, useI18n } from '@/i18n';

interface RegistrationFormProps {
  tableId: string;
  tableName: string;
  requiresSkillLevel?: boolean;
  registrationMessage?: string | null;
  existingRegistration?: Registration | null;
  onRegistrationComplete?: () => void;
}

// W2.1b — design tokens shared across both registration forms. Pulled
// out as constants so refresh of RegistrationForm + DoublesRegistrationForm
// stays mechanically consistent.

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

const fieldHelpText: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--tl-fg-3)',
  margin: '4px 0 0',
  lineHeight: 1.5,
};

const requiredMarker: React.CSSProperties = {
  color: 'var(--tl-green)',
  marginLeft: 2,
};

// Status banner style. Variant picks the colour: green-glow for
// approved, gold for pending, live-red for rejected.
const statusBannerStyle = (variant: 'approved' | 'pending' | 'rejected'): React.CSSProperties => {
  if (variant === 'approved') {
    return {
      background: 'var(--tl-green-glow)',
      border: '1px solid rgba(0, 185, 107, 0.30)',
      color: 'var(--tl-green)',
    };
  }
  if (variant === 'pending') {
    return {
      background: 'rgba(233, 182, 73, 0.10)',
      border: '1px solid rgba(233, 182, 73, 0.30)',
      color: 'var(--tl-gold)',
    };
  }
  return {
    background: 'rgba(255, 65, 54, 0.10)',
    border: '1px solid rgba(255, 65, 54, 0.30)',
    color: 'var(--tl-live)',
  };
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

export function RegistrationForm({
  tableId,
  tableName,
  requiresSkillLevel = true,
  registrationMessage,
  existingRegistration,
  onRegistrationComplete,
}: RegistrationFormProps) {
  const { user } = useAuth();
  const t = useTranslation();
  const { language } = useI18n();
  const { submitRegistration, cancelRegistration, loading } = useRegistration();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState(existingRegistration?.display_name || '');
  const [team, setTeam] = useState(existingRegistration?.team || '');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>(
    existingRegistration?.rating_system || 'none',
  );
  const [skillLevel, setSkillLevel] = useState(existingRegistration?.skill_level?.toString() || '');
  const [skillSystemName, setSkillSystemName] = useState(existingRegistration?.skill_system_name || '');
  const [skillDescription, setSkillDescription] = useState(existingRegistration?.skill_description || '');
  const [profileLink, setProfileLink] = useState(existingRegistration?.profile_link || '');

  const handleLoginClick = () => {
    const returnUrl = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

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
        <button
          type="button"
          className="tl-btn green"
          onClick={handleLoginClick}
        >
          <LogIn className="w-4 h-4" />
          {t.quickTable.login}
        </button>
      </div>
    );
  }

  // ─── State 2: Approved ─────────────────────────────────────────────────
  if (existingRegistration && existingRegistration.status === 'approved') {
    return (
      <div style={{ ...surfaceCard, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <CheckCircle2 className="w-12 h-12" style={{ color: 'var(--tl-green)', margin: '0 auto 12px' }} />
          <h3 style={{ ...sectionTitle, marginBottom: 4 }}>
            {t.quickTable.registration.approvedTitle}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', margin: 0 }}>
            {t.quickTable.registration.approvedDesc}{' '}
            <strong style={{ color: 'var(--tl-fg)' }}>{tableName}</strong>.
          </p>
          <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', marginTop: 8 }}>
            {t.quickTable.registration.approvedWaiting}
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--tl-border)', paddingTop: 18 }}>
          <h4 style={{ ...fieldLabel, marginBottom: 12 }}>
            {t.quickTable.registration.infoTitle}
          </h4>
          <RegistrationInfo registration={existingRegistration} t={t} />
        </div>
      </div>
    );
  }

  // ─── State 3: Rejected ─────────────────────────────────────────────────
  if (existingRegistration && existingRegistration.status === 'rejected') {
    return (
      <div style={{ ...surfaceCard, padding: '40px 28px', textAlign: 'center' }}>
        <XCircle className="w-12 h-12" style={{ color: 'var(--tl-live)', margin: '0 auto 12px' }} />
        <h3 style={{ ...sectionTitle, marginBottom: 4 }}>
          {t.quickTable.registration.rejected}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', margin: 0 }}>
          {t.quickTable.registration.rejected}
        </p>
      </div>
    );
  }

  // ─── State 4: Pending ──────────────────────────────────────────────────
  if (existingRegistration && existingRegistration.status === 'pending') {
    return (
      <div style={{ ...surfaceCard, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Clock className="w-12 h-12" style={{ color: 'var(--tl-gold)', margin: '0 auto 12px' }} />
          <h3 style={{ ...sectionTitle, marginBottom: 4 }}>
            {t.quickTable.registration.pendingTitle}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', margin: 0 }}>
            {t.quickTable.registration.pendingDesc}
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--tl-border)', paddingTop: 18, marginBottom: 24 }}>
          <h4 style={{ ...fieldLabel, marginBottom: 12 }}>
            {t.quickTable.registration.infoTitle}
          </h4>
          <RegistrationInfo registration={existingRegistration} t={t} />
        </div>

        <button
          type="button"
          className="tl-btn"
          onClick={async () => {
            if (confirm(t.quickTable.registration.cancelConfirm)) {
              await cancelRegistration(existingRegistration.id);
              onRegistrationComplete?.();
            }
          }}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', color: 'var(--tl-live)' }}
        >
          {t.quickTable.registration.cancelRegistration}
        </button>
      </div>
    );
  }

  // ─── State 5: New registration form ────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) return;
    if (ratingSystem === 'other' && !skillSystemName.trim()) return;
    if (requiresSkillLevel && ratingSystem === 'none' && !skillDescription.trim()) return;

    const formData: RegistrationFormData = {
      display_name: displayName,
      team: team || undefined,
      rating_system: ratingSystem,
      skill_level: skillLevel ? parseFloat(skillLevel) : undefined,
      skill_description: ratingSystem === 'none' ? skillDescription : undefined,
      skill_system_name: ratingSystem === 'other' ? skillSystemName : undefined,
      profile_link: profileLink || undefined,
    };

    const result = await submitRegistration(tableId, formData);
    if (result) {
      onRegistrationComplete?.();
    }
  };

  const skillDescOptions = t.quickTable.skillDescOptions;
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
          <h2 style={sectionTitle}>{t.quickTable.registration.title}</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
          {t.quickTable.registerDesc}{' '}
          <strong style={{ color: 'var(--tl-fg)' }}>{tableName}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {registrationMessage && (
          <div
            style={{
              ...statusBannerStyle('pending'),
              padding: 14,
              borderRadius: 'var(--tl-radius)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <AlertCircle className="w-4 h-4" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
              {registrationMessage}
            </p>
          </div>
        )}

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

        {/* Skill Level — DUPR-ready field group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Label style={fieldLabel}>
            {t.quickTable.registration.skillLevel}
            {requiresSkillLevel && <span style={requiredMarker}>*</span>}
          </Label>

          {/* Custom radio cards — keeps the radio-input semantics intact
              for screen readers + form binding, but renders token-styled
              labels. Stays within the existing rating_system state shape. */}
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

          {/* DUPR rating input — slot for the upcoming integration. The
              input shape stays as-is; the DUPR integration will populate
              skill_level + profile_link via API rather than user typing. */}
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
                <Label htmlFor="skillSystemName" style={fieldLabel}>
                  {t.quickTable.registration.systemName}
                  <span style={requiredMarker}>*</span>
                </Label>
                <Input
                  id="skillSystemName"
                  name="skillSystemName"
                  value={skillSystemName}
                  onChange={(e) => setSkillSystemName(e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="profileLinkOther" style={fieldLabel}>
                  {t.quickTable.registration.duprLink}
                </Label>
                <Input
                  id="profileLinkOther"
                  name="profileLink"
                  type="url"
                  value={profileLink}
                  onChange={(e) => setProfileLink(e.target.value)}
                  placeholder={t.quickTable.exampleDuprLink}
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
                  <span style={requiredMarker}>*</span>
                </Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {skillDescOptions.map((desc) => (
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

        {/* Disclaimer */}
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
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--tl-fg-3)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
            {t.quickTable.registration.disclaimer}
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="tl-btn green"
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? t.quickTable.registration.submitting : t.quickTable.registration.submit}
        </button>
      </form>
    </div>
  );
}

// Helper component for displaying registration info — refreshed visual
// with token table rows.
function RegistrationInfo({ registration, t }: { registration: Registration; t: any }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: t.quickTable.registration.infoName,
      value: registration.display_name,
    },
  ];
  if (registration.team) {
    rows.push({ label: t.quickTable.registration.teamClub, value: registration.team });
  }
  rows.push({
    label: t.quickTable.registration.skillLevel,
    value: (() => {
      if (registration.rating_system === 'DUPR') {
        return (
          <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
            DUPR {registration.skill_level ?? ''}
          </span>
        );
      }
      if (registration.rating_system === 'other') {
        return (
          <>
            {registration.skill_system_name || t.quickTable.registration.otherSystem}
            {registration.skill_level ? `: ${registration.skill_level}` : ''}
          </>
        );
      }
      return registration.skill_description || t.quickTable.registration.noRating;
    })(),
  });

  return (
    <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0 }}>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            fontSize: 13,
          }}
        >
          <dt
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {r.label}
          </dt>
          <dd
            style={{
              color: 'var(--tl-fg)',
              margin: 0,
              textAlign: 'right',
            }}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default RegistrationForm;
