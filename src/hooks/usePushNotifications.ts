/**
 * Push Notifications Hook
 * 
 * Handles:
 * 1. Requesting permission (deferred until meaningful interaction)
 * 2. Registering device token to database
 * 3. Handling incoming notifications (foreground + tap)
 * 4. Deep linking from notification tap
 */
import { useEffect, useRef, useCallback } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, getPlatform } from '@/lib/capacitor-utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Store the latest token so we can save it once user is available
let pendingToken: string | null = null;

export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  // Save token to database
  const saveToken = useCallback(async (token: string) => {
    if (!user?.id) {
      console.log('[Push] No user yet, storing pending token');
      pendingToken = token;
      return;
    }

    const platform = getPlatform();
    console.log('[Push] Saving token for platform:', platform, 'user:', user.id);

    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: user.id,
            token,
            platform,
          },
          { onConflict: 'user_id,token' }
        );

      if (error) {
        console.error('[Push] Error saving token:', error);
      } else {
        console.log('[Push] Token saved successfully');
        pendingToken = null;
      }
    } catch (e) {
      console.error('[Push] Exception saving token:', e);
    }
  }, [user?.id]);

  // When user becomes available, save any pending token
  useEffect(() => {
    if (user?.id && pendingToken) {
      console.log('[Push] User now available, saving pending token');
      saveToken(pendingToken);
    }
  }, [user?.id, saveToken]);

  // Handle notification tap - navigate to relevant page
  const handleNotificationTap = useCallback((data: Record<string, unknown>) => {
    console.log('[Push] Notification tapped, data:', data);

    const entityType = data.entity_type as string;
    const entityId = data.entity_id as string;
    const relatedId = data.related_id as string;

    if (!entityType) return;

    switch (entityType) {
      case 'organization':
        if (relatedId) {
          navigate(`/livestream/${relatedId}`);
        }
        break;
      case 'tournament':
        if (relatedId) {
          navigate(`/livestream/${relatedId}`);
        }
        break;
      default:
        navigate('/notifications');
    }
  }, [navigate]);

  // Single setup: request permission, register, and listen for all events
  useEffect(() => {
    if (!isNativeApp() || registeredRef.current) return;
    registeredRef.current = true;

    console.log('🚀 INIT PUSH');

    let regListener: { remove: () => void } | undefined;
    let errListener: { remove: () => void } | undefined;
    let foregroundListener: { remove: () => void } | undefined;
    let tapListener: { remove: () => void } | undefined;

    const setup = async () => {
      // Set up ALL listeners BEFORE calling register()
      regListener = await PushNotifications.addListener('registration', (token) => {
        console.log('🔥 FCM TOKEN:', token.value);
        saveToken(token.value);
      });

      errListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error('❌ Registration error:', err);
      });

      foregroundListener = await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('[Push] Foreground notification:', notification);
          toast(notification.title || 'Thông báo mới', {
            description: notification.body,
            action: notification.data?.entity_type
              ? {
                  label: 'Xem',
                  onClick: () => handleNotificationTap(notification.data || {}),
                }
              : undefined,
          });
        }
      );

      tapListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          console.log('[Push] Notification action:', action);
          handleNotificationTap(action.notification.data || {});
        }
      );

      // NOW request permission and register
      const result = await PushNotifications.requestPermissions();
      console.log('Permission result:', result);

      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    };

    setup();

    return () => {
      regListener?.remove();
      errListener?.remove();
      foregroundListener?.remove();
      tapListener?.remove();
    };
  }, [saveToken, handleNotificationTap]);

  /**
   * Remove token when user logs out
   */
  const removeToken = useCallback(async (token: string) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);
      console.log('[Push] Token removed');
    } catch (e) {
      console.error('[Push] Error removing token:', e);
    }
  }, [user?.id]);

  return {
    removeToken,
  };
};
