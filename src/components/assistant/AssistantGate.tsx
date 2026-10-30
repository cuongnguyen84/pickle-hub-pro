import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { assistantScreenFor } from "@/lib/assistant-context";

// Chỉ tải khung trợ lý (và hook quick-table) trên các route quanh giải.
const TournamentAssistant = lazy(() => import("./TournamentAssistant"));

const AssistantGate = () => {
  const { pathname } = useLocation();
  const screen = assistantScreenFor(pathname);
  if (!screen) return null;
  return (
    <Suspense fallback={null}>
      <TournamentAssistant routeScreen={screen} />
    </Suspense>
  );
};

export default AssistantGate;
