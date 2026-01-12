import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

export interface ChatMessage {
  id: string;
  livestream_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
  client_message_id?: string;
  _pending?: boolean;
  _failed?: boolean;
  _tempId?: string;
}

export interface ChatSettings {
  livestream_id: string;
  is_chat_enabled: boolean;
  slow_mode_seconds: number;
  updated_at: string;
}

export interface ChatMute {
  id: string;
  livestream_id: string;
  user_id: string;
  muted_until: string;
  reason: string | null;
  created_at: string;
}

interface UseLiveChatResult {
  messages: ChatMessage[];
  settings: ChatSettings | null;
  userMute: ChatMute | null;
  isLoading: boolean;
  isModerator: boolean;
  hasOlderMessages: boolean;
  sendMessage: (message: string) => Promise<boolean>;
  retryMessage: (tempId: string, message: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  updateSettings: (updates: Partial<Pick<ChatSettings, 'is_chat_enabled' | 'slow_mode_seconds'>>) => Promise<boolean>;
  muteUser: (userId: string, durationMinutes: number, reason?: string) => Promise<boolean>;
  unmuteUser: (muteId: string) => Promise<boolean>;
  loadOlderMessages: () => Promise<void>;
}

const MESSAGES_LIMIT = 50;
const SEND_TIMEOUT_MS = 5000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

// Generate unique client message ID
const generateClientMessageId = () => 
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useLiveChat = (livestreamId: string): UseLiveChatResult => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [userMute, setUserMute] = useState<ChatMute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  
  // SPLIT CHANNELS: Separate broadcast and postgres_changes to avoid binding mismatch
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Track all known message IDs (real DB IDs)
  const messageIdsRef = useRef<Set<string>>(new Set());
  // Track client_message_ids we've seen (for broadcast/postgres dedupe)
  const clientMessageIdsRef = useRef<Set<string>>(new Set());
  // Track pending messages for reconciliation
  const pendingMessagesRef = useRef<Map<string, { 
    clientMessageId: string;
    text: string; 
    userId: string; 
    timestamp: number 
  }>>(new Map());
  // Track reconnection attempts for resilience during high traffic
  const broadcastReconnectAttemptsRef = useRef(0);
  const pgReconnectAttemptsRef = useRef(0);

  // Check if user is moderator
  useEffect(() => {
    const checkModerator = async () => {
      if (!user) {
        setIsModerator(false);
        return;
      }
      
      const { data } = await supabase.rpc('can_moderate_chat', {
        _livestream_id: livestreamId,
        _user_id: user.id
      });
      
      setIsModerator(!!data);
    };
    
    checkModerator();
  }, [livestreamId, user]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Load last messages
      const { data: messagesData, count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .eq('livestream_id', livestreamId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_LIMIT);
      
      if (messagesData) {
        const reversed = [...messagesData].reverse();
        messageIdsRef.current = new Set(reversed.map(m => m.id));
        // Track client_message_ids from loaded messages
        reversed.forEach(m => {
          if (m.client_message_id) {
            clientMessageIdsRef.current.add(m.client_message_id);
          }
        });
        setMessages(reversed);
        setHasOlderMessages((count || 0) > MESSAGES_LIMIT);
      }
      
      // Load settings
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
      
      // Check if user is muted
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

  // ============================================
  // CHANNEL A: BROADCAST (instant message delivery)
  // ============================================
  useEffect(() => {
    if (!livestreamId) return;
    
    console.log('[Chat] Setting up BROADCAST channel for:', livestreamId);
    
    const broadcastChannel = supabase.channel(`chat:broadcast:${livestreamId}`, {
      config: {
        broadcast: { self: true }
      }
    });
    
    // Listen for broadcast messages
    broadcastChannel.on('broadcast', { event: 'message' }, (payload) => {
      const broadcastMsg = payload.payload as {
        client_message_id: string;
        livestream_id: string;
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        message: string;
        created_at: string;
      };
      
      console.log('[Chat] Received broadcast message:', broadcastMsg.client_message_id);
      
      // Skip if we already have this message (by client_message_id)
      if (clientMessageIdsRef.current.has(broadcastMsg.client_message_id)) {
        console.log('[Chat] Broadcast already exists, skipping:', broadcastMsg.client_message_id);
        return;
      }
      
      // Skip if this is our own pending message (we already have optimistic version)
      const isOwnPending = Array.from(pendingMessagesRef.current.values())
        .some(p => p.clientMessageId === broadcastMsg.client_message_id);
      
      if (isOwnPending) {
        console.log('[Chat] Broadcast is own pending, skipping:', broadcastMsg.client_message_id);
        return;
      }
      
      // Add to tracking and UI immediately
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
      
      console.log('[Chat] Adding broadcast message to UI');
      setMessages(prev => [...prev, newMessage]);
    });
    
    // Subscribe AFTER registering handlers with reconnection logic
    broadcastChannel.subscribe((status, err) => {
      console.log('[Chat] BROADCAST channel status:', status, err ? `Error: ${err.message}` : '');
      if (status === 'SUBSCRIBED') {
        console.log('[Chat] ✓ BROADCAST channel ready');
        broadcastReconnectAttemptsRef.current = 0; // Reset on success
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Auto-reconnect with exponential backoff
        if (broadcastReconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY_MS * Math.pow(2, broadcastReconnectAttemptsRef.current);
          console.log(`[Chat] BROADCAST reconnecting in ${delay}ms (attempt ${broadcastReconnectAttemptsRef.current + 1})`);
          broadcastReconnectAttemptsRef.current++;
          setTimeout(() => {
            if (broadcastChannelRef.current) {
              supabase.removeChannel(broadcastChannelRef.current);
              broadcastChannelRef.current = null;
            }
            // Force re-subscribe by triggering effect cleanup
          }, delay);
        } else {
          console.error('[Chat] BROADCAST max reconnect attempts reached');
        }
      }
    });
    
    broadcastChannelRef.current = broadcastChannel;
    
    return () => {
      console.log('[Chat] Cleaning up BROADCAST channel');
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
    };
  }, [livestreamId]);
  
  // ============================================
  // CHANNEL B: POSTGRES CHANGES (reconciliation & persistence)
  // ============================================
  useEffect(() => {
    if (!livestreamId) return;
    
    console.log('[Chat] Setting up POSTGRES channel for:', livestreamId);
    
    const pgChannel = supabase.channel(`chat:pg:${livestreamId}`);
    
    // Listen for INSERT (message persistence confirmation)
    pgChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `livestream_id=eq.${livestreamId}`
      },
      (payload) => {
        const dbMessage = payload.new as ChatMessage & { client_message_id?: string };
        console.log('[Chat] PG INSERT:', dbMessage.id, 'client_id:', dbMessage.client_message_id);
        
        // Already have this exact DB message
        if (messageIdsRef.current.has(dbMessage.id)) {
          console.log('[Chat] DB message exists, skipping:', dbMessage.id);
          return;
        }
        
        // Reconcile with pending/broadcast messages
        if (dbMessage.client_message_id) {
          // Find and replace matching pending message
          let foundPending = false;
          for (const [tempId, pendingData] of pendingMessagesRef.current.entries()) {
            if (pendingData.clientMessageId === dbMessage.client_message_id) {
              console.log('[Chat] Replacing pending:', tempId, '-> DB:', dbMessage.id);
              foundPending = true;
              pendingMessagesRef.current.delete(tempId);
              messageIdsRef.current.add(dbMessage.id);
              
              setMessages(prev => prev.map(m => 
                m.id === tempId ? { ...dbMessage, _pending: false, _failed: false } : m
              ));
              break;
            }
          }
          
          // Check for broadcast message to replace
          if (!foundPending) {
            const broadcastId = `broadcast-${dbMessage.client_message_id}`;
            
            setMessages(prev => {
              const hasBroadcast = prev.some(m => m.id === broadcastId);
              if (hasBroadcast) {
                console.log('[Chat] Replacing broadcast:', broadcastId, '-> DB:', dbMessage.id);
                messageIdsRef.current.add(dbMessage.id);
                return prev.map(m => 
                  m.id === broadcastId ? { ...dbMessage, _pending: false, _failed: false } : m
                );
              }
              
              // No matching - add as new (edge case: missed broadcast)
              if (!messageIdsRef.current.has(dbMessage.id)) {
                console.log('[Chat] Adding DB message (no broadcast):', dbMessage.id);
                messageIdsRef.current.add(dbMessage.id);
                return [...prev, { ...dbMessage, _pending: false, _failed: false }];
              }
              
              return prev;
            });
          }
        } else {
          // Legacy message without client_message_id
          console.log('[Chat] Adding legacy DB message:', dbMessage.id);
          messageIdsRef.current.add(dbMessage.id);
          setMessages(prev => [...prev, { ...dbMessage, _pending: false, _failed: false }]);
        }
      }
    );
    
    // Listen for DELETE
    pgChannel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `livestream_id=eq.${livestreamId}`
      },
      (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        console.log('[Chat] Message deleted:', deletedId);
        messageIdsRef.current.delete(deletedId);
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      }
    );
    
    // Listen for settings changes
    pgChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_room_settings',
        filter: `livestream_id=eq.${livestreamId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setSettings(payload.new as ChatSettings);
        }
      }
    );
    
    // IMPORTANT: Subscribe AFTER registering ALL handlers with reconnection logic
    pgChannel.subscribe((status, err) => {
      console.log('[Chat] POSTGRES channel status:', status, err ? `Error: ${err.message}` : '');
      if (status === 'SUBSCRIBED') {
        console.log('[Chat] ✓ POSTGRES channel ready');
        pgReconnectAttemptsRef.current = 0; // Reset on success
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Auto-reconnect with exponential backoff
        if (pgReconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY_MS * Math.pow(2, pgReconnectAttemptsRef.current);
          console.log(`[Chat] POSTGRES reconnecting in ${delay}ms (attempt ${pgReconnectAttemptsRef.current + 1})`);
          pgReconnectAttemptsRef.current++;
          setTimeout(() => {
            if (pgChannelRef.current) {
              supabase.removeChannel(pgChannelRef.current);
              pgChannelRef.current = null;
            }
          }, delay);
        } else {
          console.error('[Chat] POSTGRES max reconnect attempts reached');
        }
      }
    });
    
    pgChannelRef.current = pgChannel;
    
    return () => {
      console.log('[Chat] Cleaning up POSTGRES channel');
      if (pgChannelRef.current) {
        supabase.removeChannel(pgChannelRef.current);
        pgChannelRef.current = null;
      }
    };
  }, [livestreamId]);

  // Get user profile for display name and avatar
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
      toast({
        title: t.chat.signInToChat,
        variant: "destructive"
      });
      return false;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage || trimmedMessage.length > 500) {
      return false;
    }

    // Check mute status
    if (userMute && new Date(userMute.muted_until) > new Date()) {
      toast({
        title: t.chat.youAreMuted,
        variant: "destructive"
      });
      return false;
    }

    // Check if chat is enabled
    if (settings && !settings.is_chat_enabled) {
      toast({
        title: t.chat.chatDisabled,
        variant: "destructive"
      });
      return false;
    }

    const profile = await getUserProfile();
    const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
    const avatarUrl = profile?.avatar_url || null;

    // Generate client_message_id for dedupe
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

    console.log('[Chat] Adding optimistic message:', tempId, 'client_id:', clientMessageId);
    
    // Track pending message for reconciliation
    pendingMessagesRef.current.set(tempId, {
      clientMessageId,
      text: trimmedMessage,
      userId: user.id,
      timestamp: Date.now()
    });
    clientMessageIdsRef.current.add(clientMessageId);
    
    // Immediately add to UI
    setMessages(prev => [...prev, optimisticMessage]);

    // 1. Send broadcast IMMEDIATELY via BROADCAST channel
    const broadcastChannel = broadcastChannelRef.current;
    if (broadcastChannel) {
      console.log('[Chat] Sending broadcast via channel');
      broadcastChannel.send({
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
      }).then(() => {
        console.log('[Chat] Broadcast sent successfully');
      }).catch((err) => {
        console.error('[Chat] Broadcast error:', err);
      });
    } else {
      console.warn('[Chat] Broadcast channel not available - message will rely on Postgres changes');
    }

    // 2. Persist to DB (in parallel)
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
      console.error('[Chat] Error persisting message:', error);
      
      // Mark as failed
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m
      ));
      
      if (error.message.includes('can_send_chat_message')) {
        toast({
          title: t.chat.slowModeWait,
          variant: "destructive"
        });
      } else {
        toast({
          title: t.chat.sendError,
          variant: "destructive"
        });
      }
      return false;
    }

    console.log('[Chat] Message persisted successfully, waiting for Postgres change to confirm');
    return true;
  }, [user, userMute, settings, livestreamId, toast, t]);

  const retryMessage = useCallback(async (tempId: string, message: string): Promise<boolean> => {
    // Remove the failed message first
    const pendingData = pendingMessagesRef.current.get(tempId);
    if (pendingData) {
      clientMessageIdsRef.current.delete(pendingData.clientMessageId);
    }
    
    setMessages(prev => prev.filter(m => m.id !== tempId));
    pendingMessagesRef.current.delete(tempId);
    
    // Send again
    return sendMessage(message);
  }, [sendMessage]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    // Optimistic delete
    setMessages(prev => prev.filter(m => m.id !== messageId));
    messageIdsRef.current.delete(messageId);
    
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('[Chat] Error deleting message:', error);
      toast({
        title: t.common.error,
        variant: "destructive"
      });
      return false;
    }

    return true;
  }, [toast, t]);

  const updateSettings = useCallback(async (
    updates: Partial<Pick<ChatSettings, 'is_chat_enabled' | 'slow_mode_seconds'>>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('chat_room_settings')
      .upsert({
        livestream_id: livestreamId,
        ...updates,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('[Chat] Error updating settings:', error);
      toast({
        title: t.common.error,
        variant: "destructive"
      });
      return false;
    }

    return true;
  }, [livestreamId, toast, t]);

  const muteUser = useCallback(async (
    userId: string,
    durationMinutes: number,
    reason?: string
  ): Promise<boolean> => {
    const mutedUntil = new Date();
    mutedUntil.setMinutes(mutedUntil.getMinutes() + durationMinutes);

    const { error } = await supabase
      .from('chat_mutes')
      .upsert({
        livestream_id: livestreamId,
        user_id: userId,
        muted_until: mutedUntil.toISOString(),
        reason
      });

    if (error) {
      console.error('[Chat] Error muting user:', error);
      toast({
        title: t.common.error,
        variant: "destructive"
      });
      return false;
    }

    toast({
      title: t.chat.userMuted
    });
    return true;
  }, [livestreamId, toast, t]);

  const unmuteUser = useCallback(async (muteId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('chat_mutes')
      .delete()
      .eq('id', muteId);

    if (error) {
      console.error('[Chat] Error unmuting user:', error);
      return false;
    }

    return true;
  }, []);

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
        if (m.client_message_id) {
          clientMessageIdsRef.current.add(m.client_message_id);
        }
      });
      setMessages(prev => [...reversed, ...prev]);
      setHasOlderMessages((count || 0) > MESSAGES_LIMIT);
    } else {
      setHasOlderMessages(false);
    }
  }, [messages, livestreamId]);

  return {
    messages,
    settings,
    userMute,
    isLoading,
    isModerator,
    hasOlderMessages,
    sendMessage,
    retryMessage,
    deleteMessage,
    updateSettings,
    muteUser,
    unmuteUser,
    loadOlderMessages
  };
};
