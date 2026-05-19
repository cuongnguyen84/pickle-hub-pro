import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { ChatSettings } from "./useLiveChat";

interface UseChatModerationResult {
  isModerator: boolean;
  updateSettings: (updates: Partial<Pick<ChatSettings, 'is_chat_enabled' | 'slow_mode_seconds'>>) => Promise<boolean>;
  muteUser: (userId: string, durationMinutes: number, reason?: string) => Promise<boolean>;
  unmuteUser: (muteId: string) => Promise<boolean>;
}

export function useChatModeration(livestreamId: string): UseChatModerationResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [isModerator, setIsModerator] = useState(false);

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
      toast({ title: t.common.error, variant: "destructive" });
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
      toast({ title: t.common.error, variant: "destructive" });
      return false;
    }

    toast({ title: t.chat.userMuted });
    return true;
  }, [livestreamId, toast, t]);

  const unmuteUser = useCallback(async (muteId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('chat_mutes')
      .delete()
      .eq('id', muteId);

    if (error) return false;
    return true;
  }, []);

  return { isModerator, updateSettings, muteUser, unmuteUser };
}
