-- Enable realtime for team match games and matches tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_match_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_match_matches;