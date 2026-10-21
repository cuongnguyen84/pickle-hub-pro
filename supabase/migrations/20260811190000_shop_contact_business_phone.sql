-- ============================================================================
-- Shop marketplace — business phone normalization
-- ----------------------------------------------------------------------------
-- D2 asks for a BUSINESS phone. The step 3 normalizer only accepted Vietnamese
-- mobile prefixes (3/5/7/8/9), because it was written for Zalo — Zalo accounts
-- are mobile-based — and the `phone` channel was then pointed at the same rule.
--
-- The result: a shop whose published number is its shop line, 028 3822 1234,
-- could not enter it. The error told them the number was invalid, which is not
-- true, and offered "nhập dạng 09xxxxxxxx", which is not an option they have.
--
-- So the two rules separate:
--
--   * `phone` accepts a Vietnamese mobile OR a landline, and normalizes to
--     E.164. Landlines matter for a business and are what a buyer will call
--     during shop hours.
--   * `zalo` stays mobile-only, because a landline cannot hold a Zalo account.
--     Its error says so, in its own words, instead of borrowing the phone one.
--
-- The numbering plan this encodes (post-2017 Vietnam), stated because the
-- regexes are otherwise unreadable — the national significant number, i.e.
-- what follows +84 with no trunk 0:
--
--   mobile    [35789] + 8 digits   =  9 digits   0912 345 678  -> +84912345678
--   landline  2       + 9 digits   = 10 digits   024 3825 1234 -> +842438251234
--                                                0225 3823 456 -> +842253823456
--
-- Every Vietnamese geographic area code begins with 2 and the NSN is always 10
-- digits, whether the area code is two digits (24 Hà Nội, 28 TP.HCM) or three
-- (225 Hải Phòng, 236 Đà Nẵng, 292 Cần Thơ). One rule covers all of them.
--
-- Deliberately NOT accepted, with a message that says which is which:
--   * 1900 / 1800 service lines. They are charged per call or toll-free
--     routing, not a number a buyer can reach a person on, and they do not
--     dial from outside Vietnam. Rejected by name so the seller is not left
--     guessing at "không hợp lệ".
--   * short codes (113, 114, 115, 1022…) — caught by digit count.
--   * anything with too few or too many digits, which is the actual typo.
--
-- What this migration does NOT do: seed a contact from the account phone or
-- email. Nothing here reads auth.users. A published contact stays something the
-- seller declared on purpose (D2), and an edit to an approved value still drops
-- it back to pending_review — that is the trigger from 20260811180000, and the
-- pgTAP proves it holds for a landline too.
-- ============================================================================

-- ─── 1. The number rule, once ───────────────────────────────────────────────
-- Shared by both channels so they cannot disagree about what a Vietnamese
-- phone number is; they differ only in whether a landline is allowed, and in
-- what they say when it is not.

CREATE OR REPLACE FUNCTION public.vn_phone_is_nsn(_nsn TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  -- mobile: 9 digits, prefix 3/5/7/8/9.  landline: 10 digits, always area 2xx.
  SELECT _nsn ~ '^[35789][0-9]{8}$' OR _nsn ~ '^2[0-9]{9}$'
$$;

CREATE OR REPLACE FUNCTION public.vn_phone_e164(_value TEXT, _mobile_only BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _d   TEXT;
  _nsn TEXT;
BEGIN
  -- Separators are how humans write phone numbers: "028 3822 1234",
  -- "0912.345.678", "(024) 3825-1234", "+84 90 123 45 67". Strip everything
  -- that is not a digit — the leading + carries no information a country code
  -- check does not already have.
  _d := regexp_replace(coalesce(_value, ''), '[^0-9]', '', 'g');

  -- No early "chưa nhập" branch on purpose. "abc" and "zalo.me/shopvot" strip
  -- to zero digits but are not empty input, and telling that seller they typed
  -- nothing is both false and unhelpful — they fall through to the message that
  -- shows them what a number looks like. Genuinely empty input is caught by the
  -- caller before it gets here.

  -- 00 is the international access prefix: 0084… is +84…
  IF left(_d, 2) = '00' THEN _d := substring(_d from 3); END IF;

  -- Named before the generic failure, so the seller is told the actual reason
  -- rather than being sent to count their digits.
  IF _d ~ '^0?1[89]00' THEN
    RAISE EXCEPTION 'đầu số 1900/1800 chưa hỗ trợ — dùng số di động hoặc số bàn của shop'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Try the country code first, then the trunk 0, then the bare national
  -- number — but only accept a reading that produces a VALID national number.
  -- Order alone is not enough: 0847123456 is a real Vinaphone number whose
  -- national form starts with the digits 84, and stripping those as a country
  -- code would leave 7 digits and a wrong rejection.
  IF left(_d, 2) = '84' AND public.vn_phone_is_nsn(substring(_d from 3)) THEN
    _nsn := substring(_d from 3);
  ELSIF left(_d, 1) = '0' AND public.vn_phone_is_nsn(substring(_d from 2)) THEN
    _nsn := substring(_d from 2);
  ELSIF public.vn_phone_is_nsn(_d) THEN
    _nsn := _d;
  END IF;

  IF _nsn IS NULL THEN
    IF _mobile_only THEN
      RAISE EXCEPTION 'số Zalo không hợp lệ — Zalo dùng số di động, ví dụ 0901234567'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    RAISE EXCEPTION 'số điện thoại không hợp lệ — nhập số di động (0901234567) hoặc số bàn (02838221234)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A landline is a perfectly good business number and a perfectly impossible
  -- Zalo account, so this is refused here rather than at the regex.
  IF _mobile_only AND _nsn !~ '^[35789][0-9]{8}$' THEN
    RAISE EXCEPTION 'số Zalo không hợp lệ — số bàn không đăng ký được Zalo, nhập số di động hoặc liên kết zalo.me/…'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN '+84' || _nsn;
END $$;

COMMENT ON FUNCTION public.vn_phone_e164(TEXT, BOOLEAN) IS
  'Vietnamese phone -> E.164. _mobile_only rejects landlines with a Zalo-specific message.';

REVOKE ALL ON FUNCTION public.vn_phone_e164(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vn_phone_is_nsn(TEXT)        FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vn_phone_e164(TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vn_phone_is_nsn(TEXT)        TO authenticated, service_role;

-- ─── 2. Channel normalization, rebuilt on top of it ─────────────────────────

CREATE OR REPLACE FUNCTION public.shop_contact_normalize(_type TEXT, _value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _v      TEXT := btrim(coalesce(_value, ''));
  _handle TEXT;
BEGIN
  IF _v = '' THEN
    RAISE EXCEPTION 'chưa nhập thông tin liên hệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- No scheme games. javascript:, data:, and friends never reach a link.
  IF _v ~* '^\s*(javascript|data|vbscript|file|about|blob)\s*:' THEN
    RAISE EXCEPTION 'liên kết không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _type = 'phone' THEN
    -- Business phone: mobile or landline.
    RETURN public.vn_phone_e164(_v, false);

  ELSIF _type = 'zalo' THEN
    -- Zalo is reachable by a zalo.me link or by the mobile number the account
    -- is registered to. Not by a landline — see vn_phone_e164.
    IF _v ~* '^(https?://)?(www\.)?zalo\.me/' THEN
      _handle := regexp_replace(_v, '^.*zalo\.me/', '', 'i');
      _handle := split_part(split_part(_handle, '?', 1), '#', 1);
      _handle := btrim(_handle, '/');
      IF _handle ~ '^[A-Za-z0-9._-]{3,60}$' THEN
        RETURN 'https://zalo.me/' || _handle;
      END IF;
      RAISE EXCEPTION 'liên kết Zalo không hợp lệ' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    RETURN 'https://zalo.me/' || regexp_replace(public.vn_phone_e164(_v, true), '^\+', '');

  ELSIF _type = 'messenger' THEN
    IF _v ~* '^(https?://)?(www\.)?(m\.me|messenger\.com|facebook\.com)/' THEN
      _handle := regexp_replace(_v, '^.*(m\.me|messenger\.com|facebook\.com)/', '', 'i');
      _handle := split_part(split_part(_handle, '?', 1), '#', 1);
      _handle := btrim(_handle, '/');
    ELSE
      _handle := _v;
    END IF;
    IF _handle ~ '^[A-Za-z0-9.]{5,60}$' THEN
      RETURN 'https://m.me/' || _handle;
    END IF;
    RAISE EXCEPTION 'tên Messenger không hợp lệ — dùng m.me/tênshop'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RAISE EXCEPTION 'kênh liên hệ không hỗ trợ: %', _type USING ERRCODE = 'invalid_parameter_value';
END $$;

GRANT EXECUTE ON FUNCTION public.shop_contact_normalize(TEXT, TEXT) TO authenticated, service_role;
