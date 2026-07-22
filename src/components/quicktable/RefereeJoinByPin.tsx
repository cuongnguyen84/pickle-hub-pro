import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import {
  normalizePinInput,
  redeemRefereePin,
  type RefereePinFormat,
} from '@/lib/referee-helpers';

interface RefereeJoinByPinProps {
  format: RefereePinFormat;
  parentId: string;
  /** Called after a successful redeem so the page can refresh referee state. */
  onJoined?: () => void;
}

/**
 * Viewer-side entry: a small button + dialog to become a referee with the
 * organizer's PIN. Anonymous users are routed through login and return here
 * (same ?redirect contract as the rest of the app — UX-07 class).
 * Mount on the public view surface of each format; hide it for creators by
 * simply not rendering (the mount sites already know canManage).
 */
export const RefereeJoinByPin = ({ format, parentId, onJoined }: RefereeJoinByPinProps) => {
  const { t } = useI18n();
  const p = t.referee.pin;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTriggerAnonymous = () => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  };

  const handleSubmit = async () => {
    if (submitting || pin.length !== 6) return;
    if (!navigator.onLine) {
      setError(p.errOffline);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await redeemRefereePin(format, parentId, pin);
      if (result === 'ok') {
        toast.success(p.success);
        setOpen(false);
        setPin('');
        onJoined?.();
      } else if (result === 'already_referee') {
        toast.success(p.alreadyReferee);
        setOpen(false);
        setPin('');
        onJoined?.();
      } else if (result === 'expired') {
        setError(p.errExpired);
      } else if (result === 'rate_limited') {
        setError(p.errRateLimited);
      } else {
        setError(p.errInvalid);
      }
    } catch {
      setError(p.errGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Button type="button" variant="outline" onClick={handleTriggerAnonymous}>
        <KeyRound className="w-4 h-4" />
        {p.joinBtn}
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPin('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <KeyRound className="w-4 h-4" />
          {p.joinBtn}
        </Button>
      </DialogTrigger>
      <DialogContent style={{ maxWidth: 380 }}>
        <DialogHeader>
          <DialogTitle>{p.joinTitle}</DialogTitle>
          <DialogDescription>{p.joinHelper}</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={pin}
            onChange={(e) => {
              setPin(normalizePinInput(e.target.value));
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={7}
            autoComplete="one-time-code"
            aria-label={p.codeLabel}
            aria-invalid={!!error}
            aria-describedby={error ? 'referee-pin-join-error' : undefined}
            style={{
              height: 56,
              width: '100%',
              textAlign: 'center',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.25em',
              fontVariantNumeric: 'tabular-nums',
              background: 'var(--tl-bg)',
              border: '1px solid var(--tl-border)',
              borderRadius: 'var(--tl-radius)',
              color: 'var(--tl-fg)',
            }}
          />
          {error && (
            <p
              id="referee-pin-join-error"
              role="alert"
              style={{ fontSize: 13, color: 'var(--tl-live)', margin: 0, lineHeight: 1.5 }}
            >
              {error}
            </p>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || pin.length !== 6}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {p.joinChecking}
              </>
            ) : (
              p.joinSubmit
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RefereeJoinByPin;
