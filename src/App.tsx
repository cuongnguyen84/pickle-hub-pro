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
import Login from "./pages/Login";
import WatchVideo from "./pages/WatchVideo";
import WatchLive from "./pages/WatchLive";
import NotFound from "./pages/NotFound";
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
              <Route path="/login" element={<Login />} />
              {/* Admin routes */}
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/organizations" element={<AdminOrganizations />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/tournaments" element={<AdminTournaments />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
              {/* Creator routes */}
              <Route path="/creator" element={<CreatorOverview />} />
              <Route path="/creator/videos" element={<CreatorVideos />} />
              <Route path="/creator/videos/new" element={<CreatorVideoForm />} />
              <Route path="/creator/videos/:id/edit" element={<CreatorVideoForm />} />
              <Route path="/creator/livestreams" element={<CreatorLivestreams />} />
              <Route path="/creator/livestreams/new" element={<CreatorLivestreamForm />} />
              <Route path="/creator/livestreams/:id/edit" element={<CreatorLivestreamForm />} />
              <Route path="/creator/settings" element={<CreatorSettings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
