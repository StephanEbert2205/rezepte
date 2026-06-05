/**
 * PWA-Installationsprompt-Hook.
 *
 * Unterstützte Browser:
 *   • Chrome / Edge / Samsung Internet (Android & Desktop): `beforeinstallprompt`-Event
 *     Kommt der Event nicht (z.B. nach Deinstallation + Abklingzeit), wird 'manual'
 *     zurückgegeben und eine Browser-Menü-Anleitung angezeigt.
 *   • iOS Safari: kein nativer Prompt – stattdessen Anleitung "Teilen → Zum Home-Bildschirm"
 *   • Andere Browser: nichts anzeigen
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallStatus =
  | 'installable'   // beforeinstallprompt verfügbar → direkter Install-Button
  | 'ios'           // iOS Safari → Share-Menü-Anleitung
  | 'manual'        // Chromium-Browser, aber kein automatischer Prompt (Abklingzeit o.ä.) → Browser-Menü-Anleitung
  | 'installed'     // App läuft bereits im Standalone-Modus
  | 'unavailable';  // Firefox o.ä. – nichts anzeigen

/** Gibt zurück, ob der aktuelle Browser Chromium-basiert ist (Chrome, Edge, Samsung, Opera …). */
function isChromiumBrowser(): boolean {
  const ua = navigator.userAgent;
  return (
    /chrome|chromium|crios|samsung browser|edg|opr/i.test(ua) &&
    !/firefox|fxios/i.test(ua)
  );
}

/** Gibt zurück, ob es sich um ein Android-Gerät handelt. */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<InstallStatus>('unavailable');

  useEffect(() => {
    // Bereits installiert? (standalone mode)
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const iOSStandalone   = (navigator as { standalone?: boolean }).standalone === true;

    if (standaloneQuery.matches || iOSStandalone) {
      setStatus('installed');
      return;
    }

    // iOS Safari erkennen (kein beforeinstallprompt)
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      && !('MSStream' in window); // Edge-on-iOS herausfiltern
    const isSafari = /safari/i.test(navigator.userAgent)
      && !/chrome|crios|android/i.test(navigator.userAgent);

    if (isIos && isSafari) {
      setStatus('ios');
      return;
    }

    // Chromium-Browser: auf beforeinstallprompt warten.
    // Kommt der Event nicht (Abklingzeit nach Deinstallation), zeigen wir
    // trotzdem eine manuelle Anleitung – daher sofort 'manual' setzen und
    // bei Event-Eingang auf 'installable' upgraden.
    if (isChromiumBrowser()) {
      setStatus('manual');
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setStatus('installable');
    };

    const onInstalled = () => {
      setStatus('installed');
      setPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setStatus('installed');
      setPrompt(null);
    }
    return outcome === 'accepted';
  };

  return { status, install };
}
