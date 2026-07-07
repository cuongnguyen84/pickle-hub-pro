-- chat_room_settings was never added to the realtime publication (unlike
-- chat_messages / chat_pinned_messages / chat_highlighted_users /
-- chat_message_likes). Any channel that binds postgres_changes on it gets
-- "Unable to subscribe to changes" and receives NO events for its other
-- bindings either — which silently killed live chat message delivery in the
-- native app (and the web chat:unified channel).
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_settings;
