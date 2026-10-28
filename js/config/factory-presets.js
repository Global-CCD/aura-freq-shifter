// @ts-check
/**
 * @fileoverview Pure Data Registry for Factory Sound Design Presets
 */

/** @type {Record<string, import('../types/audio-types.js').FactoryPresetDefinition>} */
export const FACTORY_PRESETS = {
  vocal_chorus: {
    name: "Subtle Vocal Doubler / Chorus",
    shiftHz: 3, lfoShape: 0, lfoDepth: 2.0, lfoRate: 0.5, lfoPolarity: 0,
    dryWet: 0.5, space: "office", silenceVoids: 0,
    desc: "Dimensional micro-pitch drift and warm residential early reflections for vocals."
  },
  sci_fi_void: {
    name: "Deep Sci-Fi Void Resonator",
    shiftHz: -150, lfoShape: 4, lfoDepth: 50.0, lfoRate: 2.0, lfoPolarity: 1,
    dryWet: 1.0, space: "cathedral", silenceVoids: 1,
    desc: "Cavernous pitch dive with brickwall 4th-order zero-energy voids at 1–2k and 8.5–9.5k."
  },
  passthrough_clean: {
    name: "Acoustic Room Normalizer",
    shiftHz: 0, lfoShape: 0, lfoDepth: 0.0, lfoRate: 1.0, lfoPolarity: 0,
    dryWet: 0.0, space: "standard", silenceVoids: 0,
    desc: "Transparent linear dry passthrough for acoustic baseline testing."
  },
  spectral_disrupter: {
    name: "Wideband Ring-Mod Disrupter",
    shiftHz: 750, lfoShape: 1, lfoDepth: 250.0, lfoRate: 5.0, lfoPolarity: 0,
    dryWet: 0.9, space: "auditorium", silenceVoids: 1,
    desc: "Fast non-harmonic frequency sweeping with dual speech/sibilance voids."
  },
  whisper_pod: {
    name: "Whisper Isolation Pod",
    shiftHz: 10, lfoShape: 5, lfoDepth: 5.0, lfoRate: 1.0, lfoPolarity: 0,
    dryWet: 0.75, space: "micro_helmet", silenceVoids: 0,
    desc: "Cranial 0.08 m³ boundary reflection damping with gentle stochastic jitter."
  },
  void_sieve: {
    name: "Pure Spectral Void Sieve",
    shiftHz: 0, lfoShape: 0, lfoDepth: 0.0, lfoRate: 1.0, lfoPolarity: 0,
    dryWet: 1.0, space: "standard", silenceVoids: 1,
    desc: "0 Hz neutral passthrough with absolute zero-energy voids at 1–2 kHz and 8.5–9.5 kHz."
  }
};
