import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useConfirm } from '@/hooks/useConfirm';
import {
  clearRefereePin,
  getRefereePin,
  setRefereePin,
  type RefereePinFormat,
} from '@/lib/referee-helpers';

interface RefereePinSettingsProps {
  format: RefereePinFormat;
  parentId: string;
}

/**
 * Organizer-side PIN controls — rendered directly under RefereeManagement on
 * the creator surfaces of all 4 formats. The PIN itself never touches a
 * client-readable table; everything goes through the referee-pin RPCs
 * (migration 20260722110000).
 */
export const RefereePinSettings = ({ format, parentId }: RefereePinSettingsProps) => {
  const { t } = useI18n();
  const p = t.referee.pin;
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  // Reveal right after generating (the organizer needs to read it out);
  // masked on later visits until they press show.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRefereePin(format, parentId)
      .then((row) => {
        if (cancelled) return;
        setPin(row?.pin ?? null);
        setIsActive(!!row?.is_active);
      })
      .catch((err) => {
        // Non-creators get an empty result (not an error), so the common case
        // is silent. A real failure just leaves the switch off — the organizer
        // can retry by toggling — but log it so it isn't invisible.
        console.warn('[referee-pin] getRefereePin failed', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [format, parentId]);

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    if (!navigator.onLine) {
      toast.error(p.errOffline);
      return;
    }
    if (!next) {
      const ok = await confirm({
        title: p.disableConfirmTitle,
        description: p.disableConfirmBody,
        confirmText: p.disableConfirmOk,
        cancelText: p.disableConfirmCancel,
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (next) {
        const fresh = await setRefereePin(format, parentId);
        setPin(fresh);
        setIsActive(true);
        setRevealed(true);
      } else {
        await clearRefereePin(format, parentId);
        setIsActive(false);
        setRevealed(false);
      }
    } catch {
      toast.error(p.updateError);
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = async () => {
    if (busy) return;
    if (!navigator.onLine) {
      toast.error(p.errOffline);
      return;
    }
    const ok = await confirm({
      title: p.rotateConfirmTitle,
      description: p.rotateConfirmBody,
      confirmText: p.rotate,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const fresh = await setRefereePin(format, parentId);
      setPin(fresh);
      setIsActive(true);
      setRevealed(true);
    } catch {
      toast.error(p.updateError);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      toast.success(p.copied);
    } catch {
      toast.error(p.updateError);
    }
  };

  const grouped = pin ? `${pin.slice(0, 3)} ${pin.slice(3)}` : '';

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: '1px solid var(--tl-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <KeyRound className="w-4 h-4" style={{ color: 'var(--tl-green)', flexShrink: 0 }} />
        <label
          htmlFor={`referee-pin-switch-${format}`}
          style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--tl-fg)', cursor: 'pointer' }}
        >
          {p.switchLabel}
        </label>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
        ) : (
          <Switch
            id={`referee-pin-switch-${format}`}
            checked={isActive}
            disabled={busy}
            onCheckedChange={handleToggle}
            aria-describedby={`referee-pin-hint-${format}`}
          />
        )}
      </div>

      {busy && !isActive && (
        <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '8px 0 0' }} role="status">
          {p.enabling}
        </p>
      )}

      {isActive && pin && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '0.12em',
                color: 'var(--tl-fg)',
                fontVariantNumeric: 'tabular-nums',
                minWidth: 110,
              }}
              aria-label={p.codeLabel}
            >
              {revealed ? grouped : '••• •••'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? p.hide : p.show}
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label={p.copy}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRotate}
              disabled={busy}
            >
              <RefreshCw className="w-4 h-4" />
              {p.rotate}
            </Button>
          </div>
          <p
            id={`referee-pin-hint-${format}`}
            style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '8px 0 0', lineHeight: 1.5 }}
          >
            {p.hint} {p.expiryNote}
          </p>
        </div>
      )}

      {!isActive && !loading && (
        <p
          id={`referee-pin-hint-${format}`}
          style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '8px 0 0', lineHeight: 1.5 }}
        >
          {p.hint}
        </p>
      )}
    </div>
  );
};

export default RefereePinSettings;
