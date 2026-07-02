import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Plus, Trash2, Crown, Copy, Loader2, UserPlus, Check, X } from 'lucide-react';
import { useTeamMatchTeam, useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  fontSize: 18,
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

interface PreviousRosterMember {
  id: string;
  player_name: string;
  gender: 'male' | 'female';
  skill_level: number | null;
  user_id: string | null;
  is_captain: boolean;
  tournament_name: string;
}

interface TeamRosterManagerProps {
  teamId: string;
  maxRosterSize: number;
  isCaptain: boolean;
  isOwner?: boolean;
  inviteCode?: string | null;
  masterTeamId?: string | null;
  tournamentId?: string;
}

export function TeamRosterManager({
  teamId,
  maxRosterSize,
  isCaptain,
  isOwner = false,
  inviteCode,
  masterTeamId,
  tournamentId,
}: TeamRosterManagerProps) {
  const { toast } = useToast();
  const { roster, isLoading } = useTeamMatchTeam(teamId);
  const { addRosterMember, isAddingMember, removeRosterMember, updateRosterStatus } = useTeamMatchTeamManagement();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPreviousMembers, setSelectedPreviousMembers] = useState<Set<string>>(new Set());
  const [isAddingFromPrevious, setIsAddingFromPrevious] = useState(false);
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;

  const txt = {
    listTitle: language === 'vi' ? 'Danh sách thành viên' : 'Member list',
    counterShort: (n: number, max: number) =>
      language === 'vi' ? `${n}/${max} người` : `${n}/${max} players`,
    inviteCode: (code: string) =>
      language === 'vi' ? `Mã mời: ${code}` : `Invite code: ${code}`,
    inviteCopied: language === 'vi' ? 'Đã sao chép mã mời!' : 'Invite code copied!',
    noMembers: language === 'vi' ? 'Chưa có thành viên nào' : 'No members yet',
    levelLabel: language === 'vi' ? 'Level' : 'Level',
    deleteTitle: language === 'vi' ? 'Xóa thành viên?' : 'Remove member?',
    deleteDesc: (name: string) =>
      language === 'vi'
        ? `Bạn có chắc muốn xóa ${name} khỏi đội?`
        : `Are you sure you want to remove ${name} from the team?`,
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    remove: language === 'vi' ? 'Xóa' : 'Remove',
    previousTitle: (n: number) =>
      language === 'vi'
        ? `Chọn từ giải trước (${n} người)`
        : `Pick from previous tournament (${n})`,
    fromTournament: (name: string) =>
      language === 'vi' ? `Từ giải: ${name}` : `From: ${name}`,
    fallbackTournament: language === 'vi' ? 'Giải trước' : 'Previous tournament',
    addSelected: (n: number) =>
      language === 'vi'
        ? `Thêm ${n} thành viên đã chọn`
        : `Add ${n} selected member${n === 1 ? '' : 's'}`,
    addedToast: (n: number) =>
      language === 'vi'
        ? `Đã thêm ${n} thành viên`
        : `Added ${n} member${n === 1 ? '' : 's'}`,
    addedErrorToast: language === 'vi' ? 'Lỗi khi thêm thành viên' : 'Failed to add member',
    fullToast: language === 'vi' ? 'Đã đủ số lượng thành viên' : 'Roster is full',
    addMemberLabel: c.members,
    nameLabel: language === 'vi' ? 'Tên thành viên' : 'Member name',
    namePh: language === 'vi' ? 'Nhập tên' : 'Enter name',
    nameError: language === 'vi' ? 'Tên phải có ít nhất 2 ký tự' : 'Name must be at least 2 characters',
    genderLabel: language === 'vi' ? 'Giới tính' : 'Gender',
    skillLabel: language === 'vi' ? 'Trình độ' : 'Skill',
    skillPh: language === 'vi' ? 'Tùy chọn' : 'Optional',
    addBtn: language === 'vi' ? 'Thêm' : 'Add',
    addNew: (cur: number, max: number) =>
      language === 'vi'
        ? `Thêm thành viên mới (${cur}/${max})`
        : `Add new member (${cur}/${max})`,
    fullState: language === 'vi' ? 'Đội đã đủ số lượng thành viên' : 'Team roster is full',
    male: c.male,
    female: c.female,
    captain: language === 'vi' ? 'Đội trưởng' : 'Captain',
    pendingLabel: language === 'vi' ? 'Chờ duyệt' : 'Pending',
    approve: language === 'vi' ? 'Duyệt' : 'Approve',
    reject: language === 'vi' ? 'Từ chối' : 'Reject',
  };

  const addMemberSchema = z.object({
    player_name: z.string().min(2, txt.nameError).max(50),
    gender: z.enum(['male', 'female']),
    skill_level: z.number().min(1).max(8).optional(),
  });

  type AddMemberValues = z.infer<typeof addMemberSchema>;

  // Fetch roster from most recent tournament with same master_team_id
  const { data: previousRoster, isLoading: isLoadingPrevious } = useQuery({
    queryKey: ['previous-tournament-roster', masterTeamId, tournamentId],
    queryFn: async () => {
      if (!masterTeamId || !tournamentId) return [];

      const { data: otherTeams, error: teamError } = await supabase
        .from('team_match_teams')
        .select(`
          id,
          tournament_id,
          team_match_tournaments!inner (
            created_at,
            name
          )
        `)
        .eq('master_team_id', masterTeamId)
        .neq('tournament_id', tournamentId)
        .order('team_match_tournaments(created_at)', { ascending: false })
        .limit(1);

      if (teamError || !otherTeams?.length) return [];

      const latestTeam = otherTeams[0];
      const tournamentInfo = latestTeam.team_match_tournaments as unknown as {
        created_at: string;
        name: string;
      } | null;

      const { data: rosterData, error: rosterError } = await supabase
        .from('team_match_roster')
        .select('id, player_name, gender, skill_level, user_id, is_captain')
        .eq('team_id', latestTeam.id)
        .order('is_captain', { ascending: false })
        .order('created_at', { ascending: true });

      if (rosterError) throw rosterError;

      return (rosterData || []).map(r => ({
        ...r,
        tournament_name: tournamentInfo?.name || txt.fallbackTournament,
      })) as PreviousRosterMember[];
    },
    enabled: !!masterTeamId && !!tournamentId && isOwner,
  });

  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      gender: 'male',
    },
  });

  const handleAddMember = async (values: AddMemberValues) => {
    try {
      await addRosterMember({
        team_id: teamId,
        player_name: values.player_name,
        gender: values.gender,
        skill_level: values.skill_level,
      });
      form.reset();
      setShowAddForm(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeRosterMember({ memberId, teamId });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleApproveMember = async (memberId: string) => {
    try {
      await updateRosterStatus({ memberId, teamId, status: 'approved' });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      toast({ title: txt.inviteCopied });
    }
  };

  // Add selected members from previous tournament roster
  const handleAddFromPrevious = async () => {
    if (selectedPreviousMembers.size === 0) return;

    setIsAddingFromPrevious(true);
    try {
      const membersToAdd = (previousRoster || []).filter(m => selectedPreviousMembers.has(m.id));

      for (const member of membersToAdd) {
        await addRosterMember({
          team_id: teamId,
          player_name: member.player_name,
          gender: member.gender,
          skill_level: member.skill_level || undefined,
          user_id: member.user_id || undefined,
        });
      }

      setSelectedPreviousMembers(new Set());
      toast({ title: txt.addedToast(membersToAdd.length) });
    } catch (error) {
      toast({ title: txt.addedErrorToast, variant: 'destructive' });
    } finally {
      setIsAddingFromPrevious(false);
    }
  };

  const togglePreviousMember = (memberId: string) => {
    const newSet = new Set(selectedPreviousMembers);
    if (newSet.has(memberId)) {
      newSet.delete(memberId);
    } else {
      if (roster.length + newSet.size < maxRosterSize) {
        newSet.add(memberId);
      } else {
        toast({ title: txt.fullToast, variant: 'destructive' });
      }
    }
    setSelectedPreviousMembers(newSet);
  };

  const canEdit = isCaptain || isOwner;
  const canAddMore = roster.length < maxRosterSize;

  // Get list of already added player names to filter out
  const addedPlayerNames = new Set(roster.map(r => r.player_name.toLowerCase()));
  const availablePreviousMembers = (previousRoster || []).filter(
    m => !addedPlayerNames.has(m.player_name.toLowerCase()),
  );

  if (isLoading || (isOwner && isLoadingPrevious)) {
    return (
      <div style={{ ...surfaceCard, padding: 32, display: 'flex', justifyContent: 'center' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ ...surfaceCard, padding: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users className="h-4 w-4" style={{ color: 'var(--tl-fg-2)' }} />
            {txt.listTitle}
          </h3>
          <p
            style={{
              fontSize: 12,
              color: 'var(--tl-fg-3)',
              margin: '4px 0 0',
            }}
          >
            {txt.counterShort(roster.length, maxRosterSize)}
          </p>
        </div>
        {(isCaptain || isOwner) && inviteCode && (
          <button
            type="button"
            className="tl-btn"
            onClick={handleCopyInviteCode}
            style={{ padding: '5px 10px', fontSize: 12 }}
          >
            <Copy className="h-3.5 w-3.5" />
            {txt.inviteCode(inviteCode)}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Current roster list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {roster.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 0',
                color: 'var(--tl-fg-3)',
                fontSize: 13,
              }}
            >
              {txt.noMembers}
            </div>
          ) : (
            roster.map((member) => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--tl-radius)',
                  border: '1px solid var(--tl-border)',
                  background: 'var(--tl-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'Instrument Serif, serif',
                          fontStyle: 'italic',
                          fontSize: 16,
                          letterSpacing: '-0.01em',
                          color: 'var(--tl-fg)',
                        }}
                      >
                        {member.player_name}
                      </span>
                      {member.is_captain && (
                        <Crown className="h-3.5 w-3.5" style={{ color: 'var(--tl-gold)' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tl-fg-3)' }}>
                      <span style={tinyPill}>
                        {member.gender === 'male' ? txt.male : txt.female}
                      </span>
                      {member.status === 'pending' && (
                        <span style={{ ...tinyPill, background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }}>
                          {txt.pendingLabel}
                        </span>
                      )}
                      {member.skill_level && (
                        <span>
                          {txt.levelLabel}: {member.skill_level.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canEdit && !member.is_captain && member.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      aria-label={txt.approve}
                      onClick={() => handleApproveMember(member.id)}
                      className="tl-btn green"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {txt.approve}
                    </button>
                    <button
                      type="button"
                      aria-label={txt.reject}
                      onClick={() => handleRemoveMember(member.id)}
                      className="tl-btn"
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        color: 'var(--tl-live)',
                        borderColor: 'rgba(255, 65, 54, 0.35)',
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      {txt.reject}
                    </button>
                  </div>
                )}

                {canEdit && !member.is_captain && member.status !== 'pending' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label={txt.remove}
                        style={{
                          width: 32,
                          height: 32,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: 'var(--tl-radius)',
                          color: 'var(--tl-fg-3)',
                          cursor: 'pointer',
                          transition: 'color 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)';
                          (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle style={sectionTitle}>{txt.deleteTitle}</AlertDialogTitle>
                        <AlertDialogDescription
                          style={{
                            marginTop: 4,
                            fontFamily: 'inherit',
                            fontSize: 13,
                            color: 'var(--tl-fg-3)',
                          }}
                        >
                          {txt.deleteDesc(member.player_name)}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="tl-btn">{txt.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveMember(member.id)}
                          className="tl-btn"
                          style={{
                            background: 'rgba(255, 65, 54, 0.10)',
                            color: 'var(--tl-live)',
                            borderColor: 'rgba(255, 65, 54, 0.35)',
                          }}
                        >
                          {txt.remove}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))
          )}
        </div>

        {/* BTC: Select from previous tournament roster */}
        {isOwner && canAddMore && availablePreviousMembers.length > 0 && (
          <div
            style={{
              ...surfaceCard,
              padding: 14,
              background: 'var(--tl-green-glow)',
              borderColor: 'var(--tl-green)',
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <h4
                style={{
                  ...sectionTitle,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <UserPlus className="h-4 w-4" style={{ color: 'var(--tl-green)' }} />
                {txt.previousTitle(availablePreviousMembers.length)}
              </h4>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--tl-fg-3)',
                  margin: '4px 0 0',
                }}
              >
                {txt.fromTournament(previousRoster?.[0]?.tournament_name || txt.fallbackTournament)}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {availablePreviousMembers.map((member) => {
                const isSelected = selectedPreviousMembers.has(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => togglePreviousMember(member.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 'var(--tl-radius)',
                      border: `1px solid ${isSelected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                      background: isSelected ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePreviousMember(member.id)}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontSize: 15,
                              color: 'var(--tl-fg)',
                            }}
                          >
                            {member.player_name}
                          </span>
                          {member.is_captain && (
                            <Crown className="h-3 w-3" style={{ color: 'var(--tl-gold)' }} />
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11.5,
                            color: 'var(--tl-fg-3)',
                            marginTop: 2,
                          }}
                        >
                          <span>{member.gender === 'male' ? txt.male : txt.female}</span>
                          {member.skill_level && (
                            <span>• {txt.levelLabel}: {member.skill_level.toFixed(1)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4" style={{ color: 'var(--tl-green)' }} />}
                  </div>
                );
              })}
            </div>

            {selectedPreviousMembers.size > 0 && (
              <button
                type="button"
                className="tl-btn green"
                onClick={handleAddFromPrevious}
                disabled={isAddingFromPrevious}
                style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', marginTop: 10 }}
              >
                {isAddingFromPrevious && <Loader2 className="h-4 w-4 animate-spin" />}
                {txt.addSelected(selectedPreviousMembers.size)}
              </button>
            )}
          </div>
        )}

        {/* Add new member form */}
        {canEdit && canAddMore && (
          <>
            {showAddForm ? (
              <div
                style={{
                  ...surfaceCard,
                  padding: 14,
                  borderStyle: 'dashed',
                }}
              >
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleAddMember)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                  >
                    <FormField
                      control={form.control}
                      name="player_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="roster-add-name" style={fieldLabel}>
                            {txt.nameLabel}
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="roster-add-name"
                              name="roster-add-name"
                              placeholder={txt.namePh}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField
                        control={form.control}
                        name="gender"
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

                      <FormField
                        control={form.control}
                        name="skill_level"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={fieldLabel}>{txt.skillLabel}</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={txt.skillPh} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => (
                                  <SelectItem key={level} value={level.toString()}>
                                    {level.toFixed(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="tl-btn"
                        onClick={() => {
                          form.reset();
                          setShowAddForm(false);
                        }}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        {txt.cancel}
                      </button>
                      <button
                        type="submit"
                        className="tl-btn green"
                        disabled={isAddingMember}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        {isAddingMember && <Loader2 className="h-4 w-4 animate-spin" />}
                        {txt.addBtn}
                      </button>
                    </div>
                  </form>
                </Form>
              </div>
            ) : (
              <button
                type="button"
                className="tl-btn"
                onClick={() => setShowAddForm(true)}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '10px 12px',
                  borderStyle: 'dashed',
                }}
              >
                <Plus className="h-4 w-4" />
                {txt.addNew(roster.length, maxRosterSize)}
              </button>
            )}
          </>
        )}

        {!canAddMore && (
          <p
            style={{
              textAlign: 'center',
              fontSize: 12.5,
              color: 'var(--tl-fg-3)',
              margin: 0,
            }}
          >
            {txt.fullState}
          </p>
        )}
      </div>
    </div>
  );
}
