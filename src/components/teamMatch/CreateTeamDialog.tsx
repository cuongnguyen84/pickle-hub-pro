import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  team_name: z.string().min(2, 'Tên đội phải có ít nhất 2 ký tự').max(50),
  captain_name: z.string().min(2, 'Tên đội trưởng phải có ít nhất 2 ký tự').max(50),
  captain_gender: z.enum(['male', 'female']),
  captain_skill_level: z.number().min(1).max(8).optional(),
});

type FormValues = z.infer<typeof formSchema>;

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
          <DialogTitle>Tạo đội mới</DialogTitle>
          <DialogDescription>
            Đăng ký đội của bạn để tham gia giải đấu. Bạn sẽ là đội trưởng.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="team_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên đội</FormLabel>
                  <FormControl>
                    <Input placeholder="VD: Dragon Warriors" {...field} />
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
                  <FormLabel>Tên đội trưởng (bạn)</FormLabel>
                  <FormControl>
                    <Input placeholder="Tên của bạn" {...field} />
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
                  <FormLabel>Giới tính</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
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
                  <FormLabel>Trình độ (tùy chọn)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn trình độ" />
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isCreatingTeam}>
                {isCreatingTeam && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Tạo đội
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
