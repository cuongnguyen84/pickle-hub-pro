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
  useActivePublicQuickTables,
  useActiveDoublesElimination,
  useCompletedDoublesElimination,
  useActiveFlexTournaments,
  useCompletedFlexTournaments,
} from "./useTournamentData";
export type { QuickTablePublic, TeamMatchTournamentPublic, DoublesEliminationPublic, FlexTournamentPublic } from "./useTournamentData";

export {
  useLikesCount,
  useUserLiked,
  useComments,
  useViewCount,
  useApprovedRegistrations,
  useUserRegisteredTournaments,
  useUserCompletedTournaments,
} from "./useInteractionData";
