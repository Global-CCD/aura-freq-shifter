/**
 * @fileoverview JSDoc Type Definitions for Static Type Safety
 */

/**
 * @typedef {'micro_helmet'|'cockpit'|'booth'|'office'|'standard'|'auditorium'|'cathedral'|'hangar'|'subterranean_vault'|'urban_balcony'|'amphitheater'|'forest_clearing'|'quarry'|'alpine_valley'|'mega_canyon'} SpacePresetKey
 */

/**
 * @typedef {Object} SpaceProfileDefinition
 * @property {boolean} isOutdoor
 * @property {number} resonanceFreq
 * @property {number} resonanceQ
 * @property {number} airGain
 * @property {number} irLengthSec
 * @property {number} decayRate
 * @property {number} preDelaySamples
 * @property {number} itdSec
 * @property {number} reflectionGain
 * @property {number} hfDamping
 * @property {number} bassWarmth
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
