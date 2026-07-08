// ============================================================================
// TeamMatchInfoCards — 2 card thông tin ở tab Tổng quan, đặt NGAY DƯỚI Thể lệ:
//   • Thời gian & địa điểm: ngày serif lớn + đồng hồ đếm ngược + địa điểm.
//   • Yêu cầu DUPR (nam/nữ tối đa) + thanh slot đội đã đăng ký/tổng.
// ============================================================================
import { useEffect, useState } from 'react';
import { MapPin, Gauge, Users } from 'lucide-react';
import { useI18n } from '@/i18n';

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13.5,
  color: 'var(--tl-fg-2)',
};

// Đồng hồ đếm ngược tới 00:00 ngày tổ chức — 4 ô Ngày/Giờ/Phút/Giây, tick mỗi giây.
function CountdownChips({ target, language }: { target: Date; language: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target.getTime() - now;
  if (diff <= 0) return null;
  const values = [
    Math.floor(diff / 86400000),
    Math.floor(diff / 3600000) % 24,
    Math.floor(diff / 60000) % 60,
    Math.floor(diff / 1000) % 60,
  ];
  const units = language === 'vi' ? ['Ngày', 'Giờ', 'Phút', 'Giây'] : ['Days', 'Hrs', 'Min', 'Sec'];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {values.map((v, i) => (
        <div
          key={units[i]}
          style={{
            flex: 1,
            maxWidth: 84,
            textAlign: 'center',
            padding: '10px 0 8px',
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-green-glow)',
            border: '1px solid rgba(0, 185, 107, 0.30)',
          }}
        >
          <div
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--tl-green)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {String(v).padStart(2, '0')}
          </div>
          <div
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--tl-fg-3)',
              marginTop: 4,
            }}
          >
            {units[i]}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TeamMatchInfoCardsProps {
  tournament: {
    team_count: number;
    event_date?: string | null;
    location?: string | null;
    require_dupr?: boolean;
    dupr_max_male?: number | null;
    dupr_max_female?: number | null;
  };
  /** Số đội đã đăng ký (chưa bị từ chối). */
  filledSlots: number;
}

export function TeamMatchInfoCards({ tournament, filledSlots }: TeamMatchInfoCardsProps) {
  const { language } = useI18n();

  const totalSlots = tournament.team_count;
  const slotPct = totalSlots > 0 ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : 0;
  const eventTarget = tournament.event_date ? new Date(`${tournament.event_date}T00:00:00`) : null;
  const eventIsToday = eventTarget ? eventTarget.toDateString() === new Date().toDateString() : false;
  const fmtDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  const duprText = tournament.require_dupr
    ? language === 'vi'
      ? `DUPR Nam ≤ ${(tournament.dupr_max_male ?? 0).toFixed(2)} · Nữ ≤ ${(tournament.dupr_max_female ?? 0).toFixed(2)}`
      : `DUPR Male ≤ ${(tournament.dupr_max_male ?? 0).toFixed(2)} · Female ≤ ${(tournament.dupr_max_female ?? 0).toFixed(2)}`
    : null;

  return (
    <>
      {/* Thời gian & địa điểm — highlight + đếm ngược tới ngày tổ chức */}
      {(tournament.event_date || tournament.location) && (
        <section style={{ ...surfaceCard, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--tl-green)',
            }}
          >
            ◆ {language === 'vi' ? 'Thời gian & địa điểm' : 'When & where'}
          </div>
          {tournament.event_date && (
            <div
              style={{
                fontFamily: 'Instrument Serif, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 24,
                letterSpacing: '-0.015em',
                lineHeight: 1.15,
                color: 'var(--tl-fg)',
              }}
            >
              {fmtDate(tournament.event_date)}
            </div>
          )}
          {eventTarget && eventTarget.getTime() > Date.now() && (
            <CountdownChips target={eventTarget} language={language} />
          )}
          {eventIsToday && (
            <span
              style={{
                alignSelf: 'flex-start',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--tl-green)',
                background: 'var(--tl-green-glow)',
                borderRadius: 999,
                padding: '5px 12px',
              }}
            >
              {language === 'vi' ? '🎾 Hôm nay!' : '🎾 Today!'}
            </span>
          )}
          {tournament.location && (
            <div style={{ ...infoRowStyle, fontSize: 15.5, fontWeight: 600, color: 'var(--tl-fg)' }}>
              <MapPin style={{ width: 18, height: 18, color: 'var(--tl-green)', flexShrink: 0 }} />
              <span>{tournament.location}</span>
            </div>
          )}
        </section>
      )}

      {/* Yêu cầu DUPR · thanh slot */}
      <section style={{ ...surfaceCard, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {duprText && (
          <div style={infoRowStyle}>
            <Gauge className="h-4 w-4" style={{ color: 'var(--tl-gold)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{duprText}</span>
          </div>
        )}
        <div>
          <div style={{ ...infoRowStyle, justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users className="h-4 w-4" style={{ color: 'var(--tl-green)', flexShrink: 0 }} />
              {language === 'vi' ? 'Slot đội' : 'Team slots'}
            </span>
            <strong style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13, color: filledSlots >= totalSlots ? 'var(--tl-live)' : 'var(--tl-fg)' }}>
              {filledSlots}/{totalSlots}
            </strong>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--tl-border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${slotPct}%`,
                borderRadius: 999,
                background: filledSlots >= totalSlots ? 'var(--tl-live)' : 'var(--tl-green)',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
