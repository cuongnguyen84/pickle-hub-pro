import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/utils/ga';

/**
 * Hook to track page views on route changes
 * Only triggers once per route change, not on every render
 */
export const usePageTracking = (): void => {
  const location = useLocation();
  const prevPathRef = useRef<string>('');

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Only track if path actually changed
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      trackPageView(location.pathname);
    }
  }, [location]);
};
