// @ts-check
/**
 * @fileoverview Observable Centralized Application State Store
 */
export class StateStore {
  /**
   * @param {Record<string, any>} initialState
   */
  constructor(initialState) {
    this._state = { ...initialState };
    /** @type {Map<string, Set<Function>>} */
    this._subscribers = new Map();
  }

  /**
   * @returns {Readonly<Record<string, any>>}
   */
  getState() {
    return Object.freeze({ ...this._state });
  }

  /**
   * @param {Record<string, any>} updates
   */
  setState(updates) {
    const prevState = { ...this._state };
    this._state = Object.assign(this._state, updates);

    Object.keys(updates).forEach(key => {
      if (this._subscribers.has(key)) {
        const callbacks = this._subscribers.get(key);
        if (callbacks) {
          callbacks.forEach(cb => cb(this._state[key], prevState[key]));
        }
      }
    });
  }

  /**
   * @param {string} key
   * @param {Function} callback
   * @returns {() => void} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, new Set());
    }
    const set = this._subscribers.get(key);
    if (set) set.add(callback);
    return () => {
      const current = this._subscribers.get(key);
      if (current) current.delete(callback);
    };
  }
}

export const store = new StateStore({
  theme: 'light',
  engineStatus: 'idle', // 'idle' | 'running' | 'paused' | 'error'
  inputSource: 'room_indoors',
  selectedDeviceId: 'default',
  passthrough: true,
  noiseColor: 'pink',
  activeRoomPreset: 'standard',
  enableCoreParams: true,
  enableSecondaryParams: true,
  shiftHz: 0.0,
  lfoShape: 0,
  lfoRange: 0.0,
  lfoDuration: 1.0,
  lfoPolarity: 0,
  dryWet: 1.0,
  silenceVoids: false,
  masterGain: 0.85,
  soundConfirmed: false,
  peakDb: -Infinity,
  activePresetKey: ''
});
