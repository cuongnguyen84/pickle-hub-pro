import { useLivePresence } from "@/hooks/useLivePresence";
import LiveCard from "./LiveCard";
import { format } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { useI18n } from "@/i18n";

interface LiveCardWithPresenceProps {
  id: string;
  title: string;
  thumbnail?: string;
  totalViews?: number;
  organizationName?: string;
  organizationSlug?: string;
  organizationLogo?: string;
  isVerifiedCreator?: boolean;
  status?: "live" | "scheduled" | "ended";
  scheduledStartAt?: string | null;
  className?: string;
  isReplay?: boolean;
  priority?: boolean;
}

/**
 * LiveCard wrapper that provides real-time concurrent viewer count
 * using Supabase Presence for live streams, and formats scheduled time.
 */
const LiveCardWithPresence = ({
  id,
  title,
  thumbnail,
  totalViews,
  organizationName,
  organizationSlug,
  organizationLogo,
  isVerifiedCreator = true,
  status = "live",
  scheduledStartAt,
  className,
  isReplay = false,
  priority = false,
}: LiveCardWithPresenceProps) => {
  const { language } = useI18n();
  
  // Only enable presence for live streams
  const { concurrentViewers } = useLivePresence(id, status === "live");

  // Format scheduled time for display
  const formattedScheduledAt = scheduledStartAt
    ? format(
        new Date(scheduledStartAt),
        "dd/MM HH:mm",
        { locale: language === "vi" ? vi : enUS }
      )
    : undefined;

  return (
    <LiveCard
      id={id}
      title={title}
      thumbnail={thumbnail}
      viewerCount={status === "live" ? concurrentViewers : undefined}
      totalViews={status === "ended" ? totalViews : undefined}
      organizationName={organizationName}
      organizationSlug={organizationSlug}
      organizationLogo={organizationLogo}
      isVerifiedCreator={isVerifiedCreator}
      status={status}
      scheduledAt={formattedScheduledAt}
      className={className}
      isReplay={isReplay}
      priority={priority}
    />
  );
};

export default LiveCardWithPresence;
