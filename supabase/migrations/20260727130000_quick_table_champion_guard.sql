-- champion-on-event-card hardening (qa-verifier finding, 2026-07-27):
-- policy "Creators can update their tables" không giới hạn cột, nên creator có
-- thể UPDATE champion_name trực tiếp qua PostgREST — tự phong vô địch giả lên
-- bề mặt công khai (card /tournaments + SSR description), bypass toàn bộ logic
-- RPC. Guard: BEFORE UPDATE revert im lặng mọi thay đổi 2 cột champion đến từ
-- role client (authenticated/anon). RPC SECURITY DEFINER chạy dưới owner nên
-- không bị chạm. Revert im lặng thay vì RAISE để không phá client nào lỡ gửi
-- full-row payload.

CREATE OR REPLACE FUNCTION public.protect_quick_table_champion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.champion_player_id IS DISTINCT FROM OLD.champion_player_id
          OR NEW.champion_name IS DISTINCT FROM OLD.champion_name) THEN
    NEW.champion_player_id := OLD.champion_player_id;
    NEW.champion_name := OLD.champion_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_quick_table_champion ON public.quick_tables;
CREATE TRIGGER protect_quick_table_champion
  BEFORE UPDATE ON public.quick_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_quick_table_champion();
