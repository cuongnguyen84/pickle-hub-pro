import { useState, useEffect } from 'react';
import { useRegistration, type Registration } from '@/hooks/useRegistration';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, MoreVertical, Pencil, Users, Clock, CheckCircle2, XCircle, RefreshCw, Swords, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BracketSetupDialog } from './BracketSetupDialog';
import type { QuickTable } from '@/hooks/useQuickTable';

interface RegistrationManagerProps {
  tableId: string;
  shareId?: string;
  table?: QuickTable;
  onPendingCountChange?: (count: number) => void;
}

export function RegistrationManager({ tableId, shareId, table, onPendingCountChange }: RegistrationManagerProps) {
  const { t } = useI18n();
  const {
    getTableRegistrations,
    approveRegistration,
    rejectRegistration,
    bulkApprove,
    updateBTCOverride,
  } = useRegistration();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [overrideSkill, setOverrideSkill] = useState('');
  const [btcNotes, setBtcNotes] = useState('');
  const [showBracketSetup, setShowBracketSetup] = useState(false);

  const loadRegistrations = async () => {
    setLoading(true);
    const data = await getTableRegistrations(tableId);
    setRegistrations(data);
    setLoading(false);
    
    const pendingCount = data.filter(r => r.status === 'pending').length;
    onPendingCountChange?.(pendingCount);
  };

  useEffect(() => {
    loadRegistrations();

    // Subscribe to realtime updates
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`registrations-${tableId}:${Date.now()}_${Math.random().toString(36).slice(2,7)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quick_table_registrations',
            filter: `table_id=eq.${tableId}`,
          },
          () => {
            loadRegistrations();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[RegistrationManager] Realtime setup failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [tableId]);

  const pendingRegistrations = registrations.filter(r => r.status === 'pending');
  const approvedRegistrations = registrations.filter(r => r.status === 'approved');
  const rejectedRegistrations = registrations.filter(r => r.status === 'rejected');

  const handleApprove = async (id: string) => {
    const success = await approveRegistration(id);
    if (success) loadRegistrations();
  };

  const handleReject = async (id: string) => {
    const success = await rejectRegistration(id);
    if (success) loadRegistrations();
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const success = await bulkApprove(selectedIds);
    if (success) {
      setSelectedIds([]);
      loadRegistrations();
    }
  };

  const handleEditSubmit = async () => {
    if (!editingRegistration) return;
    
    const success = await updateBTCOverride(
      editingRegistration.id,
      overrideSkill ? parseFloat(overrideSkill) : null,
      btcNotes || null
    );
    
    if (success) {
      setEditingRegistration(null);
      loadRegistrations();
    }
  };

  const openEditDialog = (reg: Registration) => {
    setEditingRegistration(reg);
    setOverrideSkill(reg.btc_override_skill?.toString() || '');
    setBtcNotes(reg.btc_notes || '');
  };

  // Handle start bracket - open setup dialog
  const handleStartBracket = () => {
    if (approvedRegistrations.length < 6) {
      toast.error('Cần ít nhất 6 VĐV được duyệt');
      return;
    }
    setShowBracketSetup(true);
  };

  // Prepare approved players data for BracketSetupDialog
  const approvedPlayersForBracket = approvedRegistrations.map(reg => ({
    name: reg.display_name,
    team: reg.team,
    skill: reg.btc_override_skill || reg.skill_level || null,
  }));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingRegistrations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingRegistrations.map(r => r.id));
    }
  };

  const getSkillDisplay = (reg: Registration) => {
    if (reg.btc_override_skill) {
      return (
        <span className="text-primary font-medium">
          {reg.btc_override_skill} <span className="text-xs text-foreground-muted">(BTC)</span>
        </span>
      );
    }

    if (reg.rating_system === 'DUPR') {
      return `DUPR ${reg.skill_level || '—'}`;
    }
    if (reg.rating_system === 'other') {
      return reg.skill_level?.toString() || '—';
    }
    return reg.skill_description || t.quickTable.noRating;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> {t.quickTable.pending}</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> {t.quickTable.approved}</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> {t.quickTable.rejected}</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-foreground-muted" />
          <p className="text-foreground-muted">{t.quickTable.loading}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingRegistrations.length}</p>
              <p className="text-sm text-foreground-muted">{t.quickTable.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedRegistrations.length}</p>
              <p className="text-sm text-foreground-muted">{t.quickTable.approved}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejectedRegistrations.length}</p>
              <p className="text-sm text-foreground-muted">{t.quickTable.rejected}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Start Bracket Button - shows when ≥6 approved */}
      {approvedRegistrations.length >= 6 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Swords className="w-4 h-4 text-primary" />
                  {t.quickTable.readyToBracket}
                </h3>
                <p className="text-sm text-foreground-secondary">
                  {t.quickTable.readyToBracketDesc.replace('{count}', approvedRegistrations.length.toString())}
                </p>
              </div>
              <Button onClick={handleStartBracket}>
                <Swords className="w-4 h-4 mr-2" />
                {t.quickTable.createBracket}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not enough players warning */}
      {approvedRegistrations.length > 0 && approvedRegistrations.length < 6 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t.quickTable.needMinPlayers.replace('{count}', approvedRegistrations.length.toString())}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Registrations */}
      {pendingRegistrations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                {t.quickTable.pendingRegistrations} ({pendingRegistrations.length})
              </CardTitle>
              {selectedIds.length > 0 && (
                <Button size="sm" onClick={handleBulkApprove}>
                  <Check className="w-4 h-4 mr-1" />
                  {t.quickTable.approveSelected.replace('{count}', selectedIds.length.toString())}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === pendingRegistrations.length && pendingRegistrations.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>VĐV</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Trình độ</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(reg.id)}
                        onCheckedChange={() => toggleSelect(reg.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{reg.display_name}</TableCell>
                    <TableCell className="text-foreground-muted text-sm">{reg.email || '—'}</TableCell>
                    <TableCell className="text-foreground-muted">{reg.team || '—'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{getSkillDisplay(reg)}</div>
                        {reg.profile_link && (
                          <a
                            href={reg.profile_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Xem hồ sơ
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleApprove(reg.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleReject(reg.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(reg)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              {t.quickTable.editSkillLevel}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Approved Registrations */}
      {approvedRegistrations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {t.quickTable.approvedPlayers} ({approvedRegistrations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>VĐV</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Trình độ</TableHead>
                  <TableHead>{t.quickTable.btcNote}</TableHead>
                  <TableHead className="text-right">{t.quickTable.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRegistrations.map((reg, idx) => (
                  <TableRow key={reg.id}>
                    <TableCell className="text-foreground-muted">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{reg.display_name}</TableCell>
                    <TableCell className="text-foreground-muted text-sm">{reg.email || '—'}</TableCell>
                    <TableCell className="text-foreground-muted">{reg.team || '—'}</TableCell>
                    <TableCell>{getSkillDisplay(reg)}</TableCell>
                    <TableCell className="text-sm text-foreground-muted max-w-[200px] truncate">
                      {reg.btc_notes || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(reg)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            {t.common.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleReject(reg.id)}
                          >
                            <X className="w-4 h-4 mr-2" />
                            {t.quickTable.cancelApproval}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rejected Registrations */}
      {rejectedRegistrations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-foreground-muted">
              <XCircle className="w-4 h-4" />
              {t.quickTable.rejectedRegistrations} ({rejectedRegistrations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>VĐV</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Trình độ</TableHead>
                  <TableHead className="text-right">{t.quickTable.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedRegistrations.map((reg) => (
                  <TableRow key={reg.id} className="opacity-60">
                    <TableCell className="font-medium">{reg.display_name}</TableCell>
                    <TableCell className="text-foreground-muted text-sm">{reg.email || '—'}</TableCell>
                    <TableCell className="text-foreground-muted">{reg.team || '—'}</TableCell>
                    <TableCell>{getSkillDisplay(reg)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(reg.id)}>
                        {t.quickTable.approve}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {registrations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-foreground-muted opacity-50" />
            <p className="text-foreground-muted">Chưa có VĐV nào đăng ký</p>
            <p className="text-sm text-foreground-muted mt-1">
              Chia sẻ link giải để VĐV có thể đăng ký tham dự
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRegistration} onOpenChange={() => setEditingRegistration(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin VĐV</DialogTitle>
            <DialogDescription>
              Thông tin do BTC ghi đè sẽ được sử dụng thay cho thông tin VĐV tự khai
            </DialogDescription>
          </DialogHeader>

          {editingRegistration && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{editingRegistration.display_name}</p>
                <p className="text-sm text-foreground-muted">
                  Trình độ tự khai: {
                    editingRegistration.rating_system === 'DUPR' 
                      ? `DUPR ${editingRegistration.skill_level || '—'}`
                      : editingRegistration.rating_system === 'other'
                        ? editingRegistration.skill_level?.toString() || '—'
                        : editingRegistration.skill_description || 'Chưa có rating'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overrideSkill">Trình độ do BTC xác nhận</Label>
                <Input
                  id="overrideSkill"
                  type="number"
                  step="0.01"
                  min="1"
                  max="8"
                  value={overrideSkill}
                  onChange={(e) => setOverrideSkill(e.target.value)}
                  placeholder="VD: 3.50"
                />
                <p className="text-xs text-foreground-muted">
                  Để trống nếu sử dụng trình độ tự khai
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="btcNotes">Ghi chú nội bộ</Label>
                <Textarea
                  id="btcNotes"
                  value={btcNotes}
                  onChange={(e) => setBtcNotes(e.target.value)}
                  placeholder="VD: BTC xác nhận trình độ qua giải ABC"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRegistration(null)}>
              Hủy
            </Button>
            <Button onClick={handleEditSubmit}>
              Lưu thay đổi
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

export default RegistrationManager;
