import { useState, useEffect } from 'react';
import { useTeamRegistration, type Team } from '@/hooks/useTeamRegistration';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Check, X, MoreVertical, Users, Clock, CheckCircle2, XCircle, 
  RefreshCw, Swords, AlertCircle, UserMinus, Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BracketSetupDialog } from './BracketSetupDialog';
import type { QuickTable } from '@/hooks/useQuickTable';

interface TeamManagerProps {
  tableId: string;
  shareId?: string;
  table?: QuickTable;
  onPendingCountChange?: (count: number) => void;
}

export function TeamManager({ tableId, shareId, table, onPendingCountChange }: TeamManagerProps) {
  const { t } = useI18n();
  const { getTableTeams, btcManageTeam } = useTeamRegistration();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBracketSetup, setShowBracketSetup] = useState(false);
  const [noteDialog, setNoteDialog] = useState<{ team: Team; action: 'approve' | 'reject' | 'remove' } | null>(null);
  const [notes, setNotes] = useState('');
  
  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadTeams = async () => {
    setLoading(true);
    const data = await getTableTeams(tableId);
    setTeams(data);
    setLoading(false);
    
    const pendingCount = data.filter(t => !t.btc_approved && t.team_status !== 'rejected' && t.team_status !== 'removed').length;
    onPendingCountChange?.(pendingCount);
  };

  useEffect(() => {
    loadTeams();

    // Subscribe to realtime updates
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`teams-${tableId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quick_table_teams',
            filter: `table_id=eq.${tableId}`,
          },
          () => {
            loadTeams();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[TeamManager] Realtime setup failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [tableId]);

  // All registered teams (excluding removed/rejected) for display
  const allRegisteredTeams = teams.filter(t => t.team_status !== 'rejected' && t.team_status !== 'removed');
  const pendingTeams = teams.filter(t => !t.btc_approved && t.team_status !== 'rejected' && t.team_status !== 'removed');
  const approvedTeams = teams.filter(t => t.btc_approved && t.team_status !== 'removed');
  const rejectedTeams = teams.filter(t => t.team_status === 'rejected');
  const removedTeams = teams.filter(t => t.team_status === 'removed');

  const handleAction = async (teamId: string, action: 'approve' | 'reject' | 'remove', notes?: string) => {
    const success = await btcManageTeam(teamId, action, notes);
    if (success) {
      loadTeams();
      setNoteDialog(null);
      setNotes('');
      // Clear selection if the approved/rejected team was selected
      setSelectedIds(prev => prev.filter(id => id !== teamId));
    }
  };

  // Batch approve/reject
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await btcManageTeam(id, 'approve');
      if (success) successCount++;
    }
    setBatchLoading(false);
    setSelectedIds([]);
    loadTeams();
    if (successCount > 0) {
      toast.success(`Đã duyệt ${successCount} đội`);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await btcManageTeam(id, 'reject');
      if (success) successCount++;
    }
    setBatchLoading(false);
    setSelectedIds([]);
    loadTeams();
    if (successCount > 0) {
      toast.success(`Đã từ chối ${successCount} đội`);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPending = () => {
    const pendingIds = pendingTeams.map(t => t.id);
    const allSelected = pendingIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pendingIds])]);
    }
  };

  const handleStartBracket = () => {
    if (approvedTeams.length < 3) {
      toast.error('Cần ít nhất 3 đội được duyệt');
      return;
    }
    setShowBracketSetup(true);
  };

  const getTeamStatusBadge = (team: Team) => {
    if (team.team_status === 'removed') {
      return <Badge variant="destructive" className="gap-1"><Trash2 className="w-3 h-3" /> Đã loại</Badge>;
    }
    if (team.team_status === 'rejected') {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Từ chối</Badge>;
    }
    if (team.btc_approved) {
      return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Đã duyệt</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</Badge>;
  };

  const getPartnerStatus = (team: Team) => {
    if (team.player2_user_id) {
      return <Badge variant="outline" className="gap-1 text-green-600 border-green-600"><Users className="w-3 h-3" /> Đủ đội</Badge>;
    }
    return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600"><UserMinus className="w-3 h-3" /> Thiếu partner</Badge>;
  };

  // Prepare data for bracket setup
  const approvedPlayersForBracket = approvedTeams.map(team => ({
    name: `${team.player1_display_name}${team.player2_display_name ? ` / ${team.player2_display_name}` : ''}`,
    team: team.player1_team || team.player2_team,
    skill: team.player1_skill_level || null,
  }));

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Đang tải...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTeams.length}</p>
              <p className="text-sm text-muted-foreground">Chờ duyệt</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedTeams.length}</p>
              <p className="text-sm text-muted-foreground">Đã duyệt</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedTeams.filter(t => t.player2_user_id).length}</p>
              <p className="text-sm text-muted-foreground">Đủ đội</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejectedTeams.length + removedTeams.length}</p>
              <p className="text-sm text-muted-foreground">Từ chối/Loại</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Start Bracket Button */}
      {approvedTeams.length >= 3 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Swords className="w-4 h-4 text-primary" />
                  Sẵn sàng chia bảng
                </h3>
                <p className="text-sm text-muted-foreground">
                  Có {approvedTeams.length} đội đã được duyệt
                </p>
              </div>
              <Button onClick={handleStartBracket}>
                <Swords className="w-4 h-4 mr-2" />
                Chia bảng
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Registered Teams */}
      {allRegisteredTeams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Các VĐV đã đăng ký ({allRegisteredTeams.length})
              </CardTitle>
              {/* Batch actions */}
              {pendingTeams.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.length > 0 && `${selectedIds.length} đã chọn`}
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBatchApprove}
                    disabled={selectedIds.length === 0 || batchLoading}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Duyệt ({selectedIds.length})
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBatchReject}
                    disabled={selectedIds.length === 0 || batchLoading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Từ chối ({selectedIds.length})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {pendingTeams.length > 0 && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={pendingTeams.length > 0 && pendingTeams.every(t => selectedIds.includes(t.id))}
                        onCheckedChange={toggleSelectAllPending}
                        aria-label="Chọn tất cả"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Đội</TableHead>
                  <TableHead>VĐV 1</TableHead>
                  <TableHead>VĐV 2 (Partner)</TableHead>
                  <TableHead>Trình độ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRegisteredTeams.map((team, idx) => (
                  <TableRow key={team.id}>
                    {pendingTeams.length > 0 && (
                      <TableCell>
                        {!team.btc_approved && (
                          <Checkbox
                            checked={selectedIds.includes(team.id)}
                            onCheckedChange={() => toggleSelect(team.id)}
                            aria-label={`Chọn ${team.player1_display_name}`}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      {getPartnerStatus(team)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{team.player1_display_name}</p>
                        {team.player1_team && (
                          <p className="text-sm text-muted-foreground">{team.player1_team}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {team.player2_user_id ? (
                        <div>
                          <p className="font-medium">{team.player2_display_name}</p>
                          {team.player2_team && (
                            <p className="text-sm text-muted-foreground">{team.player2_team}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Chưa có</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {team.player1_skill_level && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">VĐV1:</span>{' '}
                            {team.player1_rating_system === 'DUPR' ? 'DUPR ' : 
                             team.player1_rating_system === 'other' ? '' : ''}{team.player1_skill_level}
                            {team.player1_profile_link && team.player1_rating_system === 'other' && team.player1_profile_link.startsWith('[') && (
                              <span className="text-muted-foreground ml-1">
                                ({team.player1_profile_link.match(/\[(.*?)\]/)?.[1] || 'Khác'})
                              </span>
                            )}
                          </p>
                        )}
                        {team.player2_skill_level && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">VĐV2:</span>{' '}
                            {team.player2_rating_system === 'DUPR' ? 'DUPR ' : ''}{team.player2_skill_level}
                            {team.player2_profile_link && team.player2_rating_system === 'other' && team.player2_profile_link.startsWith('[') && (
                              <span className="text-muted-foreground ml-1">
                                ({team.player2_profile_link.match(/\[(.*?)\]/)?.[1] || 'Khác'})
                              </span>
                            )}
                          </p>
                        )}
                        {!team.player1_skill_level && !team.player2_skill_level && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTeamStatusBadge(team)}</TableCell>
                    <TableCell className="text-right">
                      {!team.btc_approved ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-green-600" 
                            onClick={() => handleAction(team.id, 'approve')}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-red-600" 
                            onClick={() => setNoteDialog({ team, action: 'reject' })}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setNoteDialog({ team, action: 'remove' })}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Loại khỏi giải
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rejected/Removed Teams (collapsed) */}
      {(rejectedTeams.length > 0 || removedTeams.length > 0) && (
        <Card className="opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              Từ chối / Đã loại ({rejectedTeams.length + removedTeams.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>VĐV</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rejectedTeams, ...removedTeams].map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <p className="font-medium">{team.player1_display_name}</p>
                    </TableCell>
                    <TableCell>{getTeamStatusBadge(team)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {team.btc_notes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {teams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Chưa có đội nào đăng ký</h3>
            <p className="text-muted-foreground">
              Chia sẻ link đăng ký để VĐV có thể tham gia
            </p>
          </CardContent>
        </Card>
      )}

      {/* Note Dialog */}
      <Dialog open={!!noteDialog} onOpenChange={() => setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.action === 'reject' && 'Từ chối đội'}
              {noteDialog?.action === 'remove' && 'Loại đội khỏi giải'}
            </DialogTitle>
            <DialogDescription>
              {noteDialog?.team.player1_display_name}
              {noteDialog?.team.player2_display_name && ` / ${noteDialog.team.player2_display_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ghi chú (tùy chọn)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Lý do từ chối hoặc loại..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => noteDialog && handleAction(noteDialog.team.id, noteDialog.action, notes)}
            >
              {noteDialog?.action === 'reject' ? 'Từ chối' : 'Loại khỏi giải'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bracket Setup Dialog */}
      {table && shareId && (
        <BracketSetupDialog
          open={showBracketSetup}
          onOpenChange={setShowBracketSetup}
          table={table}
          shareId={shareId}
          approvedPlayers={approvedPlayersForBracket}
        />
      )}
    </div>
  );
}

export default TeamManager;
