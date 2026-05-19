-- Enable realtime for quick_table_matches and quick_table_players
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_players;