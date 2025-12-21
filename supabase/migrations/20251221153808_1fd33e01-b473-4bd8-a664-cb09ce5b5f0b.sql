-- Create enums for type safety
CREATE TYPE public.app_role AS ENUM ('viewer', 'creator', 'admin');
CREATE TYPE public.video_type AS ENUM ('short', 'long');
CREATE TYPE public.content_status AS ENUM ('draft', 'published', 'hidden');
CREATE TYPE public.livestream_status AS ENUM ('scheduled', 'live', 'ended');
CREATE TYPE public.tournament_status AS ENUM ('upcoming', 'ongoing', 'ended');
CREATE TYPE public.target_type AS ENUM ('video', 'livestream');

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  status public.tournament_status NOT NULL DEFAULT 'upcoming',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type public.video_type NOT NULL DEFAULT 'long',
  title TEXT NOT NULL,
  description TEXT,
  mux_asset_id TEXT,
  mux_playback_id TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  status public.content_status NOT NULL DEFAULT 'draft',
  tags TEXT[] DEFAULT '{}',
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Livestreams table
CREATE TABLE public.livestreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mux_live_stream_id TEXT,
  mux_playback_id TEXT,
  mux_stream_key TEXT, -- SENSITIVE: Only accessible to creator/admin
  status public.livestream_status NOT NULL DEFAULT 'scheduled',
  scheduled_start_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Likes table
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.target_type NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.target_type NOT NULL,
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- View events table
CREATE TABLE public.view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.target_type NOT NULL,
  target_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_published_at ON public.videos(published_at DESC);
CREATE INDEX idx_videos_organization ON public.videos(organization_id);
CREATE INDEX idx_livestreams_status ON public.livestreams(status);
CREATE INDEX idx_livestreams_organization ON public.livestreams(organization_id);
CREATE INDEX idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX idx_comments_target ON public.comments(target_type, target_id);
CREATE INDEX idx_view_events_target ON public.view_events(target_type, target_id);
CREATE INDEX idx_view_events_created ON public.view_events(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_events ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Helper function to check if current user is creator
CREATE OR REPLACE FUNCTION public.is_creator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'creator'
  )
$$;

-- Helper to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  
  -- Insert default viewer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Organizations: Public read, admin write
CREATE POLICY "Organizations are publicly viewable"
  ON public.organizations FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Profiles: Users can view their own, admins can view all
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles are created via trigger"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- User roles: Only admins can manage
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tournaments: Public read, admin write
CREATE POLICY "Tournaments are publicly viewable"
  ON public.tournaments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tournaments"
  ON public.tournaments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Videos: Published are public, creators can manage their org's videos
CREATE POLICY "Published videos are publicly viewable"
  ON public.videos FOR SELECT
  USING (status = 'published' OR public.is_admin());

CREATE POLICY "Creators can view their org videos"
  ON public.videos FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Creators can insert videos for their org"
  ON public.videos FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Creators can update their org videos"
  ON public.videos FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Creators can delete their org videos"
  ON public.videos FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Admins can manage all videos"
  ON public.videos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Livestreams: Public fields viewable (excluding stream_key), creators manage their org
CREATE POLICY "Public livestream info is viewable"
  ON public.livestreams FOR SELECT
  USING (true);

CREATE POLICY "Creators can insert livestreams for their org"
  ON public.livestreams FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Creators can update their org livestreams"
  ON public.livestreams FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Creators can delete their org livestreams"
  ON public.livestreams FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Admins can manage all livestreams"
  ON public.livestreams FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Likes: Authenticated users can like published content
CREATE POLICY "Likes are publicly viewable"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert likes"
  ON public.likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own likes"
  ON public.likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Comments: Authenticated users can comment on published content
CREATE POLICY "Comments are publicly viewable"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- View events: Anyone can insert, admins/creators can read
CREATE POLICY "Anyone can insert view events"
  ON public.view_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Creators can view their org's view events"
  ON public.view_events FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (public.is_creator() OR public.is_admin())
  );

CREATE POLICY "Admins can view all view events"
  ON public.view_events FOR SELECT
  TO authenticated
  USING (public.is_admin());