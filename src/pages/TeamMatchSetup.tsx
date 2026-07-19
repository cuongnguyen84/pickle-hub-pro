import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft';
import { DraftRestoredBanner, DraftSaveStatus } from '@/components/wizard/DraftAutosave';
import { completeJourney, startJourney, trackJourneyStep } from '@/lib/journeys';
import { TheLineLayout } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Check, Info, Users, Gamepad2, Zap, Trophy, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMatch, CreateTournamentInput, DiscountTier } from '@/hooks/useTeamMatch';
import { GameTemplateEditor, GameTemplateItem, getDefaultTemplates } from '@/components/teamMatch/GameTemplateEditor';
import { VN_BANKS } from '@/lib/payment/banks';
import { generateVietQRUrl } from '@/lib/payment/vietqr';
import { normalizeAccountName } from '@/components/social/create-event/types';
import { useI18n } from '@/i18n';
import { getLoginUrl } from '@/lib/auth-config';
import { SetupBreadcrumb, SetupPageHead, SetupLoginGate } from '@/components/tournament/SetupShell';
import { surfaceCard, stepKickerStyle } from '@/components/tournament/setup-styles';

type Step = 1 | 2 | 3 | 4 | 5;

const isPowerOfTwo = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

const ROSTER_SIZE_OPTIONS = [
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
];

// TM keeps its local heading/desc variants (26px serif + mono caps desc) —
// the shared setup-styles tokens are the QT/Flex/DE 28px/prose variant.
const stepHeadingStyle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 26,
  letterSpacing: '-0.015em',
  lineHeight: 1.05,
  margin: 0,
  color: 'var(--tl-fg)',
};

// Token-styled toggle row (replaces "rounded-lg border p-4")
const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: 16,
  borderRadius: 'var(--tl-radius)',
  background: 'var(--tl-bg)',
  border: '1px solid var(--tl-border)',
};

// Token-styled info card (replaces ad-hoc bg-muted/50 / bg-amber-500/10 etc.)
const infoCardStyle = (variant: 'neutral' | 'warning' | 'success' | 'destructive'): React.CSSProperties => {
  if (variant === 'warning') {
    return {
      background: 'rgba(233, 182, 73, 0.10)',
      border: '1px solid rgba(233, 182, 73, 0.30)',
    };
  }
  if (variant === 'success') {
    return {
      background: 'var(--tl-green-glow)',
      border: '1px solid rgba(0, 185, 107, 0.30)',
    };
  }
  if (variant === 'destructive') {
    return {
      background: 'rgba(255, 65, 54, 0.10)',
      border: '1px solid rgba(255, 65, 54, 0.30)',
    };
  }
  return {
    background: 'var(--tl-bg)',
    border: '1px solid var(--tl-border)',
  };
};

const infoCardIconColor = (variant: 'neutral' | 'warning' | 'success' | 'destructive'): string => {
  if (variant === 'warning') return 'var(--tl-gold)';
  if (variant === 'success') return 'var(--tl-green)';
  if (variant === 'destructive') return 'var(--tl-live)';
  return 'var(--tl-fg-3)';
};

export default function TeamMatchSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { createTournament, isCreating } = useTeamMatch();

  const STEPS = [
    { id: 1, title: t.teamMatch.setup.stepBasicInfo, icon: Users },
    { id: 2, title: t.teamMatch.setup.stepGameTemplates, icon: Gamepad2 },
    { id: 3, title: t.teamMatch.setup.stepDreambreaker, icon: Zap },
    { id: 4, title: t.teamMatch.setup.stepFormat, icon: Trophy },
    { id: 5, title: language === 'vi' ? 'Lệ phí' : 'Fees', icon: CreditCard },
  ];

  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [rosterSize, setRosterSize] = useState<4 | 6 | 8>(4);
  const [teamCount, setTeamCount] = useState(4);
  const [requireRegistration, setRequireRegistration] = useState(false);
  const [requireMinGames, setRequireMinGames] = useState(false);
  // Ràng buộc DUPR khi yêu cầu đăng ký — điểm DUPR tối đa theo giới tính (native parity).
  const [useDupr, setUseDupr] = useState(false);
  const [duprMaxMale, setDuprMaxMale] = useState(5.0);
  const [duprMaxFemale, setDuprMaxFemale] = useState(4.5);

  const [templates, setTemplates] = useState<GameTemplateItem[]>(() => getDefaultTemplates(4));

  // Chế độ tính theo TỔNG điểm: mỗi game con tới `pointsPerGame`; hết các game,
  // bên nào tổng điểm cao hơn thắng (không phải đạt mốc cố định). Parity native.
  const [totalScoreMode, setTotalScoreMode] = useState(false);
  const [pointsPerGame, setPointsPerGame] = useState(7);

  const [hasDreambreaker, setHasDreambreaker] = useState(false);

  const [format, setFormat] = useState<'round_robin' | 'single_elimination' | 'rr_playoff'>('round_robin');
  const [playoffTeamCount, setPlayoffTeamCount] = useState(4);
  const [hasThirdPlaceMatch, setHasThirdPlaceMatch] = useState(false);
  // rr_playoff: nhánh Tái sinh — hạng 3,4 mỗi bảng đá bracket phụ (như playoff hạng 1,2).
  const [hasRepechage, setHasRepechage] = useState(false);

  // Step 5 — Thể lệ & Lệ phí. QR VietQR dựng từ bank trio khi phí > 0.
  const [rulesSummary, setRulesSummary] = useState('');
  const [entryFeeVnd, setEntryFeeVnd] = useState(0);
  const [entryFeeTeamVnd, setEntryFeeTeamVnd] = useState(0);
  const [bankCode, setBankCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  // Bậc giảm giá slot đăng ký sớm — BTC tự nhập, cộng dồn theo thứ tự.
  const [discountTiers, setDiscountTiers] = useState<DiscountTier[]>([]);
  const validTiers = discountTiers.filter((d) => d.slots > 0 && d.percent > 0 && d.percent <= 100);
  const hasAnyFee = entryFeeVnd > 0 || entryFeeTeamVnd > 0;
  const feeStepValid =
    !hasAnyFee ||
    (bankCode !== '' && /^[0-9]{6,20}$/.test(bankAccountNumber) && bankAccountName.trim().length >= 3);
  // Số tiền preview: ưu tiên phí/đội, không thì phí/VĐV.
  const previewAmount = entryFeeTeamVnd > 0 ? entryFeeTeamVnd : entryFeeVnd;
  const qrPreviewUrl =
    hasAnyFee && feeStepValid && bankCode
      ? generateVietQRUrl({
          bankCode,
          accountNumber: bankAccountNumber,
          accountName: bankAccountName,
          amount: previewAmount,
          memo: `Le phi ${name.trim() || 'giai'}`,
        })
      : null;

  // ── UX-05 journey instrumentation (organizer_tournament, tool=teammatch) ──
  const journeyStartedRef = useRef(false);
  useEffect(() => {
    if (user && !journeyStartedRef.current) {
      journeyStartedRef.current = true;
      startJourney('organizer_tournament');
      trackJourneyStep('organizer_tournament', 'organizer_tournament_creation_started', {
        tool: 'teammatch',
        auth_state: 'authenticated',
      });
    }
  }, [user]);

  // ── UX-04 autosave (local-first, docs/proposals/ux-01-05) ────────────────
  // Bank trio deliberately EXCLUDED from the draft (same rule as UX-02
  // templates, D3): payment account details never persist outside the DB —
  // CodeQL js/clear-text-storage-of-sensitive-data. Organizer re-enters
  // them on restore.
  const draftValue = useMemo(
    () => ({
      step, name, eventDate, location, rosterSize, teamCount,
      requireRegistration, requireMinGames, useDupr, duprMaxMale, duprMaxFemale,
      templates, totalScoreMode, pointsPerGame, hasDreambreaker,
      format, playoffTeamCount, hasThirdPlaceMatch, hasRepechage,
      rulesSummary, entryFeeVnd, entryFeeTeamVnd, discountTiers,
    }),
    [
      step, name, eventDate, location, rosterSize, teamCount,
      requireRegistration, requireMinGames, useDupr, duprMaxMale, duprMaxFemale,
      templates, totalScoreMode, pointsPerGame, hasDreambreaker,
      format, playoffTeamCount, hasThirdPlaceMatch, hasRepechage,
      rulesSummary, entryFeeVnd, entryFeeTeamVnd, discountTiers,
    ],
  );
  // Dirty = differs from the pristine first-render snapshot (captured before
  // the restore effect applies any saved draft).
  const draftJson = JSON.stringify(draftValue);
  const initialJsonRef = useRef<string | null>(null);
  if (initialJsonRef.current === null) initialJsonRef.current = draftJson;
  const dirty = draftJson !== initialJsonRef.current;
  const draft = useAutosaveDraft<typeof draftValue>({
    key: 'draft:teammatch:new',
    value: draftValue,
    enabled: dirty && !isCreating,
  });
  const [restoredDraft, setRestoredDraft] = useState(false);
  useEffect(() => {
    // Apply once at mount. Shape-guard against hand-edited payloads.
    const d = draft.initial;
    if (!d || typeof d.name !== 'string' || !Array.isArray(d.templates)) return;
    setStep([1, 2, 3, 4, 5].includes(d.step) ? d.step : 1);
    setName(d.name);
    if (typeof d.eventDate === 'string') setEventDate(d.eventDate);
    if (typeof d.location === 'string') setLocation(d.location);
    if ([4, 6, 8].includes(d.rosterSize)) setRosterSize(d.rosterSize);
    if (typeof d.teamCount === 'number') setTeamCount(d.teamCount);
    if (typeof d.requireRegistration === 'boolean') setRequireRegistration(d.requireRegistration);
    if (typeof d.requireMinGames === 'boolean') setRequireMinGames(d.requireMinGames);
    if (typeof d.useDupr === 'boolean') setUseDupr(d.useDupr);
    if (typeof d.duprMaxMale === 'number') setDuprMaxMale(d.duprMaxMale);
    if (typeof d.duprMaxFemale === 'number') setDuprMaxFemale(d.duprMaxFemale);
    if (d.templates.every((tpl) => tpl && typeof tpl.display_name === 'string')) {
      setTemplates(d.templates);
    }
    if (typeof d.totalScoreMode === 'boolean') setTotalScoreMode(d.totalScoreMode);
    if (typeof d.pointsPerGame === 'number') setPointsPerGame(d.pointsPerGame);
    if (typeof d.hasDreambreaker === 'boolean') setHasDreambreaker(d.hasDreambreaker);
    if (['round_robin', 'single_elimination', 'rr_playoff'].includes(d.format)) setFormat(d.format);
    if (typeof d.playoffTeamCount === 'number') setPlayoffTeamCount(d.playoffTeamCount);
    if (typeof d.hasThirdPlaceMatch === 'boolean') setHasThirdPlaceMatch(d.hasThirdPlaceMatch);
    if (typeof d.hasRepechage === 'boolean') setHasRepechage(d.hasRepechage);
    if (typeof d.rulesSummary === 'string') setRulesSummary(d.rulesSummary);
    if (typeof d.entryFeeVnd === 'number') setEntryFeeVnd(d.entryFeeVnd);
    if (typeof d.entryFeeTeamVnd === 'number') setEntryFeeTeamVnd(d.entryFeeTeamVnd);
    if (Array.isArray(d.discountTiers)) {
      setDiscountTiers(
        d.discountTiers.filter((tier) => tier && typeof tier.slots === 'number' && typeof tier.percent === 'number'),
      );
    }
    setRestoredDraft(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToInitial = () => {
    draft.clear();
    setStep(1);
    setName('');
    setEventDate('');
    setLocation('');
    setRosterSize(4);
    setTeamCount(4);
    setRequireRegistration(false);
    setRequireMinGames(false);
    setUseDupr(false);
    setDuprMaxMale(5.0);
    setDuprMaxFemale(4.5);
    setTemplates(getDefaultTemplates(4));
    setTotalScoreMode(false);
    setPointsPerGame(7);
    setHasDreambreaker(false);
    setFormat('round_robin');
    setPlayoffTeamCount(4);
    setHasThirdPlaceMatch(false);
    setHasRepechage(false);
    setRulesSummary('');
    setEntryFeeVnd(0);
    setEntryFeeTeamVnd(0);
    setBankCode('');
    setBankAccountNumber('');
    setBankAccountName('');
    setDiscountTiers([]);
  };

  const isSingleElimination = format === 'single_elimination';
  const isValidTeamCountForSE = isPowerOfTwo(teamCount) && teamCount >= 4;
  const teamCountWarning = isSingleElimination && !isValidTeamCountForSE
    ? t.teamMatch.setup.invalidTeamCount
    : null;

  const handleRosterSizeChange = (size: 4 | 6 | 8) => {
    setRosterSize(size);
    setTemplates(getDefaultTemplates(size));
  };

  const isEvenGames = templates.length % 2 === 0;
  const effectiveDreambreaker = isEvenGames && hasDreambreaker;

  // Số đội vào playoff — gợi ý theo luỹ thừa-của-2 lớn nhất ≤ teamCount (native
  // parity). Vd 25→[16,8], 10→[8,4], 6→[4,2], ≤3→[2]. Không fix cứng 2/4/8.
  const playoffSizeOptions = useMemo(() => {
    let p = 1;
    while (p * 2 <= teamCount) p *= 2;
    if (p < 2) p = 2;
    return p > 2 ? [p, p / 2] : [2];
  }, [teamCount]);

  // Kẹp playoffTeamCount về 1 option hợp lệ khi đổi số đội.
  useEffect(() => {
    if (!playoffSizeOptions.includes(playoffTeamCount)) {
      setPlayoffTeamCount(playoffSizeOptions[0]);
    }
  }, [playoffSizeOptions, playoffTeamCount]);

  const roundName = (n: number): string => {
    const vi: Record<number, string> = { 2: 'Chung kết', 4: 'Bán kết', 8: 'Tứ kết', 16: 'Vòng 1/16', 32: 'Vòng 1/32' };
    const en: Record<number, string> = { 2: 'Finals', 4: 'Semifinals', 8: 'Quarterfinals', 16: 'Round of 16', 32: 'Round of 32' };
    return (language === 'vi' ? vi : en)[n] ?? `${n} ${language === 'vi' ? 'đội' : 'teams'}`;
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length >= 3 && teamCount >= 2;
      case 2:
        return templates.length >= 1;
      case 3:
        return true;
      case 4:
        if (format === 'single_elimination') {
          return isValidTeamCountForSE;
        }
        return true;
      case 5:
        return feeStepValid;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate(getLoginUrl('/tools/team-match/new'));
      return;
    }
    trackJourneyStep('organizer_tournament', 'organizer_tournament_submit_attempted', {
      tool: 'teammatch',
      auth_state: 'authenticated',
    });

    const input: CreateTournamentInput = {
      name: name.trim(),
      team_roster_size: rosterSize,
      team_count: teamCount,
      format,
      playoff_team_count: format === 'rr_playoff' ? playoffTeamCount : undefined,
      require_registration: requireRegistration,
      require_dupr: requireRegistration && useDupr,
      dupr_max_male: duprMaxMale,
      dupr_max_female: duprMaxFemale,
      has_dreambreaker: effectiveDreambreaker,
      require_min_games_per_player: requireMinGames,
      has_third_place_match: format === 'single_elimination' ? hasThirdPlaceMatch : false,
      has_repechage: format === 'rr_playoff' ? hasRepechage : false,
      total_score_mode: totalScoreMode,
      points_per_game: pointsPerGame,
      event_date: eventDate || undefined,
      location: location.trim() || undefined,
      discount_tiers: hasAnyFee && validTiers.length > 0 ? validTiers : undefined,
      rules_summary: rulesSummary.trim() || undefined,
      entry_fee_vnd: entryFeeVnd > 0 ? entryFeeVnd : undefined,
      entry_fee_team_vnd: entryFeeTeamVnd > 0 ? entryFeeTeamVnd : undefined,
      bank_code: hasAnyFee ? bankCode : undefined,
      bank_account_number: hasAnyFee ? bankAccountNumber : undefined,
      bank_account_name: hasAnyFee ? bankAccountName : undefined,
      game_templates: templates.map(tpl => ({
        order_index: tpl.order_index,
        game_type: tpl.game_type,
        display_name: tpl.display_name,
        scoring_type: tpl.scoring_type,
      })),
    };

    try {
      const result = await createTournament(input);
      draft.clear();
      completeJourney('organizer_tournament', 'organizer_tournament_created', {
        tool: 'teammatch',
        auth_state: 'authenticated',
      });
      navigate(`/tools/team-match/${result.share_id}`);
    } catch (error) {
      // Error handled in hook
    }
  };

  // ─── Login gate ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SetupLoginGate
        layoutTitle={t.teamMatch.setup.title}
        noindex={true}
        toolLabel="Team Match"
        toolPath="/tools/team-match"
        icon={Users}
        title={t.teamMatch.setup.loginRequired}
        desc={t.teamMatch.setup.loginRequiredDesc}
        loginRedirect="/tools/team-match/new"
      />
    );
  }

  // ─── Wizard ──────────────────────────────────────────────────────────────
  const stepIndex = step - 1;

  return (
    <TheLineLayout title={t.teamMatch.setup.title} noindex={true} active="lab">
      <div className="tl-shell">
        <SetupBreadcrumb toolLabel="Team Match" toolPath="/tools/team-match" />

        <SetupPageHead
          kicker={language === 'vi' ? 'Tạo giải mới · Team Match MLP' : 'New tournament · Team Match MLP'}
          h1Sans="team match."
          subtitle={t.teamMatch.setup.subtitle}
        />

        {/* Step indicators — token-driven, mono caps below */}
        <section style={{ marginTop: 32, marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
              padding: '0 8px',
            }}
          >
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isPast = step > s.id;
              const StepIcon = s.icon;
              const circleBg = isActive
                ? 'var(--tl-green)'
                : isPast
                  ? 'var(--tl-green-glow)'
                  : 'var(--tl-surface)';
              const circleFg = isActive
                ? 'var(--tl-bg)'
                : isPast
                  ? 'var(--tl-green)'
                  : 'var(--tl-fg-3)';
              const circleBorder = isActive || isPast ? 'var(--tl-green)' : 'var(--tl-border)';

              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: circleBg,
                        color: circleFg,
                        border: `2px solid ${circleBorder}`,
                        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                      }}
                    >
                      {isPast ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span
                      style={{
                        display: 'none',
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 500,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: isActive ? 'var(--tl-fg)' : 'var(--tl-fg-3)',
                      }}
                      className="md:inline"
                    >
                      {s.title}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      style={{
                        width: 32,
                        height: 2,
                        background: isPast ? 'var(--tl-green)' : 'var(--tl-border)',
                        margin: '0 4px',
                        transition: 'background 0.15s',
                      }}
                      className="hidden sm:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0 0', width: '100%' }}>
          <div style={surfaceCard}>
            {restoredDraft && <DraftRestoredBanner onStartOver={resetToInitial} />}
            <div style={{ marginBottom: 24 }}>
              <div style={stepKickerStyle}>
                ◆ {language === 'vi' ? `Bước ${step}/${STEPS.length}` : `Step ${step}/${STEPS.length}`}
              </div>
              <h2 style={stepHeadingStyle}>{STEPS[stepIndex].title}</h2>
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t.teamMatch.setup.tournamentName}{' '}
                    <span style={{ color: 'var(--tl-live)' }}>*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.teamMatch.setup.tournamentNamePlaceholder}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">{language === 'vi' ? 'Ngày tổ chức' : 'Event date'}</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">{language === 'vi' ? 'Địa điểm' : 'Location'}</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder={language === 'vi' ? 'VD: Sân ABC, Q.7' : 'e.g. ABC Courts'}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>
                    {t.teamMatch.setup.playersPerTeam}{' '}
                    <span style={{ color: 'var(--tl-live)' }}>*</span>
                  </Label>
                  <RadioGroup
                    value={rosterSize.toString()}
                    onValueChange={(v) => handleRosterSizeChange(Number(v) as 4 | 6 | 8)}
                    className="grid grid-cols-3 gap-3"
                  >
                    {ROSTER_SIZE_OPTIONS.map(opt => {
                      const selected = rosterSize === opt.value;
                      return (
                        <div key={opt.value}>
                          <RadioGroupItem
                            value={opt.value.toString()}
                            id={`roster-${opt.value}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`roster-${opt.value}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 16,
                              borderRadius: 'var(--tl-radius)',
                              border: `2px solid ${selected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                              background: selected ? 'var(--tl-green-glow)' : 'var(--tl-bg)',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'Instrument Serif, serif',
                                fontStyle: 'italic',
                                fontSize: 32,
                                fontWeight: 400,
                                lineHeight: 1,
                                color: 'var(--tl-fg)',
                              }}
                            >
                              {opt.label}
                            </span>
                            <span
                              style={{
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontSize: 10.5,
                                color: 'var(--tl-fg-3)',
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                marginTop: 6,
                              }}
                            >
                              {language === 'vi' ? 'VĐV' : 'players'}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: 'var(--tl-fg-3)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {language === 'vi'
                        ? 'Số nam/nữ tham khảo theo kiểu MLP. BTC có thể tự quyết định tỷ lệ phù hợp.'
                        : 'MLP-style player count. Organizers decide the actual male/female ratio.'}
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamCount">
                    {t.teamMatch.setup.teamCount}{' '}
                    <span style={{ color: 'var(--tl-live)' }}>*</span>
                  </Label>
                  <Input
                    id="teamCount"
                    type="number"
                    min={2}
                    max={32}
                    value={teamCount}
                    onChange={(e) => setTeamCount(Number(e.target.value))}
                  />
                </div>

                <div style={toggleRowStyle}>
                  <div>
                    <Label>{t.teamMatch.setup.requireRegistration}</Label>
                    <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                      {t.teamMatch.setup.requireRegistrationDesc}
                    </p>
                  </div>
                  <Switch
                    checked={requireRegistration}
                    onCheckedChange={setRequireRegistration}
                  />
                </div>

                {requireRegistration && (
                  <>
                    <div style={toggleRowStyle}>
                      <div>
                        <Label>{language === 'vi' ? 'Sử dụng DUPR' : 'Use DUPR'}</Label>
                        <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                          {language === 'vi'
                            ? 'Giới hạn điểm DUPR tối đa khi đăng ký'
                            : 'Cap max DUPR rating at registration'}
                        </p>
                      </div>
                      <Switch checked={useDupr} onCheckedChange={setUseDupr} />
                    </div>

                    {useDupr && (
                      <div
                        style={{
                          paddingLeft: 16,
                          borderLeft: '2px solid var(--tl-green)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                        }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor="duprMaxMale">
                            {language === 'vi' ? 'DUPR tối đa — Nam' : 'Max DUPR — Male'}
                          </Label>
                          <Input
                            id="duprMaxMale"
                            type="number"
                            min={2}
                            max={8}
                            step={0.25}
                            value={duprMaxMale}
                            onChange={(e) =>
                              setDuprMaxMale(Math.min(8, Math.max(2, Number(e.target.value) || 2)))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="duprMaxFemale">
                            {language === 'vi' ? 'DUPR tối đa — Nữ' : 'Max DUPR — Female'}
                          </Label>
                          <Input
                            id="duprMaxFemale"
                            type="number"
                            min={2}
                            max={8}
                            step={0.25}
                            value={duprMaxFemale}
                            onChange={(e) =>
                              setDuprMaxFemale(Math.min(8, Math.max(2, Number(e.target.value) || 2)))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div style={toggleRowStyle}>
                  <div>
                    <Label>{t.teamMatch.setup.requireMinGames}</Label>
                    <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                      {t.teamMatch.setup.requireMinGamesDesc}
                    </p>
                  </div>
                  <Switch
                    checked={requireMinGames}
                    onCheckedChange={setRequireMinGames}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Game Templates — child component (deferred PR D.2) */}
            {step === 2 && (
              <div className="space-y-5">
                <div style={toggleRowStyle}>
                  <div>
                    <Label>{language === 'vi' ? 'Tính theo tổng điểm' : 'Total-score mode'}</Label>
                    <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                      {language === 'vi'
                        ? 'Cộng dồn điểm tất cả các game; bên nào tổng điểm cao hơn thắng, thay vì đếm số game thắng/thua.'
                        : 'Sum points across all games; higher total wins, instead of counting game wins.'}
                    </p>
                  </div>
                  <Switch checked={totalScoreMode} onCheckedChange={setTotalScoreMode} />
                </div>

                {totalScoreMode && (
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
                      <Label htmlFor="pointsPerGame">
                        {language === 'vi' ? 'Điểm mỗi game con' : 'Points per game'}
                      </Label>
                      <Input
                        id="pointsPerGame"
                        type="number"
                        min={1}
                        max={50}
                        value={pointsPerGame}
                        onChange={(e) => setPointsPerGame(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 16,
                        borderRadius: 'var(--tl-radius)',
                        ...infoCardStyle('neutral'),
                      }}
                    >
                      <Info className="w-5 h-5 mt-0.5" style={{ color: infoCardIconColor('neutral') }} />
                      <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
                        {language === 'vi'
                          ? `Mỗi cặp thi đấu tới ${pointsPerGame} điểm. Hết ${templates.length} cặp, bên nào tổng số điểm lớn hơn là thắng.`
                          : `Each pairing plays to ${pointsPerGame}. After ${templates.length} games, the side with the higher total wins.`}
                      </p>
                    </div>
                  </div>
                )}

                <GameTemplateEditor
                  templates={templates}
                  onChange={setTemplates}
                  rosterSize={rosterSize}
                  totalScoreMode={totalScoreMode}
                  pointsPerGame={pointsPerGame}
                />
              </div>
            )}

            {/* Step 3: DreamBreaker */}
            {step === 3 && (
              <div className="space-y-5">
                {!isEvenGames ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 16,
                      borderRadius: 'var(--tl-radius)',
                      ...infoCardStyle('neutral'),
                    }}
                  >
                    <Info className="w-5 h-5 mt-0.5" style={{ color: infoCardIconColor('neutral') }} />
                    <div>
                      <p style={{ fontWeight: 500, color: 'var(--tl-fg)', fontSize: 14, margin: 0 }}>
                        {language === 'vi'
                          ? `Số game là số lẻ (${templates.length} games)`
                          : `Odd number of games (${templates.length} games)`}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.5 }}>
                        {language === 'vi'
                          ? 'Không cần DreamBreaker vì đã có ván quyết định (ván cuối cùng).'
                          : 'No DreamBreaker needed as the last game serves as tiebreaker.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 16,
                        borderRadius: 'var(--tl-radius)',
                        ...infoCardStyle('warning'),
                      }}
                    >
                      <Info className="w-5 h-5 mt-0.5" style={{ color: infoCardIconColor('warning') }} />
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--tl-gold)', fontSize: 14, margin: 0 }}>
                          {language === 'vi'
                            ? `Số game là số chẵn (${templates.length} games)`
                            : `Even number of games (${templates.length} games)`}
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', marginTop: 4, lineHeight: 1.5 }}>
                          {language === 'vi'
                            ? 'Khi 2 đội thắng số game bằng nhau, cần DreamBreaker để phân định. Khi bật, ván lẻ cuối cùng sẽ là ván Dreambreaker.'
                            : 'When teams tie on game wins, DreamBreaker determines the winner.'}
                        </p>
                      </div>
                    </div>

                    <div style={toggleRowStyle}>
                      <div>
                        <Label>{language === 'vi' ? 'Bật DreamBreaker' : 'Enable DreamBreaker'}</Label>
                        <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                          {language === 'vi'
                            ? 'Thêm ván quyết định khi 2 đội hòa về số game thắng'
                            : 'Add tiebreaker when teams are tied on games won'}
                        </p>
                      </div>
                      <Switch
                        checked={hasDreambreaker}
                        onCheckedChange={setHasDreambreaker}
                      />
                    </div>

                    {hasDreambreaker && (
                      <div
                        style={{
                          paddingLeft: 16,
                          borderLeft: '2px solid var(--tl-green)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                        }}
                      >
                        <div
                          style={{
                            ...surfaceCard,
                            background: 'var(--tl-bg)',
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap className="w-5 h-5" style={{ color: 'var(--tl-green)' }} />
                            <span
                              style={{
                                fontFamily: 'Instrument Serif, serif',
                                fontStyle: 'italic',
                                fontSize: 18,
                                fontWeight: 400,
                                color: 'var(--tl-fg)',
                              }}
                            >
                              {language === 'vi' ? 'Ván Dreambreaker (Ván cuối cùng)' : 'Dreambreaker Game (Final Game)'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontSize: 13 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 0',
                                borderBottom: '1px solid var(--tl-border)',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                                  fontSize: 11,
                                  color: 'var(--tl-fg-3)',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {language === 'vi' ? 'Hình thức' : 'Format'}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--tl-fg)' }}>
                                {language === 'vi' ? 'Đánh Đơn (Singles)' : 'Singles'}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 0',
                                borderBottom: '1px solid var(--tl-border)',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                                  fontSize: 11,
                                  color: 'var(--tl-fg-3)',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {language === 'vi' ? 'Số VĐV mỗi đội' : 'Players per team'}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--tl-fg)' }}>
                                {language === 'vi' ? '4 VĐV (Tự do chọn nam/nữ)' : '4 players (any gender)'}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 0',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                                  fontSize: 11,
                                  color: 'var(--tl-fg-3)',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {language === 'vi' ? 'Cách tính điểm' : 'Scoring'}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--tl-fg)' }}>Rally Scoring</span>
                            </div>
                          </div>

                          <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: 0, lineHeight: 1.55 }}>
                            {language === 'vi'
                              ? 'Dreambreaker theo chuẩn MLP: 4 VĐV thi đấu đơn, mỗi pha bóng đều tính điểm. Đội trưởng sẽ chọn 4 VĐV bất kỳ (không phân biệt giới tính) khi line up.'
                              : 'MLP-standard Dreambreaker: 4 singles players, rally scoring. Captain chooses 4 players (any gender) during lineup.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 4: Format */}
            {step === 4 && (
              <div className="space-y-5">
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as 'round_robin' | 'single_elimination' | 'rr_playoff')}
                  className="space-y-3"
                >
                  {[
                    { value: 'round_robin', title: t.teamMatch.setup.formatRoundRobin, desc: t.teamMatch.setup.formatRoundRobinDesc, id: 'format-rr' },
                    { value: 'single_elimination', title: t.teamMatch.setup.formatSingleElimination, desc: t.teamMatch.setup.formatSingleEliminationDesc, id: 'format-se' },
                    { value: 'rr_playoff', title: t.teamMatch.setup.formatRrPlayoff, desc: t.teamMatch.setup.formatRrPlayoffDesc, id: 'format-rrp' },
                  ].map(opt => {
                    const selected = format === opt.value;
                    return (
                      <div
                        key={opt.value}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: 16,
                          borderRadius: 'var(--tl-radius)',
                          border: `1px solid ${selected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                          background: selected ? 'var(--tl-green-glow)' : 'var(--tl-bg)',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <RadioGroupItem value={opt.value} id={opt.id} className="mt-1" />
                        <div style={{ flex: 1 }}>
                          <Label htmlFor={opt.id} style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--tl-fg)' }}>
                            {opt.title}
                          </Label>
                          <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.5 }}>
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>

                {format === 'rr_playoff' && (
                  <div
                    style={{
                      paddingLeft: 16,
                      borderLeft: '2px solid var(--tl-green)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <Label htmlFor="playoffCount">{t.teamMatch.setup.playoffTeams}</Label>
                    <Select
                      value={playoffTeamCount.toString()}
                      onValueChange={(v) => setPlayoffTeamCount(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {playoffSizeOptions.map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {language === 'vi' ? `${n} đội (${roundName(n)})` : `${n} teams (${roundName(n)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div style={toggleRowStyle}>
                      <div>
                        <Label>{language === 'vi' ? 'Vòng Tái sinh' : 'Repechage'}</Label>
                        <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                          {language === 'vi'
                            ? 'Hạng 3,4 mỗi bảng đá thêm nhánh phụ (như playoff cho hạng 1,2). Hạng 3 bảng X gặp hạng 4 bảng Y.'
                            : 'Teams ranked 3rd–4th in each group play a side bracket (mirrors the 1st–2nd playoff). 3rd of X vs 4th of Y.'}
                        </p>
                      </div>
                      <Switch checked={hasRepechage} onCheckedChange={setHasRepechage} />
                    </div>
                  </div>
                )}

                {format === 'single_elimination' && (
                  <div
                    style={{
                      paddingLeft: 16,
                      borderLeft: '2px solid var(--tl-green)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    {teamCountWarning && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: 12,
                          borderRadius: 'var(--tl-radius)',
                          ...infoCardStyle('destructive'),
                        }}
                      >
                        <Info className="w-4 h-4 mt-0.5" style={{ color: infoCardIconColor('destructive') }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tl-live)', margin: 0 }}>
                            {teamCountWarning}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                            {language === 'vi'
                              ? `Hiện tại: ${teamCount} đội. Quay lại bước 1 để điều chỉnh.`
                              : `Current: ${teamCount} teams. Go back to step 1 to adjust.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {isValidTeamCountForSE && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: 12,
                          borderRadius: 'var(--tl-radius)',
                          ...infoCardStyle('success'),
                        }}
                      >
                        <Check className="w-4 h-4 mt-0.5" style={{ color: infoCardIconColor('success') }} />
                        <p style={{ fontSize: 13, color: 'var(--tl-green)', margin: 0, fontWeight: 500 }}>
                          {language === 'vi'
                            ? `${teamCount} đội — Hợp lệ cho Single Elimination`
                            : `${teamCount} teams — Valid for Single Elimination`}
                        </p>
                      </div>
                    )}

                    <div style={toggleRowStyle}>
                      <div>
                        <Label>{t.teamMatch.setup.thirdPlaceMatch}</Label>
                        <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                          {t.teamMatch.setup.thirdPlaceMatchDesc}
                        </p>
                      </div>
                      <Switch
                        checked={hasThirdPlaceMatch}
                        onCheckedChange={setHasThirdPlaceMatch}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 12,
                        borderRadius: 'var(--tl-radius)',
                        ...infoCardStyle('neutral'),
                      }}
                    >
                      <Info className="w-4 h-4 mt-0.5" style={{ color: infoCardIconColor('neutral') }} />
                      <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0, lineHeight: 1.5 }}>
                        {language === 'vi'
                          ? 'Sau khi tạo giải, BTC sẽ chọn cách ghép đội: Bốc thăm ngẫu nhiên hoặc Xếp thủ công.'
                          : 'After creation, organizers can choose: Random draw or Manual pairing.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Thể lệ & Lệ phí */}
            {step === 5 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="rulesSummary">
                    {language === 'vi' ? 'Tóm tắt thể lệ giải' : 'Rules summary'}
                  </Label>
                  <textarea
                    id="rulesSummary"
                    rows={4}
                    value={rulesSummary}
                    onChange={(e) => setRulesSummary(e.target.value)}
                    placeholder={language === 'vi'
                      ? 'VD: Thi đấu MLP, mỗi trận 4 game + DreamBreaker. Check-in trước 15 phút…'
                      : 'e.g. MLP format, 4 games + DreamBreaker per tie. Check in 15 min early…'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--tl-radius)',
                      border: '1px solid var(--tl-border)',
                      background: 'var(--tl-surface)',
                      color: 'var(--tl-fg)',
                      fontSize: 14,
                      lineHeight: 1.5,
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entryFeeVnd">
                    {language === 'vi' ? 'Lệ phí mỗi VĐV (VND)' : 'Fee per player (VND)'}
                  </Label>
                  <Input
                    id="entryFeeVnd"
                    type="number"
                    min={0}
                    value={entryFeeVnd || ''}
                    placeholder="0"
                    onChange={(e) => setEntryFeeVnd(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entryFeeTeamVnd">
                    {language === 'vi' ? 'Lệ phí mỗi đội (VND)' : 'Fee per team (VND)'}
                  </Label>
                  <Input
                    id="entryFeeTeamVnd"
                    type="number"
                    min={0}
                    value={entryFeeTeamVnd || ''}
                    placeholder="0"
                    onChange={(e) => setEntryFeeTeamVnd(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>

                {hasAnyFee && (
                  <div className="space-y-3">
                    <div>
                      <Label>{language === 'vi' ? 'Giảm giá slot đăng ký sớm' : 'Early-slot discounts'}</Label>
                      <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.45 }}>
                        {language === 'vi'
                          ? 'VD: 10 slot đầu giảm 20%, 5 slot tiếp giảm 15%. Slot tính theo thứ tự đăng ký đội; QR tự áp dụng số tiền sau giảm.'
                          : 'e.g. first 10 slots -20%, next 5 slots -15%. Slots follow team registration order; the QR applies the discounted amount.'}
                      </p>
                    </div>
                    {discountTiers.map((tier, i) => {
                      const from = discountTiers.slice(0, i).reduce((s, d) => s + d.slots, 0) + 1;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--tl-fg-3)', minWidth: 52 }}>
                            {language === 'vi' ? `Slot ${from}+` : `Slot ${from}+`}
                          </span>
                          <Input
                            type="number"
                            min={1}
                            value={tier.slots || ''}
                            placeholder={language === 'vi' ? 'Số slot' : 'Slots'}
                            onChange={(e) =>
                              setDiscountTiers((ts) => ts.map((d, j) => (j === i ? { ...d, slots: Math.max(0, Number(e.target.value) || 0) } : d)))
                            }
                          />
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={tier.percent || ''}
                            placeholder={language === 'vi' ? '% giảm' : '% off'}
                            onChange={(e) =>
                              setDiscountTiers((ts) => ts.map((d, j) => (j === i ? { ...d, percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : d)))
                            }
                          />
                          <button
                            type="button"
                            className="tl-btn"
                            style={{ padding: '8px 12px', color: 'var(--tl-live)' }}
                            onClick={() => setDiscountTiers((ts) => ts.filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="tl-btn"
                      onClick={() => setDiscountTiers((ts) => [...ts, { slots: 0, percent: 0 }])}
                    >
                      + {language === 'vi' ? 'Thêm bậc giảm giá' : 'Add tier'}
                    </button>
                    {validTiers.length > 0 && previewAmount > 0 && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 'var(--tl-radius)',
                          ...infoCardStyle('success'),
                          fontSize: 12.5,
                          color: 'var(--tl-fg-2)',
                          lineHeight: 1.6,
                        }}
                      >
                        {validTiers.map((tier, i) => {
                          const from = validTiers.slice(0, i).reduce((s, d) => s + d.slots, 0) + 1;
                          const to = from + tier.slots - 1;
                          const amount = Math.round((previewAmount * (100 - tier.percent)) / 100);
                          return (
                            <div key={i}>
                              {language === 'vi'
                                ? `Slot ${from}–${to}: ${amount.toLocaleString('vi-VN')} đ (−${tier.percent}%)`
                                : `Slots ${from}–${to}: ${amount.toLocaleString('en-US')} đ (−${tier.percent}%)`}
                            </div>
                          );
                        })}
                        <div>
                          {language === 'vi'
                            ? `Slot còn lại: ${previewAmount.toLocaleString('vi-VN')} đ (giá gốc)`
                            : `Remaining slots: ${previewAmount.toLocaleString('en-US')} đ (full price)`}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {hasAnyFee ? (
                  <div
                    style={{
                      paddingLeft: 16,
                      borderLeft: '2px solid var(--tl-green)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--tl-green)',
                      }}
                    >
                      {language === 'vi' ? 'Tài khoản nhận — tạo mã QR' : 'Receiving account — QR'}
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'vi' ? 'Ngân hàng' : 'Bank'}</Label>
                      <Select value={bankCode} onValueChange={setBankCode}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'vi' ? 'Chọn ngân hàng' : 'Select bank'} />
                        </SelectTrigger>
                        <SelectContent>
                          {VN_BANKS.map((b) => (
                            <SelectItem key={b.code} value={b.code}>
                              {b.shortName} ({b.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bankAccountNumber">{language === 'vi' ? 'Số tài khoản' : 'Account number'}</Label>
                      <Input
                        id="bankAccountNumber"
                        inputMode="numeric"
                        value={bankAccountNumber}
                        placeholder="0123456789"
                        onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bankAccountName">{language === 'vi' ? 'Tên chủ tài khoản' : 'Account holder'}</Label>
                      <Input
                        id="bankAccountName"
                        value={bankAccountName}
                        placeholder="NGUYEN VAN A"
                        onChange={(e) => setBankAccountName(e.target.value)}
                        onBlur={() => setBankAccountName((v) => normalizeAccountName(v))}
                      />
                    </div>

                    {qrPreviewUrl ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <img
                          src={qrPreviewUrl}
                          alt="VietQR preview"
                          width={220}
                          style={{ borderRadius: 12, background: '#fff' }}
                        />
                        <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--tl-fg-3)' }}>
                          {language === 'vi'
                            ? `Quét mã để chuyển ${previewAmount.toLocaleString('vi-VN')} đ`
                            : `Scan to transfer ${previewAmount.toLocaleString('en-US')} đ`}
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: 12,
                          borderRadius: 'var(--tl-radius)',
                          ...infoCardStyle('warning'),
                        }}
                      >
                        <Info className="w-4 h-4 mt-0.5" style={{ color: infoCardIconColor('warning') }} />
                        <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', margin: 0 }}>
                          {language === 'vi'
                            ? 'Nhập đủ ngân hàng + số tài khoản (6–20 số) + tên chủ TK để xem trước mã QR.'
                            : 'Fill bank + account number (6–20 digits) + holder name to preview the QR.'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 12,
                      borderRadius: 'var(--tl-radius)',
                      ...infoCardStyle('neutral'),
                    }}
                  >
                    <Info className="w-4 h-4 mt-0.5" style={{ color: infoCardIconColor('neutral') }} />
                    <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0 }}>
                      {language === 'vi'
                        ? 'Miễn phí — không cần tài khoản nhận. Nhập lệ phí > 0 để tạo mã QR chuyển khoản cho VĐV.'
                        : 'Free — no account needed. Enter a fee > 0 to generate a transfer QR.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation buttons — sticky bottom dock */}
          <div
            style={{
              marginTop: 24,
              position: 'sticky',
              bottom: 16,
              padding: '12px 0',
              background: 'linear-gradient(to top, var(--tl-bg) 50%, transparent)',
            }}
          >
            <DraftSaveStatus lastSavedAt={draft.lastSavedAt} saveFailed={draft.saveFailed} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              type="button"
              className="tl-btn"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4" />
              {t.quickTable.back}
            </button>

            {step < 5 ? (
              <button
                type="button"
                className="tl-btn green"
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={!canProceed()}
              >
                {t.quickTable.continue}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                className="tl-btn green"
                onClick={handleSubmit}
                disabled={isCreating}
              >
                {isCreating ? t.teamMatch.setup.creating : t.teamMatch.setup.createBtn}
                <Check className="w-4 h-4" />
              </button>
            )}
            </div>
          </div>
        </section>
        <div style={{ height: 80 }} />
      </div>
    </TheLineLayout>
  );
}
