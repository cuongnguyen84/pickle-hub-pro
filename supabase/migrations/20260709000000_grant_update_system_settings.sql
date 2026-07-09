-- Admin toggles on /admin (AdminOverview) could not be changed: PATCH to
-- system_settings returned 403 "permission denied for table" because the
-- `authenticated` role only had SELECT. The "Admins can update system settings"
-- RLS policy was dead without the underlying table grant.
-- RLS still restricts writes to admins; the grant just lets the policy run.
GRANT UPDATE ON public.system_settings TO authenticated;
