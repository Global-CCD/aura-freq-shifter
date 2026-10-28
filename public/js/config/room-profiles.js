// @ts-check
/**
 * @fileoverview Pure Data Registry for 15-Profile Spatial Continuum
 */

/** @type {Record<import('../types/audio-types.js').SpacePresetKey, import('../types/audio-types.js').SpaceProfileDefinition>} */
export const ROOM_PROFILES = {
  // Indoor Enclosed Architecture
  micro_helmet: {
    isOutdoor: false, resonanceFreq: 1150, resonanceQ: 3.2, airGain: 0.12,
    irLengthSec: 0.06, decayRate: 0.008, preDelaySamples: 0,
    itdSec: 0.0003, reflectionGain: 0.45, hfDamping: 0.00, bassWarmth: 0.85
  },
  cockpit: {
    isOutdoor: false, resonanceFreq: 720, resonanceQ: 2.6, airGain: 0.14,
    irLengthSec: 0.12, decayRate: 0.016, preDelaySamples: 96,
    itdSec: 0.0008, reflectionGain: 0.42, hfDamping: 0.00, bassWarmth: 0.90
  },
  booth: {
    isOutdoor: false, resonanceFreq: 520, resonanceQ: 2.2, airGain: 0.16,
    irLengthSec: 0.18, decayRate: 0.025, preDelaySamples: 0,
    itdSec: 0.0012, reflectionGain: 0.40, hfDamping: 0.00, bassWarmth: 0.95
  },
  office: {
    isOutdoor: false, resonanceFreq: 240, resonanceQ: 1.6, airGain: 0.19,
    irLengthSec: 0.45, decayRate: 0.065, preDelaySamples: 288,
    itdSec: 0.0025, reflectionGain: 0.38, hfDamping: 0.08, bassWarmth: 1.05
  },
  standard: {
    isOutdoor: false, resonanceFreq: 175, resonanceQ: 1.4, airGain: 0.22,
    irLengthSec: 0.75, decayRate: 0.12, preDelaySamples: 0,
    itdSec: 0.0035, reflectionGain: 0.35, hfDamping: 0.00, bassWarmth: 1.00
  },
  auditorium: {
    isOutdoor: false, resonanceFreq: 95, resonanceQ: 1.1, airGain: 0.26,
    irLengthSec: 2.2, decayRate: 0.35, preDelaySamples: 1056,
    itdSec: 0.0080, reflectionGain: 0.32, hfDamping: 0.25, bassWarmth: 1.15
  },
  cathedral: {
    isOutdoor: false, resonanceFreq: 48, resonanceQ: 0.8, airGain: 0.32,
    irLengthSec: 6.0, decayRate: 0.95, preDelaySamples: 2160,
    itdSec: 0.0150, reflectionGain: 0.28, hfDamping: 0.50, bassWarmth: 1.30
  },
  hangar: {
    isOutdoor: false, resonanceFreq: 34, resonanceQ: 0.7, airGain: 0.36,
    irLengthSec: 7.8, decayRate: 1.25, preDelaySamples: 3120,
    itdSec: 0.0220, reflectionGain: 0.25, hfDamping: 0.70, bassWarmth: 1.40
  },
  subterranean_vault: {
    isOutdoor: false, resonanceFreq: 28, resonanceQ: 0.65, airGain: 0.38,
    irLengthSec: 9.5, decayRate: 1.50, preDelaySamples: 3600,
    itdSec: 0.0280, reflectionGain: 0.24, hfDamping: 0.80, bassWarmth: 1.50
  },

  // Outdoor Open-Air Environments
  urban_balcony: {
    isOutdoor: true, resonanceFreq: 180, resonanceQ: 0.9, airGain: 0.18,
    irLengthSec: 0.55, decayRate: 0.07, preDelaySamples: 384,
    itdSec: 0.0040, reflectionGain: 0.35, hfDamping: 0.15, bassWarmth: 0.90
  },
  amphitheater: {
    isOutdoor: true, resonanceFreq: 110, resonanceQ: 0.75, airGain: 0.22,
    irLengthSec: 1.6, decayRate: 0.22, preDelaySamples: 1200,
    itdSec: 0.0120, reflectionGain: 0.30, hfDamping: 0.35, bassWarmth: 0.95
  },
  forest_clearing: {
    isOutdoor: true, resonanceFreq: 85, resonanceQ: 0.6, airGain: 0.25,
    irLengthSec: 2.5, decayRate: 0.35, preDelaySamples: 1920,
    itdSec: 0.0180, reflectionGain: 0.28, hfDamping: 0.55, bassWarmth: 1.05
  },
  quarry: {
    isOutdoor: true, resonanceFreq: 55, resonanceQ: 0.65, airGain: 0.30,
    irLengthSec: 5.5, decayRate: 0.85, preDelaySamples: 2880,
    itdSec: 0.0250, reflectionGain: 0.26, hfDamping: 0.65, bassWarmth: 1.20
  },
  alpine_valley: {
    isOutdoor: true, resonanceFreq: 32, resonanceQ: 0.5, airGain: 0.35,
    irLengthSec: 9.0, decayRate: 1.45, preDelaySamples: 4320,
    itdSec: 0.0350, reflectionGain: 0.22, hfDamping: 0.85, bassWarmth: 1.35
  },
  mega_canyon: {
    isOutdoor: true, resonanceFreq: 18, resonanceQ: 0.45, airGain: 0.40,
    irLengthSec: 12.5, decayRate: 2.10, preDelaySamples: 5760,
    itdSec: 0.0450, reflectionGain: 0.19, hfDamping: 0.95, bassWarmth: 1.55
  }
};

/** @type {Record<import('../types/audio-types.js').SpacePresetKey, string>} */
export const ROOM_METADATA = {
  micro_helmet: "INDOOR: Volume: ~0.08 m³ | RT60: 0.02s | Cavity Resonance: 1,150 Hz | ITD: 0.3ms (Cranial Pod - INDOOR ABSOLUTE MIN)",
  cockpit: "INDOOR: Volume: ~1.2 m³ | RT60: 0.05s | Cavity Resonance: 720 Hz | ITD: 0.8ms (Aircraft Cockpit / Kiosk)",
  booth: "INDOOR: Volume: ~2.5 m³ | RT60: 0.08s | Cavity Resonance: 520 Hz | ITD: 1.2ms (Ultra-Damped Vocal Isolation Pod)",
  office: "INDOOR: Volume: ~35 m³ | RT60: 0.35s | Cavity Resonance: 240 Hz | ITD: 2.5ms (Treated Home Studio / Bedroom)",
  standard: "INDOOR: Volume: ~90 m³ | RT60: 0.75s | Cavity Resonance: 175 Hz | ITD: 3.5ms (Tracking Studio - DEFAULT BASELINE)",
  auditorium: "INDOOR: Volume: ~2,800 m³ | RT60: 1.80s | Air Resonance: 95 Hz | ITD: 8.0ms (Recital Concert Hall)",
  cathedral: "INDOOR: Volume: ~85,000 m³ | RT60: 5.50s | Air Resonance: 48 Hz | ITD: 15.0ms (Gothic Cathedral Nave)",
  hangar: "INDOOR: Volume: ~180,000 m³ | RT60: 7.20s | Air Resonance: 34 Hz | ITD: 22.0ms (Airship Hangar / Cistern)",
  subterranean_vault: "INDOOR: Volume: ~350,000 m³ | RT60: 8.80s | Air Resonance: 28 Hz | ITD: 28.0ms (Salt Mine Vault - INDOOR ABSOLUTE MAX)",
  urban_balcony: "OUTDOOR: Eff. Volume: ~500 m³ | RT60: 0.40s | Ground Bounce: 180 Hz | ITD: 4.0ms (Urban Courtyard - OUTDOOR MIN)",
  amphitheater: "OUTDOOR: Eff. Volume: ~25,000 m³ | RT60: 1.20s | Open Air: 110 Hz | ITD: 12.0ms (Roman Amphitheater)",
  forest_clearing: "OUTDOOR: Eff. Volume: ~75,000 m³ | RT60: 1.90s | Pine Scatter: 85 Hz | ITD: 18.0ms (Forest Clearing)",
  quarry: "OUTDOOR: Eff. Volume: ~300,000 m³ | RT60: 4.80s | Rock Wall: 55 Hz | ITD: 25.0ms (Granite Quarry Basin)",
  alpine_valley: "OUTDOOR: Eff. Volume: ~1,500,000 m³ | RT60: 8.50s | Mountain Ridge: 32 Hz | ITD: 35.0ms (Alpine Valley)",
  mega_canyon: "OUTDOOR: Eff. Volume: ~5,000,000 m³+ | RT60: 12.00s | Molecular Air: 18 Hz | ITD: 45.0ms (Desert Canyon - OUTDOOR ABSOLUTE MAX)"
};
