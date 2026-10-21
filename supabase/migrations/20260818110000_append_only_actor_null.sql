-- ============================================================================
-- Append-only ledgers vs. delete-account — one escape hatch, four triggers.
-- ----------------------------------------------------------------------------
-- Four tables carry `actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET
-- NULL` AND a BEFORE UPDATE trigger that raises unconditionally:
--
--   inventory_movements             20260811210000 (FK :419, trigger ~:469)
--   product_submission_events       20260811230000 (FK :59,  trigger :89-108)
--   product_moderation_events       20260812091000 FK / 20260812120000 trigger
--   shop_contact_moderation_events  20260812120000 (FK :290, trigger :330-350)
--
-- Deleting an account makes Postgres issue an UPDATE on every one of those rows
-- to null the column. The trigger refuses it, and `auth.admin.deleteUser` in
-- supabase/functions/delete-account/index.ts:156 fails for anybody who has ever
-- left a trace. Today that is admins and pilot sellers; the moment
-- shop_order_create writes a `sale` row with the BUYER's uid it is every buyer
-- of a counted variant.
--
-- The fix is not to drop the FK (an actor id that silently points at a deleted
-- account is worse) and not to weaken append-only. It is to name the ONE update
-- Postgres itself issues: actor_user_id going NULL, and NOTHING ELSE changing.
-- Anything else on the same UPDATE is still somebody editing the books.
--
-- `to_jsonb(NEW) - 'actor_user_id' = to_jsonb(OLD) - 'actor_user_id'` is the
-- whole test, and it stays correct when a column is added later — an explicit
-- column-by-column comparison would not.
--
-- Every body below is the CURRENT body, copied verbatim (DELETE branch
-- included — a blanket refusal there makes the ON DELETE CASCADE impossible,
-- which is a lesson each of these files already paid for), plus the one guard.
-- CREATE OR REPLACE takes whatever body it is given, so a restatement that
-- forgot a branch would silently un-do it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_movements_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- FK ON DELETE SET NULL, not somebody editing the ledger.
    IF NEW.actor_user_id IS NULL AND OLD.actor_user_id IS NOT NULL
       AND to_jsonb(NEW) - 'actor_user_id' = to_jsonb(OLD) - 'actor_user_id' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'sổ kho chỉ ghi thêm, không sửa' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A DELETE is refused while the thing it is an account OF still exists.
  --
  -- But the FKs above are ON DELETE CASCADE, and a blanket refusal makes those
  -- cascades impossible: deleting a shop that has ever moved stock fails, which
  -- takes account deletion and the QA teardown with it. That is not "history is
  -- protected", it is "a shop can never be removed", and it was found by the QA
  -- cleanup silently leaving six shops behind.
  --
  -- Postgres deletes the parent row before the children in a cascade, so inside
  -- this trigger a missing parent IS the cascade. History still cannot be
  -- edited or selectively pruned; it goes only when its whole subject goes.
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id)
     OR NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = OLD.variant_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'sổ kho chỉ ghi thêm, không xoá' USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE OR REPLACE FUNCTION public.product_submission_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.actor_user_id IS NULL AND OLD.actor_user_id IS NOT NULL
       AND to_jsonb(NEW) - 'actor_user_id' = to_jsonb(OLD) - 'actor_user_id' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'lịch sử gửi duyệt chỉ ghi thêm, không sửa' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Same shape as the inventory ledger: a DELETE is allowed only when the
  -- product it is a history OF has already gone, which inside a cascade it has.
  -- A blanket refusal would make the product undeletable.
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id)
     OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'lịch sử gửi duyệt chỉ ghi thêm, không xoá' USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE OR REPLACE FUNCTION public.product_moderation_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.actor_user_id IS NULL AND OLD.actor_user_id IS NOT NULL
       AND to_jsonb(NEW) - 'actor_user_id' = to_jsonb(OLD) - 'actor_user_id' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'nhật ký kiểm duyệt chỉ được ghi thêm, không sửa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = OLD.product_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'nhật ký kiểm duyệt chỉ được ghi thêm, không xoá'
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE OR REPLACE FUNCTION public.shop_contact_moderation_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.actor_user_id IS NULL AND OLD.actor_user_id IS NOT NULL
       AND to_jsonb(NEW) - 'actor_user_id' = to_jsonb(OLD) - 'actor_user_id' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'nhật ký kiểm duyệt kênh liên hệ chỉ được ghi thêm, không sửa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = OLD.shop_id)
     OR NOT EXISTS (SELECT 1 FROM public.shop_contact_channels WHERE id = OLD.contact_channel_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'nhật ký kiểm duyệt kênh liên hệ chỉ được ghi thêm, không xoá'
    USING ERRCODE = 'insufficient_privilege';
END $$;
