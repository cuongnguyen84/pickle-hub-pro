import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { ChatMessage, ChatSettings, ChatMute } from "./useLiveChat";

const MESSAGES_LIMIT = 50;
const SEND_TIMEOUT_MS = 5000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

const generateClientMessageId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface UseChatMessagesResult {
  messages: ChatMessage[];
  isLoading: boolean;
  hasOlderMessages: boolean;
  sendMessage: (message: string) => Promise<boolean>;
  retryMessage: (tempId: string, message: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  loadOlderMessages: () => Promise<void>;
  channelRef: React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings | null>>;
  settings: ChatSettings | null;
  userMute: ChatMute | null;
  setUserMute: React.Dispatch<React.SetStateAction<ChatMute | null>>;
}

export function useChatMessages(livestreamId: string): UseChatMessagesResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [userMute, setUserMute] = useState<ChatMute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);

  const [channelVersion, setChannelVersion] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const clientMessageIdsRef = useRef<Set<string>>(new Set());
  const pendingMessagesRef = useRef<Map<string, {
    clientMessageId: string;
    text: string;
    userId: string;
    timestamp: number;
  }>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const lastFetchTimeRef = useRef<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      const { data: messagesData, count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .eq('livestream_id', livestreamId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_LIMIT);

      if (messagesData) {
        const reversed = [...messagesData].reverse();
        messageIdsRef.current = new Set(reversed.map(m => m.id));
        reversed.forEach(m => {
          if (m.client_message_id) {
            clientMessageIdsRef.current.add(m.client_message_id);
          }
        });
        setMessages(reversed);
        setHasOlderMessages((count || 0) > MESSAGES_LIMIT);
        if (reversed.length > 0) {
          lastFetchTimeRef.current = reversed[reversed.length - 1].created_at;
        }
      }

      const { data: settingsData } = await supabase
        .from('chat_room_settings')
        .select('*')
        .eq('livestream_id', livestreamId)
        .maybeSingle();

      setSettings(settingsData || {
        livestream_id: livestreamId,
        is_chat_enabled: true,
        slow_mode_seconds: 0,
        updated_at: new Date().toISOString()
      });

      if (user) {
        const { data: muteData } = await supabase
          .from('chat_mutes')
          .select('*')
          .eq('livestream_id', livestreamId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (muteData && new Date(muteData.muted_until) > new Date()) {
          setUserMute(muteData);
        } else {
          setUserMute(null);
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, [livestreamId, user]);

  // Unified channel for broadcast + postgres_changes
  useEffect(() => {
    if (!livestreamId) return;

    const channel = supabase.channel(`chat:unified:${livestreamId}`, {
      config: { broadcast: { self: true } }
    });

    channel.on('broadcast', { event: 'message' }, (payload) => {
      const broadcastMsg = payload.payload as {
        client_message_id: string;
        livestream_id: string;
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        message: string;
        created_at: string;
      };

      if (clientMessageIdsRef.current.has(broadcastMsg.client_message_id)) return;

      const isOwnPending = Array.from(pendingMessagesRef.current.values())
        .some(p => p.clientMessageId === broadcastMsg.client_message_id);
      if (isOwnPending) return;

      clientMessageIdsRef.current.add(broadcastMsg.client_message_id);

      const newMessage: ChatMessage = {
        id: `broadcast-${broadcastMsg.client_message_id}`,
        livestream_id: broadcastMsg.livestream_id,
        user_id: broadcastMsg.user_id,
        display_name: broadcastMsg.display_name,
        avatar_url: broadcastMsg.avatar_url,
        message: broadcastMsg.message,
        created_at: broadcastMsg.created_at,
        client_message_id: broadcastMsg.client_message_id,
        _pending: false,
        _failed: false
      };

      setMessages(prev => [...prev, newMessage]);
    });

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `livestream_id=eq.${livestreamId}` },
      (payload) => {
        const dbMessage = payload.new as ChatMessage & { client_message_id?: string };
        if (messageIdsRef.current.has(dbMessage.id)) return;

        if (dbMessage.client_message_id) {
          let foundPending = false;
          for (const [tempId, pendingData] of pendingMessagesRef.current.entries()) {
            if (pendingData.clientMessageId === dbMessage.client_message_id) {
              foundPending = true;
              pendingMessagesRef.current.delete(tempId);
              messageIdsRef.current.add(dbMessage.id);
              setMessages(prev => prev.map(m =>
                m.id === tempId ? { ...dbMessage, _pending: false, _failed: false } : m
              ));
              break;
            }
          }

          if (!foundPending) {
            const broadcastId = `broadcast-${dbMessage.client_message_id}`;
            setMessages(prev => {
              const hasBroadcast = prev.some(m => m.id === broadcastId);
              if (hasBroadcast) {
                messageIdsRef.current.add(dbMessage.id);
                return prev.map(m =>
                  m.id === broadcastId ? { ...dbMessage, _pending: false, _failed: false } : m
                );
              }
              if (!messageIdsRef.current.has(dbMessage.id)) {
                messageIdsRef.current.add(dbMessage.id);
                return [...prev, { ...dbMessage, _pending: false, _failed: false }];
              }
              return prev;
            });
          }
        } else {
          messageIdsRef.current.add(dbMessage.id);
          setMessages(prev => [...prev, { ...dbMessage, _pending: false, _failed: false }]);
        }
      }
    );

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `livestream_id=eq.${livestreamId}` },
      (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        messageIdsRef.current.delete(deletedId);
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_room_settings', filter: `livestream_id=eq.${livestreamId}` },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setSettings(payload.new as ChatSettings);
        }
      }
    );

    const fetchMissedMessages = async () => {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;

      const { data: newMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('livestream_id', livestreamId)
        .gt('created_at', lastMessage.created_at)
        .order('created_at', { ascending: true })
        .limit(100);

      if (newMessages && newMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const existingClientIds = new Set(prev.map(m => m.client_message_id).filter(Boolean));
          const trulyNew = newMessages.filter(m =>
            !existingIds.has(m.id) &&
            (!m.client_message_id || !existingClientIds.has(m.client_message_id))
          );
          if (trulyNew.length === 0) return prev;
          trulyNew.forEach(m => {
            messageIdsRef.current.add(m.id);
            if (m.client_message_id) clientMessageIdsRef.current.add(m.client_message_id);
          });
          return [...prev, ...trulyNew];
        });
      }
    };

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        if (reconnectAttemptsRef.current > 0) fetchMissedMessages();
        reconnectAttemptsRef.current = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current), 15000);
          reconnectAttemptsRef.current++;
          setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            setChannelVersion(v => v + 1);
          }, delay);
        }
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [livestreamId, channelVersion]);

  // Polling fallback
  useEffect(() => {
    if (!livestreamId) return;

    const pollMessages = async () => {
      const currentMessages = messages;
      const lastMessage = currentMessages[currentMessages.length - 1];
      const sinceTime = lastMessage?.created_at || lastFetchTimeRef.current;
      if (!sinceTime) return;

      const { data: newMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('livestream_id', livestreamId)
        .gt('created_at', sinceTime)
        .order('created_at', { ascending: true })
        .limit(50);

      if (newMessages && newMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const existingClientIds = new Set(prev.map(m => m.client_message_id).filter(Boolean));
          const trulyNew = newMessages.filter(m =>
            !existingIds.has(m.id) &&
            (!m.client_message_id || !existingClientIds.has(m.client_message_id))
          );
          if (trulyNew.length === 0) return prev;
          trulyNew.forEach(m => {
            messageIdsRef.current.add(m.id);
            if (m.client_message_id) clientMessageIdsRef.current.add(m.client_message_id);
          });
          lastFetchTimeRef.current = trulyNew[trulyNew.length - 1].created_at;
          return [...prev, ...trulyNew];
        });
      }
    };

    const pollInterval = setInterval(pollMessages, 5000);
    return () => clearInterval(pollInterval);
  }, [livestreamId, messages]);

  const getUserProfile = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();
    return data;
  };

  const sendMessage = useCallback(async (message: string): Promise<boolean> => {
    if (!user) {
      toast({ title: t.chat.signInToChat, variant: "destructive" });
      return false;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage || trimmedMessage.length > 500) return false;

    if (userMute && new Date(userMute.muted_until) > new Date()) {
      toast({ title: t.chat.youAreMuted, variant: "destructive" });
      return false;
    }

    if (settings && !settings.is_chat_enabled) {
      toast({ title: t.chat.chatDisabled, variant: "destructive" });
      return false;
    }

    const profile = await getUserProfile();
    const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
    const avatarUrl = profile?.avatar_url || null;

    const clientMessageId = generateClientMessageId();
    const tempId = `pending-${clientMessageId}`;
    const createdAt = new Date().toISOString();

    const optimisticMessage: ChatMessage = {
      id: tempId,
      livestream_id: livestreamId,
      user_id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
      message: trimmedMessage,
      created_at: createdAt,
      client_message_id: clientMessageId,
      _pending: true,
      _failed: false,
      _tempId: tempId
    };

    pendingMessagesRef.current.set(tempId, {
      clientMessageId,
      text: trimmedMessage,
      userId: user.id,
      timestamp: Date.now()
    });
    clientMessageIdsRef.current.add(clientMessageId);
    setMessages(prev => [...prev, optimisticMessage]);

    const channel = channelRef.current;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          client_message_id: clientMessageId,
          livestream_id: livestreamId,
          user_id: user.id,
          display_name: displayName,
          avatar_url: avatarUrl,
          message: trimmedMessage,
          created_at: createdAt
        }
      }).catch(() => {});
    }

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, _pending: true } : m
      ));
    }, SEND_TIMEOUT_MS);

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        livestream_id: livestreamId,
        user_id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        message: trimmedMessage,
        client_message_id: clientMessageId
      });

    clearTimeout(timeoutId);

    if (error) {
      pendingMessagesRef.current.delete(tempId);
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m
      ));

      if (error.message.includes('can_send_chat_message')) {
        toast({ title: t.chat.slowModeWait, variant: "destructive" });
      } else {
        toast({ title: t.chat.sendError, variant: "destructive" });
      }
      return false;
    }

    pendingMessagesRef.current.delete(tempId);
    setMessages(prev => prev.map(m =>
      m.id === tempId ? { ...m, _pending: false, _failed: false } : m
    ));

    return true;
  }, [user, userMute, settings, livestreamId, toast, t]);

  const retryMessage = useCallback(async (tempId: string, message: string): Promise<boolean> => {
    const pendingData = pendingMessagesRef.current.get(tempId);
    if (pendingData) {
      clientMessageIdsRef.current.delete(pendingData.clientMessageId);
    }
    setMessages(prev => prev.filter(m => m.id !== tempId));
    pendingMessagesRef.current.delete(tempId);
    return sendMessage(message);
  }, [sendMessage]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    messageIdsRef.current.delete(messageId);

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      toast({ title: t.common.error, variant: "destructive" });
      return false;
    }
    return true;
  }, [toast, t]);

  const loadOlderMessages = useCallback(async () => {
    if (messages.length === 0) return;

    const oldestMessage = messages[0];
    const { data: olderData, count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('livestream_id', livestreamId)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_LIMIT);

    if (olderData && olderData.length > 0) {
      const reversed = [...olderData].reverse();
      reversed.forEach(m => {
        messageIdsRef.current.add(m.id);
        if (m.client_message_id) clientMessageIdsRef.current.add(m.client_message_id);
      });
      setMessages(prev => [...reversed, ...prev]);
      setHasOlderMessages((count || 0) > MESSAGES_LIMIT);
    } else {
      setHasOlderMessages(false);
    }
  }, [messages, livestreamId]);

  return {
    messages,
    isLoading,
    hasOlderMessages,
    sendMessage,
    retryMessage,
    deleteMessage,
    loadOlderMessages,
    channelRef,
    settings,
    setSettings,
    userMute,
    setUserMute,
  };
}
