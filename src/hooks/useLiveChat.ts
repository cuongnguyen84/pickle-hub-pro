// Barrel re-export - useLiveChat combines useChatMessages + useChatModeration
// Types are still exported from here for backward compatibility

import { useChatMessages } from "./useChatMessages";
import { useChatModeration } from "./useChatModeration";

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

export const useLiveChat = (livestreamId: string): UseLiveChatResult => {
  const {
    messages,
    isLoading,
    hasOlderMessages,
    sendMessage,
    retryMessage,
    deleteMessage,
    loadOlderMessages,
    settings,
    userMute,
  } = useChatMessages(livestreamId);

  const {
    isModerator,
    updateSettings,
    muteUser,
    unmuteUser,
  } = useChatModeration(livestreamId);

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
    loadOlderMessages,
  };
};
