-- ============================================================================
-- Seller rules — versioned document, and acceptance the SERVER enforces (CP12)
-- ----------------------------------------------------------------------------
-- Product Owner decision 2026-08-12, #5: a seller application may not be
-- submitted until the server has verified that this applicant accepted the
-- effective version of "Quy chế người bán".
--
-- What was actually true before this migration, and is worth writing down
-- because everyone believed otherwise: the consent checkbox in
-- SellerApplication.tsx was `disabled`, but shop_application_submit() validated
-- five fields and never looked at consent, and shop_applications had no column
-- to record it in. The checkbox was locked; the submit was not. A seller
-- approved yesterday left no evidence of agreeing to anything.
--
-- Three design decisions, each of which is the reason a whole class of forgery
-- is impossible rather than merely discouraged:
--
--   1. content_hash is a GENERATED column over the body. It cannot disagree
--      with the text it claims to hash, because nobody writes it. A document
--      whose body is edited in place gets a different hash automatically, and
--      every acceptance of the old hash stops matching — which is exactly the
--      alarm we want, and the reason §3 forbids the edit outright.
--
--   2. The client presents a version and a hash, and the server uses them ONLY
--      to refuse a mismatch. What gets stored is the server's own copy. There
--      is no parameter through which a caller can state who accepted, when, or
--      what — so there is nothing to validate away later.
--
--   3. Enforcement lives inside shop_application_submit(), not beside it. A
--      client that skips the UI and POSTs straight to the RPC hits the same
--      check, because it IS the submit.
--
-- Rollback: DROP TRIGGER/FUNCTION/TABLE in reverse dependency order, then
-- restore the zero-argument shop_application_submit() from migration
-- 20260811090000. Additive except for that one function signature — see §5.
-- ============================================================================

-- ─── 1. The document ────────────────────────────────────────────────────────
-- One row per (key, version). A version is immutable by construction: §3.

CREATE TABLE IF NOT EXISTS public.legal_documents (
  document_key TEXT NOT NULL,
  version      TEXT NOT NULL,
  -- Which programme this version governs. The closed pilot's rules are not the
  -- public launch's rules, and a scope column is what stops v1 being reused by
  -- default the day Shop opens — the reuse would be silent, which is the
  -- problem with it.
  scope        TEXT NOT NULL DEFAULT 'closed-pilot',
  title        TEXT NOT NULL,
  -- The full text, stored once. An acceptance row references it rather than
  -- copying it: duplicating an immutable document into every signature buys
  -- nothing and invites the two copies to disagree.
  body         TEXT NOT NULL,
  -- Never written by anyone. sha256 over `body` exactly as stored — no
  -- whitespace folding, no normalisation. A normaliser is a second
  -- implementation of "the same document", and the two would drift.
  --
  -- digest(text, text) rather than digest(convert_to(body,'UTF8'), …):
  -- convert_to is only STABLE, because its result depends on the server
  -- encoding, and a generation expression must be IMMUTABLE — Postgres refuses
  -- the table outright otherwise (42P17). pgcrypto's text overload is marked
  -- immutable and, on this UTF-8 database, hashes the same bytes.
  content_hash TEXT GENERATED ALWAYS AS (
    encode(extensions.digest(body, 'sha256'), 'hex')
  ) STORED,
  effective_at TIMESTAMPTZ NOT NULL,
  -- Who signed the text off, and when. Both NULL means DRAFT: the row exists,
  -- and legal_current_document() will not serve it, so nobody can accept it and
  -- no application can be submitted against it. Staging a draft is therefore
  -- safe; promoting it is a deliberate, separate act.
  approved_by  TEXT,
  approved_at  TIMESTAMPTZ,
  -- Set when a version is superseded or withdrawn. Never un-set.
  retired_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_key, version),
  CONSTRAINT legal_documents_key_len   CHECK (char_length(document_key) BETWEEN 3 AND 64),
  CONSTRAINT legal_documents_version_fmt CHECK (version ~ '^[a-z0-9][a-z0-9._-]{0,31}$'),
  CONSTRAINT legal_documents_scope_check CHECK (scope IN ('closed-pilot', 'public')),
  CONSTRAINT legal_documents_body_len   CHECK (char_length(body) >= 200),
  -- An approval is a name AND a time, or neither. Half of one is not evidence.
  CONSTRAINT legal_documents_approval_pair CHECK (
    (approved_by IS NULL AND approved_at IS NULL)
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  -- No backdating. A version cannot take effect before somebody approved it,
  -- which is the whole reason both timestamps exist rather than one.
  CONSTRAINT legal_documents_no_backdate
    CHECK (approved_at IS NULL OR effective_at >= approved_at),
  CONSTRAINT legal_documents_retire_after_effective
    CHECK (retired_at IS NULL OR retired_at > effective_at)
);

COMMENT ON TABLE public.legal_documents IS
  'Versioned legal documents (seller rules first). A version is immutable once written; changing the text means a new version and a new hash. See migration 20260814090000.';
COMMENT ON COLUMN public.legal_documents.content_hash IS
  'GENERATED sha256 of body. Never supplied by a client; it is what an acceptance is checked against.';

CREATE INDEX IF NOT EXISTS idx_legal_documents_effective
  ON public.legal_documents (document_key, effective_at DESC);

-- ─── 2. The acceptance ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_key   TEXT NOT NULL,
  version        TEXT NOT NULL,
  -- Copied from the document AT SIGNING TIME, by the server. Storing it rather
  -- than only referencing the document is what makes an in-place edit visible:
  -- the reference would silently follow the new text, the copy would not.
  content_hash   TEXT NOT NULL,
  -- Evidence, not a key. Which application the seller was filling in when they
  -- signed. Acceptance is per (user, version): withdrawing one application and
  -- starting another does not require signing the same version twice.
  application_id UUID REFERENCES public.shop_applications(id) ON DELETE SET NULL,
  accepted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency for a retried submit. Not identity, not evidence.
  client_token   TEXT,
  FOREIGN KEY (document_key, version)
    REFERENCES public.legal_documents (document_key, version),
  CONSTRAINT legal_acceptances_one_per_version UNIQUE (user_id, document_key, version)
);

COMMENT ON TABLE public.legal_acceptances IS
  'Append-only record that a user accepted a specific document version and hash. Written only by legal_accept(); no client INSERT policy exists. See migration 20260814090000.';

-- No IP address and no device fingerprint. Collecting either is new personal
-- data and needs a privacy-policy decision that has not been made; the schema
-- deliberately has nowhere to put it, so nobody can start collecting it by
-- accident. Adding it later is a migration and a policy line, in that order.

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user
  ON public.legal_acceptances (user_id, document_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_acceptances_client_token
  ON public.legal_acceptances (user_id, document_key, client_token)
  WHERE client_token IS NOT NULL;

-- ─── 3. Immutability ────────────────────────────────────────────────────────
-- A document version is a thing someone signed. Editing it in place would make
-- every existing signature describe text that no longer exists.
--
-- Only retired_at may move, and only from NULL to a value: retiring is the
-- sanctioned way to stop offering a version, and un-retiring would resurrect a
-- document people were told was withdrawn.

CREATE OR REPLACE FUNCTION public.legal_documents_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.legal_acceptances a
      WHERE a.document_key = OLD.document_key AND a.version = OLD.version
    ) THEN
      RAISE EXCEPTION 'văn bản đã có người chấp thuận, không xoá được'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;

  -- Identity never moves, approved or not.
  IF NEW.document_key IS DISTINCT FROM OLD.document_key
     OR NEW.version  IS DISTINCT FROM OLD.version
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'không đổi được khoá hay phiên bản của một văn bản'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Content freezes AT APPROVAL, not at insert. Before that the row is a
  -- draft: the Product Owner is still editing the text, and content_hash —
  -- being generated — follows it. Freezing at insert sounded stricter and was
  -- in fact a trap: a draft staged with a past effective_at could never be
  -- approved, because approval would then breach the no-backdate rule with no
  -- way to move the date. Found by the test that tries to approve a draft.
  IF OLD.approved_at IS NOT NULL
     AND (NEW.scope IS DISTINCT FROM OLD.scope
          OR NEW.title IS DISTINCT FROM OLD.title
          OR NEW.body  IS DISTINCT FROM OLD.body
          OR NEW.effective_at IS DISTINCT FROM OLD.effective_at) THEN
    RAISE EXCEPTION 'một phiên bản đã phê duyệt là bất biến — đổi nội dung thì tạo phiên bản mới'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Approval is a one-way door: NULL → a value, once. Re-approving under a
  -- different name, or withdrawing an approval people have already relied on,
  -- would make the receipts describe something that no longer happened.
  IF OLD.approved_at IS NOT NULL
     AND (NEW.approved_at IS DISTINCT FROM OLD.approved_at
          OR NEW.approved_by IS DISTINCT FROM OLD.approved_by) THEN
    RAISE EXCEPTION 'đã phê duyệt thì không sửa được người duyệt hay thời điểm duyệt'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at THEN
    RAISE EXCEPTION 'đã thu hồi thì không đổi lại được'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS legal_documents_immutable_trg ON public.legal_documents;
CREATE TRIGGER legal_documents_immutable_trg
  BEFORE UPDATE OR DELETE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_documents_immutable();

-- Acceptances are never edited. DELETE is left to the FK cascade from
-- auth.users so that account deletion (and the QA teardown) still works — a
-- signature that outlives the person is not evidence, it is a retention bug.
--
-- One UPDATE is allowed, and only one: application_id going from a value to
-- NULL. That is the FK's own ON DELETE SET NULL firing when the application a
-- signature was made during is deleted, and blocking it made every
-- `DELETE FROM shop_applications` fail — which the browser acceptance run
-- found the first time it tore its fixture down. The signature itself is
-- untouched; what is being detached is a pointer to something that no longer
-- exists. Every other column is still frozen, and application_id can never
-- come back or point somewhere new.
CREATE OR REPLACE FUNCTION public.legal_acceptances_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.application_id IS NULL
     AND OLD.application_id IS NOT NULL
     AND NEW.id            IS NOT DISTINCT FROM OLD.id
     AND NEW.user_id       IS NOT DISTINCT FROM OLD.user_id
     AND NEW.document_key  IS NOT DISTINCT FROM OLD.document_key
     AND NEW.version       IS NOT DISTINCT FROM OLD.version
     AND NEW.content_hash  IS NOT DISTINCT FROM OLD.content_hash
     AND NEW.accepted_at   IS NOT DISTINCT FROM OLD.accepted_at
     AND NEW.client_token  IS NOT DISTINCT FROM OLD.client_token THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'bằng chứng chấp thuận chỉ được ghi thêm'
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS legal_acceptances_append_only_trg ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_append_only_trg
  BEFORE UPDATE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.legal_acceptances_append_only();

-- ─── 4. RLS + grants ────────────────────────────────────────────────────────

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- A document a person is asked to agree to must be readable before they agree.
-- Only the one on offer: a draft, a retired version and a future one are not
-- offers, and a draft in particular must not be readable — the Product Owner
-- stages text here before approving it, and half-approved wording leaking to a
-- seller is worse than no wording at all.
DROP POLICY IF EXISTS "legal_documents_select_effective" ON public.legal_documents;
CREATE POLICY "legal_documents_select_effective" ON public.legal_documents
  FOR SELECT
  USING (
    public.is_admin()
    OR (approved_at IS NOT NULL
        AND effective_at <= now()
        AND (retired_at IS NULL OR retired_at > now()))
  );

-- Writes are admin-only, and even an admin cannot edit a version (§3).
DROP POLICY IF EXISTS "legal_documents_admin_write" ON public.legal_documents;
CREATE POLICY "legal_documents_admin_write" ON public.legal_documents
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Own receipt, or an admin reviewing an application. Never public, never
-- another seller: who signed what and when is not catalogue data.
DROP POLICY IF EXISTS "legal_acceptances_select_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_own" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Deliberately NO insert/update/delete policy. legal_accept() is SECURITY
-- DEFINER and is the only writer. A seller cannot sign for themselves by
-- writing a row, and an admin cannot sign on a seller's behalf at all.

GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;  -- gated by the admin policy above

-- service_role bypasses RLS but NOT the grant layer, and a missing grant here
-- is a 42501 that reads like a policy bug. This repo has run two sweeps for
-- exactly this defect; the omission was caught here by the HTTP integration
-- test, which is the only thing that speaks to PostgREST the way a client does.
-- Publishing a version and the QA teardown both need it.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_documents TO service_role;
GRANT SELECT, DELETE ON public.legal_acceptances TO service_role;

-- ─── 5. Reading the effective version ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.legal_current_document(_document_key TEXT)
RETURNS TABLE (
  document_key TEXT,
  version      TEXT,
  scope        TEXT,
  title        TEXT,
  body         TEXT,
  content_hash TEXT,
  effective_at TIMESTAMPTZ,
  approved_by  TEXT,
  approved_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.document_key, d.version, d.scope, d.title, d.body, d.content_hash,
         d.effective_at, d.approved_by, d.approved_at
  FROM public.legal_documents d
  WHERE d.document_key = _document_key
    -- APPROVED is a precondition, not a label. An unapproved row is a draft,
    -- and a draft is never on offer no matter what its effective_at says.
    AND d.approved_at IS NOT NULL
    AND d.effective_at <= now()
    AND (d.retired_at IS NULL OR d.retired_at > now())
  ORDER BY d.effective_at DESC, d.version DESC
  LIMIT 1
$$;

COMMENT ON FUNCTION public.legal_current_document(TEXT) IS
  'The one version currently on offer: approved, effective, not retired, most recent. Returns no row when nothing is published — which is what blocks submission.';

-- ─── 6. Signing ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.legal_accept(
  _document_key TEXT,
  _version      TEXT,
  _content_hash TEXT,
  _client_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc   RECORD;
  _prior public.legal_acceptances%ROWTYPE;
  _app   UUID;
  _row   public.legal_acceptances%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'phải đăng nhập' USING ERRCODE = '42501';
  END IF;

  -- Replay first, before any lock: a retry of a signature that already
  -- happened must return the first receipt rather than queue behind a lock and
  -- then be told something is stale.
  IF _client_token IS NOT NULL THEN
    SELECT * INTO _prior FROM public.legal_acceptances
    WHERE user_id = auth.uid() AND document_key = _document_key
      AND client_token = _client_token;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true, 'replayed', true,
        'document_key', _prior.document_key, 'version', _prior.version,
        'content_hash', _prior.content_hash, 'accepted_at', _prior.accepted_at);
    END IF;
  END IF;

  SELECT * INTO _doc FROM public.legal_current_document(_document_key);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chưa có phiên bản nào đang hiệu lực'
      USING ERRCODE = 'P0002';
  END IF;

  -- The caller signs the version they were shown, or nothing. A form left open
  -- across a version change must go back and read the new one.
  IF _version IS DISTINCT FROM _doc.version THEN
    RAISE EXCEPTION 'phiên bản đã đổi (bản %, bạn đang xem bản %)', _doc.version, _version
      USING ERRCODE = 'PT409';
  END IF;
  IF _content_hash IS DISTINCT FROM _doc.content_hash THEN
    RAISE EXCEPTION 'nội dung văn bản không khớp bản đang hiệu lực'
      USING ERRCODE = 'PT409';
  END IF;

  -- Evidence only, and resolved here rather than accepted as a parameter, so a
  -- caller cannot attach their signature to somebody else's application.
  SELECT id INTO _app FROM public.shop_applications
  WHERE applicant_user_id = auth.uid()
  ORDER BY created_at DESC LIMIT 1;

  -- Note what is NOT taken from the caller: user_id, accepted_at and
  -- content_hash all come from the server. The parameters exist to be refused,
  -- not to be stored.
  INSERT INTO public.legal_acceptances
    (user_id, document_key, version, content_hash, application_id, client_token)
  VALUES
    (auth.uid(), _doc.document_key, _doc.version, _doc.content_hash, _app, _client_token)
  ON CONFLICT (user_id, document_key, version) DO NOTHING
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    -- Already signed this version — idempotent, and the receipt is the first one.
    SELECT * INTO _row FROM public.legal_acceptances
    WHERE user_id = auth.uid() AND document_key = _doc.document_key
      AND version = _doc.version;
    RETURN jsonb_build_object(
      'ok', true, 'replayed', true,
      'document_key', _row.document_key, 'version', _row.version,
      'content_hash', _row.content_hash, 'accepted_at', _row.accepted_at);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'replayed', false,
    'document_key', _row.document_key, 'version', _row.version,
    'content_hash', _row.content_hash, 'accepted_at', _row.accepted_at);
END $$;

REVOKE ALL ON FUNCTION public.legal_current_document(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.legal_current_document(TEXT) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.legal_accept(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.legal_accept(TEXT, TEXT, TEXT, TEXT) TO authenticated;
-- Not granted to service_role: nothing on the server has standing to sign on a
-- seller's behalf, and a grant that exists gets used.

-- ─── 7. Enforcement, inside submit ──────────────────────────────────────────
-- DROP first, deliberately. Adding a defaulted parameter with CREATE OR REPLACE
-- would leave the zero-argument function in place, and a no-argument call would
-- then be ambiguous — 42725, the same failure that once broke every approve,
-- reject and request-changes in this feature.

DROP FUNCTION IF EXISTS public.shop_application_submit();

CREATE OR REPLACE FUNCTION public.shop_application_submit(
  _expected_rules_version TEXT DEFAULT NULL
)
RETURNS public.shop_application_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.shop_applications%ROWTYPE;
  _was public.shop_application_status;
  _doc RECORD;
BEGIN
  IF NOT public.shop_pilot_has_access() THEN
    RAISE EXCEPTION 'shop_pilot_access_required' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE: two taps on "Gửi hồ sơ" must not produce two submissions.
  SELECT * INTO _row
  FROM public.shop_applications
  WHERE applicant_user_id = auth.uid()
    AND status IN ('draft', 'needs_changes')
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Idempotent: already submitted is a no-op, not an error, so a retry after
    -- a dropped response does not look like a failure to the user.
    SELECT status INTO _was
    FROM public.shop_applications
    WHERE applicant_user_id = auth.uid()
      AND status IN ('submitted', 'under_review')
    LIMIT 1;
    IF FOUND THEN RETURN _was; END IF;
    RAISE EXCEPTION 'no_editable_application' USING ERRCODE = 'P0002';
  END IF;

  -- Server-side validation. The client form validates too, for the message —
  -- but the client is not the authority on whether a row may move.
  IF coalesce(_row.seller_type, '') = '' THEN
    RAISE EXCEPTION 'missing_seller_type' USING ERRCODE = '23514';
  END IF;
  IF char_length(coalesce(_row.full_name, '')) < 2 THEN
    RAISE EXCEPTION 'missing_full_name' USING ERRCODE = '23514';
  END IF;
  IF coalesce(_row.phone, '') !~ '^0[0-9]{9}$' THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '23514';
  END IF;
  IF char_length(coalesce(_row.shop_name, '')) < 3 THEN
    RAISE EXCEPTION 'missing_shop_name' USING ERRCODE = '23514';
  END IF;
  IF char_length(coalesce(_row.city, '')) < 2 THEN
    RAISE EXCEPTION 'missing_city' USING ERRCODE = '23514';
  END IF;

  -- ── Seller rules (Product Owner decision 2026-08-12 #5) ─────────────────
  -- This is the whole point of the migration and it lives HERE, in the submit,
  -- so that a caller who never loads the UI meets the identical check.
  SELECT * INTO _doc FROM public.legal_current_document('seller-rules');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seller_rules_not_published' USING ERRCODE = 'P0002';
  END IF;

  -- The client tells us which version it displayed. If that is not the one in
  -- force, the person agreed to text we are no longer offering.
  IF _expected_rules_version IS NOT NULL
     AND _expected_rules_version IS DISTINCT FROM _doc.version THEN
    RAISE EXCEPTION 'seller_rules_version_changed' USING ERRCODE = 'PT409';
  END IF;

  -- Matched on hash as well as version: a version whose text was swapped
  -- underneath a signature must not count, and §3 makes that swap impossible
  -- precisely so this check can never be the only thing standing in the way.
  IF NOT EXISTS (
    SELECT 1 FROM public.legal_acceptances a
    WHERE a.user_id       = auth.uid()
      AND a.document_key  = 'seller-rules'
      AND a.version       = _doc.version
      AND a.content_hash  = _doc.content_hash
      AND a.accepted_at  <= now()
  ) THEN
    RAISE EXCEPTION 'seller_rules_not_accepted' USING ERRCODE = '23514';
  END IF;

  _was := _row.status;

  PERFORM set_config('shop.privileged_write', 'on', true);
  UPDATE public.shop_applications
  SET status = 'submitted',
      submitted_at = now(),
      requested_fields = '{}'
  WHERE id = _row.id;
  PERFORM set_config('shop.privileged_write', 'off', true);

  INSERT INTO public.shop_application_events (application_id, actor_user_id, actor_kind, event)
  VALUES (_row.id, auth.uid(), 'applicant',
          CASE WHEN _was = 'needs_changes' THEN 'resubmitted' ELSE 'submitted' END);

  RETURN 'submitted';
END $$;

REVOKE ALL ON FUNCTION public.shop_application_submit(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shop_application_submit(TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.shop_application_submit(TEXT) TO service_role;

-- ─── 8. Receipt, for the moderator ──────────────────────────────────────────
-- The review screen has to answer one question: did this person accept the
-- version that is IN FORCE?
--
-- Not "what is their most recent signature". Those differ, and the difference
-- is the interesting case: someone who signed v1 and never came back after v2
-- took effect has a signature, and it is not the one that counts. Answering
-- with the latest row would show a moderator a green tick for consent to text
-- we no longer offer.
--
-- Keying on the effective version also means this view and the gate inside
-- shop_application_submit() read the same fact, so they cannot disagree —
-- and it removes an ordering ambiguity that would otherwise be decided by
-- whichever row happened to be written first within the same clock tick.

CREATE OR REPLACE FUNCTION public.shop_application_rules_receipt(_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _applicant UUID;
  _doc       RECORD;
  _row       RECORD;
  _stale     RECORD;
BEGIN
  SELECT applicant_user_id INTO _applicant
  FROM public.shop_applications WHERE id = _application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'không thấy hồ sơ' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (public.is_admin() OR _applicant = auth.uid()) THEN
    RAISE EXCEPTION 'không có quyền' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _doc FROM public.legal_current_document('seller-rules');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_effective_version');
  END IF;

  SELECT a.version, a.content_hash, a.accepted_at
  INTO _row
  FROM public.legal_acceptances a
  WHERE a.user_id = _applicant
    AND a.document_key = 'seller-rules'
    AND a.version      = _doc.version
    AND a.content_hash = _doc.content_hash;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'accepted', true,
      'title', _doc.title,
      'version', _row.version,
      'content_hash', _row.content_hash,
      'accepted_at', _row.accepted_at);
  END IF;

  -- Not consent, but worth showing: they signed something, just not this.
  SELECT a.version, a.accepted_at INTO _stale
  FROM public.legal_acceptances a
  WHERE a.user_id = _applicant AND a.document_key = 'seller-rules'
  ORDER BY a.accepted_at DESC, a.version DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'accepted', false,
    'reason', CASE WHEN _stale.version IS NULL THEN 'never_accepted' ELSE 'stale_version' END,
    'current_version', _doc.version,
    'accepted_version', _stale.version,
    'accepted_at', _stale.accepted_at);
END $$;

REVOKE ALL ON FUNCTION public.shop_application_rules_receipt(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shop_application_rules_receipt(UUID) TO authenticated;

-- ─── 9. No document is seeded here ──────────────────────────────────────────
-- "Quy chế người bán v1" does not exist yet; the Product Owner and whoever
-- handles legal own its text. Seeding a placeholder would produce a document
-- real sellers could be asked to sign, which is worse than having none — so
-- this migration ships the machinery and no content, and submission stays
-- blocked with `seller_rules_not_published` until a real version is inserted.
--
-- The local test document is created by the QA fixture
-- (scripts/qa/p2b-seed.mjs → seedSellerRules), whose title begins with
-- "[TEST-ONLY]" so that a copy of it appearing on a real environment is
-- self-reporting. It is never inserted by a migration, so it cannot travel.
