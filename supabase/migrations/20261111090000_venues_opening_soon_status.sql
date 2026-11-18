-- Sân "sắp mở" (opening soon) cho bảng venues.
-- TSA @ Newton (Singapore) là sân đầu tiên được công bố trước khi mở cửa:
-- cần niêm yết kèm nhãn "Sắp mở" + mốc dự kiến, không được hiển thị như sân
-- đang hoạt động, và bị loại khỏi tìm kiếm sân gần đây cho tới khi mở cửa.
--
-- status: 'active' (đang hoạt động - mặc định cho mọi sân hiện hữu) hoặc
--         'opening_soon' (đã công bố, chưa mở cửa).
-- opening_expected: mốc mở cửa dự kiến dạng 'YYYY-MM' (vd '2027-03'),
-- chỉ có ý nghĩa khi status = 'opening_soon'.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS opening_expected text;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_status_check
  CHECK (status IN ('active', 'opening_soon'));

COMMENT ON COLUMN public.venues.status IS
  'active = sân đang hoạt động; opening_soon = đã công bố, chưa mở cửa (hiển thị nhãn Sắp mở, loại khỏi nearby search)';
COMMENT ON COLUMN public.venues.opening_expected IS
  'Mốc mở cửa dự kiến dạng YYYY-MM khi status = opening_soon (vd 2027-03)';
