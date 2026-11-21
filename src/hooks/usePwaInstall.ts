import { useCallback, useEffect, useState } from 'react';
import { detectPwaPlatform, isStandaloneDisplayMode, type PwaPlatform } from '../lib/pwa';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export interface UsePwaInstallResult {
  canNativeInstall: boolean;
  isInstalled: boolean;
  platform: PwaPlatform;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'manual'>;
}

/**
 * Track PWA installability, standalone display mode, and native install prompt triggers.
 */
export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneDisplayMode());
  const [platform] = useState<PwaPlatform>(() => detectPwaPlatform());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const onDisplayChange = () => {
      setIsInstalled(isStandaloneDisplayMode());
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    mediaQuery?.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      mediaQuery?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (!deferredPrompt) {
      return 'manual';
    }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      return choice.outcome;
    } catch {
      return 'manual';
    }
  }, [deferredPrompt]);

  return {
    canNativeInstall: deferredPrompt !== null,
    isInstalled,
    platform,
    promptInstall,
  };
}
