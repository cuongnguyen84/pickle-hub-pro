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

// Track if we've already requested permission this session
let permissionRequested = false;

export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  // Eager push init - request permission & register immediately on native app start
  useEffect(() => {
    if (!isNativeApp()) return;

    console.log('🚀 INIT PUSH');

    PushNotifications.requestPermissions().then(result => {
      console.log('Permission result:', result);

      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });

    PushNotifications.addListener('registration', token => {
      console.log('🔥 FCM TOKEN:', token.value);
    });

    PushNotifications.addListener('registrationError', err => {
      console.error('❌ Registration error:', err);
    });
  }, []);

  // Save token to database
  const saveToken = useCallback(async (token: string) => {
    if (!user?.id) return;

    const platform = getPlatform();
    console.log('[Push] Saving token for platform:', platform);

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
      }
    } catch (e) {
      console.error('[Push] Exception saving token:', e);
    }
  }, [user?.id]);

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

  // Register push notification listeners (for saving token + handling notifications)
  useEffect(() => {
    if (!isNativeApp() || !user?.id) return;

    let cleanup: (() => void) | undefined;

    const setupListeners = async () => {
      // Listen for registration success - save token to DB
      const regListener = await PushNotifications.addListener('registration', (token) => {
        console.log('[Push] Registration token (saving):', token.value);
        saveToken(token.value);
      });

      // Listen for notifications received in foreground
      const foregroundListener = await PushNotifications.addListener(
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

      // Listen for notification taps
      const tapListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          console.log('[Push] Notification action:', action);
          handleNotificationTap(action.notification.data || {});
        }
      );

      cleanup = () => {
        regListener.remove();
        foregroundListener.remove();
        tapListener.remove();
      };
    };

    setupListeners();

    return () => {
      cleanup?.();
    };
  }, [user?.id, saveToken, handleNotificationTap]);

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
