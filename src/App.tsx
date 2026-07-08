import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider, useI18n } from "@/i18n";
import { lazy, Suspense, Component, ReactNode } from "react";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { usePageTracking } from "@/hooks/usePageTracking";
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
const MatchScoring = lazyRetry(() => import("./pages/MatchScoring"));
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
// Social Events MVP — PR53 (public profile + match history + badges)
// PR79 Phase 2F (audit I-8) — PublicProfile is deprecated. /u/:slug now
// redirects to the canonical /nguoi-choi/:username (handled by the
// NavigateUSlug alias below + a server 301 in functions/_middleware.ts).
// The component still exists for any in-flight links but is no longer
// mounted on a route. Delete file once we confirm no external /u/<hex>
// links are still flowing.
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

// Lazy load preview pages (design directions, feature-flagged, noindex)
const PreviewTheLine = lazyRetry(() => import("./pages/preview/TheLine"));
const PreviewLiveList = lazyRetry(() => import("./pages/preview/LiveList"));
const PreviewLiveWatch = lazyRetry(() => import("./pages/preview/LiveWatch"));
const PreviewTournamentsList = lazyRetry(() => import("./pages/preview/TournamentsList"));
const PreviewTournamentDetail = lazyRetry(() => import("./pages/preview/TournamentDetail"));
const PreviewBlogList = lazyRetry(() => import("./pages/preview/BlogList"));
const PreviewBlogPost = lazyRetry(() => import("./pages/preview/BlogPostPage"));
const PreviewWatchVideo = lazyRetry(() => import("./pages/preview/WatchVideo"));
const PreviewRankings = lazyRetry(() => import("./pages/preview/Rankings"));
const Rankings = lazyRetry(() => import("./pages/Rankings"));
const PreviewOrgDetail = lazyRetry(() => import("./pages/preview/OrganizationDetail"));
const PreviewSearch = lazyRetry(() => import("./pages/preview/Search"));
const PreviewBracketLab = lazyRetry(() => import("./pages/preview/BracketLab"));

// Lazy load redirect pages
const QuickTableRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.QuickTableRedirect })),
);
const QuickTableSetupRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.QuickTableSetupRedirect })),
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
prefetchHomeData(queryClient);

// Minimal route-transition fallback. Centered spinner on the page background
// — no header, no nav. PageLoader renders inside <I18nProvider> (the Suspense
// boundary that uses it lives at App.tsx line 366, well inside line 354's
// I18nProvider) so useI18n() is safe to call here without a localStorage
// fallback.
//
// a11y (Codex P2): role="status" + aria-live="polite" so screen readers
// announce the transition; sr-only label gives them a phrase to announce.
const PageLoader = () => {
  const { language } = useI18n();
  const label = language === "en" ? "Loading..." : "Đang tải...";
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="sr-only">{label}</span>
    </div>
  );
};

// Helper: detect a "chunk error" — covers both classic Vite/webpack chunk
// load failures AND the SPA-fallback signature (HTML served as JS → parser
// hits "<" first character).
const isChunkErrorMessage = (msg: string | undefined): boolean => {
  if (!msg) return false;
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("Unexpected token '<'") ||
    msg.includes("Unexpected token <")
  );
};

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
const DeepLinkInitializer = () => {
  useDeepLinkHandler();
  return null;
};

// Component to initialize push notifications
const PushNotificationInitializer = () => {
  usePushNotifications();
  return null;
};

// Mount the unified-notifications realtime subscription ONCE per page
// (Codex P2 follow-up on PR #27). AppHeader renders the bell twice
// (desktop md:block + mobile md:hidden side-by-side, CSS-toggled), so
// subscribing inside the bell duplicates Supabase channel subscriptions
// and runs invalidateQueries 2x per notification. Mounting here keeps
// it 1-per-session regardless of how many bell instances exist.
const NotificationsRealtimeInitializer = () => {
  useUnifiedNotificationsRealtime();
  return null;
};

// Component to track page views for GA4
const PageTracker = () => {
  usePageTracking();
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <DeepLinkInitializer />
              <PushNotificationInitializer />
              <NotificationsRealtimeInitializer />
              <PageTracker />
              
              <BottomNav />
              <ChatFAB />
              <ChunkErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    {/* Primary livestream routes */}
                    <Route path="/live" element={<Live />} />
                    <Route path="/live/:id" element={<WatchLive />} />
                    {/* Legacy /livestream routes - 301 redirect to /live */}
                    <Route path="/livestream" element={<Navigate to="/live" replace />} />
                    <Route path="/livestream/:id" element={<LivestreamRedirect />} />
                    <Route path="/videos" element={<Videos />} />
                    <Route path="/watch/:id" element={<WatchVideo />} />
                    <Route path="/tournaments" element={<Tournaments />} />
                    <Route path="/tournament/:slug" element={<ConditionalAuth><TournamentDetail /></ConditionalAuth>} />
                    <Route path="/org/:slug" element={<OrganizationDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/auth/reset-password" element={<ResetPassword />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/dupr" element={<RequireAuth><DuprConnect /></RequireAuth>} />
                    <Route path="/admin/dupr" element={<RequireAuth requiredRole="admin"><AdminDuprDashboard /></RequireAuth>} />
                    <Route path="/admin/errors" element={<RequireAuth requiredRole="admin"><AdminErrors /></RequireAuth>} />
                    <Route path="/match" element={<RequireAuth><MatchSubmitPage /></RequireAuth>} />
                    <Route path="/match/new" element={<RequireAuth><MatchNewPage /></RequireAuth>} />
                    <Route path="/match/confirm" element={<RequireAuth><MatchConfirm /></RequireAuth>} />
                    {/* Phase A: public invite-to-confirm landing (token = bearer; no auth wrapper) */}
                    <Route path="/match/confirm/:code" element={<MatchInviteConfirm />} />
                    <Route path="/account/my-tournaments" element={<RequireAuth><MyTournaments /></RequireAuth>} />
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
                    <Route path="/social" element={<SocialEventList />} />
                    <Route path="/vi/social" element={<ViLanguageWrapper><SocialEventList /></ViLanguageWrapper>} />
                    <Route path="/social/:slug" element={<SocialEventDetail />} />
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
                    <Route path="/vi/social/:slug" element={<ViLanguageWrapper><SocialEventDetail /></ViLanguageWrapper>} />
                    <Route path="/social/:slug/danh-sach" element={<SocialEventRoster />} />
                    <Route path="/vi/social/:slug/danh-sach" element={<ViLanguageWrapper><SocialEventRoster /></ViLanguageWrapper>} />
                    <Route path="/social/:slug/xep-cap" element={<SocialEventMatchmaking />} />
                    <Route path="/vi/social/:slug/xep-cap" element={<ViLanguageWrapper><SocialEventMatchmaking /></ViLanguageWrapper>} />
                    <Route path="/social/:slug/live" element={<SocialEventLive />} />
                    <Route path="/vi/social/:slug/live" element={<SocialEventLive />} />
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
                    <Route path="/clubs" element={<ClubsList />} />
                    <Route path="/vi/clubs" element={<ViLanguageWrapper><ClubsList /></ViLanguageWrapper>} />
                    <Route path="/clubs/new" element={<CreateClub />} />
                    <Route path="/san" element={<VenuesList />} />
                    <Route path="/vi/san" element={<ViLanguageWrapper><VenuesList /></ViLanguageWrapper>} />
                    <Route path="/san/them" element={<VenueSubmit />} />
                    <Route path="/vi/san/them" element={<ViLanguageWrapper><VenueSubmit /></ViLanguageWrapper>} />
                    <Route path="/san/khu-vuc/:city" element={<VenuesCity />} />
                    <Route path="/vi/san/khu-vuc/:city" element={<ViLanguageWrapper><VenuesCity /></ViLanguageWrapper>} />
                    {/* Find players + in-app messaging (auth-gated, noindex) */}
                    <Route path="/tim-ban-choi" element={<FindPlayers />} />
                    <Route path="/vi/tim-ban-choi" element={<ViLanguageWrapper><FindPlayers /></ViLanguageWrapper>} />
                    <Route path="/tin-nhan" element={<Messages />} />
                    <Route path="/vi/tin-nhan" element={<ViLanguageWrapper><Messages /></ViLanguageWrapper>} />
                    <Route path="/san/:slug" element={<VenueDetail />} />
                    <Route path="/vi/san/:slug" element={<ViLanguageWrapper><VenueDetail /></ViLanguageWrapper>} />
                    {/* Social Events MVP PR57 — organizer club settings */}
                    <Route path="/clb/:slug/quan-ly/cai-dat" element={<EditClub />} />
                    {/* Social Events MVP PR58 — player-facing registration page + organizer event edit */}
                    <Route path="/dang-ky/:magic_token" element={<PlayerRegistration />} />
                    <Route path="/vi/dang-ky/:magic_token" element={<ViLanguageWrapper><PlayerRegistration /></ViLanguageWrapper>} />
                    {/* PR69 — Edit event route renamed to /social/. */}
                    <Route path="/clb/:slug/quan-ly/social/:event_slug/sua" element={<EditSocialEvent />} />
                    <Route path="/clb/:slug/quan-ly/su-kien/:event_slug/sua" element={<NavigateClbEditEvent />} />
                    {/* Social Events MVP PR59 — phone-keyed recovery page */}
                    <Route path="/khoi-phuc-dang-ky" element={<RecoveryRegistration />} />
                    <Route path="/vi/khoi-phuc-dang-ky" element={<ViLanguageWrapper><RecoveryRegistration /></ViLanguageWrapper>} />
                    <Route path="/notifications" element={<Notifications />} />
                    {/* Sprint 5 PR-C — Vietnamese-friendly alias. Same
                        page renders for both /notifications and /thong-bao
                        so existing inbound links + bell deep-links keep
                        working while VN viewers get a localized URL. */}
                    <Route path="/thong-bao" element={<Notifications />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/news" element={<News language="en" />} />
                    <Route path="/news/:slug" element={<NewsArticle language="en" />} />
                    <Route path="/rankings" element={<Rankings />} />
                    <Route path="/vi/rankings" element={<Rankings />} />
                    {/* Bet #1 Sprint 4 Phase 4A: Feed page */}
                    <Route path="/feed" element={<Feed />} />
                    <Route path="/vi/feed" element={<Feed />} />
                    {/* Blog routes */}
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    {/* Forum routes */}
                    <Route path="/forum" element={<Forum />} />
                    <Route path="/forum/:categorySlug" element={<ForumCategory />} />
                    <Route path="/forum/post/:postId" element={<ForumPostDetail />} />
                    <Route path="/forum/new" element={<ForumPostCreate />} />
                    {/* Share redirect routes - for links shared on social media */}
                    <Route path="/share/live/:id" element={<ShareRedirect type="live" />} />
                    <Route path="/share/video/:id" element={<ShareRedirect type="video" />} />
                    {/* Tools routes */}
                    <Route path="/tools" element={<Tools />} />
                    <Route path="/tools/quick-tables" element={<QuickTables />} />
                    <Route path="/tools/quick-tables/parent/:shareId" element={<ParentTournamentPage />} />
                    <Route path="/tools/quick-tables/:shareId" element={<ConditionalAuth><QuickTableView /></ConditionalAuth>} />
                    <Route path="/tools/quick-tables/:shareId/setup" element={<QuickTableSetup />} />
                    <Route path="/tools/quick-tables/referee/:matchId" element={<QuickTableRefereeScoring />} />
                    {/* Team Match routes */}
                    <Route path="/tools/team-match" element={<TeamMatchList />} />
                    <Route path="/tools/team-match/new" element={<TeamMatchSetup />} />
                    <Route path="/tools/team-match/match/:matchId/score" element={<TeamMatchScoring />} />
                    <Route path="/tools/team-match/:id" element={<ConditionalAuth><TeamMatchView /></ConditionalAuth>} />
                    {/* Doubles Elimination routes */}
                    <Route path="/tools/doubles-elimination" element={<DoublesEliminationList />} />
                    <Route path="/tools/doubles-elimination/new" element={<DoublesEliminationSetup />} />
                    <Route path="/tools/doubles-elimination/:shareId" element={<ConditionalAuth><DoublesEliminationView /></ConditionalAuth>} />
                    <Route path="/tools/doubles-elimination/match/:matchId/score" element={<DoublesEliminationScoring />} />
                    {/* Flex Tournament routes */}
                    <Route path="/tools/flex-tournament" element={<FlexTournamentList />} />
                    <Route path="/tools/flex-tournament/new" element={<FlexTournamentSetup />} />
                    <Route path="/tools/flex-tournament/:shareId" element={<ConditionalAuth><FlexTournamentView /></ConditionalAuth>} />
                    {/* Dashboard routes */}
                    <Route path="/tools/dashboard" element={<DashboardPicker />} />
                    <Route path="/tools/dashboard/:type/:id" element={<TournamentDashboard />} />
                    {/* Legacy Quick Tables redirects */}
                    <Route path="/quick-tables" element={<Navigate to="/tools/quick-tables" replace />} />
                    <Route path="/quick-tables/:shareId" element={<QuickTableRedirect />} />
                    <Route path="/quick-tables/:shareId/setup" element={<QuickTableSetupRedirect />} />
                    <Route path="/matches/:matchId/score" element={<MatchScoring />} />
                    <Route path="/join/:inviteCode" element={<JoinTeam />} />
                    {/* Embed routes - no layout, minimal UI */}
                    <Route path="/embed/live/:id" element={<EmbedLive />} />
                    <Route path="/embed/video/:id" element={<EmbedVideo />} />
                    {/* Preview routes - design direction exploration, noindex */}
                    <Route path="/preview/the-line" element={<PreviewTheLine />} />
                    <Route path="/preview/the-line/live" element={<PreviewLiveList />} />
                    <Route path="/preview/the-line/live/:id" element={<PreviewLiveWatch />} />
                    <Route path="/preview/the-line/tournaments" element={<PreviewTournamentsList />} />
                    <Route path="/preview/the-line/tournament/:slug" element={<PreviewTournamentDetail />} />
                    <Route path="/preview/the-line/blog" element={<PreviewBlogList />} />
                    <Route path="/preview/the-line/blog/:slug" element={<PreviewBlogPost />} />
                    <Route path="/preview/the-line/watch/:id" element={<PreviewWatchVideo />} />
                    <Route path="/preview/the-line/rankings" element={<PreviewRankings />} />
                    <Route path="/preview/the-line/org/:slug" element={<PreviewOrgDetail />} />
                    <Route path="/preview/the-line/search" element={<PreviewSearch />} />
                    <Route path="/preview/the-line/tools" element={<PreviewBracketLab />} />
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
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/advertise" element={<Advertise />} />
                    <Route path="/affiliate-disclosure" element={<AffiliateDisclosurePage />} />

                    {/* Vietnamese /vi/* routes — same components, ViLanguageWrapper sets lang */}
                    <Route path="/vi" element={<ViLanguageWrapper><Index /></ViLanguageWrapper>} />
                    <Route path="/vi/live" element={<ViLanguageWrapper><Live /></ViLanguageWrapper>} />
                    <Route path="/vi/live/:id" element={<ViLanguageWrapper><WatchLive /></ViLanguageWrapper>} />
                    <Route path="/vi/videos" element={<ViLanguageWrapper><Videos /></ViLanguageWrapper>} />
                    <Route path="/vi/watch/:id" element={<ViLanguageWrapper><WatchVideo /></ViLanguageWrapper>} />
                    <Route path="/vi/tournaments" element={<ViLanguageWrapper><Tournaments /></ViLanguageWrapper>} />
                    <Route path="/vi/tournament/:slug" element={<ViLanguageWrapper><ConditionalAuth><TournamentDetail /></ConditionalAuth></ViLanguageWrapper>} />
                    <Route path="/vi/org/:slug" element={<ViLanguageWrapper><OrganizationDetail /></ViLanguageWrapper>} />
                    <Route path="/vi/news" element={<ViLanguageWrapper><News language="vi" /></ViLanguageWrapper>} />
                    <Route path="/vi/news/:slug" element={<ViLanguageWrapper><NewsArticle language="vi" /></ViLanguageWrapper>} />
                    <Route path="/vi/blog" element={<ViLanguageWrapper><Blog /></ViLanguageWrapper>} />
                    <Route path="/vi/blog/:slug" element={<ViLanguageWrapper><ViBlogPost /></ViLanguageWrapper>} />
                    <Route path="/vi/forum" element={<ViLanguageWrapper><Forum /></ViLanguageWrapper>} />
                    <Route path="/vi/forum/:categorySlug" element={<ViLanguageWrapper><ForumCategory /></ViLanguageWrapper>} />
                    <Route path="/vi/forum/post/:postId" element={<ViLanguageWrapper><ForumPostDetail /></ViLanguageWrapper>} />
                    <Route path="/vi/forum/new" element={<ViLanguageWrapper><ForumPostCreate /></ViLanguageWrapper>} />
                    <Route path="/vi/tools" element={<ViLanguageWrapper><Tools /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/quick-tables" element={<ViLanguageWrapper><QuickTables /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/quick-tables/parent/:shareId" element={<ViLanguageWrapper><ParentTournamentPage /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/quick-tables/:shareId" element={<ViLanguageWrapper><ConditionalAuth><QuickTableView /></ConditionalAuth></ViLanguageWrapper>} />
                    <Route path="/vi/tools/quick-tables/:shareId/setup" element={<ViLanguageWrapper><QuickTableSetup /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/team-match" element={<ViLanguageWrapper><TeamMatchList /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/team-match/new" element={<ViLanguageWrapper><TeamMatchSetup /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/team-match/match/:matchId/score" element={<ViLanguageWrapper><TeamMatchScoring /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/team-match/:id" element={<ViLanguageWrapper><ConditionalAuth><TeamMatchView /></ConditionalAuth></ViLanguageWrapper>} />
                    <Route path="/vi/tools/doubles-elimination" element={<ViLanguageWrapper><DoublesEliminationList /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/doubles-elimination/new" element={<ViLanguageWrapper><DoublesEliminationSetup /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/doubles-elimination/:shareId" element={<ViLanguageWrapper><ConditionalAuth><DoublesEliminationView /></ConditionalAuth></ViLanguageWrapper>} />
                    <Route path="/vi/tools/doubles-elimination/match/:matchId/score" element={<ViLanguageWrapper><DoublesEliminationScoring /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/flex-tournament" element={<ViLanguageWrapper><FlexTournamentList /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/flex-tournament/new" element={<ViLanguageWrapper><FlexTournamentSetup /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/flex-tournament/:shareId" element={<ViLanguageWrapper><ConditionalAuth><FlexTournamentView /></ConditionalAuth></ViLanguageWrapper>} />
                    <Route path="/vi/tools/dashboard" element={<ViLanguageWrapper><DashboardPicker /></ViLanguageWrapper>} />
                    <Route path="/vi/tools/dashboard/:type/:id" element={<ViLanguageWrapper><TournamentDashboard /></ViLanguageWrapper>} />
                    <Route path="/vi/search" element={<ViLanguageWrapper><Search /></ViLanguageWrapper>} />
                    <Route path="/vi/privacy" element={<ViLanguageWrapper><Privacy /></ViLanguageWrapper>} />
                    <Route path="/vi/terms" element={<ViLanguageWrapper><Terms /></ViLanguageWrapper>} />
                    <Route path="/vi/advertise" element={<ViLanguageWrapper><Advertise /></ViLanguageWrapper>} />
                    <Route path="/vi/affiliate-disclosure" element={<ViLanguageWrapper><AffiliateDisclosurePage /></ViLanguageWrapper>} />
                    <Route path="/vi/login" element={<ViLanguageWrapper><Login /></ViLanguageWrapper>} />
                    <Route path="/vi/account" element={<ViLanguageWrapper><Account /></ViLanguageWrapper>} />
                    <Route path="/vi/account/my-tournaments" element={<ViLanguageWrapper><RequireAuth><MyTournaments /></RequireAuth></ViLanguageWrapper>} />
                    <Route path="/vi/notifications" element={<ViLanguageWrapper><Notifications /></ViLanguageWrapper>} />
                    <Route path="/vi/thong-bao" element={<ViLanguageWrapper><Notifications /></ViLanguageWrapper>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ChunkErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
