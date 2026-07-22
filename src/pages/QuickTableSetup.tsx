import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft';
import { DraftRestoredBanner, DraftSaveStatus } from '@/components/wizard/DraftAutosave';
import { completeJourney, startJourney, trackJourneyStep } from '@/lib/journeys';
import { TheLineLayout } from '@/components/layout';
import { useQuickTable, type QuickTable } from '@/hooks/useQuickTable';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ArrowRight, Shuffle, Users, Wand2, Hand } from 'lucide-react';
import { toast } from 'sonner';
import { ManualGroupAssignment } from '@/components/quicktable/ManualGroupAssignment';
import CourtTimeSettings from '@/components/quicktable/CourtTimeSettings';
import { useI18n } from '@/i18n';
import { useConfirm } from '@/hooks/useConfirm';
import { parseCourtsInput } from '@/lib/round-robin';
import { surfaceCard, stepKickerStyle, stepHeadingStyle, stepDescStyle } from '@/components/tournament/setup-styles';

interface PlayerInput {
  id: string;
  name: string;
  name2: string;   // VĐV 2 (chỉ đôi); đôi gộp "name & name2" làm nhãn
  team: string;
  seed: string;
}

type AssignmentMode = 'auto' | 'manual';
type Step = 'input' | 'assignment';

const QuickTableSetup = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const {
    getTableByShareId, setupRosterAtomic, deleteTable,
  } = useQuickTable();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<PlayerInput[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('auto');
  const [step, setStep] = useState<Step>('input');

  const [courts, setCourts] = useState('');
  const [startTime, setStartTime] = useState('');

  // ── UX-05 journey instrumentation (organizer_tournament, tool=quicktable) ─
  // Entry condition: the pre-created table loaded and the roster form renders.
  const journeyStartedRef = useRef(false);
  useEffect(() => {
    if (!loading && table && !journeyStartedRef.current) {
      journeyStartedRef.current = true;
      startJourney('organizer_tournament');
      trackJourneyStep('organizer_tournament', 'organizer_tournament_creation_started', {
        tool: 'quicktable',
        auth_state: user ? 'authenticated' : 'anonymous',
      });
    }
  }, [loading, table, user]);

  // ── UX-04 autosave (local-first, docs/proposals/ux-01-05) ────────────────
  // The table row is pre-created upstream, so shareId scopes the draft.
  // ManualGroupAssignment's internal drag state is child-owned and not
  // serialized — restoring on the assignment step re-starts the grouping.
  const draftValue = useMemo(
    () => ({ players, assignmentMode, step, courts, startTime }),
    [players, assignmentMode, step, courts, startTime],
  );
  // Initial state = all-empty roster rows + defaults, so "dirty" is simply
  // "any field has content / any non-default choice".
  const dirty =
    players.some(p => p.name || p.name2 || p.team || p.seed) ||
    courts !== '' ||
    startTime !== '' ||
    assignmentMode !== 'auto';
  const draft = useAutosaveDraft<typeof draftValue>({
    key: shareId ? `draft:quicktable:${shareId}` : null,
    value: draftValue,
    enabled: dirty && !saving,
  });
  const [restoredDraft, setRestoredDraft] = useState(false);
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    // Apply once, AFTER loadTable seeded the empty roster (mount-time apply
    // would be clobbered by setPlayers(initialPlayers)). Shape-guarded.
    if (loading || !table || restoreAppliedRef.current) return;
    restoreAppliedRef.current = true;
    const d = draft.initial;
    if (!d || !Array.isArray(d.players)) return;
    const restoredPlayers: PlayerInput[] = d.players
      .filter((p): p is PlayerInput => Boolean(p) && typeof p.name === 'string')
      .map((p, i) => ({
        id: typeof p.id === 'string' ? p.id : `new-${i}`,
        name: p.name,
        name2: typeof p.name2 === 'string' ? p.name2 : '',
        team: typeof p.team === 'string' ? p.team : '',
        seed: typeof p.seed === 'string' ? p.seed : '',
      }));
    if (restoredPlayers.length < 2) return;
    setPlayers(restoredPlayers);
    if (d.assignmentMode === 'auto' || d.assignmentMode === 'manual') setAssignmentMode(d.assignmentMode);
    if (typeof d.courts === 'string') setCourts(d.courts);
    if (typeof d.startTime === 'string') setStartTime(d.startTime);
    if (d.step === 'input' || d.step === 'assignment') setStep(d.step);
    setRestoredDraft(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, table]);

  const resetToInitial = () => {
    draft.clear();
    setPlayers(
      Array.from({ length: table?.player_count ?? 0 }, (_, i) => ({
        id: `new-${i}`,
        name: '',
        name2: '',
        team: '',
        seed: '',
      })),
    );
    setAssignmentMode('auto');
    setStep('input');
    setCourts('');
    setStartTime('');
  };

  useEffect(() => {
    const loadTable = async () => {
      if (!shareId) return;

      setLoading(true);
      const data = await getTableByShareId(shareId);

      if (data) {
        setTable(data.table);

        if (data.table.requires_registration) {
          navigate(`/tools/quick-tables/${shareId}`);
          return;
        }

        if (data.players.length > 0) {
          navigate(`/tools/quick-tables/${shareId}`);
          return;
        }

        const initialPlayers: PlayerInput[] = Array.from(
          { length: data.table.player_count },
          (_, i) => ({
            id: `new-${i}`,
            name: '',
            name2: '',
            team: '',
            seed: '',
          }),
        );
        setPlayers(initialPlayers);
      }

      setLoading(false);
    };

    loadTable();
  }, [shareId, getTableByShareId, navigate]);

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addPlayerSlot = () => {
    setPlayers(prev => [
      ...prev,
      { id: `new-${prev.length}`, name: '', name2: '', team: '', seed: '' },
    ]);
  };

  const removePlayerSlot = (index: number) => {
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const shufflePlayers = () => {
    setPlayers(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const isDoubles = table?.is_doubles === true;
  const filledPlayers = players.filter(p => isDoubles ? (p.name.trim() && p.name2.trim()) : p.name.trim());

  const handleProceedToAssignment = () => {
    if (filledPlayers.length < 2) {
      toast.error(t.quickTable.setup.minPlayersError);
      return;
    }

    if (assignmentMode === 'manual' && table?.format === 'round_robin' && table.group_count) {
      setStep('assignment');
    } else {
      handleAutoSubmit();
    }
  };

  const handleAutoSubmit = async () => {
    if (!table) return;
    trackJourneyStep('organizer_tournament', 'organizer_tournament_submit_attempted', {
      tool: 'quicktable',
      auth_state: user ? 'authenticated' : 'anonymous',
    });

    setSaving(true);

    try {
      const playerData = filledPlayers.map(p => ({
        name: isDoubles ? `${p.name.trim()} & ${p.name2.trim()}` : p.name.trim(),
        player1_name: p.name.trim(),
        player2_name: isDoubles ? p.name2.trim() : undefined,
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const parsedCourts = parseCourtsInput(courts);
      const created = await setupRosterAtomic(
        table.id,
        playerData,
        table.group_count ?? 1,
        undefined,
        parsedCourts,
        startTime || null,
      );
      if (!created) throw new Error('Failed to set up table');

      draft.clear();
      completeJourney('organizer_tournament', 'organizer_tournament_created', {
        tool: 'quicktable',
        auth_state: user ? 'authenticated' : 'anonymous',
      });
      toast.success(t.quickTable.setup.createdSuccess);
      navigate(`/tools/quick-tables/${shareId}`);
    } catch (error) {
      console.error('Error setting up table:', error);
      toast.error(t.quickTable.setup.errorOccurred);
    } finally {
      setSaving(false);
    }
  };

  const handleManualAssignmentComplete = async (groupAssignments: Map<number, PlayerInput[]>) => {
    if (!table || !table.group_count) return;
    trackJourneyStep('organizer_tournament', 'organizer_tournament_submit_attempted', {
      tool: 'quicktable',
      auth_state: user ? 'authenticated' : 'anonymous',
    });

    setSaving(true);

    try {
      const playerData = filledPlayers.map(p => ({
        name: isDoubles ? `${p.name.trim()} & ${p.name2.trim()}` : p.name.trim(),
        player1_name: p.name.trim(),
        player2_name: isDoubles ? p.name2.trim() : undefined,
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const assignments = filledPlayers.map((player) => {
        for (let groupIndex = 0; groupIndex < table.group_count!; groupIndex++) {
          if ((groupAssignments.get(groupIndex) || []).some(candidate => candidate.id === player.id)) {
            return groupIndex;
          }
        }
        return -1;
      });
      const created = await setupRosterAtomic(
        table.id,
        playerData,
        table.group_count,
        assignments,
        parseCourtsInput(courts),
        startTime || null,
      );
      if (!created) throw new Error('Failed to set up table');

      draft.clear();
      completeJourney('organizer_tournament', 'organizer_tournament_created', {
        tool: 'quicktable',
        auth_state: user ? 'authenticated' : 'anonymous',
      });
      toast.success(t.quickTable.setup.manualSuccess);
      navigate(`/tools/quick-tables/${shareId}`);
    } catch (error) {
      console.error('Error setting up table with manual assignment:', error);
      toast.error(t.quickTable.setup.errorOccurred);
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading + 404 states ────────────────────────────────────────────────
  if (loading) {
    return (
      <TheLineLayout title="Quick Table Setup" noindex={true} active="lab">
        <div className="tl-shell">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              color: 'var(--tl-fg-3)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t.common.loading}
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!table) {
    return (
      <TheLineLayout title="Quick Table Setup" noindex={true} active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{t.quickTable.setup.notFound}</h3>
            <p>{t.quickTable.setup.notFoundDesc}</p>
            <Link to="/tools/quick-tables" className="tl-btn">
              ← {t.quickTable.view.goBack}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const formatLabel = table.format === 'round_robin' ? 'Round Robin' : t.quickTable.largePlayoff;

  // ─── Manual assignment step ─────────────────────────────────────────────
  if (step === 'assignment' && table.group_count) {
    return (
      <TheLineLayout title={`Chia bảng - ${table.name}`} noindex={true} active="lab">
        <div className="tl-shell">
          <nav className="tl-breadcrumb">
            <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
            <span className="sep">/</span>
            <Link to="/tools/quick-tables">Quick Tables</Link>
            <span className="sep">/</span>
            <span className="current">{table.name}</span>
          </nav>

          <header className="tl-page-head">
            <div className="kicker">
              ◆ {language === 'vi' ? 'Chia bảng thủ công' : 'Manual group assignment'}
            </div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
              <em className="tl-serif">{table.name}</em>
            </h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 12,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span>{formatLabel}</span>
              <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
              <span>{table.group_count} {t.quickTable.groups.groups}</span>
              <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
              <span>{filledPlayers.length} {t.quickTable.players}</span>
            </div>
          </header>

          <section style={{ padding: '32px 0 80px', maxWidth: 960, margin: '0 auto' }}>
            <div style={surfaceCard}>
              {restoredDraft && <DraftRestoredBanner onStartOver={resetToInitial} />}
              <div style={{ marginBottom: 20 }}>
                <div style={stepKickerStyle}>
                  <Hand className="inline w-3 h-3" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {t.quickTable.manualAssignment.title}
                </div>
                <h2 style={stepHeadingStyle}>{t.quickTable.manualAssignment.title}</h2>
                <p style={stepDescStyle}>{t.quickTable.manualAssignment.description}</p>
              </div>
              <ManualGroupAssignment
                players={filledPlayers}
                groupCount={table.group_count}
                onComplete={handleManualAssignmentComplete}
                onCancel={() => setStep('input')}
              />
              {saving && (
                <div
                  style={{
                    marginTop: 16,
                    textAlign: 'center',
                    color: 'var(--tl-fg-3)',
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.quickTable.setup.processing}
                </div>
              )}
            </div>
          </section>
        </div>
      </TheLineLayout>
    );
  }

  const handleDeleteTable = async () => {
    if (!table) return;
    if (!(await confirm({ description: `Bạn có chắc chắn muốn xoá giải "${table.name}"? Tất cả dữ liệu sẽ bị xoá vĩnh viễn.`, destructive: true }))) {
      return;
    }
    const success = await deleteTable(table.id);
    if (success) {
      navigate('/tools/quick-tables');
    }
  };

  const canDeleteTable = isAdmin || (user && table.creator_user_id === user.id);

  // ─── Player input step ──────────────────────────────────────────────────
  return (
    <TheLineLayout title={`Nhập VĐV - ${table.name}`} noindex={true} active="lab">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/quick-tables">Quick Tables</Link>
          <span className="sep">/</span>
          <span className="current">{table.name}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === 'vi' ? 'Nhập danh sách VĐV' : 'Enter player roster'}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
            <em className="tl-serif">{table.name}</em>
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 12,
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>{formatLabel}</span>
            {table.group_count && (
              <>
                <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
                <span>{table.group_count} {t.quickTable.groups.groups}</span>
              </>
            )}
            <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
            <span>{table.player_count} {t.quickTable.players}</span>
            {canDeleteTable && (
              <button
                type="button"
                onClick={handleDeleteTable}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid var(--tl-border)',
                  color: 'var(--tl-live)',
                  font: 'inherit',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  cursor: 'pointer',
                }}
              >
                <Trash2 className="w-3 h-3" />
                {language === 'vi' ? 'Xoá giải' : 'Delete'}
              </button>
            )}
          </div>
        </header>

        <section style={{ padding: '32px 0 0', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <div style={surfaceCard}>
            {restoredDraft && <DraftRestoredBanner onStartOver={resetToInitial} />}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div>
                <div style={stepKickerStyle}>◆ {language === 'vi' ? 'VĐV' : 'Players'}</div>
                <h2 style={stepHeadingStyle}>{t.quickTable.setup.inputPlayers}</h2>
                <p style={stepDescStyle}>{t.quickTable.setup.inputPlayersDesc}</p>
              </div>
              <button type="button" className="tl-btn" onClick={shufflePlayers}>
                <Shuffle className="w-4 h-4" />
                {t.quickTable.setup.shuffle}
              </button>
            </div>

            <div className="space-y-2">
              {players.map((player, index) => (
                <div key={player.id} className="flex items-center gap-2">
                  <span
                    style={{
                      width: 24,
                      flexShrink: 0,
                      textAlign: 'center',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      fontSize: 12,
                      color: 'var(--tl-fg-3)',
                    }}
                  >
                    {index + 1}
                  </span>
                  {isDoubles ? (
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <Input
                        value={player.name}
                        onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                        placeholder="VĐV 1"
                        className="min-w-0 h-10 sm:h-9"
                      />
                      <Input
                        value={player.name2}
                        onChange={(e) => updatePlayer(index, 'name2', e.target.value)}
                        placeholder="VĐV 2"
                        className="min-w-0 h-10 sm:h-9"
                      />
                    </div>
                  ) : (
                    <Input
                      value={player.name}
                      onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                      placeholder={t.quickTable.setup.playerNamePlaceholder}
                      className="flex-1 min-w-0 h-10 sm:h-9"
                    />
                  )}
                  <Input
                    value={player.team}
                    onChange={(e) => updatePlayer(index, 'team', e.target.value)}
                    placeholder={t.quickTable.setup.teamPlaceholder}
                    className="w-16 sm:w-24 h-10 sm:h-9 flex-shrink-0"
                  />
                  <Input
                    type="number"
                    value={player.seed}
                    onChange={(e) => updatePlayer(index, 'seed', e.target.value)}
                    placeholder={t.quickTable.setup.seedPlaceholder}
                    className="w-14 sm:w-16 h-10 sm:h-9 flex-shrink-0"
                    min={1}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePlayerSlot(index)}
                    disabled={players.length <= 2}
                    className="text-foreground-muted hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--tl-border)' }}>
              <button type="button" className="tl-btn" onClick={addPlayerSlot} style={{ width: '100%', justifyContent: 'center' }}>
                <Plus className="w-4 h-4" />
                {t.quickTable.setup.addPlayer}
              </button>
            </div>

            {/* Assignment Mode (round robin only) */}
            {table.format === 'round_robin' && table.group_count && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--tl-border)' }}>
                <Label className="text-sm font-medium mb-3 block">
                  {t.quickTable.setup.assignmentMethod}
                </Label>
                <RadioGroup
                  value={assignmentMode}
                  onValueChange={(value) => setAssignmentMode(value as AssignmentMode)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <AssignmentModeOption
                    value="auto"
                    icon={<Wand2 className="w-5 h-5" />}
                    title={t.quickTable.setup.autoMode}
                    desc={t.quickTable.setup.autoModeDesc}
                    selected={assignmentMode === 'auto'}
                  />
                  <AssignmentModeOption
                    value="manual"
                    icon={<Hand className="w-5 h-5" />}
                    title={t.quickTable.setup.manualMode}
                    desc={t.quickTable.setup.manualModeDesc}
                    selected={assignmentMode === 'manual'}
                  />
                </RadioGroup>
              </div>
            )}

            {table.format === 'round_robin' && (
              <CourtTimeSettings
                courts={courts}
                onCourtsChange={setCourts}
                startTime={startTime}
                onStartTimeChange={setStartTime}
              />
            )}

            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 'var(--tl-radius)',
                background: 'var(--tl-bg)',
                border: '1px solid var(--tl-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Users className="w-4 h-4" style={{ color: 'var(--tl-green)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--tl-fg)', fontSize: 13.5, margin: 0 }}>
                    {t.quickTable.setup.tips}
                  </p>
                  <ul
                    style={{
                      color: 'var(--tl-fg-2)',
                      fontSize: 13,
                      lineHeight: 1.55,
                      margin: '6px 0 0',
                      paddingLeft: 0,
                      listStyle: 'none',
                    }}
                  >
                    <li>· {t.quickTable.setup.tipTeam}</li>
                    <li>· {t.quickTable.setup.tipSeed}</li>
                    {assignmentMode === 'auto' && <li>· {t.quickTable.setup.tipAuto}</li>}
                    {assignmentMode === 'manual' && <li>· {t.quickTable.setup.tipManual}</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                position: 'sticky',
                bottom: 16,
                zIndex: 5,
              }}
            >
              <DraftSaveStatus lastSavedAt={draft.lastSavedAt} saveFailed={draft.saveFailed} />
              <button
                type="button"
                className="tl-btn green"
                style={{ width: '100%', justifyContent: 'center', padding: '14px 18px' }}
                onClick={handleProceedToAssignment}
                disabled={saving || filledPlayers.length < 2}
              >
                {saving
                  ? t.quickTable.setup.processing
                  : assignmentMode === 'manual' && table.format === 'round_robin' && table.group_count
                    ? t.quickTable.setup.continueManual
                    : t.quickTable.setup.createBracketBtn}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
        <div style={{ height: 80 }} />
      </div>
    </TheLineLayout>
  );
};

function AssignmentModeOption({
  value, icon, title, desc, selected,
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected: boolean;
}) {
  return (
    <div className="relative">
      <RadioGroupItem value={value} id={`mode-${value}`} className="peer sr-only" />
      <Label
        htmlFor={`mode-${value}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: 14,
          borderRadius: 'var(--tl-radius)',
          border: `1px solid ${selected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
          background: selected ? 'var(--tl-green-glow)' : 'var(--tl-bg)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <span
          style={{
            color: selected ? 'var(--tl-green)' : 'var(--tl-fg-2)',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {icon}
        </span>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13.5, margin: 0, color: 'var(--tl-fg)' }}>
            {title}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '4px 0 0' }}>
            {desc}
          </p>
        </div>
      </Label>
    </div>
  );
}

export default QuickTableSetup;
