import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { lazy, Suspense, Component, ReactNode } from "react";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { usePageTracking } from "@/hooks/usePageTracking";
import BottomNav from "@/components/layout/BottomNav";
import AppHeader from "@/components/layout/AppHeader";

import { ViLanguageWrapper } from "@/components/layout/ViLanguageWrapper";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { initializeGoogleAuth } from "@/hooks/useNativeGoogleAuth";

// Eagerly load the Index page for fast initial render
import Index from "./pages/Index";
import RequireAuth from "@/components/auth/RequireAuth";
import ConditionalAuth from "@/components/auth/ConditionalAuth";

// Initialize Native Google Auth plugin on app startup
initializeGoogleAuth();

// Lazy load all other pages for code splitting
const Live = lazy(() => import("./pages/Live"));
const Videos = lazy(() => import("./pages/Videos"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const WatchVideo = lazy(() => import("./pages/WatchVideo"));
const WatchLive = lazy(() => import("./pages/WatchLive"));
const Account = lazy(() => import("./pages/Account"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Search = lazy(() => import("./pages/Search"));
const OrganizationDetail = lazy(() => import("./pages/OrganizationDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Tools = lazy(() => import("./pages/Tools"));
const QuickTables = lazy(() => import("./pages/QuickTables"));
const QuickTableSetup = lazy(() => import("./pages/QuickTableSetup"));
const QuickTableView = lazy(() => import("./pages/QuickTableView"));
const ParentTournamentPage = lazy(() => import("./pages/ParentTournamentPage"));
const MatchScoring = lazy(() => import("./pages/MatchScoring"));
const JoinTeam = lazy(() => import("./pages/JoinTeam"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const TeamMatchList = lazy(() => import("./pages/TeamMatchList"));
const TeamMatchSetup = lazy(() => import("./pages/TeamMatchSetup"));
const TeamMatchView = lazy(() => import("./pages/TeamMatchView"));
const News = lazy(() => import("./pages/News"));
const ShareRedirect = lazy(() => import("./pages/ShareRedirect"));

// Doubles Elimination pages
const DoublesEliminationList = lazy(() => import("./pages/DoublesEliminationList"));
const DoublesEliminationSetup = lazy(() => import("./pages/DoublesEliminationSetup"));
const DoublesEliminationView = lazy(() => import("./pages/DoublesEliminationView"));
const DoublesEliminationScoring = lazy(() => import("./pages/DoublesEliminationScoring"));

// Flex Tournament pages
const FlexTournamentList = lazy(() => import("./pages/FlexTournamentList"));
const FlexTournamentSetup = lazy(() => import("./pages/FlexTournamentSetup"));
const FlexTournamentView = lazy(() => import("./pages/FlexTournamentView"));

// Blog pages
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const ViBlog = lazy(() => import("./pages/ViBlog"));
const ViBlogPost = lazy(() => import("./pages/ViBlogPost"));

// Forum pages
const Forum = lazy(() => import("./pages/Forum"));
const ForumCategory = lazy(() => import("./pages/ForumCategory"));
const ForumPostDetail = lazy(() => import("./pages/ForumPostDetail"));
const ForumPostCreate = lazy(() => import("./pages/ForumPostCreate"));
// Dashboard pages
const DashboardPicker = lazy(() => import("./pages/DashboardPicker"));
const TournamentDashboard = lazy(() => import("./pages/TournamentDashboard"));

// Lazy load embed pages
const EmbedLive = lazy(() => import("./pages/embed/EmbedLive"));
const EmbedVideo = lazy(() => import("./pages/embed/EmbedVideo"));

// Lazy load preview pages (design directions, feature-flagged, noindex)
const PreviewTheLine = lazy(() => import("./pages/preview/TheLine"));
const PreviewLiveList = lazy(() => import("./pages/preview/LiveList"));
const PreviewLiveWatch = lazy(() => import("./pages/preview/LiveWatch"));
const PreviewTournamentsList = lazy(() => import("./pages/preview/TournamentsList"));
const PreviewTournamentDetail = lazy(() => import("./pages/preview/TournamentDetail"));
const PreviewBlogList = lazy(() => import("./pages/preview/BlogList"));
const PreviewBlogPost = lazy(() => import("./pages/preview/BlogPostPage"));
const PreviewWatchVideo = lazy(() => import("./pages/preview/WatchVideo"));
const PreviewRankings = lazy(() => import("./pages/preview/Rankings"));
const PreviewOrgDetail = lazy(() => import("./pages/preview/OrganizationDetail"));
const PreviewSearch = lazy(() => import("./pages/preview/Search"));
const PreviewBracketLab = lazy(() => import("./pages/preview/BracketLab"));

// Lazy load redirect pages
const QuickTableRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.QuickTableRedirect })),
);
const QuickTableSetupRedirect = lazy(() =>
  import("./pages/redirects/QuickTableRedirects").then((m) => ({ default: m.QuickTableSetupRedirect })),
);

// Lazy load admin pages
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminOrganizations = lazy(() => import("./pages/admin/AdminOrganizations"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminTournaments = lazy(() => import("./pages/admin/AdminTournaments"));
const AdminApiKeys = lazy(() => import("./pages/admin/AdminApiKeys"));
const AdminModeration = lazy(() => import("./pages/admin/AdminModeration"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminLivestreamViewers = lazy(() => import("./pages/admin/AdminLivestreamViewers"));
const AdminPushNotification = lazy(() => import("./pages/admin/AdminPushNotification"));
const AdminForum = lazy(() => import("./pages/admin/AdminForum"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminViBlog = lazy(() => import("./pages/admin/AdminViBlog"));
const AdminViBlogEditor = lazy(() => import("./pages/admin/AdminViBlogEditor"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));

// Lazy load creator pages
const CreatorOverview = lazy(() => import("./pages/creator/CreatorOverview"));
const CreatorVideos = lazy(() => import("./pages/creator/CreatorVideos"));
const CreatorVideoForm = lazy(() => import("./pages/creator/CreatorVideoForm"));
const CreatorLivestreams = lazy(() => import("./pages/creator/CreatorLivestreams"));
const CreatorLivestreamForm = lazy(() => import("./pages/creator/CreatorLivestreamForm"));
const CreatorSettings = lazy(() => import("./pages/creator/CreatorSettings"));
const CreatorAnalytics = lazy(() => import("./pages/creator/CreatorAnalytics"));
const CreatorTournaments = lazy(() => import("./pages/creator/CreatorTournaments"));

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

// Minimal loading fallback that mirrors MainLayout shell to prevent layout shift
const PageLoader = () => (
  <div className="h-full bg-background flex flex-col w-full max-w-[100vw] overflow-hidden">
    <AppHeader />
    <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </main>
  </div>
);

// Error boundary for lazy-loaded chunks (handles stale cache after deploy)
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  // REVIEW: counter reset delayed (was in componentDidMount, fired before child's
  // lazy import attempt → defeated MAX_RELOADS cap → infinite reload loop on EN
  // blog posts 2026-04-27). Now reset only after 5s of error-free mount.
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  componentDidMount() {
    // Defer reset — if a child's lazy import fails on mount, componentDidCatch
    // fires before this timer and the counter is preserved so MAX_RELOADS holds.
    // Only reset when no chunk error has fired for 5s = stale cache resolved.
    this.resetTimer = setTimeout(() => {
      try { sessionStorage.removeItem("chunk-reload-count"); } catch {}
    }, 5000);
  }
  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    const isChunkError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Loading chunk") ||
      error.message.includes("ChunkLoadError");
    console.error("[ChunkErrorBoundary] Caught error:", error.message, error.stack);
    if (isChunkError) {
      // Safety: cap reloads so stale SW cache doesn't cause infinite reload loop.
      // Repro: SW caches old index.html → new chunk 404 → boundary reload → SW serves
      // same stale HTML → chunk 404 again → loop. Without this guard the admin dashboard
      // was unreachable on 2026-04-23 after a chunk-name change.
      const KEY = "chunk-reload-count";
      const MAX_RELOADS = 2;
      try {
        const count = Number(sessionStorage.getItem(KEY) || "0");
        if (count >= MAX_RELOADS) {
          sessionStorage.removeItem(KEY);
          // Let the error UI render instead of reloading again.
          return;
        }
        sessionStorage.setItem(KEY, String(count + 1));
      } catch {
        // sessionStorage may be disabled (private mode, quota) — fall through to reload once.
      }
      window.location.reload();
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error &&
        (this.state.error.message.includes("Failed to fetch dynamically imported module") ||
         this.state.error.message.includes("Loading chunk") ||
         this.state.error.message.includes("ChunkLoadError"));
      // For chunk errors, show loading (page will auto-reload via componentDidCatch)
      // For other errors, show retry button so users aren't stuck
      return (
        <div className="h-full bg-background flex flex-col w-full overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto flex items-center justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
            {isChunkError ? (
              <div className="text-muted-foreground">Đang tải lại...</div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="text-muted-foreground">Đã xảy ra lỗi</div>
                <div className="text-xs text-muted-foreground/60 max-w-md text-center break-all">
                  {this.state.error?.message}
                </div>
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
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
              <PageTracker />
              
              <BottomNav />
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
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/news" element={<News />} />
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
                    {/* Team Match routes */}
                    <Route path="/tools/team-match" element={<TeamMatchList />} />
                    <Route path="/tools/team-match/new" element={<TeamMatchSetup />} />
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
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/viewers" element={<AdminLivestreamViewers />} />
                    <Route path="/admin/push" element={<AdminPushNotification />} />
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

                    {/* Vietnamese /vi/* routes — same components, ViLanguageWrapper sets lang */}
                    <Route path="/vi" element={<ViLanguageWrapper><Index /></ViLanguageWrapper>} />
                    <Route path="/vi/live" element={<ViLanguageWrapper><Live /></ViLanguageWrapper>} />
                    <Route path="/vi/live/:id" element={<ViLanguageWrapper><WatchLive /></ViLanguageWrapper>} />
                    <Route path="/vi/videos" element={<ViLanguageWrapper><Videos /></ViLanguageWrapper>} />
                    <Route path="/vi/watch/:id" element={<ViLanguageWrapper><WatchVideo /></ViLanguageWrapper>} />
                    <Route path="/vi/tournaments" element={<ViLanguageWrapper><Tournaments /></ViLanguageWrapper>} />
                    <Route path="/vi/tournament/:slug" element={<ViLanguageWrapper><ConditionalAuth><TournamentDetail /></ConditionalAuth></ViLanguageWrapper>} />
                    <Route path="/vi/org/:slug" element={<ViLanguageWrapper><OrganizationDetail /></ViLanguageWrapper>} />
                    <Route path="/vi/news" element={<ViLanguageWrapper><News /></ViLanguageWrapper>} />
                    <Route path="/vi/blog" element={<ViLanguageWrapper><ViBlog /></ViLanguageWrapper>} />
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
                    <Route path="/vi/login" element={<ViLanguageWrapper><Login /></ViLanguageWrapper>} />
                    <Route path="/vi/account" element={<ViLanguageWrapper><Account /></ViLanguageWrapper>} />
                    <Route path="/vi/notifications" element={<ViLanguageWrapper><Notifications /></ViLanguageWrapper>} />

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
