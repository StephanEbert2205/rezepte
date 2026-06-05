/**
 * Persistente App-Einstellungen im localStorage.
 * Rein client-seitig – kein Backend erforderlich.
 */

export interface AppSettings {
  /** Display im Kochmodus nicht ausschalten (Screen Wake Lock API). Standard: true. */
  keepScreenAwake: boolean;
}

const STORAGE_KEY = 'rz_settings';

const DEFAULTS: AppSettings = {
  keepScreenAwake: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore (z.B. Private-Mode-Beschränkungen)
  }
}
