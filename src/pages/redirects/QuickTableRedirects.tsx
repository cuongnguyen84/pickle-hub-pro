import { Navigate, useParams } from "react-router-dom";

// Redirect component for legacy /quick-tables/:shareId routes
export const QuickTableRedirect = () => {
  const { shareId } = useParams();
  return <Navigate to={`/tools/quick-tables/${shareId}`} replace />;
};

// Redirect component for legacy /quick-tables/:shareId/setup routes
export const QuickTableSetupRedirect = () => {
  const { shareId } = useParams();
  return <Navigate to={`/tools/quick-tables/${shareId}/setup`} replace />;
};

// ARCH-04 S4 (2026-07-17): the legacy manual scoreboard page
// (/matches/:matchId/score, MatchScoring.tsx, 1,399 lines) is deleted —
// the shared referee screen covers it (manual mode + sets + timeouts +
// undo + DB persistence + spectators + lockout) and NOTHING in the app
// linked here anymore. Old bookmarks land on the referee screen.
export const LegacyMatchScoringRedirect = () => {
  const { matchId } = useParams();
  return <Navigate to={`/tools/quick-tables/referee/${matchId}`} replace />;
};
