-- ============================================================================
-- Shop marketplace — shop_activate RPC (nút kích hoạt shop).
-- ----------------------------------------------------------------------------
-- Until now activation was a hand-run script: approve creates the shop at
-- pending_activation, and someone UPDATEs state='active' by hand. This RPC is
-- the single sanctioned path so the admin UI gets real errors instead of the
-- guard trigger's silent no-op (shops_guard_privileged_columns reverts
-- privileged columns for non-admins WITHOUT erroring — a PATCH from a stale
-- session would 200 and change nothing).
--
-- One transition only: pending_activation → active. Everything else is either
-- idempotent (already active) or a stable, client-matchable error string.
--
-- Error strings are API. activateErrorMessage() in
-- src/hooks/shop/useShopApplicationQueue.ts matches on them:
--   admin_required · shop_not_found · invalid_verified_method
--   · shop_not_activatable:<state>
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.shop_activate(
  _shop_id UUID,
  _verified_method TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.shops%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  -- Same whitelist as CHECK shops_verified_method_check — validated up front
  -- so the caller gets a nameable error, not a raw constraint violation.
  IF _verified_method IS NOT NULL
     AND _verified_method NOT IN ('gap-truc-tiep', 'giay-phep-kinh-doanh') THEN
    RAISE EXCEPTION 'invalid_verified_method' USING ERRCODE = '22023';
  END IF;

  -- Lock the row: two admin tabs activating at once serialise here; the
  -- second one sees state='active' and takes the idempotent branch.
  SELECT * INTO _row FROM public.shops WHERE id = _shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF _row.state = 'active' THEN
    -- Idempotent replay: no second audit row, no overwrite of an existing
    -- verified_method/verified_at pair.
    RETURN _row.state::text;
  END IF;

  IF _row.state <> 'pending_activation' THEN
    -- restricted / suspended / closed are runbook territory, not this button.
    RAISE EXCEPTION 'shop_not_activatable:%', _row.state USING ERRCODE = '22023';
  END IF;

  -- verified_method and verified_at move as a PAIR (CHECK shops_verified_pair)
  -- or not at all. The BEFORE UPDATE guard trigger fires here too, but the
  -- caller is already proven admin, so is_admin() inside it returns true.
  UPDATE public.shops
  SET state           = 'active',
      verified_method = CASE WHEN _verified_method IS NOT NULL
                             THEN _verified_method ELSE verified_method END,
      verified_at     = CASE WHEN _verified_method IS NOT NULL
                             THEN now() ELSE verified_at END
  WHERE id = _shop_id;

  -- Explicit casts are load-bearing: public.log_audit_event has TWO overloads
  -- (…text,jsonb,text) and (…text,jsonb,jsonb,jsonb). Untyped literals make
  -- the call ambiguous — runtime 42725 "function is not unique". Same gotcha
  -- that broke every shop_application_decide before the pgTAP run caught it.
  PERFORM public.log_audit_event(
    'shop_activated'::text,
    'admin'::text,
    'shop'::text,
    _shop_id::text,
    'info'::text,
    jsonb_build_object('verified_method', _verified_method),
    'user'::text
  );

  RETURN 'active';
END $$;

REVOKE ALL ON FUNCTION public.shop_activate(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_activate(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_activate(UUID, TEXT) TO service_role;
