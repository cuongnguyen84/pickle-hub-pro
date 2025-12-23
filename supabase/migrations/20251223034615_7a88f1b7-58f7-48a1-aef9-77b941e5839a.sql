-- Fix function search path for update_quick_table_timestamp
CREATE OR REPLACE FUNCTION public.update_quick_table_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;