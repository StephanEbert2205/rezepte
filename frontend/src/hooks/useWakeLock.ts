/**
 * Aktiviert den Screen Wake Lock, solange `active` true ist.
 *
 * - Funktioniert auf Smartphones, Tablets und Desktop-Browsern,
 *   die die Screen Wake Lock API unterstützen (Chrome 84+, Safari 16.4+, Firefox 126+).
 * - Ist die API nicht verfügbar, passiert still nothing.
 * - Der Lock wird bei Tab-Wechsel/Minimieren automatisch aufgehoben und
 *   bei Rückkehr zum Tab automatisch neu beantragt.
 */
import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    // Feature-Detection – ältere Browser überspringen
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    };
    if (!active || !nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        // Fehler ignorieren (z.B. Permission Denied, Systemeinschränkung)
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquire();
      }
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
