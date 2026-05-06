// ============================================================================
// MatchFAB — Sprint 2 Phase 3A.1
// ----------------------------------------------------------------------------
// Floating action button bottom-right. Tap → /tran-dau/moi (match check-in
// wizard). Mobile-only (<md) so it doesn't compete with desktop nav. Hidden
// when user not logged in (the wizard requires auth anyway).
//
// Bottom offset accounts for MainLayout's pb-20/pb-24/pb-28 (web/iOS/Android
// native) so the FAB clears the bottom nav.
// ============================================================================

import { Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { isIOS, isAndroid, isNativeApp } from "@/lib/capacitor-utils";
import { cn } from "@/lib/utils";

const MatchFAB = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  // Hide while auth resolving, when logged out, or when already inside the
  // wizard (avoid covering the wizard's own footer button).
  if (loading || !user) return null;
  if (location.pathname.startsWith("/tran-dau/moi")) return null;

  const native = isNativeApp();
  const bottomClass = native && isAndroid()
    ? "bottom-32"
    : native && isIOS()
    ? "bottom-28"
    : "bottom-24";

  return (
    <Button
      type="button"
      onClick={() => navigate("/tran-dau/moi")}
      aria-label="Check-in trận đấu mới"
      className={cn(
        "fixed right-4 z-40 h-14 w-14 rounded-full p-0 shadow-lg md:hidden",
        "bg-social-primary text-white hover:bg-social-primary-dark",
        "transition-transform active:scale-95",
        bottomClass,
      )}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </Button>
  );
};

export default MatchFAB;
