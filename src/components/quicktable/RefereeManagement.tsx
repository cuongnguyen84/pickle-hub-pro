import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, UserMinus, Mail, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

// Generic referee display type — works for both Quick Tables and Doubles Elimination
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
  const { t } = useI18n();
  const r = t.referee;
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
    <div
      style={{
        background: 'var(--tl-bg-elev)',
        border: '1px solid var(--tl-border)',
        borderRadius: 'var(--tl-radius-lg)',
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 14,
          borderBottom: '1px solid var(--tl-border)',
          marginBottom: 18,
        }}
      >
        <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
        <h3
          style={{
            fontFamily: 'Instrument Serif, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '-0.015em',
            margin: 0,
            color: 'var(--tl-fg)',
          }}
        >
          {r.title}
        </h3>
        {referees.length > 0 && (
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--tl-surface)',
              border: '1px solid var(--tl-border)',
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.04em',
            }}
          >
            {referees.length}
          </span>
        )}
      </div>

      {/* Add referee form */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Mail
            className="w-4 h-4"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--tl-fg-3)',
              pointerEvents: 'none',
            }}
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={r.emailPlaceholder}
            className="pl-9"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <button
          type="button"
          className="tl-btn green"
          onClick={handleAdd}
          disabled={isAdding || !email.trim()}
          style={{ flexShrink: 0 }}
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              {r.addBtn}
            </>
          )}
        </button>
      </div>

      {/* Referee list / empty state */}
      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--tl-fg-3)',
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 12,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {r.loading}
        </div>
      ) : referees.length === 0 ? (
        <div className="tl-empty-card" style={{ marginBottom: 14 }}>
          <span className="tl-empty-card-mark">◌</span>
          <span className="tl-empty-card-label">{r.emptyState}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {referees.map((referee) => (
            <div
              key={referee.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 'var(--tl-radius)',
                background: 'var(--tl-bg)',
                border: '1px solid var(--tl-border)',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13.5,
                    color: 'var(--tl-fg)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {referee.display_name || r.noName}
                </div>
                <div
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    color: 'var(--tl-fg-3)',
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}
                >
                  {referee.email}
                </div>
              </div>
              <button
                type="button"
                className="tl-btn"
                onClick={() => handleRemove(referee.id)}
                disabled={removingId === referee.id}
                style={{
                  padding: '6px 10px',
                  fontSize: 11.5,
                  color: 'var(--tl-live)',
                  borderColor: 'var(--tl-border)',
                }}
              >
                {removingId === referee.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    {r.removeBtn}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: 12.5,
          color: 'var(--tl-fg-3)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {r.description}
      </p>
    </div>
  );
};

export default RefereeManagement;
