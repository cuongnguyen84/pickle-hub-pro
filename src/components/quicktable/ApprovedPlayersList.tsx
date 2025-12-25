import { useApprovedRegistrations } from '@/hooks/useSupabaseData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, CheckCircle2 } from 'lucide-react';

interface ApprovedPlayersListProps {
  tableId: string;
  tableName?: string;
}

export function ApprovedPlayersList({ tableId, tableName }: ApprovedPlayersListProps) {
  const { data: registrations = [], isLoading } = useApprovedRegistrations(tableId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            VĐV đã được duyệt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (registrations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            VĐV đã được duyệt
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-foreground-muted">Chưa có VĐV nào được duyệt.</p>
        </CardContent>
      </Card>
    );
  }

  // Format skill display
  const formatSkill = (reg: typeof registrations[0]) => {
    if (reg.rating_system === 'DUPR') {
      return reg.skill_level ? `DUPR ${reg.skill_level}` : 'DUPR';
    }
    if (reg.rating_system === 'other') {
      const systemName = reg.skill_system_name || 'Khác';
      return reg.skill_level ? `${systemName}: ${reg.skill_level}` : systemName;
    }
    return reg.skill_description || 'Chưa khai';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          VĐV đã được duyệt
          <Badge variant="secondary" className="ml-2">{registrations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Tên VĐV</TableHead>
              <TableHead className="hidden sm:table-cell">Team</TableHead>
              <TableHead className="text-right">Trình độ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((reg, idx) => (
              <TableRow key={reg.id}>
                <TableCell className="font-medium text-foreground-muted">{idx + 1}</TableCell>
                <TableCell className="font-medium">{reg.display_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-foreground-muted">
                  {reg.team || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-xs">
                    {formatSkill(reg)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default ApprovedPlayersList;
