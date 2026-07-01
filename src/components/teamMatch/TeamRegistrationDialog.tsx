import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useMasterTeams, useMasterTeamWithRoster, useMasterTeamManagement } from '@/hooks/useMasterTeams';
import { Loader2, Plus, Users, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DuprEligibilityCheck } from '@/components/dupr/DuprEligibilityCheck';
import { DuprSsoModal } from '@/components/dupr/DuprSsoModal';
import { useDuprConnection, useInvalidateDuprConnection } from '@/hooks/useDuprConnection';
import { isDuprEligible } from '@/lib/duprEligibility';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
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

interface TeamRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  maxRosterSize: number;
  /** MLP DUPR gating — when true, captain must have a verified DUPR within range. */
  requireDupr?: boolean;
  duprMaxMale?: number | null;
  duprMaxFemale?: number | null;
  /** Skip the mode picker — open straight into create or use-existing. */
  initialMode?: RegistrationMode;
  onSuccess?: () => void;
}

type RegistrationMode = 'select' | 'create' | 'use-existing';

export function TeamRegistrationDialog({
  open,
  onOpenChange,
  tournamentId,
  maxRosterSize,
  requireDupr = false,
  duprMaxMale = null,
  duprMaxFemale = null,
  initialMode = 'select',
  onSuccess,
}: TeamRegistrationDialogProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isCreatingTeam, registerExistingTeam } = useTeamMatchTeamManagement();
  const { createMasterTeam } = useMasterTeamManagement();
  const { data: masterTeams, isLoading: isLoadingMasterTeams } = useMasterTeams();
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;

  const [mode, setMode] = useState<RegistrationMode>(initialMode);
  const [selectedMasterTeamId, setSelectedMasterTeamId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [excludedMemberIds, setExcludedMemberIds] = useState<Set<string>>(new Set());

  const { team: selectedMasterTeam, roster: masterRoster, isLoading: isLoadingRoster } = useMasterTeamWithRoster(
    selectedMasterTeamId || undefined,
  );

  const txt = {
    titleSelect: language === 'vi' ? 'Đăng ký đội' : 'Register team',
    titleCreate: c.createTeamTitle,
    titleUseExisting: language === 'vi' ? 'Chọn đội đã có' : 'Pick an existing team',
    descSelect: language === 'vi'
      ? 'Chọn cách đăng ký đội của bạn'
      : 'Pick how you want to register your team',
    descCreate: language === 'vi'
      ? 'Đăng ký đội mới để tham gia giải đấu'
      : 'Register a new team for this tournament',
    descUseExisting: language === 'vi'
      ? 'Sử dụng đội đã tạo trước đó'
      : 'Use a team you already created',
    createOpt: language === 'vi' ? 'Tạo đội mới' : 'Create new team',
    createOptDesc: language === 'vi'
      ? 'Đăng ký đội mới cho giải đấu này'
      : 'Register a brand-new team for this tournament',
    useOpt: language === 'vi' ? 'Sử dụng đội đã có' : 'Use an existing team',
    useOptCountLoading: language === 'vi' ? 'Đang tải...' : 'Loading...',
    useOptCount: (n: number) =>
      language === 'vi' ? `Bạn có ${n} đội` : `You have ${n} team${n === 1 ? '' : 's'}`,
    useOptNone: language === 'vi' ? 'Bạn chưa có đội nào' : 'No teams yet',
    teamNameLabel: c.teamNameLabel,
    teamNamePh: language === 'vi' ? 'VD: Dragon Warriors' : 'E.g. Dragon Warriors',
    captainNameLabel: c.captainNameLabel,
    captainNamePh: language === 'vi' ? 'Tên của bạn' : 'Your name',
    genderLabel: language === 'vi' ? 'Giới tính' : 'Gender',
    male: c.male,
    female: c.female,
    skillLabel: language === 'vi' ? 'Trình độ (tùy chọn)' : 'Skill (optional)',
    skillPh: language === 'vi' ? 'Chọn trình độ' : 'Pick skill',
    back: language === 'vi' ? 'Quay lại' : 'Back',
    create: language === 'vi' ? 'Tạo đội' : 'Create team',
    register: language === 'vi' ? 'Đăng ký' : 'Register',
    createdAt: (date: Date) =>
      language === 'vi'
        ? `Tạo lúc: ${date.toLocaleDateString('vi-VN')}`
        : `Created: ${date.toLocaleDateString('en-US')}`,
    rosterTitle: language === 'vi' ? 'Thành viên đội' : 'Team roster',
    counter: (cur: number, max: number) =>
      language === 'vi' ? `${cur}/${max} người` : `${cur}/${max} players`,
    deselectHint: (n: number) =>
      language === 'vi'
        ? `Bỏ chọn ${n > 0 ? `thêm ${n}` : '0'} người nữa để đăng ký`
        : `Deselect ${n > 0 ? `${n} more` : '0'} member${n === 1 ? '' : 's'} to continue`,
    captainTag: language === 'vi' ? 'Đội trưởng' : 'Captain',
    overLimit: (current: number, max: number, deselectCount: number) =>
      language === 'vi'
        ? `Đội có ${current} người, vượt quá giới hạn ${max} người. Bỏ chọn ${deselectCount} thành viên để tiếp tục.`
        : `Roster has ${current} members, exceeding limit of ${max}. Deselect ${deselectCount} member${deselectCount === 1 ? '' : 's'} to continue.`,
    successCreated: language === 'vi' ? 'Đã tạo đội mới' : 'Team created',
    successRegistered: language === 'vi' ? 'Đã đăng ký đội vào giải' : 'Team registered',
    successTitle: language === 'vi' ? 'Thành công' : 'Success',
    errorTitle: language === 'vi' ? 'Lỗi' : 'Error',
  };

  const formSchema = z.object({
    team_name: z.string().min(2, c.teamNameError).max(50),
    captain_name: z.string().min(2, c.captainNameError).max(50),
    captain_gender: z.enum(['male', 'female']),
    captain_skill_level: z.number().min(1).max(8).optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  // Calculate effective roster (excluding selected members)
  const effectiveRoster = masterRoster.filter(m => !excludedMemberIds.has(m.id));
  const rosterExceedsLimit = effectiveRoster.length > maxRosterSize;
  const needToExclude = masterRoster.length > maxRosterSize ? masterRoster.length - maxRosterSize : 0;
  const currentlyExcluded = excludedMemberIds.size;

  const toggleExcludeMember = (memberId: string, isCaptain: boolean) => {
    if (isCaptain) return; // Cannot exclude captain

    setExcludedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  // Reset excluded members when changing team
  const handleSelectMasterTeam = (teamId: string) => {
    setSelectedMasterTeamId(teamId);
    setExcludedMemberIds(new Set());
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      team_name: '',
      captain_name: '',
      captain_gender: 'male',
    },
  });

  const hasMasterTeams = masterTeams && masterTeams.length > 0;
  const canRegisterWithExisting = selectedMasterTeam && !rosterExceedsLimit;

  // ─── DUPR gating (MLP) ─── captain = logged-in user, MLP is doubles-only.
  const { data: duprConn } = useDuprConnection();
  const invalidateDupr = useInvalidateDuprConnection();
  const [showSso, setShowSso] = useState(false);
  const captainGender =
    mode === 'use-existing'
      ? masterRoster.find((m) => m.is_captain)?.gender ?? 'male'
      : form.watch('captain_gender');
  const duprMax = captainGender === 'female' ? duprMaxFemale : duprMaxMale;
  // MLP: doubles rating preferred, fall back to singles when the captain only
  // has a singles rating (common in VN).
  const captainDupr = duprConn?.doubles ?? duprConn?.singles ?? null;
  const duprConnected = !!duprConn?.ssoConnected && captainDupr != null;
  const duprEligible = isDuprEligible({
    requireDupr,
    connected: duprConnected,
    rating: captainDupr,
    max: duprMax,
  });

  // On open: jump straight to the requested mode; when the captain has exactly
  // one master team in use-existing mode, preselect it (one-tap confirm).
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    if (initialMode === 'use-existing' && masterTeams?.length === 1) {
      setSelectedMasterTeamId(masterTeams[0].id);
    }
    // Pre-fill captain name from the logged-in profile (DUPR/account name).
    if (profile?.display_name && !form.getValues('captain_name')) {
      form.setValue('captain_name', profile.display_name);
    }
  }, [open, initialMode, masterTeams, profile?.display_name, form]);

  const handleCreateNewTeam = async (values: FormValues) => {
    if (!user) return;

    try {
      // Create master team first (auto-save)
      const masterTeam = await createMasterTeam({
        team_name: values.team_name,
        captain_name: values.captain_name,
        captain_gender: values.captain_gender,
        captain_skill_level: values.captain_skill_level,
      });

      // Then create tournament team linked to master team
      const { data: tournamentTeam, error: teamError } = await supabase
        .from('team_match_teams')
        .insert({
          tournament_id: tournamentId,
          team_name: values.team_name,
          captain_user_id: user.id,
          master_team_id: masterTeam.id,
          status: 'approved', // captain self-registration is auto-approved (no BTC review)
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add captain to tournament roster
      await supabase.from('team_match_roster').insert({
        team_id: tournamentTeam.id,
        player_name: values.captain_name,
        gender: values.captain_gender,
        skill_level: values.captain_skill_level || null,
        user_id: user.id,
        is_captain: true,
        status: 'approved',
      });

      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-user-team', tournamentId] });

      toast({ title: txt.successTitle, description: txt.successCreated });
      form.reset();
      setMode('select');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: txt.errorTitle,
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleUseExistingTeam = async () => {
    if (!user || !selectedMasterTeam) return;

    setIsRegistering(true);
    try {
      await registerExistingTeam({
        tournamentId,
        masterTeam: { id: selectedMasterTeam.id, team_name: selectedMasterTeam.team_name },
        roster: effectiveRoster.map((member) => ({
          player_name: member.player_name,
          gender: member.gender,
          skill_level: member.skill_level,
          user_id: member.user_id,
          is_captain: member.is_captain,
        })),
      });
      setMode('select');
      setSelectedMasterTeamId(null);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // registerExistingTeam already surfaced the error toast.
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBack = () => {
    setMode('select');
    setSelectedMasterTeamId(null);
    setExcludedMemberIds(new Set());
    form.reset();
  };

  const handleClose = () => {
    setMode('select');
    setSelectedMasterTeamId(null);
    setExcludedMemberIds(new Set());
    form.reset();
    onOpenChange(false);
  };

  const title =
    mode === 'select' ? txt.titleSelect : mode === 'create' ? txt.titleCreate : txt.titleUseExisting;
  const desc =
    mode === 'select' ? txt.descSelect : mode === 'create' ? txt.descCreate : txt.descUseExisting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>{title}</DialogTitle>
          <DialogDescription
            style={{
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--tl-fg-3)',
            }}
          >
            {desc}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selection */}
        {mode === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
            <button
              type="button"
              onClick={() => setMode('create')}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                borderRadius: 'var(--tl-radius)',
                border: '1px solid var(--tl-border)',
                background: 'var(--tl-bg-elev)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green)';
                (e.currentTarget as HTMLElement).style.background = 'var(--tl-green-glow)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg-elev)';
              }}
            >
              <Plus className="h-5 w-5" style={{ color: 'var(--tl-fg-2)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div
                  style={{
                    fontFamily: 'Instrument Serif, serif',
                    fontStyle: 'italic',
                    fontSize: 17,
                    color: 'var(--tl-fg)',
                    lineHeight: 1.2,
                  }}
                >
                  {txt.createOpt}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--tl-fg-3)',
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {txt.createOptDesc}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('use-existing')}
              disabled={!hasMasterTeams && !isLoadingMasterTeams}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                borderRadius: 'var(--tl-radius)',
                border: '1px solid var(--tl-border)',
                background: 'var(--tl-bg-elev)',
                cursor: !hasMasterTeams && !isLoadingMasterTeams ? 'not-allowed' : 'pointer',
                opacity: !hasMasterTeams && !isLoadingMasterTeams ? 0.5 : 1,
                textAlign: 'left',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (hasMasterTeams || isLoadingMasterTeams) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-green)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--tl-green-glow)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg-elev)';
              }}
            >
              <Users className="h-5 w-5" style={{ color: 'var(--tl-fg-2)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div
                  style={{
                    fontFamily: 'Instrument Serif, serif',
                    fontStyle: 'italic',
                    fontSize: 17,
                    color: 'var(--tl-fg)',
                    lineHeight: 1.2,
                  }}
                >
                  {txt.useOpt}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--tl-fg-3)',
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {isLoadingMasterTeams
                    ? txt.useOptCountLoading
                    : hasMasterTeams
                      ? txt.useOptCount(masterTeams.length)
                      : txt.useOptNone}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Create New Team Form */}
        {mode === 'create' && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleCreateNewTeam)}
              style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}
            >
              {requireDupr && (
                <DuprEligibilityCheck
                  ratingSource="dupr"
                  isDoubles
                  allowSinglesFallback
                  maxDupr={duprMax}
                  onConnectDupr={() => setShowSso(true)}
                />
              )}

              <FormField
                control={form.control}
                name="team_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="register-team-name" style={fieldLabel}>
                      {txt.teamNameLabel}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="register-team-name"
                        name="register-team-name"
                        placeholder={txt.teamNamePh}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="captain_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="register-captain-name" style={fieldLabel}>
                      {txt.captainNameLabel}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="register-captain-name"
                        name="register-captain-name"
                        placeholder={txt.captainNamePh}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="captain_gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={fieldLabel}>{txt.genderLabel}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">{txt.male}</SelectItem>
                        <SelectItem value="female">{txt.female}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                <button
                  type="button"
                  className="tl-btn"
                  onClick={handleBack}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {txt.back}
                </button>
                <button
                  type="submit"
                  className="tl-btn green"
                  disabled={isCreatingTeam || !duprEligible}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isCreatingTeam && <Loader2 className="h-4 w-4 animate-spin" />}
                  {txt.create}
                </button>
              </div>
            </form>
          </Form>
        )}

        {/* Use Existing Team Selection */}
        {mode === 'use-existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
            {isLoadingMasterTeams ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
              </div>
            ) : (
              <>
                {requireDupr && selectedMasterTeamId && (
                  <DuprEligibilityCheck
                    ratingSource="dupr"
                    isDoubles
                    allowSinglesFallback
                    maxDupr={duprMax}
                    onConnectDupr={() => setShowSso(true)}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {masterTeams?.map((team) => {
                    const checked = selectedMasterTeamId === team.id;
                    return (
                      <label
                        key={team.id}
                        htmlFor={`master-team-${team.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '12px 14px',
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
                          id={`master-team-${team.id}`}
                          name="master-team-select"
                          value={team.id}
                          checked={checked}
                          onChange={() => handleSelectMasterTeam(team.id)}
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
                        <div>
                          <div
                            style={{
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontSize: 17,
                              color: 'var(--tl-fg)',
                              lineHeight: 1.2,
                            }}
                          >
                            {team.team_name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--tl-fg-3)', marginTop: 4 }}>
                            {txt.createdAt(new Date(team.created_at))}
                          </div>
                        </div>
                        {checked && (
                          <Check className="h-5 w-5" style={{ color: 'var(--tl-green)' }} />
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Selected Team Preview */}
                {selectedMasterTeamId && (
                  <div style={{ ...surfaceCard, padding: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <h4 style={{ ...sectionTitle, fontSize: 15 }}>{txt.rosterTitle}</h4>
                      {isLoadingRoster ? (
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
                      ) : (
                        <span
                          style={{
                            ...tinyPill,
                            ...(rosterExceedsLimit
                              ? {
                                  background: 'rgba(255, 65, 54, 0.10)',
                                  color: 'var(--tl-live)',
                                  borderColor: 'rgba(255, 65, 54, 0.35)',
                                }
                              : {}),
                          }}
                        >
                          {txt.counter(effectiveRoster.length, maxRosterSize)}
                        </span>
                      )}
                    </div>
                    {needToExclude > 0 && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--tl-fg-3)',
                          margin: '0 0 8px',
                        }}
                      >
                        {txt.deselectHint(needToExclude - currentlyExcluded)}
                      </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {masterRoster.map((member) => {
                        const isExcluded = excludedMemberIds.has(member.id);
                        const memberIsCaptain = member.is_captain;

                        return (
                          <div
                            key={member.id}
                            onClick={() => !memberIsCaptain && toggleExcludeMember(member.id, memberIsCaptain)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 10px',
                              borderRadius: 'var(--tl-radius)',
                              border: '1px solid var(--tl-border)',
                              background: 'var(--tl-bg-elev)',
                              opacity: isExcluded ? 0.5 : 1,
                              cursor: memberIsCaptain ? 'default' : 'pointer',
                              transition: 'opacity 0.15s',
                            }}
                          >
                            <Checkbox
                              checked={!isExcluded}
                              disabled={memberIsCaptain}
                              onCheckedChange={() => toggleExcludeMember(member.id, memberIsCaptain)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span style={tinyPill}>
                              {member.gender === 'male' ? txt.male : txt.female}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 13.5,
                                color: 'var(--tl-fg)',
                                textDecoration: isExcluded ? 'line-through' : 'none',
                              }}
                            >
                              {member.player_name}
                            </span>
                            {memberIsCaptain && (
                              <span style={{ ...tinyPill, background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }}>
                                {txt.captainTag}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {needToExclude > 0 && rosterExceedsLimit && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 'var(--tl-radius)',
                            background: 'rgba(255, 65, 54, 0.08)',
                            border: '1px solid rgba(255, 65, 54, 0.35)',
                            color: 'var(--tl-fg-2)',
                            fontSize: 12.5,
                            marginTop: 6,
                          }}
                        >
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--tl-live)' }} />
                          <div>
                            {txt.overLimit(masterRoster.length, maxRosterSize, needToExclude - currentlyExcluded)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                  <button
                    type="button"
                    className="tl-btn"
                    onClick={handleBack}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {txt.back}
                  </button>
                  <button
                    type="button"
                    className="tl-btn green"
                    onClick={handleUseExistingTeam}
                    disabled={!canRegisterWithExisting || isRegistering || !duprEligible}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {isRegistering && <Loader2 className="h-4 w-4 animate-spin" />}
                    {txt.register}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <DuprSsoModal
          open={showSso}
          onClose={() => setShowSso(false)}
          onSuccess={() => {
            setShowSso(false);
            invalidateDupr();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
