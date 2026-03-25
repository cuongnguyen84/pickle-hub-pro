// Barrel re-export file — preserves backward compatibility
// All hooks have been split into domain-specific files for maintainability

export { useVideos, useVideo, useReplays } from "./useVideoData";
export type { Video } from "./useVideoData";

export { useLivestreams, useLivestream } from "./useLivestreamData";
export type { Livestream, LivestreamWithLogo } from "./useLivestreamData";

export {
  useOrganizations,
  useTournaments,
  useTournamentBySlug,
  useTournamentContent,
  useOpenRegistrationTables,
  useOpenTeamMatchTournaments,
  useCompletedPublicQuickTables,
  useCompletedTeamMatchTournaments,
} from "./useTournamentData";
export type { QuickTablePublic, TeamMatchTournamentPublic } from "./useTournamentData";

export {
  useLikesCount,
  useUserLiked,
  useComments,
  useViewCount,
  useApprovedRegistrations,
  useUserRegisteredTournaments,
  useUserCompletedTournaments,
} from "./useInteractionData";
