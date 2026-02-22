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
          // Livestream notification - go to livestream
          navigate(`/livestream/${relatedId}`);
        }
        break;
      case 'tournament':
        if (relatedId) {
          navigate(`/livestream/${relatedId}`);
        }
        break;
      default:
        // Fallback to notifications page
        navigate('/notifications');
    }
  }, [navigate]);

  // Register push notification listeners
  useEffect(() => {
    if (!isNativeApp() || !user?.id) return;

    let cleanup: (() => void) | undefined;

    const setupListeners = async () => {
      // Listen for registration success
      const regListener = await PushNotifications.addListener('registration', (token) => {
        console.log('[Push] Registration token:', token.value);
        saveToken(token.value);
      });

      // Listen for registration errors
      const regErrorListener = await PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
      });

      // Listen for notifications received in foreground
      const foregroundListener = await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('[Push] Foreground notification:', notification);
          // Show a toast for foreground notifications
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

      // Listen for notification taps (app opened from notification)
      const tapListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          console.log('[Push] Notification action:', action);
          handleNotificationTap(action.notification.data || {});
        }
      );

      cleanup = () => {
        regListener.remove();
        regErrorListener.remove();
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
   * Request push notification permission
   * Call this at a meaningful moment (e.g., after user follows something)
   * to avoid Apple rejection for premature permission requests
   */
  const requestPermission = useCallback(async () => {
    if (!isNativeApp() || permissionRequested) return false;

    try {
      const permStatus = await PushNotifications.checkPermissions();
      console.log('[Push] Current permission:', permStatus.receive);

      if (permStatus.receive === 'granted') {
        // Already granted, just register
        if (!registeredRef.current) {
          await PushNotifications.register();
          registeredRef.current = true;
        }
        return true;
      }

      if (permStatus.receive === 'denied') {
        console.log('[Push] Permission denied previously');
        return false;
      }

      // Request permission
      permissionRequested = true;
      const result = await PushNotifications.requestPermissions();
      console.log('[Push] Permission result:', result.receive);

      if (result.receive === 'granted') {
        await PushNotifications.register();
        registeredRef.current = true;
        return true;
      }

      return false;
    } catch (e) {
      console.error('[Push] Permission request error:', e);
      return false;
    }
  }, []);

  /**
   * Auto-register if permission was previously granted
   * Safe to call on app start
   */
  const autoRegisterIfGranted = useCallback(async () => {
    if (!isNativeApp() || !user?.id || registeredRef.current) return;

    try {
      const permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'granted') {
        console.log('[Push] Auto-registering (permission previously granted)');
        await PushNotifications.register();
        registeredRef.current = true;
      }
    } catch (e) {
      console.error('[Push] Auto-register error:', e);
    }
  }, [user?.id]);

  // Auto-register on mount if permission already granted
  useEffect(() => {
    autoRegisterIfGranted();
  }, [autoRegisterIfGranted]);

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
    requestPermission,
    removeToken,
  };
};
