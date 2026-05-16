import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';
import { Loader2 } from 'lucide-react';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
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

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  onSuccess?: () => void;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  tournamentId,
  onSuccess,
}: CreateTeamDialogProps) {
  const { createTeam, isCreatingTeam } = useTeamMatchTeamManagement();
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;

  const txt = {
    title: c.createTeamTitle,
    desc: c.createTeamDesc,
    teamNameLabel: c.teamNameLabel,
    teamNamePh: language === 'vi' ? 'VD: Dragon Warriors' : 'E.g. Dragon Warriors',
    captainNameLabel: c.captainNameLabel,
    captainNamePh: language === 'vi' ? 'Tên của bạn' : 'Your name',
    genderLabel: language === 'vi' ? 'Giới tính' : 'Gender',
    male: c.male,
    female: c.female,
    skillLabel: language === 'vi' ? 'Trình độ (tùy chọn)' : 'Skill (optional)',
    skillPh: language === 'vi' ? 'Chọn trình độ' : 'Pick skill',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    submit: language === 'vi' ? 'Tạo đội' : 'Create team',
  };

  const formSchema = z.object({
    team_name: z.string().min(2, c.teamNameError).max(50),
    captain_name: z.string().min(2, c.captainNameError).max(50),
    captain_gender: z.enum(['male', 'female']),
    captain_skill_level: z.number().min(1).max(8).optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      team_name: '',
      captain_name: '',
      captain_gender: 'male',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createTeam({
        tournament_id: tournamentId,
        team_name: values.team_name,
        captain_name: values.captain_name,
        captain_gender: values.captain_gender,
        captain_skill_level: values.captain_skill_level,
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>{txt.title}</DialogTitle>
          <DialogDescription
            style={{
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--tl-fg-3)',
            }}
          >
            {txt.desc}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}
          >
            <FormField
              control={form.control}
              name="team_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="create-team-name" style={fieldLabel}>
                    {txt.teamNameLabel}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="create-team-name"
                      name="create-team-name"
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
                  <FormLabel htmlFor="create-team-captain" style={fieldLabel}>
                    {txt.captainNameLabel}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="create-team-captain"
                      name="create-team-captain"
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

            <FormField
              control={form.control}
              name="captain_skill_level"
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

            <DialogFooter>
              <button
                type="button"
                className="tl-btn"
                onClick={() => onOpenChange(false)}
                disabled={isCreatingTeam}
              >
                {txt.cancel}
              </button>
              <button type="submit" className="tl-btn green" disabled={isCreatingTeam}>
                {isCreatingTeam && <Loader2 className="h-4 w-4 animate-spin" />}
                {txt.submit}
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
