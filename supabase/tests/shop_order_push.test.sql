-- Đường ống push của đơn hàng.
--
-- Câu hỏi thật của file này:
--   * helper push có bị người dùng thường gọi được không (nó gửi thông báo tới
--     UID bất kỳ — cho anon/authenticated EXECUTE là mở loa cho cả thiên hạ);
--   * ba trigger có thật sự gắn đúng bảng, đúng thời điểm, đúng cột không;
--   * và quan trọng nhất: một thông báo hỏng có giết được đơn hàng không.
--
-- Phần hành vi của câu hỏi cuối KHÔNG nằm ở đây mà nằm ở shop_orders.test.sql:
-- từ migration 20260818190000 trở đi, 118 assertion của file đó chạy KÈM ba
-- trigger này đang sống, trong môi trường local không có pg_net lẫn vault. Nếu
-- push_notify để lọt lỗi ra ngoài, file đó đỏ. Đó là bằng chứng đắt hơn bất kỳ
-- assertion nào viết lại được ở đây.

BEGIN;

SELECT plan(14);

-- ─── 1. Helper ──────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'push_notify'),
  1,
  'public.push_notify tồn tại, đúng một overload'
);

SELECT ok(
  (SELECT p.prosecdef FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'push_notify'),
  'push_notify là SECURITY DEFINER — nó đọc vault, người gọi thì không được'
);

-- Đọc secret bằng quyền definer nghĩa là search_path phải bị ghim, nếu không
-- một schema do người gọi dựng có thể chen vào trước `vault`.
SELECT ok(
  (SELECT p.proconfig::text LIKE '%search_path%' FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'push_notify'),
  'push_notify ghim search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.push_notify(uuid[],text,text,jsonb)', 'EXECUTE'),
  'anon KHÔNG gọi được push_notify'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.push_notify(uuid[],text,text,jsonb)', 'EXECUTE'),
  'authenticated KHÔNG gọi được push_notify — nếu không, bất kỳ ai đăng nhập cũng bắn được thông báo tới UID tuỳ ý'
);

SELECT ok(
  has_function_privilege('service_role', 'public.push_notify(uuid[],text,text,jsonb)', 'EXECUTE'),
  'service_role gọi được push_notify'
);

-- ─── 2. Ba trigger ──────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'shop_orders' AND NOT t.tgisinternal
     AND t.tgname IN ('trg_shop_order_push_new',
                      'trg_shop_order_push_status',
                      'trg_shop_order_push_payment_claimed')),
  3,
  'đủ ba trigger push trên shop_orders'
);

-- tgtype bit 0 = ROW, bit 1 = BEFORE. AFTER ROW ⇒ bit0 bật, bit1 tắt.
-- Phải là AFTER: BEFORE mà bắn thông báo thì đơn còn có thể vỡ sau đó, và
-- người bán đã cầm cái push cho một đơn không tồn tại.
SELECT ok(
  (SELECT bool_and((t.tgtype & 1) = 1 AND (t.tgtype & 2) = 0)
   FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'shop_orders' AND NOT t.tgisinternal
     AND t.tgname LIKE 'trg_shop_order_push_%'),
  'cả ba đều AFTER ... FOR EACH ROW'
);

SELECT ok(
  (SELECT (t.tgtype & 4) = 4 FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'shop_orders' AND t.tgname = 'trg_shop_order_push_new'),
  'trg_shop_order_push_new bắn trên INSERT'
);

SELECT ok(
  (SELECT (t.tgtype & 16) = 16 FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'shop_orders' AND t.tgname = 'trg_shop_order_push_status'),
  'trg_shop_order_push_status bắn trên UPDATE'
);

-- Trigger UPDATE có cột giới hạn: không khoanh cột thì mọi lần chạm vào đơn
-- đều gọi hàm, và hàm phải tự lọc — rẻ hơn là để Postgres lọc.
SELECT ok(
  (SELECT array_length(t.tgattr, 1) = 1 FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'shop_orders' AND t.tgname = 'trg_shop_order_push_status'),
  'trg_shop_order_push_status khoanh đúng một cột'
);

SELECT is(
  (SELECT a.attname FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = t.tgattr[0]
   WHERE c.relname = 'shop_orders' AND t.tgname = 'trg_shop_order_push_status'),
  'status',
  'cột đó là status'
);

SELECT is(
  (SELECT a.attname FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = t.tgattr[0]
   WHERE c.relname = 'shop_orders' AND t.tgname = 'trg_shop_order_push_payment_claimed'),
  'payment_claimed_at',
  'trigger báo chuyển khoản khoanh đúng cột payment_claimed_at'
);

-- ─── 3. Thiếu secret thì kêu, không câm ─────────────────────────────────────
-- Đây là cách lỗi cũ sống được nhiều tháng: pg_net không raise khi HTTP lỗi,
-- và thân trigger bọc EXCEPTION WHEN OTHERS THEN NULL. Local không có vault
-- nên push_notify phải đi đúng nhánh "thiếu secret" — và nhánh đó phải RAISE
-- WARNING chứ không return im lặng.
SELECT ok(
  (SELECT pg_get_functiondef(p.oid) LIKE '%RAISE WARNING%'
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'push_notify'),
  'push_notify kêu WARNING khi không gửi được, thay vì nuốt im lặng'
);

SELECT * FROM finish();
ROLLBACK;
