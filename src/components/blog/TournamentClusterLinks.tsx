import { Link } from "react-router-dom";
import type { ClusterLink } from "@/content/blog/tournament-cluster";

/** Schedule ↔ results ↔ watch ↔ rankings ↔ tools chip row on tournament posts.
 *  Reuses the results-board chip styles; bots get the same row from
 *  functions/_lib/render (tournamentClusterHtml). Renders nothing when empty. */
export function TournamentClusterLinks({ links, label }: { links: ClusterLink[]; label: string }) {
  if (!links.length) return null;
  return (
    <nav className="tl-rb-chips" aria-label={label} style={{ margin: "16px 0" }}>
      {links.map((l) => (
        <Link key={l.path} to={l.path} className="tl-rb-chip">
          {l.text}
        </Link>
      ))}
    </nav>
  );
}
