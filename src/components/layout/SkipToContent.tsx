import { useI18n } from '@/i18n';

// A11Y-01: first tabbable element on every page. Visually hidden until
// keyboard focus, then jumps past the fixed header/bottom-nav chrome to
// the routed content wrapper (#main-content in App.tsx).
export function SkipToContent() {
  const { language } = useI18n();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      onClick={(e) => {
        // Move real focus, not just the scroll position, so the next Tab
        // continues inside the content instead of back into the chrome.
        e.preventDefault();
        const main = document.getElementById('main-content');
        if (main) {
          main.focus();
          main.scrollIntoView({ block: 'start' });
        }
      }}
    >
      {language === 'vi' ? 'Bỏ qua, đến nội dung chính' : 'Skip to main content'}
    </a>
  );
}
