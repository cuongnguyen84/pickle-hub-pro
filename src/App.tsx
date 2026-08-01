import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { I18nProvider } from "@/i18n";
import { LoadingState, OfflineBanner } from "@/components/states/PageStates";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { lazy, Suspense, Component, ReactNode, useLayoutEffect } from "react";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useLivestreamGateAttribution } from "@/lib/livestreamGateAttribution";
import BottomNav from "@/components/layout/BottomNav";
import ChatFAB from "@/components/layout/ChatFAB";
import AppHeader from "@/components/layout/AppHeader";

import { ViLanguageWrapper } from "@/components/layout/ViLanguageWrapper";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useUnifiedNotificationsRealtime } from "@/hooks/social";
import { initializeGoogleAuth } from "@/hooks/useNativeGoogleAuth";

// Eagerly load the Index page for fast initial render
import Index from "./pages/Index";
import RequireAuth from "@/components/auth/RequireAuth";
import ConditionalAuth from "@/components/auth/ConditionalAuth";

// Initialize Native Google Auth plugin on app startup
initializeGoogleAuth();

// Lazy load all other pages for code splitting.
// lazyRetry: thử lại import 1 lần sau 1.5s — lỗi mạng thoáng qua (đang xem
// live, sóng yếu) không đáng để rơi vào ChunkErrorBoundary + reload cả trang.
// Nếu vẫn fail (deploy mới, chunk cũ 404 thật) thì boundary xử lý như cũ.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyRetry = <T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) =>
  lazy(() =>
    factory().catch(
      () =>
        new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => factory().then(resolve, reject), 1500);
        }),
    ),
  );

const Live = lazyRetry(() => import("./pages/Live"));
const Videos = lazyRetry(() => import("./pages/Videos"));
const Tournaments = lazyRetry(() => import("./pages/Tournaments"));
const TournamentDetail = lazyRetry(() => import("./pages/TournamentDetail"));
const Login = lazyRetry(() => import("./pages/Login"));
const AuthCallback = lazyRetry(() => import("./pages/AuthCallback"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const WatchVideo = lazyRetry(() => import("./pages/WatchVideo"));
const WatchLive = lazyRetry(() => import("./pages/WatchLive"));
const Account = lazyRetry(() => import("./pages/Account"));
const DuprConnect = lazyRetry(() => import("./pages/DuprConnect"));
const MatchNewPage = lazyRetry(() => import("./pages/MatchNew"));
const MatchConfirm = lazyRetry(() => import("./pages/MatchConfirm"));
const MatchInviteConfirm = lazyRetry(() => import("./pages/MatchInviteConfirm"));
const AdminDuprDashboard = lazyRetry(() => import("./pages/admin/AdminDuprDashboard"));
const AdminErrors = lazyRetry(() => import("./pages/admin/AdminErrors"));
const MatchSubmitPage = lazyRetry(() => import("./pages/Match"));
const MyTournaments = lazyRetry(() => import("./pages/MyTournaments"));
const Notifications = lazyRetry(() => import("./pages/Notifications"));
const Search = lazyRetry(() => import("./pages/Search"));
const OrganizationDetail = lazyRetry(() => import("./pages/OrganizationDetail"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Tools = lazyRetry(() => import("./pages/Tools"));
const QuickTables = lazyRetry(() => import("./pages/QuickTables"));
const QuickTableSetup = lazyRetry(() => import("./pages/QuickTableSetup"));
const QuickTableView = lazyRetry(() => import("./pages/QuickTableView"));
const ParentTournamentPage = lazyRetry(() => import("./pages/ParentTournamentPage"));
const QuickTableRefereeScoring = lazyRetry(() => import("./pages/QuickTableRefereeScoring"));
const TeamMatchScoring = lazyRetry(() => import("./pages/TeamMatchScoring"));
const JoinTeam = lazyRetry(() => import("./pages/JoinTeam"));
const Privacy = lazyRetry(() => import("./pages/Privacy"));
const Terms = lazyRetry(() => import("./pages/Terms"));
const Advertise = lazyRetry(() => import("./pages/Advertise"));
const AffiliateDisclosurePage = lazyRetry(() => import("./pages/AffiliateDisclosure"));
const TeamMatchList = lazyRetry(() => import("./pages/TeamMatchList"));
const TeamMatchSetup = lazyRetry(() => import("./pages/TeamMatchSetup"));
const TeamMatchView = lazyRetry(() => import("./pages/TeamMatchView"));
const News = lazyRetry(() => import("./pages/News"));
const NewsArticle = lazyRetry(() => import("./pages/NewsArticle"));
const ShareRedirect = lazyRetry(() => import("./pages/ShareRedirect"));

// Doubles Elimination pages
const DoublesEliminationList = lazyRetry(() => import("./pages/DoublesEliminationList"));
const DoublesEliminationSetup = lazyRetry(() => import("./pages/DoublesEliminationSetup"));
const DoublesEliminationView = lazyRetry(() => import("./pages/DoublesEliminationView"));
const DoublesEliminationScoring = lazyRetry(() => import("./pages/DoublesEliminationScoring"));

// Flex Tournament pages
const FlexTournamentList = lazyRetry(() => import("./pages/FlexTournamentList"));
const FlexTournamentSetup = lazyRetry(() => import("./pages/FlexTournamentSetup"));
const FlexTournamentView = lazyRetry(() => import("./pages/FlexTournamentView"));

// Blog pages
const Blog = lazyRetry(() => import("./pages/Blog"));
const BlogPost = lazyRetry(() => import("./pages/BlogPost"));
const ViBlogPost = lazyRetry(() => import("./pages/ViBlogPost"));

// Forum pages
const Forum = lazyRetry(() => import("./pages/Forum"));
const ForumCategory = lazyRetry(() => import("./pages/ForumCategory"));
const ForumPostDetail = lazyRetry(() => import("./pages/ForumPostDetail"));
const ForumPostCreate = lazyRetry(() => import("./pages/ForumPostCreate"));

// Bet #1 social — Sprint 2
const MatchCheckIn = lazyRetry(() => import("./pages/MatchCheckIn"));
const MatchPage = lazyRetry(() => import("./pages/MatchPage"));
// Bet #1 social — Sprint 3 Phase 3A
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
// Bet #1 social — Sprint 3 Phase 3B
const PlayerProfile = lazyRetry(() => import("./pages/PlayerProfile"));
// Bet #1 social — Sprint 4 Phase 4A
const Feed = lazyRetry(() => import("./pages/Feed"));
// Social Events MVP — Sprint 1 PR2
const SocialEventDetail = lazyRetry(() => import("./pages/SocialEventDetail"));
const ClubLanding = lazyRetry(() => import("./pages/ClubLanding"));
// Social Events MVP — Sprint 1 PR3 (organizer surfaces)
const ClubManage = lazyRetry(() => import("./pages/ClubManage"));
const CreateSocialEvent = lazyRetry(() => import("./pages/CreateSocialEvent"));
const SocialEventRoster = lazyRetry(() => import("./pages/SocialEventRoster"));
const SocialEventMatchmaking = lazyRetry(() => import("./pages/SocialEventMatchmaking"));
// Social Events MVP — Sprint 1.5 PR46 (public collection page)
const SocialEventList = lazyRetry(() => import("./pages/SocialEventList"));
// Social Events MVP — Sprint 1.5 PR47 (live event UX)
const SocialEventLive = lazyRetry(() => import("./pages/SocialEventLive"));
// Social Events MVP — PR55 (self-service club creation + discovery)
const ClubsList = lazyRetry(() => import("./pages/ClubsList"));
const CreateClub = lazyRetry(() => import("./pages/CreateClub"));
// Court finder ("Tìm sân") — venue directory
const VenuesList = lazyRetry(() => import("./pages/VenuesList"));
const VenueDetail = lazyRetry(() => import("./pages/VenueDetail"));
const VenueSubmit = lazyRetry(() => import("./pages/VenueSubmit"));
const VenuesCity = lazyRetry(() => import("./pages/VenuesCity"));
// Find players ("Tìm bạn chơi") + in-app messaging
const FindPlayers = lazyRetry(() => import("./pages/FindPlayers"));
const Messages = lazyRetry(() => import("./pages/Messages"));
// Social Events MVP — PR57 (club management polish)
const EditClub = lazyRetry(() => import("./pages/EditClub"));
// Social Events MVP — PR58 (pre-launch must-haves)
const PlayerRegistration = lazyRetry(() => import("./pages/PlayerRegistration"));
const EditSocialEvent = lazyRetry(() => import("./pages/EditSocialEvent"));
// Social Events MVP — PR59 (registration recovery)
const RecoveryRegistration = lazyRetry(() => import("./pages/RecoveryRegistration"));
// Dashboard pages
const DashboardPicker = lazyRetry(() => import("./pages/DashboardPicker"));
const TournamentDashboard = lazyRetry(() => import("./pages/TournamentDashboard"));

// Lazy load embed pages
const EmbedLive = lazyRetry(() => import("./pages/embed/EmbedLive"));
const EmbedVideo = lazyRetry(() => import("./pages/embed/EmbedVideo"));

const Rankings = lazyRetry(() => import("./pages/Rankings"));

// Lazy load redirect pages
const QuickTableRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.QuickTableRedirect })),
);
const QuickTableSetupRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.QuickTableSetupRedirect })),
);
const LegacyMatchScoringRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.LegacyMatchScoringRedirect })),
);

// Lazy load admin pages
const AdminOverview = lazyRetry(() => import("./pages/admin/AdminOverview"));
const AdminOrganizations = lazyRetry(() => import("./pages/admin/AdminOrganizations"));
const AdminUsers = lazyRetry(() => import("./pages/admin/AdminUsers"));
const AdminTournaments = lazyRetry(() => import("./pages/admin/AdminTournaments"));
const AdminApiKeys = lazyRetry(() => import("./pages/admin/AdminApiKeys"));
const AdminModeration = lazyRetry(() => import("./pages/admin/AdminModeration"));
const AdminDisputes = lazyRetry(() => import("./pages/admin/AdminDisputes"));
const AdminReports = lazyRetry(() => import("./pages/admin/AdminReports"));
const AdminNews = lazyRetry(() => import("./pages/admin/AdminNews"));
const AdminEmbeds = lazyRetry(() => import("./pages/admin/AdminEmbeds"));
const AdminLivestreamViewers = lazyRetry(() => import("./pages/admin/AdminLivestreamViewers"));
const AdminPushNotification = lazyRetry(() => import("./pages/admin/AdminPushNotification"));
const AdminForum = lazyRetry(() => import("./pages/admin/AdminForum"));
const AdminAuditLog = lazyRetry(() => import("./pages/admin/AdminAuditLog"));
const ProTourAdmin = lazyRetry(() => import("./pages/admin/ProTourAdmin"));
const AdminViBlog = lazyRetry(() => import("./pages/admin/AdminViBlog"));
const AdminViBlogEditor = lazyRetry(() => import("./pages/admin/AdminViBlogEditor"));
const AdminAnalytics = lazyRetry(() => import("./pages/admin/AdminAnalytics"));

// Lazy load creator pages
const CreatorOverview = lazyRetry(() => import("./pages/creator/CreatorOverview"));
const CreatorVideos = lazyRetry(() => import("./pages/creator/CreatorVideos"));
const CreatorVideoForm = lazyRetry(() => import("./pages/creator/CreatorVideoForm"));
const CreatorLivestreams = lazyRetry(() => import("./pages/creator/CreatorLivestreams"));
const CreatorLivestreamForm = lazyRetry(() => import("./pages/creator/CreatorLivestreamForm"));
const CreatorSettings = lazyRetry(() => import("./pages/creator/CreatorSettings"));
const CreatorAnalytics = lazyRetry(() => import("./pages/creator/CreatorAnalytics"));
const CreatorTournaments = lazyRetry(() => import("./pages/creator/CreatorTournaments"));

// Global React Query defaults tuned for mobile / iOS app.
// - staleTime 30s: prevents refetch when navigating back within 30s (e.g., home → live → home)
// - gcTime 5min: keeps data in cache for 5 minutes before garbage collection
// - refetchOnWindowFocus false: avoid double-fetch when user switches tabs/apps
// - refetchOnMount false: respect staleTime on remount (major mobile win)
// - retry: skip retry on 4xx, max 2 retries with exponential backoff
// Individual hooks can override these (e.g., live data uses staleTime: 30s already).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number } | null)?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Start fetching home page data immediately (before React renders)
import { prefetchHomeData } from "@/lib/prefetch";
import { shouldPrefetchHomeData } from "@/lib/prefetch-policy";
// Do not make venue/article LCP compete with three homepage API requests and a
// high-priority livestream thumbnail. Those requests used to run on every URL.
if (typeof window !== "undefined" && shouldPrefetchHomeData(window.location.pathname)) {
  prefetchHomeData(queryClient);
}

// Route-transition fallback = shared LoadingState (DS-04). It calls useI18n(),
// which is safe: the Suspense boundary using it renders inside I18nProvider
// after the active dictionary has loaded.
const PageLoader = () => <LoadingState fullScreen />;

// Chunk-error detection lives in @/lib/chunkError — shared with pwa.ts so
// the browser-specific message list can never drift between the two again.
import { isChunkErrorMessage } from "@/lib/chunkError";

// Error boundary for lazy-loaded chunks (handles stale cache after deploy)
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; giveUp: boolean }
> {
  // REVIEW: reload cap dùng CỬA SỔ THỜI GIAN, không reset bằng timer.
  // Lịch sử: timer 5s (fix loop 2026-04-27) lại gây loop kiểu khác — trên mạng
  // chậm (đang xem live) lazy import fail SAU 5s, counter đã bị xoá nên mỗi
  // vòng đếm lại từ 0 → reload vô hạn, kẹt "Đang tải lại..." (2026-07-08).
  // Giờ: quá MAX_RELOADS lần trong 2 phút → dừng, hiện nút tải thủ công.

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, giveUp: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  async componentDidCatch(error: Error) {
    console.error("[ChunkErrorBoundary] Caught error:", error.message, error.stack);
    if (!isChunkErrorMessage(error.message)) return;

    // Eagerly clear caches + unregister SW BEFORE reload. Existing users
    // with a pre-9425f6a SW have OLD index.html precached referencing
    // OLD chunk hashes — when the SW serves stale HTML, browser fetches
    // OLD chunk URLs, CDN SPA-fallback returns NEW HTML, parser hits "<"
    // → loop. Blowing the cache breaks the loop after one reload.
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // Storage may be disabled (private mode, quota) — fall through to reload anyway.
    }

    // Cap reloads trong cửa sổ 2 phút — chống loop bất kể lỗi nổ nhanh hay
    // chậm. Quá MAX_RELOADS → nút "Tải lại trang" thủ công (see render()).
    const KEY = "chunk-reload-count";
    const TS_KEY = "chunk-reload-first-ts";
    const MAX_RELOADS = 3;
    const WINDOW_MS = 120_000;
    const now = Date.now();
    let count = 0;
    let first = 0;
    try {
      count = Number(sessionStorage.getItem(KEY) || "0");
      first = Number(sessionStorage.getItem(TS_KEY) || "0");
    } catch { /* ignore */ }

    if (!first || now - first > WINDOW_MS) {
      count = 0;
      first = now;
    }

    if (count >= MAX_RELOADS) {
      try {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(TS_KEY);
      } catch { /* ignore */ }
      this.setState({ giveUp: true });
      return;
    }

    try {
      sessionStorage.setItem(KEY, String(count + 1));
      sessionStorage.setItem(TS_KEY, String(first));
    } catch { /* ignore */ }
    window.location.reload();
  }
  render() {
    if (this.state.hasError) {
      const chunkErr = isChunkErrorMessage(this.state.error?.message);
      return (
        <div className="h-full bg-background flex flex-col w-full overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto flex items-center justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
            {chunkErr && !this.state.giveUp ? (
              <div className="text-muted-foreground">Đang tải lại...</div>
            ) : chunkErr && this.state.giveUp ? (
              <div className="flex flex-col items-center gap-3 max-w-sm text-center px-4">
                <div className="text-muted-foreground">
                  Trang không thể tải. Có thể trình duyệt đang dùng phiên bản cũ.
                </div>
                <button
                  onClick={() => {
                    try { sessionStorage.clear(); } catch { /* ignore */ }
                    window.location.href =
                      window.location.pathname + "?_cb=" + Date.now();
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                >
                  Tải lại trang
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="text-muted-foreground">Đã xảy ra lỗi</div>
                <div className="text-xs text-muted-foreground/60 max-w-md text-center break-all">
                  {this.state.error?.message}
                </div>
                <button
                  onClick={() => this.setState({ hasError: false, error: null, giveUp: false })}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                >
                  Thử lại
                </button>
              </div>
            )}
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}

// Component to initialize deep link handler
const DeepLinkInitializer = (): null => {
  useDeepLinkHandler();
  return null;
};

// Component to initialize push notifications
const PushNotificationInitializer = (): null => {
  usePushNotifications();
  return null;
};

// Mount the unified-notifications realtime subscription ONCE per page
// (Codex P2 follow-up on PR #27). AppHeader renders the bell twice
// (desktop md:block + mobile md:hidden side-by-side, CSS-toggled), so
// subscribing inside the bell duplicates Supabase channel subscriptions
// and runs invalidateQueries 2x per notification. Mounting here keeps
// it 1-per-session regardless of how many bell instances exist.
const NotificationsRealtimeInitializer = (): null => {
  useUnifiedNotificationsRealtime();
  return null;
};

// Component to track page views for GA4
const PageTracker = (): null => {
  usePageTracking();
  return null;
};

// Livestream-gate signup attribution — kept out of useAuth (auth surface is
// release-tier RED; this is pure analytics).
const LivestreamGateAttribution = (): null => {
  useLivestreamGateAttribution();
  return null;
};

// Redirect component for /livestream/:id → /live/:id
const LivestreamRedirect = () => {
  const params = window.location.pathname.match(/\/livestream\/(.+)/);
  const id = params?.[1] || "";
  return <Navigate to={`/live/${id}`} replace />;
};

// PR69 — SPA-internal aliases for the legacy /su-kien/* paths. Fresh
// hits get a server-side 301 from public/_redirects; these handle any
// stale internal Link that still references the old path so the user
// lands on the new /social/* equivalent instead of seeing a 404.
const NavigateSuKienDetail = () => {
  const slug = window.location.pathname.match(/\/su-kien\/([^/?#]+)/)?.[1] ?? "";
  return <Navigate to={`/social/${slug}`} replace />;
};
const NavigateSuKienDanhSach = () => {
  const slug = window.location.pathname.match(/\/su-kien\/([^/?#]+)\/danh-sach/)?.[1] ?? "";
  return <Navigate to={`/social/${slug}/danh-sach`} replace />;
};
const NavigateSuKienXepCap = () => {
  const slug = window.location.pathname.match(/\/su-kien\/([^/?#]+)\/xep-cap/)?.[1] ?? "";
  return <Navigate to={`/social/${slug}/xep-cap`} replace />;
};
const NavigateSuKienLive = () => {
  const slug = window.location.pathname.match(/\/su-kien\/([^/?#]+)\/live/)?.[1] ?? "";
  return <Navigate to={`/social/${slug}/live`} replace />;
};
const NavigateSuKienLiveVi = () => {
  const slug = window.location.pathname.match(/\/vi\/su-kien\/([^/?#]+)\/live/)?.[1] ?? "";
  return <Navigate to={`/vi/social/${slug}/live`} replace />;
};
// PR69 follow-up — organizer routes under /clb/:slug also moved
// from /su-kien/* to /social/*. Same Navigate-alias pattern.
const NavigateClbCreateEvent = () => {
  const club = window.location.pathname.match(/\/clb\/([^/?#]+)\/su-kien\/moi/)?.[1] ?? "";
  return <Navigate to={`/clb/${club}/social/moi`} replace />;
};
const NavigateClbEditEvent = () => {
  const m = window.location.pathname.match(
    /\/clb\/([^/?#]+)\/quan-ly\/su-kien\/([^/?#]+)\/sua/,
  );
  const club = m?.[1] ?? "";
  const ev = m?.[2] ?? "";
  return <Navigate to={`/clb/${club}/quan-ly/social/${ev}/sua`} replace />;
};

// PR79 Phase 2F (audit I-8) — /u/:slug + /vi/u/:slug aliases. Canonical
// is /nguoi-choi/:username (single-canonical pattern, prerender lives
// there, sitemap-players.xml emits there). The CF Pages middleware
// also serves a 301 for bots; this client redirect catches SPA-routed
// hits + any in-app Link still using the old path.
const NavigateUSlug = () => {
  const slug = window.location.pathname.match(/\/u\/([^/?#]+)/)?.[1] ?? "";
  return <Navigate to={`/nguoi-choi/${slug}`} replace />;
};
const NavigateUSlugVi = () => {
  const slug = window.location.pathname.match(/\/vi\/u\/([^/?#]+)/)?.[1] ?? "";
  return <Navigate to={`/nguoi-choi/${slug}`} replace />;
};

// Scroll restoration — SPA route changes keep the previous scroll position
// by default, so deep pages open mid-scroll. Reset to top on PUSH/REPLACE
// navigations; leave POP (back/forward) alone so the browser's native
// restoration still works.
const ScrollToTop = (): null => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
      // A11Y-01: hand focus to the new page's content so screen readers
      // announce the navigation and Tab starts inside the page, not in the
      // chrome. POP keeps browser-native focus/scroll restoration.
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }
  }, [pathname, navigationType]);
  return null;
};

// ============================================================================
// ARCH-05 — EN↔VI mirrored routes, declared ONCE.
// ----------------------------------------------------------------------------
// Each entry renders twice inside <Routes>: at `path` (EN) and at
// `/vi` + path wrapped in <ViLanguageWrapper> (VI). React Router v6 ranks by
// path specificity, not source order, so mapping changes no matching.
//   viElement     — VI-specific component/props (ViBlogPost, NewsArticle vi)
//   viSkipWrapper — SocialEventLive only: court-side live scoring keeps its
//                   historical unwrapped mount pending a socket audit
// KEEP entries single-line — src/routes/__tests__/route-snapshot.test.ts
// parses them statically to verify parity against the checked-in snapshot.
// New localized page? Add ONE entry here. EN-only/admin/redirect routes stay
// as literal <Route> lines below.
// ============================================================================
interface MirroredRoute {
  path: string;
  element: ReactNode;
  viElement?: ReactNode;
  viSkipWrapper?: boolean;
}

const MIRRORED: MirroredRoute[] = [
  { path: "/", element: <Index /> },
  { path: "/live", element: <Live /> },
  { path: "/live/:id", element: <WatchLive /> },
  { path: "/videos", element: <Videos /> },
  { path: "/watch/:id", element: <WatchVideo /> },
  { path: "/tournaments", element: <Tournaments /> },
  { path: "/tournament/:slug", element: <ConditionalAuth><TournamentDetail /></ConditionalAuth> },
  { path: "/org/:slug", element: <OrganizationDetail /> },
  { path: "/login", element: <Login /> },
  { path: "/account", element: <Account /> },
  { path: "/account/my-tournaments", element: <RequireAuth><MyTournaments /></RequireAuth> },
  { path: "/social", element: <SocialEventList /> },
  { path: "/social/:slug", element: <SocialEventDetail /> },
  { path: "/social/:slug/danh-sach", element: <SocialEventRoster /> },
  { path: "/social/:slug/xep-cap", element: <SocialEventMatchmaking /> },
  { path: "/social/:slug/live", element: <SocialEventLive />, viSkipWrapper: true },
  { path: "/clubs", element: <ClubsList /> },
  { path: "/san", element: <VenuesList /> },
  { path: "/san/them", element: <VenueSubmit /> },
  { path: "/san/khu-vuc/:city", element: <VenuesCity /> },
  { path: "/tim-ban-choi", element: <FindPlayers /> },
  { path: "/tin-nhan", element: <Messages /> },
  { path: "/san/:slug", element: <VenueDetail /> },
  { path: "/dang-ky/:magic_token", element: <PlayerRegistration /> },
  { path: "/khoi-phuc-dang-ky", element: <RecoveryRegistration /> },
  { path: "/notifications", element: <Notifications /> },
  { path: "/thong-bao", element: <Notifications /> },
  { path: "/search", element: <Search /> },
  { path: "/news", element: <News />, viElement: <News language="vi" /> },
  { path: "/news/:slug", element: <NewsArticle language="en" />, viElement: <NewsArticle language="vi" /> },
  { path: "/rankings", element: <Rankings /> },
  { path: "/feed", element: <Feed /> },
  { path: "/blog", element: <Blog /> },
  { path: "/blog/:slug", element: <BlogPost />, viElement: <ViBlogPost /> },
  { path: "/forum", element: <Forum /> },
  { path: "/forum/:categorySlug", element: <ForumCategory /> },
  { path: "/forum/post/:postId", element: <ForumPostDetail /> },
  { path: "/forum/new", element: <ForumPostCreate /> },
  { path: "/tools", element: <Tools /> },
  { path: "/tools/quick-tables", element: <QuickTables /> },
  { path: "/tools/quick-tables/parent/:shareId", element: <ParentTournamentPage /> },
  { path: "/tools/quick-tables/:shareId", element: <ConditionalAuth><QuickTableView /></ConditionalAuth> },
  { path: "/tools/quick-tables/:shareId/setup", element: <QuickTableSetup /> },
  { path: "/tools/team-match", element: <TeamMatchList /> },
  { path: "/tools/team-match/new", element: <TeamMatchSetup /> },
  { path: "/tools/team-match/match/:matchId/score", element: <TeamMatchScoring /> },
  { path: "/tools/team-match/:id", element: <ConditionalAuth><TeamMatchView /></ConditionalAuth> },
  { path: "/tools/doubles-elimination", element: <DoublesEliminationList /> },
  { path: "/tools/doubles-elimination/new", element: <DoublesEliminationSetup /> },
  { path: "/tools/doubles-elimination/:shareId", element: <ConditionalAuth><DoublesEliminationView /></ConditionalAuth> },
  { path: "/tools/doubles-elimination/match/:matchId/score", element: <DoublesEliminationScoring /> },
  { path: "/tools/flex-tournament", element: <FlexTournamentList /> },
  { path: "/tools/flex-tournament/new", element: <FlexTournamentSetup /> },
  { path: "/tools/flex-tournament/:shareId", element: <ConditionalAuth><FlexTournamentView /></ConditionalAuth> },
  { path: "/tools/dashboard", element: <DashboardPicker /> },
  { path: "/tools/dashboard/:type/:id", element: <TournamentDashboard /> },
  { path: "/privacy", element: <Privacy /> },
  { path: "/terms", element: <Terms /> },
  { path: "/advertise", element: <Advertise /> },
  { path: "/affiliate-disclosure", element: <AffiliateDisclosurePage /> },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
           <ConfirmProvider>
            <Toaster />
            <Sonner />
            <OfflineBanner />
            <BrowserRouter>
              <DeepLinkInitializer />
              <PushNotificationInitializer />
              <NotificationsRealtimeInitializer />
              <PageTracker />
              <LivestreamGateAttribution />
              <ScrollToTop />

              <SkipToContent />
              <BottomNav />
              <ChatFAB />
              <ChunkErrorBoundary>
                {/* tabIndex=-1: programmatic focus target for the skip link
                    and route changes; outline suppressed since it is not a
                    user-tabbable stop. */}
                <div
                  id="main-content"
                  tabIndex={-1}
                  className="outline-none flex min-h-0 w-full flex-1 flex-col"
                >
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {MIRRORED.map((r) => (
                      <Route key={r.path} path={r.path} element={r.element} />
                    ))}
                    {MIRRORED.map((r) => {
                      const el = r.viElement ?? r.element;
                      const viPath = r.path === "/" ? "/vi" : `/vi${r.path}`;
                      return (
                        <Route
                          key={viPath}
                          path={viPath}
                          element={r.viSkipWrapper ? el : <ViLanguageWrapper>{el}</ViLanguageWrapper>}
                        />
                      );
                    })}
                    {/* Primary livestream routes */}
                    {/* Legacy /livestream routes - 301 redirect to /live */}
                    <Route path="/livestream" element={<Navigate to="/live" replace />} />
                    <Route path="/livestream/:id" element={<LivestreamRedirect />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/auth/reset-password" element={<ResetPassword />} />
                    <Route path="/dupr" element={<RequireAuth><DuprConnect /></RequireAuth>} />
                    <Route path="/admin/dupr" element={<RequireAuth requiredRole="admin"><AdminDuprDashboard /></RequireAuth>} />
                    <Route path="/admin/errors" element={<RequireAuth requiredRole="admin"><AdminErrors /></RequireAuth>} />
                    <Route path="/match" element={<RequireAuth><MatchSubmitPage /></RequireAuth>} />
                    <Route path="/match/new" element={<RequireAuth><MatchNewPage /></RequireAuth>} />
                    <Route path="/match/confirm" element={<RequireAuth><MatchConfirm /></RequireAuth>} />
                    {/* Phase A: public invite-to-confirm landing (token = bearer; no auth wrapper) */}
                    <Route path="/match/confirm/:code" element={<MatchInviteConfirm />} />
                    {/* Bet #1: match check-in (Vietnamese canonical /tran-dau/moi) */}
                    <Route path="/tran-dau/moi" element={<RequireAuth><MatchCheckIn /></RequireAuth>} />
                    {/* Bet #1: match permalink (Vietnamese canonical /tran-dau/:slug) */}
                    <Route path="/tran-dau/:slug" element={<MatchPage />} />
                    {/* Bet #1 Sprint 3 Phase 3A: onboarding wizard (auth + onboard-state handled inline) */}
                    <Route path="/onboarding" element={<Onboarding />} />
                    {/* Bet #1 Sprint 3 Phase 3B: public PlayerProfile (no auth wrapper) */}
                    <Route path="/nguoi-choi/:username" element={<PlayerProfile />} />
                    {/* Social Events MVP — public landing pages (no auth).
                        PR69 renamed /su-kien → /social; the cloudflare
                        _redirects file 301s fresh hits server-side. The
                        client-side `Navigate` aliases below catch any
                        stale SPA-internal Link that still uses the old
                        path so users never see a 404. */}
                    {/* 2026-05-20 — VI-canonical mirror for social event detail.
                        Previously only /social/:slug existed and the SPA
                        defaulted to EN for non-VN visitors. The new
                        /vi/social/:slug route forces VI rendering via
                        ViLanguageWrapper; the SSR middleware (functions/
                        _middleware.ts) already strips the /vi prefix and
                        falls through to renderSocialEvent, so bots see
                        the same prerendered VI HTML. Subroutes mirrored
                        for consistency with /vi/social/:slug/live which
                        shipped earlier. */}
                    {/* Legacy /su-kien — SPA-internal Navigate fallback */}
                    <Route path="/su-kien" element={<Navigate to="/social" replace />} />
                    <Route path="/vi/su-kien" element={<Navigate to="/vi/social" replace />} />
                    <Route path="/su-kien/:slug" element={<NavigateSuKienDetail />} />
                    <Route path="/su-kien/:slug/danh-sach" element={<NavigateSuKienDanhSach />} />
                    <Route path="/su-kien/:slug/xep-cap" element={<NavigateSuKienXepCap />} />
                    <Route path="/su-kien/:slug/live" element={<NavigateSuKienLive />} />
                    <Route path="/vi/su-kien/:slug/live" element={<NavigateSuKienLiveVi />} />
                    <Route path="/clb/:slug" element={<ClubLanding />} />
                    {/* Social Events MVP Sprint 1 PR3 — organizer surfaces (auth + ownership) */}
                    <Route path="/clb/:slug/quan-ly" element={<ClubManage />} />
                    {/* PR69 — Create event route renamed to match the
                        /social/* rebrand. Legacy /clb/:slug/su-kien/moi
                        still mounted as a Navigate alias so any cached
                        client bundle with the old path lands here. */}
                    <Route path="/clb/:slug/social/moi" element={<CreateSocialEvent />} />
                    <Route path="/clb/:slug/su-kien/moi" element={<NavigateClbCreateEvent />} />
                    {/* Social Events MVP PR53 — public profile + match history + badges */}
                    {/* PR79 Phase 2F (audit I-8) — consolidate to single
                        canonical profile route /nguoi-choi/:username.
                        The /u/:slug alias was a PR53 vanity-URL prototype
                        but never reached prerender parity. Both surfaces
                        now redirect (client-side + server 301) to the
                        canonical to retire the duplicate-content risk.
                        The slug value is forwarded verbatim — when it
                        was a real username the resolved page works;
                        when it was the old hex profile_slug it 404s
                        cleanly (hex slugs never had prerender + were
                        never in any sitemap). */}
                    <Route path="/u/:slug" element={<NavigateUSlug />} />
                    <Route path="/vi/u/:slug" element={<NavigateUSlugVi />} />
                    {/* Social Events MVP PR55 — self-service club discovery + creation */}
                    <Route path="/clubs/new" element={<CreateClub />} />
                    {/* Find players + in-app messaging (auth-gated, noindex) */}
                    {/* Social Events MVP PR57 — organizer club settings */}
                    <Route path="/clb/:slug/quan-ly/cai-dat" element={<EditClub />} />
                    {/* Social Events MVP PR58 — player-facing registration page + organizer event edit */}
                    {/* PR69 — Edit event route renamed to /social/. */}
                    <Route path="/clb/:slug/quan-ly/social/:event_slug/sua" element={<EditSocialEvent />} />
                    <Route path="/clb/:slug/quan-ly/su-kien/:event_slug/sua" element={<NavigateClbEditEvent />} />
                    {/* Social Events MVP PR59 — phone-keyed recovery page */}
                    {/* Sprint 5 PR-C — Vietnamese-friendly alias. Same
                        page renders for both /notifications and /thong-bao
                        so existing inbound links + bell deep-links keep
                        working while VN viewers get a localized URL. */}
                    {/* Canonical /news reads language from i18n context (geo-aware),
                        so VN visitors get VI like the rest of the site. /vi/news
                        below stays pinned to "vi". Article detail stays EN-pinned. */}
                    {/* Bet #1 Sprint 4 Phase 4A: Feed page */}
                    {/* Blog routes */}
                    {/* Forum routes */}
                    {/* Share redirect routes - for links shared on social media */}
                    <Route path="/share/live/:id" element={<ShareRedirect type="live" />} />
                    <Route path="/share/video/:id" element={<ShareRedirect type="video" />} />
                    {/* Tools routes */}
                    <Route path="/tools/quick-tables/referee/:matchId" element={<QuickTableRefereeScoring />} />
                    {/* Team Match routes */}
                    {/* Doubles Elimination routes */}
                    {/* Flex Tournament routes */}
                    {/* Dashboard routes */}
                    {/* Legacy Quick Tables redirects */}
                    <Route path="/quick-tables" element={<Navigate to="/tools/quick-tables" replace />} />
                    <Route path="/quick-tables/:shareId" element={<QuickTableRedirect />} />
                    <Route path="/quick-tables/:shareId/setup" element={<QuickTableSetupRedirect />} />
                    <Route path="/matches/:matchId/score" element={<LegacyMatchScoringRedirect />} />
                    <Route path="/join/:inviteCode" element={<JoinTeam />} />
                    {/* Embed routes - no layout, minimal UI */}
                    <Route path="/embed/live/:id" element={<EmbedLive />} />
                    <Route path="/embed/video/:id" element={<EmbedVideo />} />
                    {/* Admin routes */}
                    <Route path="/admin" element={<AdminOverview />} />
                    <Route path="/admin/organizations" element={<AdminOrganizations />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/tournaments" element={<AdminTournaments />} />
                    <Route path="/admin/api-keys" element={<AdminApiKeys />} />
                    <Route path="/admin/moderation" element={<AdminModeration />} />
                    <Route path="/admin/disputes" element={<AdminDisputes />} />
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/news" element={<AdminNews />} />
                    <Route path="/admin/embeds" element={<AdminEmbeds />} />
                    <Route path="/admin/viewers" element={<AdminLivestreamViewers />} />
                    <Route path="/admin/push" element={<AdminPushNotification />} />
                    <Route path="/admin/pro-tour" element={<ProTourAdmin />} />
                    <Route path="/admin/forum" element={<AdminForum />} />
                    <Route path="/admin/audit-log" element={<AdminAuditLog />} />
                    <Route path="/admin/vi-blog" element={<AdminViBlog />} />
                    <Route path="/admin/vi-blog/new" element={<AdminViBlogEditor />} />
                    <Route path="/admin/vi-blog/:id/edit" element={<AdminViBlogEditor />} />
                    <Route path="/admin/analytics" element={<AdminAnalytics />} />
                    {/* Creator routes */}
                    <Route path="/creator" element={<CreatorOverview />} />
                    <Route path="/creator/analytics" element={<CreatorAnalytics />} />
                    <Route path="/creator/videos" element={<CreatorVideos />} />
                    <Route path="/creator/videos/new" element={<CreatorVideoForm />} />
                    <Route path="/creator/videos/:id/edit" element={<CreatorVideoForm />} />
                    <Route path="/creator/livestreams" element={<CreatorLivestreams />} />
                    <Route path="/creator/livestreams/new" element={<CreatorLivestreamForm />} />
                    <Route path="/creator/livestreams/:id/edit" element={<CreatorLivestreamForm />} />
                    <Route path="/creator/settings" element={<CreatorSettings />} />
                    <Route path="/creator/tournaments" element={<CreatorTournaments />} />
                    {/* Public pages */}

                    {/* Vietnamese /vi/* routes — same components, ViLanguageWrapper sets lang */}

                    <Route path="/vi/*" element={<ViLanguageWrapper><NotFound /></ViLanguageWrapper>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </div>
              </ChunkErrorBoundary>
            </BrowserRouter>
           </ConfirmProvider>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
