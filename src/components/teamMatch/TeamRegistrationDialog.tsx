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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useMasterTeams, useMasterTeamWithRoster, useMasterTeamManagement, MasterTeam } from '@/hooks/useMasterTeams';
import { Loader2, Plus, Users, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  team_name: z.string().min(2, 'Tên đội phải có ít nhất 2 ký tự').max(50),
  captain_name: z.string().min(2, 'Tên đội trưởng phải có ít nhất 2 ký tự').max(50),
  captain_gender: z.enum(['male', 'female']),
  captain_skill_level: z.number().min(1).max(8).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TeamRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  maxRosterSize: number;
  onSuccess?: () => void;
}

type RegistrationMode = 'select' | 'create' | 'use-existing';

export function TeamRegistrationDialog({
  open,
  onOpenChange,
  tournamentId,
  maxRosterSize,
  onSuccess,
}: TeamRegistrationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createTeam, isCreatingTeam } = useTeamMatchTeamManagement();
  const { createMasterTeam } = useMasterTeamManagement();
  const { data: masterTeams, isLoading: isLoadingMasterTeams } = useMasterTeams();
  
  const [mode, setMode] = useState<RegistrationMode>('select');
  const [selectedMasterTeamId, setSelectedMasterTeamId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const { team: selectedMasterTeam, roster: masterRoster, isLoading: isLoadingRoster } = useMasterTeamWithRoster(
    selectedMasterTeamId || undefined
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      team_name: '',
      captain_name: '',
      captain_gender: 'male',
    },
  });

  const hasMasterTeams = masterTeams && masterTeams.length > 0;
  const rosterExceedsLimit = masterRoster.length > maxRosterSize;
  const canRegisterWithExisting = selectedMasterTeam && !rosterExceedsLimit;

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
          status: 'pending',
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
      
      toast({ title: 'Thành công', description: 'Đã tạo đội mới' });
      form.reset();
      setMode('select');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUseExistingTeam = async () => {
    if (!user || !selectedMasterTeam) return;
    
    setIsRegistering(true);
    try {
      // Create tournament team linked to master team
      const { data: tournamentTeam, error: teamError } = await supabase
        .from('team_match_teams')
        .insert({
          tournament_id: tournamentId,
          team_name: selectedMasterTeam.team_name,
          captain_user_id: user.id,
          master_team_id: selectedMasterTeam.id,
          status: 'pending',
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Copy roster from master team (snapshot)
      const rosterToInsert = masterRoster.slice(0, maxRosterSize).map((member) => ({
        team_id: tournamentTeam.id,
        player_name: member.player_name,
        gender: member.gender,
        skill_level: member.skill_level,
        user_id: member.user_id,
        is_captain: member.is_captain,
        status: member.is_captain ? 'approved' : 'pending',
      }));

      await supabase.from('team_match_roster').insert(rosterToInsert);

      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['team-match-user-team', tournamentId] });
      
      toast({ title: 'Thành công', description: 'Đã đăng ký đội vào giải' });
      setMode('select');
      setSelectedMasterTeamId(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBack = () => {
    setMode('select');
    setSelectedMasterTeamId(null);
    form.reset();
  };

  const handleClose = () => {
    setMode('select');
    setSelectedMasterTeamId(null);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'select' && 'Đăng ký đội'}
            {mode === 'create' && 'Tạo đội mới'}
            {mode === 'use-existing' && 'Chọn đội đã có'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'select' && 'Chọn cách đăng ký đội của bạn'}
            {mode === 'create' && 'Đăng ký đội mới để tham gia giải đấu'}
            {mode === 'use-existing' && 'Sử dụng đội đã tạo trước đó'}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => setMode('create')}
            >
              <Plus className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Tạo đội mới</div>
                <div className="text-sm text-muted-foreground">
                  Đăng ký đội mới cho giải đấu này
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => setMode('use-existing')}
              disabled={!hasMasterTeams && !isLoadingMasterTeams}
            >
              <Users className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Sử dụng đội đã có</div>
                <div className="text-sm text-muted-foreground">
                  {isLoadingMasterTeams 
                    ? 'Đang tải...' 
                    : hasMasterTeams 
                      ? `Bạn có ${masterTeams.length} đội`
                      : 'Bạn chưa có đội nào'
                  }
                </div>
              </div>
            </Button>
          </div>
        )}

        {/* Create New Team Form */}
        {mode === 'create' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateNewTeam)} className="space-y-4">
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

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  Quay lại
                </Button>
                <Button type="submit" disabled={isCreatingTeam} className="flex-1">
                  {isCreatingTeam && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tạo đội
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Use Existing Team Selection */}
        {mode === 'use-existing' && (
          <div className="space-y-4">
            {isLoadingMasterTeams ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <RadioGroup
                  value={selectedMasterTeamId || ''}
                  onValueChange={setSelectedMasterTeamId}
                  className="space-y-3"
                >
                  {masterTeams?.map((team) => (
                    <div key={team.id}>
                      <label
                        htmlFor={team.id}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedMasterTeamId === team.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={team.id} id={team.id} />
                          <div>
                            <div className="font-medium">{team.team_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Tạo lúc: {new Date(team.created_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                        {selectedMasterTeamId === team.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </label>
                    </div>
                  ))}
                </RadioGroup>

                {/* Selected Team Preview */}
                {selectedMasterTeamId && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>Thành viên đội</span>
                        {isLoadingRoster ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Badge variant={rosterExceedsLimit ? 'destructive' : 'secondary'}>
                            {masterRoster.length}/{maxRosterSize} người
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {masterRoster.slice(0, 5).map((member) => (
                        <div key={member.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {member.gender === 'male' ? 'Nam' : 'Nữ'}
                          </Badge>
                          <span>{member.player_name}</span>
                          {member.is_captain && (
                            <Badge variant="secondary" className="text-xs">
                              Đội trưởng
                            </Badge>
                          )}
                        </div>
                      ))}
                      {masterRoster.length > 5 && (
                        <div className="text-sm text-muted-foreground">
                          +{masterRoster.length - 5} người khác
                        </div>
                      )}

                      {rosterExceedsLimit && (
                        <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            Đội có {masterRoster.length} người, vượt quá giới hạn {maxRosterSize} người của giải.
                            Bạn cần loại bớt thành viên sau khi đăng ký.
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    Quay lại
                  </Button>
                  <Button
                    onClick={handleUseExistingTeam}
                    disabled={!canRegisterWithExisting || isRegistering}
                    className="flex-1"
                  >
                    {isRegistering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Đăng ký
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
