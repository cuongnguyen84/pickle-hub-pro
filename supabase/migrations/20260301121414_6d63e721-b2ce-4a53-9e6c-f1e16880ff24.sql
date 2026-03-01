
-- Trigger for quick_tables
CREATE OR REPLACE FUNCTION public.audit_quick_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_CREATED', 'tournament', 'tournament', NEW.id::text, 'info',
      jsonb_build_object('name', NEW.name, 'format', NEW.format, 'type', 'quick_table')
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_DELETED', 'tournament', 'tournament', OLD.id::text, 'warning',
      jsonb_build_object('name', OLD.name, 'type', 'quick_table')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_quick_table_changes
  AFTER INSERT OR DELETE ON public.quick_tables
  FOR EACH ROW EXECUTE FUNCTION public.audit_quick_table_changes();

-- Trigger for doubles_elimination_tournaments
CREATE OR REPLACE FUNCTION public.audit_doubles_tournament_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_CREATED', 'tournament', 'tournament', NEW.id::text, 'info',
      jsonb_build_object('name', NEW.name, 'team_count', NEW.team_count, 'type', 'doubles_elimination')
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_UPDATED', 'tournament', 'tournament', NEW.id::text, 'info',
      jsonb_build_object('name', NEW.name, 'old_status', OLD.status, 'new_status', NEW.status, 'type', 'doubles_elimination')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_doubles_tournament_changes
  AFTER INSERT OR UPDATE ON public.doubles_elimination_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.audit_doubles_tournament_changes();

-- Trigger for flex_tournaments
CREATE OR REPLACE FUNCTION public.audit_flex_tournament_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_CREATED', 'tournament', 'tournament', NEW.id::text, 'info',
      jsonb_build_object('name', NEW.name, 'type', 'flex')
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_UPDATED', 'tournament', 'tournament', NEW.id::text, 'info',
      jsonb_build_object('name', NEW.name, 'old_status', OLD.status, 'new_status', NEW.status, 'type', 'flex')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_flex_tournament_changes
  AFTER INSERT OR UPDATE ON public.flex_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.audit_flex_tournament_changes();

-- Trigger for team_match_tournaments
CREATE OR REPLACE FUNCTION public.audit_team_match_tournament_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, event_type, event_category, resource_type, resource_id, severity, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END,
      'TOURNAMENT_CREATED', 'tournament', 'tournament', NEW.id::text, 'info',
      jsonb_build_object('name', NEW.name, 'type', 'team_match')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_team_match_tournament_changes
  AFTER INSERT ON public.team_match_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.audit_team_match_tournament_changes();
