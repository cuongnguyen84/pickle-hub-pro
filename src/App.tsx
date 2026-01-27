import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { lazy, Suspense } from "react";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";

// Eagerly load the Index page for fast initial render
import Index from "./pages/Index";

import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
  console.log("[OAuth] appUrlOpen:", url);

  if (url.includes("/auth/callback")) {
    try {
      // Đóng Chrome / Custom Tab nếu còn
      await Browser.close();

      // Supabase tự xử lý session từ URL
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[OAuth] getSession error:", error.message);
      } else {
        console.log("[OAuth] Login success:", data.session);
      }
    } catch (err) {
      console.error("[OAuth] Callback handling failed:", err);
    }
  }
});

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

// Doubles Elimination pages
const DoublesEliminationList = lazy(() => import("./pages/DoublesEliminationList"));
const DoublesEliminationSetup = lazy(() => import("./pages/DoublesEliminationSetup"));
const DoublesEliminationView = lazy(() => import("./pages/DoublesEliminationView"));
const DoublesEliminationScoring = lazy(() => import("./pages/DoublesEliminationScoring"));

// Flex Tournament pages
const FlexTournamentList = lazy(() => import("./pages/FlexTournamentList"));
const FlexTournamentSetup = lazy(() => import("./pages/FlexTournamentSetup"));
const FlexTournamentView = lazy(() => import("./pages/FlexTournamentView"));

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

// Minimal loading fallback to avoid layout shift
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

// Component to initialize deep link handler
const DeepLinkInitializer = () => {
  useDeepLinkHandler();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <DeepLinkInitializer />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* Livestream routes - SEO primary */}
                <Route path="/livestream" element={<Live />} />
                <Route path="/livestream/:id" element={<WatchLive />} />
                {/* Legacy /live routes - redirect for backward compatibility */}
                <Route path="/live" element={<Live />} />
                <Route path="/live/:id" element={<WatchLive />} />
                <Route path="/videos" element={<Videos />} />
                <Route path="/watch/:id" element={<WatchVideo />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournament/:slug" element={<TournamentDetail />} />
                <Route path="/org/:slug" element={<OrganizationDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/account" element={<Account />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/search" element={<Search />} />
                <Route path="/news" element={<News />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
