import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Users, Plus, Trash2, Crown, Copy, Loader2 } from 'lucide-react';
import { useTeamMatchTeam, useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useToast } from '@/hooks/use-toast';

const addMemberSchema = z.object({
  player_name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(50),
  gender: z.enum(['male', 'female']),
  skill_level: z.number().min(1).max(8).optional(),
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

interface TeamRosterManagerProps {
  teamId: string;
  maxRosterSize: number;
  isCaptain: boolean;
  isOwner?: boolean;
  inviteCode?: string | null;
}

export function TeamRosterManager({
  teamId,
  maxRosterSize,
  isCaptain,
  isOwner = false,
  inviteCode,
}: TeamRosterManagerProps) {
  const { toast } = useToast();
  const { team, roster, isLoading } = useTeamMatchTeam(teamId);
  const { addRosterMember, isAddingMember, removeRosterMember, isRemovingMember } = useTeamMatchTeamManagement();
  const [showAddForm, setShowAddForm] = useState(false);

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

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      toast({ title: 'Đã sao chép mã mời!' });
    }
  };

  const canEdit = isCaptain || isOwner;
  const canAddMore = roster.length < maxRosterSize;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Danh sách thành viên
            </CardTitle>
            <CardDescription>
              {roster.length}/{maxRosterSize} người
            </CardDescription>
          </div>
          {(isCaptain || isOwner) && inviteCode && (
            <Button variant="outline" size="sm" onClick={handleCopyInviteCode}>
              <Copy className="h-4 w-4 mr-2" />
              Mã mời: {inviteCode}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Roster list - larger font for mobile */}
        <div className="space-y-2">
          {roster.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium">{member.player_name}</span>
                    {member.is_captain && (
                      <Crown className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Badge variant="secondary" className="text-sm">
                      {member.gender === 'male' ? 'Nam' : 'Nữ'}
                    </Badge>
                    {member.skill_level && (
                      <span>Level: {member.skill_level.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {canEdit && !member.is_captain && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xóa thành viên?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn có chắc muốn xóa {member.player_name} khỏi đội?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemoveMember(member.id)}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Xóa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>

        {/* Add member form */}
        {canEdit && canAddMore && (
          <>
            {showAddForm ? (
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddMember)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="player_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tên thành viên</FormLabel>
                            <FormControl>
                              <Input placeholder="Nhập tên" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="gender"
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
                          name="skill_level"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Trình độ</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                                value={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Tùy chọn" />
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

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            form.reset();
                            setShowAddForm(false);
                          }}
                        >
                          Hủy
                        </Button>
                        <Button type="submit" className="flex-1" disabled={isAddingMember}>
                          {isAddingMember && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Thêm
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Thêm thành viên ({roster.length}/{maxRosterSize})
              </Button>
            )}
          </>
        )}

        {!canAddMore && (
          <p className="text-sm text-center text-muted-foreground">
            Đội đã đủ số lượng thành viên
          </p>
        )}
      </CardContent>
    </Card>
  );
}
