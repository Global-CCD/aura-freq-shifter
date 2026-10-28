// @ts-check
/**
 * @fileoverview Complete 21-Profile Acoustic Continuum (0.005 m³ to 100,000,000 m³+)
 * Each profile implements the complete 14-parameter acoustic model.
 */

/** @type {Record<import('../types/audio-types.js').SpacePresetKey, import('../types/audio-types.js').SpaceProfileDefinition>} */
export const ROOM_PROFILES = {
  // --- INDOOR ARCHITECTURAL SPACES ---
  in_ear_canal: {
    isOutdoor: false, volume: 0.005, dimensions: { L: 0.025, W: 0.015, H: 0.013 },
    rt60Octaves: [0.003, 0.003, 0.003, 0.003, 0.002, 0.001],
    axialModes: [6860, 11433, 13192], preDelayMs: 0.0, itdSec: 0.00005,
    bassWarmth: 0.80, airDamping: 0.00, drrDb: 18.0, scattering: 0.05,
    tMixMs: 0.5, flutterIndex: 0.00, flowResistivity: 15000
  },
  sealed_headphone: {
    isOutdoor: false, volume: 0.025, dimensions: { L: 0.05, W: 0.05, H: 0.01 },
    rt60Octaves: [0.008, 0.008, 0.008, 0.007, 0.006, 0.004],
    axialModes: [3430, 3430, 17150], preDelayMs: 0.1, itdSec: 0.00012,
    bassWarmth: 0.82, airDamping: 0.00, drrDb: 16.0, scattering: 0.08,
    tMixMs: 1.0, flutterIndex: 0.05, flowResistivity: 12000
  },
  micro_helmet: {
    isOutdoor: false, volume: 0.08, dimensions: { L: 0.25, W: 0.22, H: 0.28 },
    rt60Octaves: [0.025, 0.022, 0.020, 0.018, 0.015, 0.010],
    axialModes: [686, 780, 612], preDelayMs: 0.3, itdSec: 0.0003,
    bassWarmth: 0.85, airDamping: 0.00, drrDb: 14.0, scattering: 0.15,
    tMixMs: 2.0, flutterIndex: 0.10, flowResistivity: 8500
  },
  cockpit: {
    isOutdoor: false, volume: 1.2, dimensions: { L: 1.2, W: 1.0, H: 1.0 },
    rt60Octaves: [0.065, 0.058, 0.050, 0.045, 0.038, 0.025],
    axialModes: [143, 172, 172], preDelayMs: 2.0, itdSec: 0.0008,
    bassWarmth: 0.90, airDamping: 0.01, drrDb: 10.0, scattering: 0.25,
    tMixMs: 5.0, flutterIndex: 0.20, flowResistivity: 5200
  },
  booth: {
    isOutdoor: false, volume: 2.5, dimensions: { L: 1.5, W: 1.2, H: 2.1 },
    rt60Octaves: [0.11, 0.09, 0.08, 0.075, 0.065, 0.045],
    axialModes: [114, 143, 82], preDelayMs: 0.0, itdSec: 0.0012,
    bassWarmth: 0.95, airDamping: 0.01, drrDb: 8.0, scattering: 0.35,
    tMixMs: 7.5, flutterIndex: 0.08, flowResistivity: 2500
  },
  office: {
    isOutdoor: false, volume: 35.0, dimensions: { L: 4.2, W: 3.5, H: 2.4 },
    rt60Octaves: [0.48, 0.40, 0.35, 0.32, 0.28, 0.20],
    axialModes: [41, 49, 71], preDelayMs: 6.0, itdSec: 0.0025,
    bassWarmth: 1.05, airDamping: 0.05, drrDb: 4.0, scattering: 0.40,
    tMixMs: 15.0, flutterIndex: 0.15, flowResistivity: 1100
  },
  standard: {
    isOutdoor: false, volume: 90.0, dimensions: { L: 6.5, W: 4.8, H: 2.9 },
    rt60Octaves: [0.95, 0.85, 0.75, 0.70, 0.60, 0.45],
    axialModes: [26, 36, 59], preDelayMs: 0.0, itdSec: 0.0035,
    bassWarmth: 1.00, airDamping: 0.08, drrDb: 0.0, scattering: 0.50,
    tMixMs: 25.0, flutterIndex: 0.05, flowResistivity: 850
  },
  auditorium: {
    isOutdoor: false, volume: 2800.0, dimensions: { L: 25.0, W: 15.0, H: 7.5 },
    rt60Octaves: [2.20, 2.00, 1.80, 1.65, 1.40, 1.05],
    axialModes: [7, 11, 23], preDelayMs: 22.0, itdSec: 0.0080,
    bassWarmth: 1.15, airDamping: 0.25, drrDb: -6.0, scattering: 0.65,
    tMixMs: 50.0, flutterIndex: 0.02, flowResistivity: 320
  },
  cathedral: {
    isOutdoor: false, volume: 85000.0, dimensions: { L: 85.0, W: 28.0, H: 36.0 },
    rt60Octaves: [6.80, 6.20, 5.50, 4.80, 3.80, 2.20],
    axialModes: [2, 6, 5], preDelayMs: 45.0, itdSec: 0.0150,
    bassWarmth: 1.30, airDamping: 0.50, drrDb: -14.0, scattering: 0.75,
    tMixMs: 95.0, flutterIndex: 0.00, flowResistivity: 80
  },
  hangar: {
    isOutdoor: false, volume: 180000.0, dimensions: { L: 120.0, W: 60.0, H: 25.0 },
    rt60Octaves: [9.20, 8.40, 7.20, 6.10, 4.50, 2.40],
    axialModes: [1, 3, 7], preDelayMs: 65.0, itdSec: 0.0220,
    bassWarmth: 1.40, airDamping: 0.65, drrDb: -18.0, scattering: 0.80,
    tMixMs: 120.0, flutterIndex: 0.04, flowResistivity: 45
  },
  subterranean_vault: {
    isOutdoor: false, volume: 350000.0, dimensions: { L: 160.0, W: 75.0, H: 29.0 },
    rt60Octaves: [11.5, 10.2, 8.80, 7.40, 5.20, 2.80],
    axialModes: [1, 2, 6], preDelayMs: 75.0, itdSec: 0.0280,
    bassWarmth: 1.50, airDamping: 0.80, drrDb: -20.0, scattering: 0.85,
    tMixMs: 140.0, flutterIndex: 0.00, flowResistivity: 30
  },
  megastructure_atrium: {
    isOutdoor: false, volume: 1200000.0, dimensions: { L: 220.0, W: 110.0, H: 50.0 },
    rt60Octaves: [18.0, 16.5, 14.2, 11.5, 7.50, 3.20],
    axialModes: [1, 2, 3], preDelayMs: 85.0, itdSec: 0.0320,
    bassWarmth: 1.65, airDamping: 0.90, drrDb: -24.0, scattering: 0.90,
    tMixMs: 180.0, flutterIndex: 0.00, flowResistivity: 15
  },

  // --- OUTDOOR OPEN-AIR ENVIRONMENTS ---
  drainage_trench: {
    isOutdoor: true, volume: 15.0, dimensions: { L: 12.0, W: 1.0, H: 1.25 },
    rt60Octaves: [0.18, 0.15, 0.12, 0.09, 0.06, 0.03],
    axialModes: [14, 172, 137], preDelayMs: 4.0, itdSec: 0.0008,
    bassWarmth: 0.85, airDamping: 0.05, drrDb: 6.0, scattering: 0.45,
    tMixMs: 8.0, flutterIndex: 0.40, flowResistivity: 4500
  },
  street_portico: {
    isOutdoor: true, volume: 120.0, dimensions: { L: 18.0, W: 2.5, H: 2.7 },
    rt60Octaves: [0.38, 0.32, 0.28, 0.22, 0.16, 0.08],
    axialModes: [10, 69, 64], preDelayMs: 6.0, itdSec: 0.0020,
    bassWarmth: 0.88, airDamping: 0.10, drrDb: 2.0, scattering: 0.50,
    tMixMs: 18.0, flutterIndex: 0.30, flowResistivity: 2800
  },
  urban_balcony: {
    isOutdoor: true, volume: 500.0, dimensions: { L: 20.0, W: 8.0, H: 3.1 },
    rt60Octaves: [0.55, 0.48, 0.40, 0.32, 0.22, 0.10],
    axialModes: [9, 21, 55], preDelayMs: 8.0, itdSec: 0.0040,
    bassWarmth: 0.90, airDamping: 0.15, drrDb: 0.0, scattering: 0.55,
    tMixMs: 30.0, flutterIndex: 0.15, flowResistivity: 1800
  },
  amphitheater: {
    isOutdoor: true, volume: 25000.0, dimensions: { L: 45.0, W: 38.0, H: 15.0 },
    rt60Octaves: [1.50, 1.35, 1.20, 1.05, 0.80, 0.45],
    axialModes: [4, 5, 11], preDelayMs: 25.0, itdSec: 0.0120,
    bassWarmth: 0.95, airDamping: 0.35, drrDb: -6.0, scattering: 0.65,
    tMixMs: 60.0, flutterIndex: 0.05, flowResistivity: 900
  },
  forest_clearing: {
    isOutdoor: true, volume: 75000.0, dimensions: { L: 60.0, W: 50.0, H: 25.0 },
    rt60Octaves: [2.30, 2.10, 1.90, 1.55, 1.10, 0.55],
    axialModes: [3, 3, 7], preDelayMs: 40.0, itdSec: 0.0180,
    bassWarmth: 1.05, airDamping: 0.55, drrDb: -10.0, scattering: 0.85,
    tMixMs: 85.0, flutterIndex: 0.00, flowResistivity: 550
  },
  quarry: {
    isOutdoor: true, volume: 300000.0, dimensions: { L: 110.0, W: 80.0, H: 34.0 },
    rt60Octaves: [5.80, 5.20, 4.80, 4.10, 3.00, 1.40],
    axialModes: [2, 2, 5], preDelayMs: 60.0, itdSec: 0.0250,
    bassWarmth: 1.20, airDamping: 0.65, drrDb: -14.0, scattering: 0.70,
    tMixMs: 110.0, flutterIndex: 0.08, flowResistivity: 250
  },
  alpine_valley: {
    isOutdoor: true, volume: 1500000.0, dimensions: { L: 280.0, W: 150.0, H: 36.0 },
    rt60Octaves: [10.5, 9.40, 8.50, 6.80, 4.50, 1.80],
    axialModes: [1, 1, 5], preDelayMs: 90.0, itdSec: 0.0350,
    bassWarmth: 1.35, airDamping: 0.85, drrDb: -18.0, scattering: 0.75,
    tMixMs: 150.0, flutterIndex: 0.02, flowResistivity: 90
  },
  mega_canyon: {
    isOutdoor: true, volume: 5000000.0, dimensions: { L: 500.0, W: 250.0, H: 40.0 },
    rt60Octaves: [15.0, 13.5, 12.0, 9.20, 5.50, 2.00],
    axialModes: [0.3, 0.7, 4.3], preDelayMs: 120.0, itdSec: 0.0450,
    bassWarmth: 1.55, airDamping: 0.95, drrDb: -22.0, scattering: 0.80,
    tMixMs: 190.0, flutterIndex: 0.00, flowResistivity: 40
  },
  planetary_caldera: {
    isOutdoor: true, volume: 100000000.0, dimensions: { L: 1500.0, W: 1200.0, H: 55.0 },
    rt60Octaves: [35.0, 31.0, 28.0, 18.0, 8.50, 2.20],
    axialModes: [0.1, 0.1, 3.1], preDelayMs: 220.0, itdSec: 0.0500,
    bassWarmth: 1.85, airDamping: 0.98, drrDb: -26.0, scattering: 0.90,
    tMixMs: 250.0, flutterIndex: 0.00, flowResistivity: 10
  }
};
