// ============================================================================
// ProTourEventsStrip — the pro-tour tournaments in season, as cards on /live
// linking to their results page (/live/pro/<slug>). Registry-driven: it
// reads src/content/pro-tour-events.ts and fetches nothing, so it costs the
// live page no request and needs no mock in its error-state tests. It
// self-hides when no event is within its window.
// ============================================================================

import { Link } from "react-router-dom";
import {
  eventPhase,
  formatEventDates,
  proTourEventsOnLive,
  type ProTourEventMeta,
} from "@/content/pro-tour-events";

type Lang = "en" | "vi";

const PHASE_LABEL = {
  upcoming: { vi: "Sắp diễn ra", en: "Upcoming" },
  live: { vi: "Đang diễn ra", en: "In progress" },
  finished: { vi: "Đã kết thúc", en: "Finished" },
} as const;

export function ProTourEventsStrip({ language, now = Date.now() }: { language: Lang; now?: number }) {
  const events = proTourEventsOnLive(now);
  if (events.length === 0) return null;
  const vi = language === "vi";
  return (
    <section className="pts" aria-label={vi ? "Giải pro tour" : "Pro tour events"}>
      <style>{PTS_CSS}</style>
      <div className="pts-head">
        <span className="pts-kicker">◆ {vi ? "Kết quả pro tour" : "Pro tour results"}</span>
      </div>
      <div className="pts-grid">
        {events.map((e) => (
          <EventCard key={e.slug} meta={e} language={language} now={now} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ meta, language, now }: { meta: ProTourEventMeta; language: Lang; now: number }) {
  const vi = language === "vi";
  const phase = eventPhase(meta, now);
  const href = `${vi ? "/vi" : ""}/live/pro/${meta.slug}`;
  const branded = Boolean(meta.brandBg);
  return (
    <Link
      to={href}
      className={`pts-card pts-card--${phase}${branded ? " pts-card--brand" : ""}`}
      style={branded ? { background: meta.brandBg } : undefined}
    >
      {meta.logoUrl && (
        <img
          className="pts-logo"
          src={meta.logoUrl}
          alt=""
          width={64}
          height={100}
          loading="lazy"
          aria-hidden="true"
        />
      )}
      <div className="pts-card-top">
        <span className="pts-tier">{meta.tier}</span>
        <span className={`pts-phase pts-phase--${phase}`}>
          {phase === "live" && <span className="pts-dot" aria-hidden="true" />}
          {PHASE_LABEL[phase][language]}
        </span>
      </div>
      <h3 className="pts-name">{vi ? meta.nameVi : meta.nameEn}</h3>
      <p className="pts-meta">
        {formatEventDates(meta, language)} · {meta.city}, {meta.country}
      </p>
      <span className="pts-cta">{vi ? "Xem kết quả →" : "See results →"}</span>
    </Link>
  );
}

const PTS_CSS = `
.pts { margin: 8px 0 28px; }
.pts-head { margin-bottom: 10px; }
.pts-kicker { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--tl-gold); font-weight: 700; }
.pts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.pts-card { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--tl-border); border-radius: var(--tl-radius-xl, 20px); background: var(--tl-surface); padding: 16px 18px; color: inherit; text-decoration: none; transition: border-color .12s, transform .12s; }
.pts-card:hover { border-color: var(--tl-gold); transform: translateY(-1px); }
.pts-card:focus-visible { outline: 2px solid var(--tl-gold); outline-offset: 2px; }
.pts-card--live { border-color: var(--tl-live); }
.pts-card--brand { position: relative; overflow: hidden; border-color: rgba(255,255,255,.18); }
.pts-card--brand:hover { border-color: rgba(255,255,255,.45); }
.pts-card--brand .pts-name, .pts-card--brand .pts-cta { color: #fff; }
.pts-card--brand .pts-meta, .pts-card--brand .pts-tier { color: rgba(255,255,255,.72); }
.pts-card--brand .pts-phase { color: rgba(255,255,255,.72); }
.pts-card--brand .pts-phase--live { color: #6ee7a0; }
.pts-card--brand .pts-dot { background: #6ee7a0; box-shadow: 0 0 0 3px rgba(110,231,160,.25); }
.pts-logo { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 64px; height: auto; opacity: .95; pointer-events: none; filter: drop-shadow(0 2px 6px rgba(0,0,0,.35)); }
.pts-card--brand .pts-card-top, .pts-card--brand .pts-name, .pts-card--brand .pts-meta, .pts-card--brand .pts-cta { position: relative; max-width: calc(100% - 72px); }
.pts-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pts-tier { font-family: "Geist Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--tl-dim); }
.pts-phase { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-dim); display: inline-flex; align-items: center; gap: 6px; }
.pts-phase--live { color: var(--tl-live); }
.pts-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tl-live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tl-live) 25%, transparent); }
.pts-name { margin: 0; font-size: 16px; line-height: 1.25; font-weight: 800; color: var(--tl-fg); }
.pts-meta { margin: 0; font-size: 12.5px; color: var(--tl-dim); }
.pts-cta { margin-top: 4px; font-size: 13px; font-weight: 700; color: var(--tl-fg); }
`;
