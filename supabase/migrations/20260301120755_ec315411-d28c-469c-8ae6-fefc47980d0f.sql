
-- 1. Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'webhook')),
  event_type text NOT NULL,
  event_category text NOT NULL CHECK (event_category IN ('auth', 'stream', 'tournament', 'admin')),
  resource_type text CHECK (resource_type IN ('stream', 'tournament', 'match', 'user', 'organization', 'video', 'api_key')),
  resource_id text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Indexes
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_event_category ON public.audit_logs (event_category);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs (event_type);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);

-- 3. RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No direct INSERT/UPDATE/DELETE policies — all writes via SECURITY DEFINER function

-- 4. SECURITY DEFINER function for logging
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _event_type text,
  _event_category text,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _severity text DEFAULT 'info',
  _metadata jsonb DEFAULT '{}'::jsonb,
  _actor_type text DEFAULT 'user'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, actor_type, event_type, event_category,
    resource_type, resource_id, severity, metadata
  ) VALUES (
    auth.uid(), _actor_type, _event_type, _event_category,
    _resource_type, _resource_id, _severity, _metadata
  )
  RETURNING id INTO _new_id;
  
  RETURN _new_id;
END;
$$;

-- 5. Trigger function for livestreams
CREATE OR REPLACE FUNCTION public.audit_livestream_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(
      'STREAM_CREATED', 'stream', 'stream', NEW.id::text, 'info',
      jsonb_build_object('title', NEW.title, 'organization_id', NEW.organization_id, 'status', NEW.status),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'live' THEN
        PERFORM public.log_audit_event(
          'STREAM_STARTED', 'stream', 'stream', NEW.id::text, 'info',
          jsonb_build_object('title', NEW.title, 'old_status', OLD.status),
          CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'webhook' END
        );
      ELSIF NEW.status = 'ended' THEN
        PERFORM public.log_audit_event(
          'STREAM_STOPPED', 'stream', 'stream', NEW.id::text, 'info',
          jsonb_build_object('title', NEW.title, 'old_status', OLD.status),
          CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'webhook' END
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_livestream_changes
  AFTER INSERT OR UPDATE ON public.livestreams
  FOR EACH ROW EXECUTE FUNCTION public.audit_livestream_changes();

-- 6. Trigger function for user_roles
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(
      'ROLE_CHANGED', 'admin', 'user', NEW.user_id::text, 'warning',
      jsonb_build_object('action', 'granted', 'role', NEW.role),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(
      'ROLE_CHANGED', 'admin', 'user', OLD.user_id::text, 'warning',
      jsonb_build_object('action', 'revoked', 'role', OLD.role),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_role_changes
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();
