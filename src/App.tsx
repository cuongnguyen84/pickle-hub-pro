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
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { initializeGoogleAuth } from "@/hooks/useNativeGoogleAuth";

// Eagerly load the Index page for fast initial render
import Index from "./pages/Index";
import RequireAuth from "@/components/auth/RequireAuth";

// Initialize Native Google Auth plugin on app startup
initializeGoogleAuth();

// Lazy load all other pages for code splitting
const Live = lazy(() => import("./pages/Live"));
const Videos = lazy(() => import("./pages/Videos"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
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

// Lazy load creator pages
const CreatorOverview = lazy(() => import("./pages/creator/CreatorOverview"));
const CreatorVideos = lazy(() => import("./pages/creator/CreatorVideos"));
const CreatorVideoForm = lazy(() => import("./pages/creator/CreatorVideoForm"));
const CreatorLivestreams = lazy(() => import("./pages/creator/CreatorLivestreams"));
const CreatorLivestreamForm = lazy(() => import("./pages/creator/CreatorLivestreamForm"));
const CreatorSettings = lazy(() => import("./pages/creator/CreatorSettings"));
const CreatorAnalytics = lazy(() => import("./pages/creator/CreatorAnalytics"));
const CreatorTournaments = lazy(() => import("./pages/creator/CreatorTournaments"));

const queryClient = new QueryClient();

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
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    // If it's a chunk load error, reload the page to get fresh chunks
    if (
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Loading chunk") ||
      error.message.includes("ChunkLoadError")
    ) {
      window.location.reload();
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full bg-background flex flex-col w-full overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto flex items-center justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="text-muted-foreground">Đang tải lại...</div>
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
                    <Route path="/tournament/:slug" element={<RequireAuth><TournamentDetail /></RequireAuth>} />
                    <Route path="/org/:slug" element={<OrganizationDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
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
                    <Route path="/tools/quick-tables/:shareId" element={<QuickTableView />} />
                    <Route path="/tools/quick-tables/:shareId/setup" element={<QuickTableSetup />} />
                    {/* Team Match routes */}
                    <Route path="/tools/team-match" element={<TeamMatchList />} />
                    <Route path="/tools/team-match/new" element={<TeamMatchSetup />} />
                    <Route path="/tools/team-match/:id" element={<TeamMatchView />} />
                    {/* Doubles Elimination routes */}
                    <Route path="/tools/doubles-elimination" element={<DoublesEliminationList />} />
                    <Route path="/tools/doubles-elimination/new" element={<DoublesEliminationSetup />} />
                    <Route path="/tools/doubles-elimination/:shareId" element={<DoublesEliminationView />} />
                    <Route path="/tools/doubles-elimination/match/:matchId/score" element={<DoublesEliminationScoring />} />
                    {/* Flex Tournament routes */}
                    <Route path="/tools/flex-tournament" element={<FlexTournamentList />} />
                    <Route path="/tools/flex-tournament/new" element={<FlexTournamentSetup />} />
                    <Route path="/tools/flex-tournament/:shareId" element={<FlexTournamentView />} />
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
