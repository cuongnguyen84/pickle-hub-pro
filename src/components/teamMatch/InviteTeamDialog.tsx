import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

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
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;

  const txt = {
    title: c.inviteDesc,
    desc: c.inviteCaptainEmail,
    emailLabel: c.inviteCaptainEmailLabel,
    emailPh: 'captain@example.com',
    rule1: language === 'vi'
      ? 'Email phải tồn tại trong hệ thống'
      : 'Email must already exist in the system',
    rule2: language === 'vi'
      ? 'Người dùng phải có đội (Master Team)'
      : 'User must already own a Master Team',
    rule3: language === 'vi'
      ? 'Đội sẽ được tự động duyệt và thêm vào giải'
      : 'Team will be auto-approved and added to the tournament',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    close: language === 'vi' ? 'Đóng' : 'Close',
    invite: language === 'vi' ? 'Mời đội' : 'Invite team',
    needLogin: language === 'vi'
      ? 'Bạn cần đăng nhập để thực hiện thao tác này'
      : 'You must be signed in to perform this action',
    errorTitle: language === 'vi' ? 'Lỗi' : 'Error',
    successTitle: language === 'vi' ? 'Thành công' : 'Success',
    genericError: language === 'vi' ? 'Có lỗi xảy ra' : 'Something went wrong',
    emailRequired: c.inviteEmailError,
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({
        title: txt.errorTitle,
        description: txt.emailRequired,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSuccessMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(txt.needLogin);
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
        let errorMessage = txt.genericError;
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
        title: txt.successTitle,
        description: data.message,
      });

      // Auto close after success
      setTimeout(() => {
        onOpenChange(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error: any) {
      toast({
        title: txt.errorTitle,
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
          <DialogTitle style={sectionTitle}>
            <Mail className="h-5 w-5" style={{ color: 'var(--tl-fg-2)' }} />
            {txt.title}
          </DialogTitle>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          {successMessage ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--tl-radius)',
                background: 'var(--tl-green-glow)',
                border: '1px solid var(--tl-green-dim, rgba(46, 204, 113, 0.35))',
                color: 'var(--tl-green)',
                fontSize: 13,
              }}
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-team-email" style={fieldLabel}>
                  {txt.emailLabel}
                </Label>
                <Input
                  id="invite-team-email"
                  name="invite-team-email"
                  type="email"
                  placeholder={txt.emailPh}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--tl-radius)',
                  background: 'var(--tl-bg)',
                  border: '1px solid var(--tl-border)',
                }}
              >
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12.5,
                    color: 'var(--tl-fg-3)',
                    lineHeight: 1.6,
                  }}
                >
                  <li>{txt.rule1}</li>
                  <li>{txt.rule2}</li>
                  <li>{txt.rule3}</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            className="tl-btn"
            onClick={handleClose}
            disabled={isLoading}
          >
            {successMessage ? txt.close : txt.cancel}
          </button>
          {!successMessage && (
            <button
              type="button"
              className="tl-btn green"
              onClick={handleInvite}
              disabled={isLoading || !email.trim()}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {txt.invite}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
