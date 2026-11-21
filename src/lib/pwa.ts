export type PwaPlatform = 'ios' | 'android' | 'desktop';

/**
 * Identify client OS family for tailored PWA install guidance.
 */
export function detectPwaPlatform(userAgent?: string): PwaPlatform {
  const ua =
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

/**
 * Return true when running inside an installed standalone PWA window.
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaMatch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return mediaMatch || iosStandalone;
}

/**
 * Register the production service worker without interfering with local Vite HMR.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Non-fatal in private browsing or restricted embeds
    });
  });
}
