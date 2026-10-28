/**
 * @fileoverview JSDoc Type Definitions for 14-Parameter Spatial Model & Multi-Strategy I/O
 */

/**
 * @typedef {'ear_canal_coupler'|'in_ear_canal'|'sealed_headphone'|'micro_helmet'|'cockpit'|'booth'|'office'|'standard'|'auditorium'|'cathedral'|'hangar'|'subterranean_vault'|'megastructure_atrium'|'megalithic_borehole'|'well_shaft'|'drainage_trench'|'street_portico'|'urban_balcony'|'amphitheater'|'forest_clearing'|'quarry'|'alpine_valley'|'mega_canyon'|'glacial_chasm'|'planetary_caldera'} SpacePresetKey
 */

/**
 * @typedef {Object} SpaceProfileDefinition
 * @property {boolean} isOutdoor
 * @property {number} volume
 * @property {{L: number, W: number, H: number}} dimensions
 * @property {[number, number, number, number, number, number]} rt60Octaves
 * @property {[number, number, number]} axialModes
 * @property {number} preDelayMs
 * @property {number} itdSec
 * @property {number} bassWarmth
 * @property {number} airDamping
 * @property {number} drrDb
 * @property {number} scattering
 * @property {number} tMixMs
 * @property {number} flutterIndex
 * @property {number} flowResistivity
 */

/**
 * @typedef {Object} RT60AnalysisResult
 * @property {number} measuredRt60
 * @property {number} dominantFreq
 * @property {string} noiseFloorDb
 * @property {string} targetName
 * @property {number} targetRt60
 * @property {number} targetRes
 * @property {number} rt60Delta
 * @property {number} resDelta
 * @property {boolean} isClipped
 */

/**
 * @typedef {Object} FactoryPresetDefinition
 * @property {string} name
 * @property {number} shiftHz
 * @property {number} lfoShape
 * @property {number} lfoDepth
 * @property {number} lfoRate
 * @property {number} lfoPolarity
 * @property {number} dryWet
 * @property {SpacePresetKey} space
 * @property {number} silenceVoids
 * @property {string} desc
 */

export {};
