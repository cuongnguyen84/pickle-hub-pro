import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, UserMinus, Mail, Loader2 } from 'lucide-react';

// Generic referee display type - works for both Quick Tables and Doubles Elimination
interface RefereeDisplay {
  id: string;
  email?: string;
  display_name?: string;
}

interface RefereeManagementProps {
  referees: RefereeDisplay[];
  loading: boolean;
  onAddReferee: (email: string) => Promise<boolean>;
  onRemoveReferee: (refereeId: string) => Promise<boolean>;
}

export const RefereeManagement = ({
  referees,
  loading,
  onAddReferee,
  onRemoveReferee,
}: RefereeManagementProps) => {
  const [email, setEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setIsAdding(true);
    const success = await onAddReferee(email);
    if (success) {
      setEmail('');
    }
    setIsAdding(false);
  };

  const handleRemove = async (refereeId: string) => {
    setRemovingId(refereeId);
    await onRemoveReferee(refereeId);
    setRemovingId(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Trọng tài
          {referees.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {referees.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add referee form */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email trọng tài"
              className="pl-9"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd} disabled={isAdding || !email.trim()} size="sm">
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-1" />
                Thêm
              </>
            )}
          </Button>
        </div>

        {/* Referee list */}
        {loading ? (
          <div className="text-sm text-foreground-muted text-center py-4">
            Đang tải...
          </div>
        ) : referees.length === 0 ? (
          <div className="text-sm text-foreground-muted text-center py-4">
            Chưa có trọng tài nào. Thêm trọng tài để họ có thể nhập điểm.
          </div>
        ) : (
          <div className="space-y-2">
            {referees.map((referee) => (
              <div
                key={referee.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 border border-border/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {referee.display_name || 'Không có tên'}
                  </div>
                  <div className="text-xs text-foreground-muted truncate">
                    {referee.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(referee.id)}
                  disabled={removingId === referee.id}
                >
                  {removingId === referee.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserMinus className="w-4 h-4 mr-1" />
                      Gỡ
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-foreground-muted">
          Trọng tài có thể nhập và sửa điểm tất cả các trận trong giải.
        </p>
      </CardContent>
    </Card>
  );
};

export default RefereeManagement;
