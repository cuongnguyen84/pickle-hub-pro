import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TheLineLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { useDoublesElimination, BestOfFormat, RatingSource } from "@/hooks/useDoublesElimination";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Plus, Trash2, Shuffle, Trophy, LogIn, Sparkles } from "lucide-react";
import { parseCourtsInput } from "@/lib/round-robin";
import { useI18n } from "@/i18n";
import { getLoginUrl } from "@/lib/auth-config";
import { DoublesEliminationPlayerInput, type PlayerSlot } from "@/components/tournament/DoublesEliminationPlayerInput";
import { computeTeamDuprSeeds, teamSeedCoverage } from "@/lib/dupr/seedDoublesTeams";
import { SeedExplainerCard } from "@/components/dupr/SeedExplainerCard";

interface TeamInput {
  id: string;
  /** Team display name (often = "Player1 / Player2"). */
  name: string;
  seed: string;
  team: string;
  // DUPR Phase 1 (2026-05-29). Each team has 2 dual-mode player slots.
  player1: PlayerSlot;
  player2: PlayerSlot;
  // Computed at "Auto-seed by DUPR" time; null when no DUPR coverage.
  dupr_avg_rating?: number | null;
  dupr_seed_source?: 'exact' | 'approx' | 'none';
}

function blankPlayer(): PlayerSlot {
  return { name: '', user_id: null, dupr_doubles: null };
}

type Step = 'info' | 'format' | 'teams';

const SUGGESTED_COUNTS = [32, 40, 48, 64, 80, 96, 128];

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 28,
};

const stepKickerStyle: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--tl-green)',
  marginBottom: 8,
};

const stepHeadingStyle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 28,
  letterSpacing: '-0.015em',
  lineHeight: 1.05,
  margin: 0,
  color: 'var(--tl-fg)',
};

const stepDescStyle: React.CSSProperties = {
  fontSize: 14.5,
  color: 'var(--tl-fg-3)',
  marginTop: 6,
  lineHeight: 1.5,
};

// DUPR Phase 1 (2026-05-29). Collect already-linked profile ids across
// teams so the search dropdown of OTHER teams excludes them (prevents one
// player being in two teams). The current team's own ids are excluded
// from the exclusion list so its own linked players can be re-edited.
function collectLinkedUserIds(teams: TeamInput[], currentIndex: number): string[] {
  const ids: string[] = [];
  teams.forEach((t, i) => {
    if (i === currentIndex) return;
    if (t.player1.user_id) ids.push(t.player1.user_id);
    if (t.player2.user_id) ids.push(t.player2.user_id);
  });
  return ids;
}

function calculateTournamentHints(teamCount: number): { r1Matches: number; byesToR4: number; isEven: boolean; t3: number; r4Target: number } {
  const N = teamCount;
  const r1Matches = Math.floor(N / 2);
  const W1 = r1Matches;
  const L1 = r1Matches;
  const r2Matches = Math.floor(L1 / 2);
  const byeInR2 = L1 % 2 === 1 ? 1 : 0;
  const W2 = r2Matches + byeInR2;
  const T3 = W1 + W2;
  const R4 = Math.pow(2, Math.floor(Math.log2(T3)));
  const byesToR4 = 2 * R4 - T3;

  return {
    r1Matches,
    byesToR4,
    isEven: r1Matches % 2 === 0,
    t3: T3,
    r4Target: R4,
  };
}

export default function DoublesEliminationSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { createTournament, addTeams, generateBracket, loading } = useDoublesElimination();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('info');

  const [name, setName] = useState('');
  const [teamCount, setTeamCount] = useState(32);
  const [courts, setCourts] = useState('');
  const [startTime, setStartTime] = useState('');

  const [earlyRoundsFormat, setEarlyRoundsFormat] = useState<BestOfFormat>('bo1');
  const [semifinalsFormat, setSemifinalsFormat] = useState<BestOfFormat>('bo3');
  const [finalsFormat, setFinalsFormat] = useState<BestOfFormat>('bo3');
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [customSemifinals, setCustomSemifinals] = useState(false);
  const [customFinals, setCustomFinals] = useState(false);

  // DUPR Phase 1 (2026-05-29). Tournament-level rating gates.
  const [ratingSource, setRatingSource] = useState<RatingSource>('self');
  const [minDuprRating, setMinDuprRating] = useState<string>('');
  const [maxDuprRating, setMaxDuprRating] = useState<string>('');
  const [autoSeedLoading, setAutoSeedLoading] = useState(false);
  const [autoSeedSummary, setAutoSeedSummary] = useState<{
    total: number;
    withDupr: number;
    stale: number;
    approx: number;
  } | null>(null);

  const [teams, setTeams] = useState<TeamInput[]>([]);

  const stepLabels = language === 'vi'
    ? ['Thông tin', 'Format', 'Danh sách đội']
    : ['Info', 'Format', 'Team List'];

  const initializeTeams = () => {
    const newTeams: TeamInput[] = [];
    for (let i = 0; i < teamCount; i++) {
      newTeams.push({
        id: `team_${i}`,
        name: '',
        seed: '',
        team: '',
        player1: blankPlayer(),
        player2: blankPlayer(),
      });
    }
    setTeams(newTeams);
    setAutoSeedSummary(null);
  };

  const updateTeam = (index: number, field: keyof TeamInput, value: string) => {
    const updated = [...teams];
    updated[index] = { ...updated[index], [field]: value };
    setTeams(updated);
  };

  // DUPR Phase 1 (2026-05-29) — slot mutation. Resets cached DUPR avg
  // for this team since the player set changed.
  const updateTeamPlayer = (index: number, slot: 'player1' | 'player2', next: PlayerSlot) => {
    const updated = [...teams];
    updated[index] = {
      ...updated[index],
      [slot]: next,
      // Invalidate prior auto-seed result for this team — organizer must
      // re-run Auto-seed to refresh.
      dupr_avg_rating: null,
      dupr_seed_source: 'none',
    };
    setTeams(updated);
    setAutoSeedSummary(null);
  };

  // Gate the Auto-seed button: at least half the teams must have BOTH player
  // slots linked to a profile. Pragmatic threshold from council 2026-05-29.
  const canAutoSeed = (() => {
    const eligible = teams.filter(t => t.player1.user_id && t.player2.user_id).length;
    const filled = teams.filter(t => t.player1.name.trim() || t.player2.name.trim() || t.name.trim()).length;
    if (filled === 0) return false;
    return eligible / filled >= 0.5;
  })();

  // DUPR Phase 1 (2026-05-29). Runs computeTeamDuprSeeds, writes results
  // back to local team state, also re-orders teams by descending avg so
  // the bracket reflects DUPR strength immediately. Coverage summary
  // populates SeedExplainerCard.
  const handleAutoSeedByDupr = async () => {
    setAutoSeedLoading(true);
    try {
      const input = teams.map(t => ({
        id: t.id,
        player1_user_id: t.player1.user_id,
        player2_user_id: t.player2.user_id,
      }));
      const seeds = await computeTeamDuprSeeds(input);
      const byId = new Map(seeds.map(s => [s.id, s]));
      const next = teams.map(t => {
        const s = byId.get(t.id);
        return s
          ? { ...t, dupr_avg_rating: s.dupr_avg_rating, dupr_seed_source: s.dupr_seed_source }
          : t;
      });
      // Re-order: highest DUPR avg first; teams without DUPR sort to bottom by name.
      next.sort((a, b) => {
        const ra = a.dupr_avg_rating ?? null;
        const rb = b.dupr_avg_rating ?? null;
        if (ra != null && rb == null) return -1;
        if (ra == null && rb != null) return 1;
        if (ra != null && rb != null && ra !== rb) return rb - ra;
        return (a.name || a.player1.name || '').localeCompare(b.name || b.player1.name || '', 'vi');
      });
      // Assign seed numbers in new order.
      const seeded = next.map((t, i) => ({ ...t, seed: String(i + 1) }));
      setTeams(seeded);
      const cov = teamSeedCoverage(seeds);
      setAutoSeedSummary({ total: cov.total, withDupr: cov.withDupr, stale: cov.stale, approx: cov.approx });
      toast({ title: language === 'vi' ? `Đã seed ${cov.withDupr}/${cov.total} đội theo DUPR` : `Seeded ${cov.withDupr}/${cov.total} teams by DUPR` });
    } catch (err) {
      console.error('[DoublesEliminationSetup] auto-seed:', err);
      toast({
        title: language === 'vi' ? 'Lỗi auto-seed DUPR' : 'Auto-seed error',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setAutoSeedLoading(false);
    }
  };

  const addTeamSlot = () => {
    setTeams(prev => [
      ...prev,
      { id: `team_${prev.length}`, name: '', seed: '', team: '', player1: blankPlayer(), player2: blankPlayer() },
    ]);
  };

  const removeTeamSlot = (index: number) => {
    if (teams.length <= 32) return;
    setTeams(prev => prev.filter((_, i) => i !== index));
  };

  const shuffleTeams = () => {
    const filledTeams = teams.filter(t => t.name.trim());
    const shuffled = [...filledTeams].sort(() => Math.random() - 0.5);

    const newTeams = shuffled.map((t, i) => ({
      ...t,
      seed: String(i + 1),
    }));

    while (newTeams.length < Math.max(teamCount, teams.length)) {
      newTeams.push({
        id: `team_${newTeams.length}`,
        name: '',
        seed: '',
        team: '',
        player1: blankPlayer(),
        player2: blankPlayer(),
      });
    }

    setTeams(newTeams);
    toast({ title: t.doublesElimination.setup.shuffled || "Shuffled team order" });
  };

  const handleNext = () => {
    if (step === 'info') {
      if (!name.trim()) {
        toast({ title: t.doublesElimination.setup.nameRequired || "Please enter tournament name", variant: "destructive" });
        return;
      }
      if (teamCount < 32) {
        toast({ title: t.doublesElimination.setup.minTeamsError, variant: "destructive" });
        return;
      }
      setStep('format');
    } else if (step === 'format') {
      initializeTeams();
      setStep('teams');
    }
  };

  const handleBack = () => {
    if (step === 'format') setStep('info');
    else if (step === 'teams') setStep('format');
  };

  const getEffectiveSemifinalsFormat = (): BestOfFormat => {
    if (customSemifinals) return semifinalsFormat;
    return earlyRoundsFormat;
  };

  const getEffectiveFinalsFormat = (): BestOfFormat => {
    if (customFinals) return finalsFormat;
    return earlyRoundsFormat;
  };

  const handleCreate = async () => {
    // DUPR Phase 1 (2026-05-29). A team is "filled" when it has either:
    //   - a team_name typed, OR
    //   - at least one player slot filled (text or linked).
    // Derived team_name uses player1/player2 names when available.
    const filledTeams = teams.filter(t => {
      if (t.name.trim()) return true;
      if (t.player1.name.trim() || t.player2.name.trim()) return true;
      return false;
    });

    if (filledTeams.length < 32) {
      toast({
        title: t.doublesElimination.setup.need32Teams || "Need at least 32 teams",
        description: `${t.common.loading}: ${filledTeams.length}`,
        variant: "destructive",
      });
      return;
    }

    // Validate DUPR range numerics.
    const minNum = minDuprRating ? parseFloat(minDuprRating) : NaN;
    const maxNum = maxDuprRating ? parseFloat(maxDuprRating) : NaN;
    if (ratingSource !== 'self') {
      if (minDuprRating && (Number.isNaN(minNum) || minNum < 0 || minNum > 8)) {
        toast({ title: language === 'vi' ? 'DUPR tối thiểu không hợp lệ' : 'Invalid min DUPR', variant: 'destructive' });
        return;
      }
      if (maxDuprRating && (Number.isNaN(maxNum) || maxNum < 0 || maxNum > 8)) {
        toast({ title: language === 'vi' ? 'DUPR tối đa không hợp lệ' : 'Invalid max DUPR', variant: 'destructive' });
        return;
      }
      if (!Number.isNaN(minNum) && !Number.isNaN(maxNum) && minNum > maxNum) {
        toast({ title: language === 'vi' ? 'DUPR tối thiểu lớn hơn tối đa' : 'Min DUPR exceeds max', variant: 'destructive' });
        return;
      }
    }

    const parsedCourts = parseCourtsInput(courts);

    const result = await createTournament(
      name,
      filledTeams.length,
      hasThirdPlace,
      earlyRoundsFormat,
      getEffectiveFinalsFormat(),
      parsedCourts,
      startTime || undefined,
      getEffectiveSemifinalsFormat(),
      {
        ratingSource,
        minDuprRating: !Number.isNaN(minNum) ? minNum : null,
        maxDuprRating: !Number.isNaN(maxNum) ? maxNum : null,
      },
    );

    if (!result.success || !result.tournament) {
      // W3.2 — quota-aware toast. LIMIT_REACHED comes from the
      // create_doubles_elimination_with_quota RPC when the user has hit
      // their profiles.tournament_create_quota cap.
      if (result.error === 'LIMIT_REACHED') {
        toast({
          title: t.quickTable.quota.limitReached,
          description: t.quickTable.quota.limitReachedDesc,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t.doublesElimination.setup.createError || "Error creating tournament", description: result.error, variant: "destructive" });
      return;
    }

    const teamsResult = await addTeams(
      result.tournament.id,
      filledTeams.map((tm) => {
        // Derive team_name: explicit > "P1 / P2" > "P1".
        const p1n = tm.player1.name.trim();
        const p2n = tm.player2.name.trim();
        const derivedName =
          tm.name.trim()
          || (p1n && p2n ? `${p1n} / ${p2n}` : (p1n || p2n || tm.name));
        const p1name = p1n || (tm.name.trim() || derivedName);
        const p2name = p2n || undefined;
        return {
          team_name: derivedName,
          player1_name: p1name,
          player2_name: p2name,
          seed: tm.seed && tm.seed.trim() ? parseInt(tm.seed) : undefined,
          player1_user_id: tm.player1.user_id,
          player2_user_id: tm.player2.user_id,
          dupr_avg_rating: tm.dupr_avg_rating ?? null,
          dupr_seed_source: tm.dupr_seed_source ?? 'none',
        };
      }),
    );

    if (!teamsResult.success) {
      toast({ title: t.doublesElimination.setup.addTeamsError || "Error adding teams", description: teamsResult.error, variant: "destructive" });
      return;
    }

    // DUPR Phase 1 (2026-05-29). Use 'dupr' seeding when organizer ran
    // Auto-seed (autoSeedSummary set) AND at least one team has DUPR avg.
    // Otherwise fall back to manual (seed column) when ANY team has a seed,
    // else 'random' to preserve legacy.
    const anyDuprSeeded = filledTeams.some(t => t.dupr_avg_rating != null);
    const anyManualSeed = filledTeams.some(t => t.seed && t.seed.trim());
    const strategy: 'manual' | 'random' | 'dupr' =
      autoSeedSummary && anyDuprSeeded ? 'dupr'
      : anyManualSeed ? 'manual'
      : 'random';
    const bracketResult = await generateBracket(result.tournament.id, parsedCourts, strategy);

    if (!bracketResult.success) {
      toast({ title: t.doublesElimination.setup.bracketError || "Error generating bracket", description: bracketResult.error, variant: "destructive" });
      return;
    }

    toast({ title: t.doublesElimination.setup.createSuccess || "Tournament created!" });
    navigate(`/tools/doubles-elimination/${result.tournament.share_id}`);
  };

  // ─── Login gate ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <TheLineLayout title={t.doublesElimination.setup.title} noindex={true} active="lab">
        <div className="tl-shell">
          <nav className="tl-breadcrumb">
            <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
            <span className="sep">/</span>
            <Link to="/tools/doubles-elimination">Doubles Elimination</Link>
            <span className="sep">/</span>
            <span className="current">{language === 'vi' ? 'Tạo mới' : 'New'}</span>
          </nav>
          <section style={{ padding: '48px 0 80px' }}>
            <div
              style={{
                ...surfaceCard,
                maxWidth: 480,
                margin: '0 auto',
                textAlign: 'center',
                padding: '40px 28px',
              }}
            >
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
                <Trophy className="w-7 h-7" style={{ color: 'var(--tl-green)' }} />
              </div>
              <h2 style={{ ...stepHeadingStyle, fontSize: 24, marginBottom: 10 }}>
                {t.doublesElimination.loginRequired}
              </h2>
              <button
                type="button"
                className="tl-btn green"
                onClick={() => navigate(getLoginUrl('/tools/doubles-elimination/new'))}
              >
                <LogIn className="w-4 h-4" />
                {t.auth.login}
              </button>
            </div>
          </section>
        </div>
      </TheLineLayout>
    );
  }

  // ─── Authenticated wizard ────────────────────────────────────────────────
  const stepKeys: Step[] = ['info', 'format', 'teams'];
  const currentStepIndex = stepKeys.indexOf(step);

  return (
    <TheLineLayout title={t.doublesElimination.setup.title} description={t.doublesElimination.description} noindex={true} active="lab">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/doubles-elimination">Doubles Elimination</Link>
          <span className="sep">/</span>
          <span className="current">{language === 'vi' ? 'Tạo mới' : 'New'}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === 'vi' ? 'Tạo giải mới · Loại kép' : 'New tournament · Double elimination'}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
            <em className="tl-serif">
              {language === 'vi' ? 'Tạo' : 'Create'}
            </em>{' '}
            <span className="sans">
              {language === 'vi' ? 'giải đấu.' : 'tournament.'}
            </span>
          </h1>
        </header>

        {/* Progress indicator */}
        <section style={{ marginTop: 32, marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexWrap: 'wrap',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 12,
            }}
          >
            {stepLabels.map((label, i) => {
              const isActive = i === currentStepIndex;
              const isPast = i < currentStepIndex;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      background: isActive
                        ? 'var(--tl-green)'
                        : isPast
                          ? 'var(--tl-green-glow)'
                          : 'var(--tl-surface)',
                      color: isActive
                        ? 'var(--tl-bg)'
                        : isPast
                          ? 'var(--tl-green)'
                          : 'var(--tl-fg-3)',
                      border: isActive
                        ? '1px solid var(--tl-green)'
                        : '1px solid var(--tl-border)',
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    style={{
                      color: isActive ? 'var(--tl-fg)' : 'var(--tl-fg-3)',
                      fontWeight: isActive ? 600 : 400,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {label}
                  </span>
                  {i < stepLabels.length - 1 && (
                    <ArrowRight
                      className="w-4 h-4"
                      style={{ color: 'var(--tl-fg-4)', marginLeft: 6 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ maxWidth: 720, margin: '0 auto', padding: '12px 0 0', width: '100%' }}>
          {/* Step 1: Info */}
          {step === 'info' && (
            <div style={surfaceCard}>
              <div style={{ marginBottom: 24 }}>
                <div style={stepKickerStyle}>
                  ◆ {language === 'vi' ? 'Bước 1 / 3' : 'Step 1 of 3'}
                </div>
                <h2 style={stepHeadingStyle}>
                  {language === 'vi' ? 'Thông tin giải đấu' : 'Tournament info'}
                </h2>
                <p style={stepDescStyle}>
                  {language === 'vi' ? 'Nhập thông tin cơ bản của giải đấu' : 'Enter basic tournament information'}
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t.doublesElimination.setup.tournamentName}{' '}
                    <span style={{ color: 'var(--tl-live)' }}>*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={t.doublesElimination.setup.tournamentNamePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    {t.doublesElimination.setup.teamCount}{' '}
                    <span style={{ color: 'var(--tl-live)' }}>*</span>{' '}
                    <span
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        color: 'var(--tl-fg-3)',
                        marginLeft: 4,
                      }}
                    >
                      ({language === 'vi' ? 'tối thiểu 32' : 'min 32'})
                    </span>
                  </Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {SUGGESTED_COUNTS.map((count) => {
                      const selected = teamCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          className="tl-btn"
                          onClick={() => setTeamCount(count)}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12.5,
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontVariantNumeric: 'tabular-nums',
                            ...(selected
                              ? {
                                  background: 'var(--tl-green)',
                                  color: 'var(--tl-bg)',
                                  borderColor: 'var(--tl-green)',
                                }
                              : {}),
                          }}
                        >
                          {count}
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    type="number"
                    min={32}
                    value={teamCount || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setTeamCount(0);
                      } else {
                        setTeamCount(parseInt(val) || 0);
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (val < 32) setTeamCount(32);
                    }}
                  />

                  {/* Hints */}
                  {(() => {
                    const hints = calculateTournamentHints(teamCount);
                    return (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 14,
                          borderRadius: 'var(--tl-radius)',
                          background: 'var(--tl-bg)',
                          border: '1px solid var(--tl-border)',
                          fontSize: 13,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tl-fg-2)' }}>
                          <span
                            style={{
                              color: hints.isEven ? 'var(--tl-green)' : 'var(--tl-gold)',
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 14,
                            }}
                          >
                            {hints.isEven ? '✓' : '⚠'}
                          </span>
                          <span>
                            {language === 'vi'
                              ? `Vòng 1: ${hints.r1Matches} trận`
                              : `Round 1: ${hints.r1Matches} matches`}
                            {!hints.isEven && (
                              <span style={{ color: 'var(--tl-gold)', marginLeft: 6 }}>
                                ({language === 'vi' ? 'lẻ — nên chọn số chẵn' : 'odd — even count recommended'})
                              </span>
                            )}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tl-fg-3)' }}>
                          <span style={{ color: 'var(--tl-fg-4)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>◆</span>
                          <span>
                            {language === 'vi' ? (
                              <>Vào Vòng 3: <strong style={{ color: 'var(--tl-fg)' }}>{hints.t3} VĐV</strong> (W1 + W2) → Vòng 4: {hints.r4Target} VĐV</>
                            ) : (
                              <>Round 3: <strong style={{ color: 'var(--tl-fg)' }}>{hints.t3} teams</strong> (W1 + W2) → Round 4: {hints.r4Target} teams</>
                            )}
                          </span>
                        </div>
                        {hints.byesToR4 > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tl-fg-3)' }}>
                            <span style={{ color: 'var(--tl-green)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>◆</span>
                            <span>
                              {language === 'vi' ? (
                                <>Được vào thẳng Vòng 4: <strong style={{ color: 'var(--tl-fg)' }}>{hints.byesToR4} VĐV</strong></>
                              ) : (
                                <>Bye to Round 4: <strong style={{ color: 'var(--tl-fg)' }}>{hints.byesToR4} teams</strong></>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <p
                    style={{
                      fontSize: 11.5,
                      color: 'var(--tl-fg-3)',
                      margin: '8px 0 0',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {language === 'vi'
                      ? 'Gợi ý: 32, 40, 48, 64, 80, 96, 128 đội để bracket cân đối'
                      : 'Suggested: 32, 40, 48, 64, 80, 96, 128 teams for balanced bracket'}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="space-y-2">
                    <Label htmlFor="courts">{t.doublesElimination.setup.courtCount}</Label>
                    <Input
                      id="courts"
                      value={courts}
                      onChange={(e) => setCourts(e.target.value)}
                      placeholder={language === 'vi' ? 'VD: 3, 4, 5, 6' : 'E.g.: 3, 4, 5, 6'}
                    />
                    <p style={{ fontSize: 11.5, color: 'var(--tl-fg-3)', margin: '4px 0 0', lineHeight: 1.45 }}>
                      {language === 'vi'
                        ? 'Nhập số sân cách nhau bởi dấu phẩy. VD: 3,4,5,6 = 4 sân đánh số 3-6'
                        : 'Court numbers separated by comma. E.g.: 3,4,5,6 = 4 courts numbered 3-6'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">{t.doublesElimination.setup.startTime}</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* DUPR Phase 1 (2026-05-29). Tournament-level rating gate.
                    UI refactor v2 (2026-05-29) — TheLine card pattern: 3
                    selectable cards instead of inline radios. Matches suggested-
                    counts pill style + hint-card aesthetic of Step 1. */}
                <div
                  style={{
                    paddingTop: 18,
                    borderTop: '1px solid var(--tl-border)',
                  }}
                  className="space-y-3"
                >
                  <div>
                    <div style={stepKickerStyle}>
                      ◆ {language === 'vi' ? 'Hệ số trình độ' : 'Rating system'}
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '6px 0 0', lineHeight: 1.5 }}>
                      {language === 'vi'
                        ? 'Cách lấy trình độ của VĐV. Chọn DUPR để bật auto-seed theo DUPR đôi của từng đội.'
                        : 'How player ratings are sourced. Pick DUPR to enable auto-seed by team doubles DUPR.'}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {(['self', 'either', 'dupr'] as const).map((rs) => {
                      const selected = ratingSource === rs;
                      const kicker = rs === 'self' ? '01' : rs === 'either' ? '02' : '03';
                      const title = rs === 'self'
                        ? (language === 'vi' ? 'Tự khai' : 'Self-report')
                        : rs === 'either'
                          ? (language === 'vi' ? 'Linh hoạt' : 'Either')
                          : 'DUPR';
                      const desc = rs === 'self'
                        ? (language === 'vi' ? 'Không yêu cầu DUPR. VĐV tự kê khai trình độ.' : 'No DUPR required. Self-reported skill.')
                        : rs === 'either'
                          ? (language === 'vi' ? 'Ưu tiên DUPR. Vẫn cho gõ tay nếu thiếu.' : 'Prefer DUPR. Fall back to manual.')
                          : (language === 'vi' ? 'Bắt buộc liên kết DUPR cho cả 2 VĐV.' : 'Require DUPR link for both players.');
                      return (
                        <button
                          key={rs}
                          type="button"
                          onClick={() => setRatingSource(rs)}
                          aria-pressed={selected}
                          style={{
                            textAlign: 'left',
                            padding: '14px 14px 12px',
                            borderRadius: 'var(--tl-radius-lg)',
                            background: selected ? 'var(--tl-green-glow)' : 'var(--tl-bg)',
                            border: selected ? '1px solid var(--tl-green)' : '1px solid var(--tl-border)',
                            cursor: 'pointer',
                            transition: 'background 120ms ease, border-color 120ms ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 10.5,
                              letterSpacing: '0.08em',
                              color: selected ? 'var(--tl-green)' : 'var(--tl-fg-4)',
                            }}>
                              ◆ {kicker}
                            </span>
                            {selected && (
                              <span style={{
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontSize: 10,
                                letterSpacing: '0.08em',
                                color: 'var(--tl-green)',
                                textTransform: 'uppercase',
                              }}>
                                ✓ {language === 'vi' ? 'Đã chọn' : 'Selected'}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontFamily: 'Instrument Serif, serif',
                            fontStyle: 'italic',
                            fontSize: 20,
                            lineHeight: 1.1,
                            color: 'var(--tl-fg)',
                          }}>
                            {title}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', lineHeight: 1.5 }}>
                            {desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {ratingSource !== 'self' && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: 14,
                        borderRadius: 'var(--tl-radius)',
                        background: 'var(--tl-bg)',
                        border: '1px solid var(--tl-border)',
                      }}
                    >
                      <div style={{ ...stepKickerStyle, marginBottom: 10 }}>
                        ◆ {language === 'vi' ? 'Khoảng DUPR cho phép' : 'DUPR range'}
                        <span style={{ color: 'var(--tl-fg-4)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                          ({language === 'vi' ? 'không bắt buộc' : 'optional'})
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="space-y-2">
                          <Label htmlFor="minDupr" style={{ fontSize: 12 }}>
                            {language === 'vi' ? 'Tối thiểu' : 'Min'}
                          </Label>
                          <Input
                            id="minDupr"
                            type="number"
                            step="0.01"
                            min="0"
                            max="8"
                            placeholder="3.00"
                            value={minDuprRating}
                            onChange={(e) => setMinDuprRating(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxDupr" style={{ fontSize: 12 }}>
                            {language === 'vi' ? 'Tối đa' : 'Max'}
                          </Label>
                          <Input
                            id="maxDupr"
                            type="number"
                            step="0.01"
                            min="0"
                            max="8"
                            placeholder="4.50"
                            value={maxDuprRating}
                            onChange={(e) => setMaxDuprRating(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                  <button type="button" className="tl-btn green" onClick={handleNext}>
                    {t.quickTable.continue}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Format */}
          {step === 'format' && (
            <div style={surfaceCard}>
              <div style={{ marginBottom: 24 }}>
                <div style={stepKickerStyle}>
                  ◆ {language === 'vi' ? 'Bước 2 / 3' : 'Step 2 of 3'}
                </div>
                <h2 style={stepHeadingStyle}>
                  {language === 'vi' ? 'Format thi đấu' : 'Match format'}
                </h2>
                <p style={stepDescStyle}>
                  {language === 'vi' ? 'Chọn số game cho mỗi trận đấu' : 'Select games per match'}
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>{t.doublesElimination.setup.earlyRoundsFormat}</Label>
                  <RadioGroup
                    value={earlyRoundsFormat}
                    onValueChange={(v) => setEarlyRoundsFormat(v as BestOfFormat)}
                    className="flex flex-wrap gap-4"
                  >
                    {(['bo1', 'bo3', 'bo5'] as const).map((fmt) => (
                      <div key={fmt} className="flex items-center space-x-2">
                        <RadioGroupItem value={fmt} id={`early-${fmt}`} />
                        <Label htmlFor={`early-${fmt}`} className="cursor-pointer">
                          <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 600 }}>
                            {fmt.toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--tl-fg-3)', marginLeft: 6, fontSize: 12.5 }}>
                            ({fmt === 'bo1' ? '1 game' : fmt === 'bo3' ? (language === 'vi' ? 'Thắng 2/3' : 'Win 2/3') : (language === 'vi' ? 'Thắng 3/5' : 'Win 3/5')})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div
                  style={{
                    paddingTop: 16,
                    borderTop: '1px solid var(--tl-border)',
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="customSemifinals"
                      checked={customSemifinals}
                      onCheckedChange={(checked) => setCustomSemifinals(checked as boolean)}
                    />
                    <Label htmlFor="customSemifinals" className="cursor-pointer">
                      {language === 'vi' ? 'Bán kết (tùy chỉnh format khác vòng ngoài)' : 'Semifinals (custom format)'}
                    </Label>
                  </div>
                  {customSemifinals && (
                    <RadioGroup
                      value={semifinalsFormat}
                      onValueChange={(v) => setSemifinalsFormat(v as BestOfFormat)}
                      className="flex flex-wrap gap-4 pl-6"
                    >
                      {(['bo3', 'bo5'] as const).map((fmt) => (
                        <div key={fmt} className="flex items-center space-x-2">
                          <RadioGroupItem value={fmt} id={`semi-${fmt}`} />
                          <Label htmlFor={`semi-${fmt}`} className="cursor-pointer">
                            <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 600 }}>
                              {fmt.toUpperCase()}
                            </span>
                            <span style={{ color: 'var(--tl-fg-3)', marginLeft: 6, fontSize: 12.5 }}>
                              ({fmt === 'bo3' ? (language === 'vi' ? 'Thắng 2/3' : 'Win 2/3') : (language === 'vi' ? 'Thắng 3/5' : 'Win 3/5')})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: 16,
                    borderTop: '1px solid var(--tl-border)',
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="customFinals"
                      checked={customFinals}
                      onCheckedChange={(checked) => setCustomFinals(checked as boolean)}
                    />
                    <Label htmlFor="customFinals" className="cursor-pointer">
                      {language === 'vi' ? 'Chung kết (tùy chỉnh format khác vòng ngoài)' : 'Finals (custom format)'}
                    </Label>
                  </div>
                  {customFinals && (
                    <RadioGroup
                      value={finalsFormat}
                      onValueChange={(v) => setFinalsFormat(v as BestOfFormat)}
                      className="flex flex-wrap gap-4 pl-6"
                    >
                      {(['bo3', 'bo5'] as const).map((fmt) => (
                        <div key={fmt} className="flex items-center space-x-2">
                          <RadioGroupItem value={fmt} id={`finals-${fmt}`} />
                          <Label htmlFor={`finals-${fmt}`} className="cursor-pointer">
                            <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 600 }}>
                              {fmt.toUpperCase()}
                            </span>
                            <span style={{ color: 'var(--tl-fg-3)', marginLeft: 6, fontSize: 12.5 }}>
                              ({fmt === 'bo3' ? (language === 'vi' ? 'Thắng 2/3' : 'Win 2/3') : (language === 'vi' ? 'Thắng 3/5' : 'Win 3/5')})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: 16,
                    borderTop: '1px solid var(--tl-border)',
                  }}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id="thirdPlace"
                    checked={hasThirdPlace}
                    onCheckedChange={(checked) => setHasThirdPlace(checked as boolean)}
                  />
                  <Label htmlFor="thirdPlace" className="cursor-pointer">
                    {t.doublesElimination.setup.thirdPlaceMatch}
                  </Label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
                  <button type="button" className="tl-btn" onClick={handleBack}>
                    <ArrowLeft className="w-4 h-4" />
                    {t.quickTable.back}
                  </button>
                  <button type="button" className="tl-btn green" onClick={handleNext}>
                    {t.quickTable.continue}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Teams */}
          {step === 'teams' && (
            <div style={surfaceCard}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 24,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={stepKickerStyle}>
                    ◆ {language === 'vi' ? 'Bước 3 / 3' : 'Step 3 of 3'}
                  </div>
                  <h2 style={stepHeadingStyle}>
                    {language === 'vi' ? 'Danh sách đội' : 'Team list'}{' '}
                    <span style={{ color: 'var(--tl-fg-3)', fontSize: 18 }}>
                      ({teams.filter(t => t.name.trim()).length}/{teams.length})
                    </span>
                  </h2>
                  <p style={stepDescStyle}>
                    {language === 'vi' ? 'Nhập thông tin các đội tham gia' : 'Enter team information'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ratingSource !== 'self' && (
                    <button
                      type="button"
                      className="tl-btn green"
                      disabled={autoSeedLoading || !canAutoSeed}
                      title={!canAutoSeed
                        ? (language === 'vi' ? 'Cần ≥ 50% đội liên kết DUPR mới bật được' : 'Need ≥ 50% teams linked to DUPR')
                        : undefined}
                      onClick={handleAutoSeedByDupr}
                    >
                      <Sparkles className="w-4 h-4" />
                      {autoSeedLoading
                        ? (language === 'vi' ? 'Đang seed…' : 'Seeding…')
                        : (language === 'vi' ? 'Auto-seed theo DUPR' : 'Auto-seed by DUPR')}
                    </button>
                  )}
                  <button type="button" className="tl-btn" onClick={shuffleTeams}>
                    <Shuffle className="w-4 h-4" />
                    {t.quickTable.setup.shuffle}
                  </button>
                </div>
              </div>

              {autoSeedSummary && (
                <SeedExplainerCard
                  total={autoSeedSummary.total}
                  withDupr={autoSeedSummary.withDupr}
                  stale={autoSeedSummary.stale}
                  approx={autoSeedSummary.approx}
                  format="doubles"
                />
              )}

              {/* DUPR Phase 1 (2026-05-29). Dual-mode team list:
                  - Optional team name + club row (top)
                  - 2 player slots (text or member-linked) below
                  Each card replaces the legacy single-row grid. */}
              <div
                style={{
                  maxHeight: 540,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  paddingRight: 4,
                  marginTop: 12,
                }}
              >
                {teams.map((team, index) => {
                  const excludeIds = collectLinkedUserIds(teams, index);
                  return (
                    <div
                      key={team.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 90px 60px 32px',
                        gap: 8,
                        alignItems: 'start',
                        padding: 10,
                        background: 'var(--tl-bg)',
                        border: '1px solid var(--tl-border)',
                        borderRadius: 'var(--tl-radius)',
                      }}
                    >
                      <div
                        style={{
                          textAlign: 'center',
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                          fontSize: 12,
                          color: 'var(--tl-fg-3)',
                          fontVariantNumeric: 'tabular-nums',
                          paddingTop: 8,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Input
                          placeholder={language === 'vi' ? 'Tên đội (tuỳ chọn — auto từ 2 VĐV)' : 'Team name (optional — auto from players)'}
                          value={team.name}
                          onChange={(e) => updateTeam(index, 'name', e.target.value)}
                          style={{ fontSize: 13 }}
                        />
                        <DoublesEliminationPlayerInput
                          value={team.player1}
                          onChange={(next) => updateTeamPlayer(index, 'player1', next)}
                          placeholder={language === 'vi' ? 'VĐV 1 (gõ tên hoặc 🔍 tìm member)' : 'Player 1 (type or 🔍 find member)'}
                          excludeUserIds={excludeIds}
                        />
                        <DoublesEliminationPlayerInput
                          value={team.player2}
                          onChange={(next) => updateTeamPlayer(index, 'player2', next)}
                          placeholder={language === 'vi' ? 'VĐV 2 (gõ tên hoặc 🔍 tìm member)' : 'Player 2 (type or 🔍 find member)'}
                          excludeUserIds={excludeIds}
                        />
                        {team.dupr_avg_rating != null && (
                          <div style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontSize: 11,
                            color: 'var(--tl-green)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            DUPR avg {team.dupr_avg_rating.toFixed(2)}
                            {team.dupr_seed_source === 'approx' && (
                              <span style={{ color: 'rgb(96,165,250)', marginLeft: 6 }}>
                                ({language === 'vi' ? 'ước tính' : 'approx'})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Input
                        placeholder="Team"
                        value={team.team}
                        onChange={(e) => updateTeam(index, 'team', e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={team.seed}
                        onChange={(e) => updateTeam(index, 'seed', e.target.value)}
                        placeholder={language === 'vi' ? 'Seed' : 'Seed'}
                        style={{ fontSize: 13 }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamSlot(index)}
                        disabled={teams.length <= 32}
                        className="text-foreground-muted hover:text-destructive"
                        style={{ marginTop: 2 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Add team */}
              <div style={{ paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--tl-border)' }}>
                <button
                  type="button"
                  className="tl-btn"
                  onClick={addTeamSlot}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Plus className="w-4 h-4" />
                  {language === 'vi' ? 'Thêm đội/VĐV' : 'Add team/player'}
                </button>
              </div>

              <p
                style={{
                  fontSize: 12.5,
                  color: 'var(--tl-fg-3)',
                  margin: '12px 0 0',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: 'var(--tl-green)', marginRight: 4 }}>◆</span>
                {language === 'vi'
                  ? 'Tip: Đội cùng Team/CLB sẽ được ưu tiên tránh gặp nhau ở vòng đầu'
                  : 'Tip: Same team/club will be prioritized to avoid early matchups'}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 16,
                  marginTop: 16,
                  borderTop: '1px solid var(--tl-border)',
                  position: 'sticky',
                  bottom: 0,
                  background: 'var(--tl-bg-elev)',
                }}
              >
                <button type="button" className="tl-btn" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4" />
                  {t.quickTable.back}
                </button>
                <button
                  type="button"
                  className="tl-btn green"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {loading ? t.doublesElimination.setup.creating : t.doublesElimination.setup.createBtn}
                  <Trophy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>
        <div style={{ height: 80 }} />
      </div>
    </TheLineLayout>
  );
}
