import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** Keep initial structured data for pages without a client schema component.
 * Remove it on navigation so a different route cannot inherit the old entity.
 */
export function PublicSeoHandoff(): null {
  const { pathname } = useLocation();
  const initialPath = useRef(pathname);
  useLayoutEffect(() => {
    if (pathname !== initialPath.current) {
      document.querySelectorAll('script[data-public-seo]').forEach((node) => node.remove());
    }
  }, [pathname]);
  return null;
}
