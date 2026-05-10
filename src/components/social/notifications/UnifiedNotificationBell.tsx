// ============================================================================
// UnifiedNotificationBell — Sprint 2 Phase 3B.2 follow-up
// ----------------------------------------------------------------------------
// Single bell for legacy + social notifications combined. Replaces the two
// separate bells previously mounted in AppHeader + TheLineLayout.
// ============================================================================

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnifiedUnreadCount, useUnifiedNotificationsRealtime } from "@/hooks/social";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import NotificationList from "./NotificationList";

interface UnifiedNotificationBellProps {
  className?: string;
}

const useIsMobile = () => {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return mobile;
};

const Trigger = ({ unread, highlight }: { unread: number; highlight: boolean }) => (
  <Button
    variant="ghost"
    size="icon"
    className={cn("relative", highlight && "animate-bounce")}
    aria-label="Thông báo"
  >
    <Bell className={cn("h-5 w-5", highlight && "text-social-primary")} />
    {unread > 0 && (
      <span
        className={cn(
          "absolute -top-1 -right-1 flex items-center justify-center",
          "min-w-[18px] h-[18px] px-1 rounded-full",
          "bg-destructive text-destructive-foreground text-[10px] font-medium",
          highlight && "animate-pulse",
        )}
      >
        {unread > 9 ? "9+" : unread}
      </span>
    )}
  </Button>
);

export const UnifiedNotificationBell = ({ className }: UnifiedNotificationBellProps) => {
  const { user } = useAuth();
  // Mount the realtime subscription at the bell level so the badge
  // updates live regardless of whether the dropdown is open. Previously
  // the subscription lived inside useUnifiedNotifications() (the LIST
  // hook), which only mounts when the dropdown content renders, so the
  // badge stayed stale until the user opened the dropdown or reloaded.
  // Cuong's two-tab follow repro (Tab 1 misses the "1" badge) was this.
  useUnifiedNotificationsRealtime();
  const { data: unread = 0 } = useUnifiedUnreadCount();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (unread > 0) {
      setHighlight(true);
      const t = setTimeout(() => setHighlight(false), 1200);
      return () => clearTimeout(t);
    }
  }, [unread]);

  if (!user) return null;

  if (isMobile) {
    return (
      <div className={className}>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <span><Trigger unread={unread} highlight={highlight} /></span>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80vh] px-2 pb-4">
            <div className="mx-auto w-full max-w-md">
              <NotificationList onClose={() => setOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span><Trigger unread={unread} highlight={highlight} /></span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[360px] p-0"
        >
          <NotificationList onClose={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default UnifiedNotificationBell;
