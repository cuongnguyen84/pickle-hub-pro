import { Link, useParams } from "react-router-dom";
import { useOrganizationBySlug, useOrganizationContent } from "@/hooks/useOrganizationData";
import { PreviewShell, formatTime, formatRelative } from "./_shell";

const OrganizationDetail = () => {
  const { slug = "" } = useParams();
  const { data: org, isLoading } = useOrganizationBySlug(slug);
  const { data: content } = useOrganizationContent(org?.id ?? "");

  const livestreams = content?.livestreams ?? [];
  const videos = content?.videos ?? [];
  const live = livestreams.filter((s) => s.status === "live");
  const scheduled = livestreams.filter((s) => s.status === "scheduled");
  const ended = livestreams.filter((s) => s.status === "ended");

  const initial = (org?.name ?? "—").charAt(0).toUpperCase();

  return (
    <PreviewShell title={org?.name ?? "Organization · Preview"}>
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <span className="current">{org?.name?.slice(0, 40) ?? "Organization"}</span>
        </nav>

        {isLoading ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>Loading organization…</p>
          </div>
        ) : !org ? (
          <div className="tl-empty" style={{ marginTop: 40 }}>
            <h3>Organization not found</h3>
            <p>This organization may have been removed or the URL is incorrect.</p>
            <Link to="/preview/the-line" className="tl-btn">Back home →</Link>
          </div>
        ) : (
          <>
            <section className="tl-org-hero">
              <div className="tl-org-logo">
                {org.display_logo || org.logo_url ? (
                  <img src={org.display_logo ?? org.logo_url ?? ""} alt={org.name} />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className="tl-org-body">
                <div className="tl-mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tl-green)" }}>
                  ◆ Organization profile
                </div>
                <h1>{org.name}</h1>
                <div className="meta">
                  <span>{live.length} live · {scheduled.length} scheduled</span>
                  <span>·</span>
                  <span>{videos.length} videos</span>
                  <span>·</span>
                  <span>{ended.length} replays</span>
                </div>
                {org.description && <p>{org.description}</p>}
              </div>
            </section>

            {live.length > 0 && (
              <section className="tl-section">
                <div className="tl-sec-head">
                  <h2>
                    Live <em className="tl-serif">now.</em>{" "}
                    <span className="sans">{live.length}</span>
                  </h2>
                </div>
                <div className="tl-match-grid">
                  {live.map((stream) => (
                    <Link key={stream.id} to={`/preview/the-line/live/${stream.id}`} className="tl-match">
                      <div className="tl-match-head">
                        <span className="stat live">Live</span>
                        <span className="ctx">{stream.started_at ? formatTime(stream.started_at) : "On air"}</span>
                      </div>
                      <h3 className="tl-match-title">{stream.title ?? "Match"}</h3>
                      <div className="tl-match-foot">
                        <span className="v">Watch →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {scheduled.length > 0 && (
              <section className="tl-section">
                <div className="tl-sec-head">
                  <h2>
                    Upcoming <span className="sans">· {scheduled.length}</span>
                  </h2>
                </div>
                <div className="tl-panel">
                  <div className="tl-panel-head">
                    <h3>Scheduled</h3>
                    <span className="meta">Next {Math.min(scheduled.length, 10)}</span>
                  </div>
                  {scheduled.slice(0, 10).map((stream) => (
                    <Link key={stream.id} to={`/preview/the-line/live/${stream.id}`} className="tl-sched-row">
                      <div className="tl-sched-date">
                        <span className="d">{stream.scheduled_start_at ? new Date(stream.scheduled_start_at).getDate().toString().padStart(2, "0") : "—"}</span>
                        <span className="m">{stream.scheduled_start_at ? new Date(stream.scheduled_start_at).toLocaleDateString("en-US", { month: "short" }).toUpperCase() : ""}</span>
                      </div>
                      <div className="tl-sched-body">
                        <h4>{stream.title ?? "Upcoming"}</h4>
                        <div className="meta">
                          <span>{formatTime(stream.scheduled_start_at)}</span>
                          <span className="sep">·</span>
                          <span>{formatRelative(stream.scheduled_start_at)}</span>
                        </div>
                      </div>
                      <div className="tl-sched-right">
                        <span className="tag active">Notify</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {videos.length > 0 && (
              <section className="tl-section">
                <div className="tl-sec-head">
                  <h2>
                    Replays & videos <span className="sans">· {videos.length}</span>
                  </h2>
                </div>
                <div className="tl-match-grid">
                  {videos.slice(0, 12).map((v) => (
                    <Link key={v.id} to={`/preview/the-line/watch/${v.id}`} className="tl-match">
                      <div className="tl-match-head">
                        <span className="stat final">{v.type?.toUpperCase()}</span>
                        <span className="ctx">{v.published_at ? formatRelative(v.published_at) : ""}</span>
                      </div>
                      <h3 className="tl-match-title">{v.title}</h3>
                      <div className="tl-match-foot">
                        <span className="v">Watch →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {livestreams.length === 0 && videos.length === 0 && (
              <section className="tl-section">
                <div className="tl-empty">
                  <h3>No broadcasts yet.</h3>
                  <p>This organization hasn't published any livestreams or videos.</p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PreviewShell>
  );
};

export default OrganizationDetail;
