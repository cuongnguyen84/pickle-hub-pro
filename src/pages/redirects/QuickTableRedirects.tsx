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
