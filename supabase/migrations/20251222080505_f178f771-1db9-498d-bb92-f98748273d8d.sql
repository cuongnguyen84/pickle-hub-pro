-- Create follow_target_type enum
CREATE TYPE public.follow_target_type AS ENUM ('organization', 'tournament');

-- Create follows table
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.follow_target_type NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Create notification_type enum
CREATE TYPE public.notification_type AS ENUM ('livestream_scheduled', 'livestream_live');

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  entity_type public.follow_target_type NOT NULL,
  entity_id UUID NOT NULL,
  related_id UUID, -- e.g. livestream_id
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for follows
CREATE POLICY "Users can view their own follows"
ON public.follows FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own follows"
ON public.follows FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own follows"
ON public.follows FOR DELETE
USING (user_id = auth.uid());

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- Service role can insert notifications (for triggers/functions)
CREATE POLICY "Service can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_follows_user_id ON public.follows(user_id);
CREATE INDEX idx_follows_target ON public.follows(target_type, target_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Function to create notifications for followers when livestream is created/goes live
CREATE OR REPLACE FUNCTION public.notify_followers_on_livestream()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_name TEXT;
  tournament_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  notification_type public.notification_type;
  follower RECORD;
BEGIN
  -- Determine notification type based on status change
  IF TG_OP = 'INSERT' AND NEW.status = 'scheduled' THEN
    notification_type := 'livestream_scheduled';
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'live' AND NEW.status = 'live' THEN
    notification_type := 'livestream_live';
  ELSE
    RETURN NEW;
  END IF;

  -- Get organization name
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;

  -- Notify organization followers
  FOR follower IN 
    SELECT user_id FROM public.follows 
    WHERE target_type = 'organization' AND target_id = NEW.organization_id
  LOOP
    IF notification_type = 'livestream_scheduled' THEN
      notification_title := org_name || ' đã lên lịch livestream mới';
      notification_message := NEW.title;
    ELSE
      notification_title := org_name || ' đang phát trực tiếp!';
      notification_message := NEW.title;
    END IF;

    INSERT INTO public.notifications (user_id, type, entity_type, entity_id, related_id, title, message)
    VALUES (follower.user_id, notification_type, 'organization', NEW.organization_id, NEW.id, notification_title, notification_message);
  END LOOP;

  -- Notify tournament followers if livestream is linked to a tournament
  IF NEW.tournament_id IS NOT NULL THEN
    SELECT name INTO tournament_name FROM public.tournaments WHERE id = NEW.tournament_id;
    
    FOR follower IN 
      SELECT user_id FROM public.follows 
      WHERE target_type = 'tournament' AND target_id = NEW.tournament_id
    LOOP
      IF notification_type = 'livestream_scheduled' THEN
        notification_title := 'Giải ' || tournament_name || ' có livestream mới';
        notification_message := NEW.title;
      ELSE
        notification_title := 'Giải ' || tournament_name || ' đang phát trực tiếp!';
        notification_message := NEW.title;
      END IF;

      INSERT INTO public.notifications (user_id, type, entity_type, entity_id, related_id, title, message)
      VALUES (follower.user_id, notification_type, 'tournament', NEW.tournament_id, NEW.id, notification_title, notification_message);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for livestream notifications
CREATE TRIGGER on_livestream_notify_followers
AFTER INSERT OR UPDATE ON public.livestreams
FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_on_livestream();