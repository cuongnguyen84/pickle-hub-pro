-- Cỡ nhánh playoff tuỳ chỉnh đặt lúc tạo giải bằng chat
-- ("16 đội mạnh nhất vào nhánh Vàng, còn lại chia Bạc và Đồng" → {16,14,14}).
-- NULL = luật mặc định theo playoff_series. Client cắt bảng xếp hạng toàn giải
-- theo các cỡ này rồi gọi create_quick_table_playoff_atomic như cũ.
ALTER TABLE public.quick_tables
  ADD COLUMN IF NOT EXISTS playoff_series_sizes smallint[]
  CONSTRAINT quick_tables_playoff_series_sizes_check CHECK (
    playoff_series_sizes IS NULL OR (
      array_length(playoff_series_sizes, 1) BETWEEN 1 AND 3
      AND 2 <= ALL (playoff_series_sizes)
      AND 200 >= ALL (playoff_series_sizes)
    )
  );
