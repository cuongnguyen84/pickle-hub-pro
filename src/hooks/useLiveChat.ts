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
  _pending?: boolean; // Local optimistic flag
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
  sendMessage: (message: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  updateSettings: (updates: Partial<Pick<ChatSettings, 'is_chat_enabled' | 'slow_mode_seconds'>>) => Promise<boolean>;
  muteUser: (userId: string, durationMinutes: number, reason?: string) => Promise<boolean>;
  unmuteUser: (muteId: string) => Promise<boolean>;
}

export const useLiveChat = (livestreamId: string): UseLiveChatResult => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [userMute, setUserMute] = useState<ChatMute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModerator, setIsModerator] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const pendingMessagesRef = useRef<Map<string, { text: string; userId: string; timestamp: number }>>(new Map());

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
      
      // Load last 50 messages
      const { data: messagesData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('livestream_id', livestreamId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (messagesData) {
        // Initialize message IDs set
        messageIdsRef.current = new Set(messagesData.map(m => m.id));
        setMessages(messagesData);
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

  // Subscribe to realtime updates
  useEffect(() => {
    console.log('[Chat] Setting up realtime subscription for:', livestreamId);
    
    channelRef.current = supabase
      .channel(`chat-${livestreamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `livestream_id=eq.${livestreamId}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          console.log('[Chat] Received new message via realtime:', newMessage.id);
          
          // Check if we already have this message (dedupe)
          if (messageIdsRef.current.has(newMessage.id)) {
            console.log('[Chat] Message already exists, skipping:', newMessage.id);
            return;
          }
          
          // Check if this message matches a pending message (optimistic update)
          let matchedPendingId: string | null = null;
          const now = Date.now();
          
          for (const [pendingId, pendingData] of pendingMessagesRef.current.entries()) {
            // Match by user_id, message text, and within 10 seconds
            if (
              pendingData.userId === newMessage.user_id &&
              pendingData.text === newMessage.message &&
              now - pendingData.timestamp < 10000
            ) {
              matchedPendingId = pendingId;
              break;
            }
          }
          
          if (matchedPendingId) {
            console.log('[Chat] Replacing pending message:', matchedPendingId, 'with real:', newMessage.id);
            // Remove from pending tracking
            pendingMessagesRef.current.delete(matchedPendingId);
            
            // Replace pending with real message
            setMessages(prev => {
              const updated = prev.map(m => 
                m.id === matchedPendingId ? { ...newMessage, _pending: false } : m
              );
              messageIdsRef.current.add(newMessage.id);
              return updated;
            });
          } else {
            // New message from another user or system
            console.log('[Chat] Adding new message from realtime:', newMessage.id);
            messageIdsRef.current.add(newMessage.id);
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `livestream_id=eq.${livestreamId}`
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          console.log('[Chat] Message deleted via realtime:', deletedId);
          messageIdsRef.current.delete(deletedId);
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .on(
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
      )
      .subscribe((status) => {
        console.log('[Chat] Subscription status:', status);
      });

    return () => {
      console.log('[Chat] Cleaning up realtime subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [livestreamId]);

  // Get user profile for display name
  const getUserProfile = async () => {
    if (!user) return null;
    
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
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

    // Create optimistic message with temporary ID
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      livestream_id: livestreamId,
      user_id: user.id,
      display_name: displayName,
      avatar_url: null,
      message: trimmedMessage,
      created_at: new Date().toISOString(),
      _pending: true
    };

    console.log('[Chat] Adding optimistic message:', tempId);
    
    // Track pending message for reconciliation
    pendingMessagesRef.current.set(tempId, {
      text: trimmedMessage,
      userId: user.id,
      timestamp: Date.now()
    });
    
    // Immediately add to UI
    setMessages(prev => [...prev, optimisticMessage]);

    // Send to server
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        livestream_id: livestreamId,
        user_id: user.id,
        display_name: displayName,
        message: trimmedMessage
      });

    if (error) {
      console.error('[Chat] Error sending message:', error);
      
      // Remove optimistic message on failure
      pendingMessagesRef.current.delete(tempId);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      // Show error toast
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

    console.log('[Chat] Message sent successfully, waiting for realtime to confirm');
    return true;
  }, [user, userMute, settings, livestreamId, toast, t]);

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
      // Note: Could refetch messages here to restore, but realtime should handle it
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

  return {
    messages,
    settings,
    userMute,
    isLoading,
    isModerator,
    sendMessage,
    deleteMessage,
    updateSettings,
    muteUser,
    unmuteUser
  };
};
