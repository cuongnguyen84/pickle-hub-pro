
CREATE OR REPLACE FUNCTION public.audit_livestream_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(
      'STREAM_CREATED', 'stream', 'livestream', NEW.id::text, 'info',
      jsonb_build_object('title', NEW.title, 'organization_id', NEW.organization_id, 'status', NEW.status),
      CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'live' THEN
        PERFORM public.log_audit_event(
          'STREAM_STARTED', 'stream', 'livestream', NEW.id::text, 'info',
          jsonb_build_object('title', NEW.title, 'old_status', OLD.status),
          CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'webhook' END
        );
      ELSIF NEW.status = 'ended' THEN
        PERFORM public.log_audit_event(
          'STREAM_STOPPED', 'stream', 'livestream', NEW.id::text, 'info',
          jsonb_build_object('title', NEW.title, 'old_status', OLD.status),
          CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'webhook' END
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
