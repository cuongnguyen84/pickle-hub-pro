import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface InviteTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  tournamentName: string;
}

export function InviteTeamDialog({
  open,
  onOpenChange,
  tournamentId,
  tournamentName,
}: InviteTeamDialogProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập email đội trưởng',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSuccessMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Bạn cần đăng nhập để thực hiện thao tác này');
      }

      const response = await supabase.functions.invoke('invite-team-to-tournament', {
        body: {
          captainEmail: email.trim(),
          tournamentId,
          tournamentName,
        },
      });

      if (response.error) {
        // Parse error from edge function response
        let errorMessage = 'Có lỗi xảy ra';
        try {
          const errorData = JSON.parse(response.error.message.split(', ').slice(1).join(', '));
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.error.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = response.data;
      
      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      setSuccessMessage(data.message);
      setEmail('');
      
      // Invalidate teams query
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournamentId] });
      
      toast({
        title: 'Thành công',
        description: data.message,
      });

      // Auto close after success
      setTimeout(() => {
        onOpenChange(false);
        setSuccessMessage('');
      }, 2000);
      
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setSuccessMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Mời đội tham gia
          </DialogTitle>
          <DialogDescription>
            Nhập email đội trưởng để mời đội tham gia giải. Đội sẽ được tự động duyệt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {successMessage ? (
            <Alert className="bg-green-500/10 border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                {successMessage}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email đội trưởng</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="captain@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Alert>
                <AlertDescription className="text-sm">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Email phải tồn tại trong hệ thống</li>
                    <li>Người dùng phải có đội (Master Team)</li>
                    <li>Đội sẽ được tự động duyệt và thêm vào giải</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {successMessage ? 'Đóng' : 'Hủy'}
          </Button>
          {!successMessage && (
            <Button onClick={handleInvite} disabled={isLoading || !email.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mời đội
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
