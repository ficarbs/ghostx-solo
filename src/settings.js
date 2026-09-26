// Player preferences (volume, screen shake), stored separately from the save file.
import { setVolumes } from './audio.js';

const KEY = 'ghostx-solo-settings';
// touch: 'auto' shows on-screen controls on touch devices; 'on' / 'off' force it.
export const settings = { master: 0.7, music: 0.5, sfx: 0.8, shake: true, touch: 'auto' };

export function loadSettings() {
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {
    /* storage unavailable: keep defaults */
  }
  setVolumes(settings);
}

export function updateSetting(k, v) {
  settings[k] = v;
  setVolumes(settings);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}
