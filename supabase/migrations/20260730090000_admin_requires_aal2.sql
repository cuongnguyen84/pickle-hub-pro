-- ADMIN-MFA: quyền admin yêu cầu phiên aal2 (đã qua 2FA/TOTP) MỘT KHI user
-- đã enroll factor verified. Trước khi enroll: hành vi không đổi
-- (self-activating — không lock-out admin trước khi kịp đăng ký 2FA).
-- Gate UI tương ứng: src/components/admin/AdminMFAGate.tsx

CREATE OR REPLACE FUNCTION public.admin_session_aal_ok()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2'
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid()
        AND status = 'verified'
    )
$$;

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
  ) AND public.admin_session_aal_ok()
$$;

-- Guard chỉ áp cho phiên hiện tại (_user_id = auth.uid()): claim aal mô tả
-- phiên đang gọi, không nói gì về phiên của user khác.
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
  ) AND (
    _role <> 'admin'
    OR _user_id IS DISTINCT FROM auth.uid()
    OR public.admin_session_aal_ok()
  )
$$;
