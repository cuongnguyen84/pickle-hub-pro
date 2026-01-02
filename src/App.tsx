import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import Index from "./pages/Index";
import Live from "./pages/Live";
import Videos from "./pages/Videos";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import WatchVideo from "./pages/WatchVideo";
import WatchLive from "./pages/WatchLive";
import Account from "./pages/Account";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import OrganizationDetail from "./pages/OrganizationDetail";
import NotFound from "./pages/NotFound";
import QuickTables from "./pages/QuickTables";
import QuickTableSetup from "./pages/QuickTableSetup";
import QuickTableView from "./pages/QuickTableView";
import MatchScoring from "./pages/MatchScoring";
import JoinTeam from "./pages/JoinTeam";
import Privacy from "./pages/Privacy";
import { EmbedLive, EmbedVideo } from "./pages/embed";
import {
  AdminOverview,
  AdminOrganizations,
  AdminUsers,
  AdminTournaments,
  AdminModeration,
} from "./pages/admin";
import {
  CreatorOverview,
  CreatorVideos,
  CreatorVideoForm,
  CreatorLivestreams,
  CreatorLivestreamForm,
  CreatorSettings,
  CreatorAnalytics,
} from "./pages/creator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
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
              {/* Quick Tables routes */}
              <Route path="/quick-tables" element={<QuickTables />} />
              <Route path="/quick-tables/:shareId" element={<QuickTableView />} />
              <Route path="/quick-tables/:shareId/setup" element={<QuickTableSetup />} />
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
              {/* Public pages */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
