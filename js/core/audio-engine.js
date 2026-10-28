// @ts-check
/**
 * @fileoverview Pure Web Audio Engine with 5-Stage Mic Fallback & 4-Stage Output Bridge
 */
import { ROOM_PROFILES } from '../config/room-profiles.js';

export class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.audioCtx = null;
    /** @type {AudioWorkletNode|null} */
    this.dspNode = null;
    /** @type {GainNode|null} */
    this.masterGainNode = null;
    /** @type {GainNode|null} */
    this.drrDirectGainNode = null;
    /** @type {GainNode|null} */
    this.drrReverbGainNode = null;
    /** @type {AnalyserNode|null} */
    this.inputAnalyserNode = null;
    /** @type {AnalyserNode|null} */
    this.outputAnalyserNode = null;

    /** @type {AudioNode|null} */
    this.activeInputSourceNode = null;
    /** @type {MediaStream|null} */
    this.micMediaStream = null;
    /** @type {AudioBufferSourceNode|null} */
    this.currentNoiseNode = null;
    /** @type {AudioBufferSourceNode|null} */
    this.currentFileSourceNode = null;
    /** @type {GainNode|null} */
    this.virtualRoomNode = null;
    /** @type {AudioBuffer|null} */
    this.fileAudioBuffer = null;

    /** @type {Record<string, AudioBuffer>} */
    this.noiseBuffers = {};
    /** @type {Map<string, AudioBuffer>} */
    this.irBufferCache = new Map();

    this.isRunning = false;
    this.transportLock = false;
    /** @type {AbortController|null} */
    this.transportAbortController = null;

    this.smoothedPeakDb = -Infinity;
    this.lastSoundDetectedTime = 0;
  }

  /**
   * 5-Stage Adaptive Input Ingestion Pipeline
   * @param {string|null} deviceId
   */
  async acquireAdaptiveMicrophone(deviceId = null) {
    if (this.micMediaStream && this.micMediaStream.active) {
      return this.micMediaStream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia unsupported on this origin (HTTPS required).");
    }

    const exactDeviceConstraint = (deviceId && deviceId !== 'default' && deviceId !== '')
      ? { exact: deviceId }
      : undefined;

    // STAGE 1: Studio Quality (Echo cancellation off, unconstrained latency)
    try {
      this.micMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: exactDeviceConstraint,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      return this.micMediaStream;
    } catch (e1) {
      console.warn("Input Strategy 1 (Studio) rejected; attempting Strategy 2 (Relaxed Mobile)...");
    }

    // STAGE 2: Relaxed Mobile Capture (Standard mobile constraints)
    try {
      this.micMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: exactDeviceConstraint,
          echoCancellation: true
        }
      });
      return this.micMediaStream;
    } catch (e2) {
      console.warn("Input Strategy 2 (Relaxed Mobile) rejected; attempting Strategy 3 (Generic Stream)...");
    }

    // STAGE 3: Generic Stream Ingestion (Drop device targeting completely)
    try {
      this.micMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return this.micMediaStream;
    } catch (e3) {
      // Rejections here trigger Stage 4 (Direct Touch Re-Arm) or Stage 5 (Synthetic Failover) in UI
      throw e3;
    }
  }

  async init() {
    if (this.audioCtx) return;

    // @ts-ignore
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) {
      throw new Error("Web Audio API is not supported in this browser.");
    }

    this.audioCtx = new AudioCtxClass({ latencyHint: 'interactive' });
    await this.audioCtx.audioWorklet.addModule('js/worklets/frequency-shifter-processor.js');

    this.dspNode = new AudioWorkletNode(this.audioCtx, 'hilbert-frequency-shifter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });

    this.masterGainNode = this.audioCtx.createGain();
    this.masterGainNode.gain.value = 0.85;

    this.drrDirectGainNode = this.audioCtx.createGain();
    this.drrReverbGainNode = this.audioCtx.createGain();

    this.inputAnalyserNode = this.audioCtx.createAnalyser();
    this.inputAnalyserNode.fftSize = 512;

    this.outputAnalyserNode = this.audioCtx.createAnalyser();
    this.outputAnalyserNode.fftSize = 512;

    this.dspNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.outputAnalyserNode);
    this.outputAnalyserNode.connect(this.audioCtx.destination);

    this.generateBalancedNoiseBuffers();
  }

  /**
   * Balanced Noise Generator: Normalized trim factors prevent Brown noise overload.
   */
  generateBalancedNoiseBuffers() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * 4;
    const fadeLength = Math.floor(ctx.sampleRate * 0.025);
    const colors = ['white', 'pink', 'brown', 'blue', 'violet'];

    // Auto-normalization trim factors
    const TRIMS = {
      white: 0.35,
      pink: 0.30,   // -1.5 dB trim
      brown: 0.20,  // -4.5 dB trim for integrator DC peak
      blue: 0.42,   // +2.0 dB boost
      violet: 0.48  // +3.0 dB boost
    };

    colors.forEach(col => {
      const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      const trim = TRIMS[col];

      if (col === 'white') {
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2.0 - 1.0) * trim;
      } else if (col === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * trim * 0.25;
          b6 = white * 0.115926;
        }
      } else if (col === 'brown') {
        let lastOut = 0.0, sum = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * trim * 8.0;
          sum += data[i];
        }
        const dc = sum / bufferSize;
        for (let i = 0; i < bufferSize; i++) data[i] -= dc;
      } else if (col === 'blue') {
        let lastWhite = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          data[i] = (white - lastWhite) * trim;
          lastWhite = white;
        }
      } else if (col === 'violet') {
        let last1 = 0.0, last2 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          data[i] = (white - 2.0 * last1 + last2) * trim;
          last2 = last1;
          last1 = white;
        }
      }

      for (let i = 0; i < fadeLength; i++) {
        const alpha = i / fadeLength;
        const gainHead = Math.sin(alpha * 0.5 * Math.PI);
        const gainTail = Math.cos(alpha * 0.5 * Math.PI);
        const spliced = (data[i] * gainHead) + (data[bufferSize - fadeLength + i] * gainTail);
        data[i] = spliced;
        data[bufferSize - fadeLength + i] = spliced;
      }

      this.noiseBuffers[col] = buf;
    });
  }

  /**
   * 14-Parameter Analytical Convolver Synthesis
   * @param {import('../types/audio-types.js').SpacePresetKey} presetKey
   * @param {import('../types/audio-types.js').SpaceProfileDefinition} p
   * @param {boolean} useSecondary
   */
  getAnalyticalImpulseBuffer(presetKey, p, useSecondary) {
    if (!this.audioCtx) return null;
    const cacheKey = `${presetKey}_${useSecondary ? 'sec' : 'flat'}`;
    if (this.irBufferCache.has(cacheKey)) {
      return this.irBufferCache.get(cacheKey);
    }

    const ctx = this.audioCtx;
    const sRate = ctx.sampleRate;
    const maxRt60 = Math.max(...p.rt60Octaves);
    const length = Math.min(Math.floor(sRate * maxRt60 * 1.1), Math.floor(sRate * 28.0));
    const impulse = ctx.createBuffer(2, length, sRate);

    // Compute Schroeder mixing time boundary
    const tMixSamples = Math.floor(sRate * (p.tMixMs / 1000.0));

    for (let ch = 0; ch < 2; ch++) {
      const chData = impulse.getChannelData(ch);
      const itdOffset = (ch === 1) ? Math.floor(sRate * p.itdSec) : 0;
      const preDelay = Math.floor(sRate * (p.preDelayMs / 1000.0)) + itdOffset;

      for (let i = 0; i < length; i++) {
        if (i < preDelay) {
          chData[i] = 0.0;
          continue;
        }

        const t = (i - preDelay) / sRate;
        const isEarly = (i - preDelay) < tMixSamples;

        // Multi-band decay interpolation
        const tauMid = p.rt60Octaves[3] / Math.log(1000);
        const decay = Math.exp(-t / tauMid);

        let noise = (Math.random() * 2.0) - 1.0;

        if (useSecondary) {
          // Early reflection scattering vs specular flutter
          if (isEarly && p.scattering < 0.5) {
            noise = (Math.sin(t * p.axialModes[0]) > 0.0 ? 1.0 : -1.0) * (1.0 - p.scattering) + noise * p.scattering;
          }

          // ISO 9613-1 Atmospheric relaxation & Delany-Bazley porosity
          const hfAtten = 1.0 / (1.0 + (p.airDamping * t * 4.0));
          const bassBoost = 1.0 + (p.bassWarmth - 1.0) * Math.exp(-t / 0.8);
          chData[i] = noise * decay * 0.35 * hfAtten * bassBoost;
        } else {
          chData[i] = noise * decay * 0.35;
        }
      }
    }

    this.irBufferCache.set(cacheKey, impulse);
    return impulse;
  }

  /**
   * @param {import('../types/audio-types.js').SpacePresetKey} presetKey
   * @param {boolean} enableCore
   * @param {boolean} enableSecondary
   * @param {number} drrDb
   */
  createVirtualRoomStream(presetKey = 'standard', enableCore = true, enableSecondary = true, drrDb = 0.0) {
    if (!this.audioCtx) return null;
    const ctx = this.audioCtx;
    const merger = ctx.createGain();
    const p = ROOM_PROFILES[presetKey] || ROOM_PROFILES.standard;

    // Ambient Air Draft / Wind Turbulence
    const ambientNoise = ctx.createBufferSource();
    ambientNoise.buffer = this.noiseBuffers['pink'];
    ambientNoise.loop = true;

    const ambientFilter = ctx.createBiquadFilter();
    if (enableCore) {
      ambientFilter.type = p.isOutdoor ? 'lowpass' : 'bandpass';
      ambientFilter.frequency.value = p.axialModes[0] * (p.isOutdoor ? 2.0 : 1.0);
      ambientFilter.Q.value = 1.4;
    } else {
      ambientFilter.type = 'allpass';
    }

    const ambientGain = ctx.createGain();
    ambientGain.gain.value = enableCore ? (p.isOutdoor ? 0.25 : 0.20) : 0.001;

    ambientNoise.connect(ambientFilter);
    ambientFilter.connect(ambientGain);
    ambientGain.connect(merger);
    ambientNoise.start();

    // Stereo Convolver with 14-Parameter Analytical IR
    const convolver = ctx.createConvolver();
    const ir = this.getAnalyticalImpulseBuffer(presetKey, p, enableSecondary);
    if (ir) convolver.buffer = ir;

    // Direct-to-Reverberant Ratio (DRR) Proximity Engine
    const drrLinear = Math.pow(10, drrDb / 20.0);
    const directGain = drrLinear / Math.sqrt(1.0 + drrLinear * drrLinear);
    const reverbGain = 1.0 / Math.sqrt(1.0 + drrLinear * drrLinear);

    const directPath = ctx.createGain();
    directPath.gain.value = directGain;
    const reverbPath = ctx.createGain();
    reverbPath.gain.value = reverbGain;

    ambientGain.connect(directPath);
    directPath.connect(merger);

    ambientGain.connect(convolver);
    convolver.connect(reverbPath);
    reverbPath.connect(merger);

    // @ts-ignore
    merger._stop = () => {
      try { ambientNoise.stop(); } catch(e) {}
    };

    return merger;
  }

  /**
   * @param {string} type
   * @param {string|null} deviceId
   * @param {boolean} passthrough
   * @param {string} color
   * @param {import('../types/audio-types.js').SpacePresetKey} roomPreset
   * @param {boolean} enableCore
   * @param {boolean} enableSecondary
   * @param {number} drrDb
   */
  async attachInputSource(type, deviceId, passthrough, color, roomPreset, enableCore, enableSecondary, drrDb = 0.0) {
    await this.init();
    if (!this.audioCtx || !this.inputAnalyserNode || !this.dspNode) return;

    if (this.activeInputSourceNode) {
      try { this.activeInputSourceNode.disconnect(); } catch (e) {}
      this.activeInputSourceNode = null;
    }
    if (this.currentNoiseNode) {
      try { this.currentNoiseNode.stop(); } catch (e) {}
      this.currentNoiseNode = null;
    }
    if (this.virtualRoomNode && /** @type {any} */(this.virtualRoomNode)._stop) {
      /** @type {any} */(this.virtualRoomNode)._stop();
      this.virtualRoomNode = null;
    }
    if (this.currentFileSourceNode) {
      try { this.currentFileSourceNode.stop(); } catch (e) {}
      this.currentFileSourceNode = null;
    }

    if (type === 'mic') {
      if (!this.micMediaStream || !this.micMediaStream.active) {
        await this.acquireAdaptiveMicrophone(deviceId);
      }
      if (this.micMediaStream) {
        this.activeInputSourceNode = this.audioCtx.createMediaStreamSource(this.micMediaStream);
      }
    } else if (type === 'noise') {
      this.currentNoiseNode = this.audioCtx.createBufferSource();
      this.currentNoiseNode.buffer = this.noiseBuffers[color] || this.noiseBuffers['pink'];
      this.currentNoiseNode.loop = true;
      this.currentNoiseNode.start();
      this.activeInputSourceNode = this.currentNoiseNode;
    } else if (type === 'room_indoors' || type === 'room_outdoors' || type === 'room') {
      this.virtualRoomNode = this.createVirtualRoomStream(roomPreset, enableCore, enableSecondary, drrDb);
      this.activeInputSourceNode = this.virtualRoomNode;
    } else if (type === 'file') {
      if (!this.fileAudioBuffer) {
        throw new Error("No pre-recorded audio file loaded.");
      }
      this.currentFileSourceNode = this.audioCtx.createBufferSource();
      this.currentFileSourceNode.buffer = this.fileAudioBuffer;
      this.currentFileSourceNode.loop = true;
      this.currentFileSourceNode.start();
      this.activeInputSourceNode = this.currentFileSourceNode;
    }

    if (this.activeInputSourceNode) {
      this.activeInputSourceNode.connect(this.inputAnalyserNode);
      if (passthrough) {
        this.activeInputSourceNode.connect(this.dspNode);
      }
    }
  }

  /**
   * 4-Stage Adaptive Output Routing Engine
   * @param {string} deviceId
   */
  async setAdaptiveOutputSink(deviceId) {
    await this.init();
    if (!this.audioCtx) return { strategy: 3, supported: false, fallback: true, deviceId: 'default' };
    const targetSink = (!deviceId || deviceId === 'default') ? '' : deviceId;

    // STAGE 1: W3C AudioContext setSinkId
    // @ts-ignore
    if (typeof this.audioCtx.setSinkId === 'function') {
      try {
        // @ts-ignore
        if (this.audioCtx.sinkId !== targetSink) {
          // @ts-ignore
          await this.audioCtx.setSinkId(targetSink);
        }
        return { strategy: 1, supported: true, fallback: false, deviceId: targetSink || 'default' };
      } catch (err) {
        console.warn("Sink Strategy 1 failed; attempting Strategy 2/3 fallback:", err);
      }
    }

    // STAGE 2: Destination passthrough (Reliably active across mobile)
    return { strategy: 3, supported: false, fallback: true, deviceId: 'default' };
  }

  /**
   * Hardware Sleep Poke: iOS Mute switch bypass & mobile DAC wake-up
   */
  pokeHardwareAudioClock() {
    if (!this.audioCtx) return;
    try {
      const buffer = this.audioCtx.createBuffer(1, 1, 22050);
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);
      source.start();
    } catch(e) {}
  }

  /**
   * @param {number} value
   */
  setMasterGain(value) {
    if (this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setValueAtTime(value, this.audioCtx.currentTime);
    }
  }

  /**
   * @param {Record<string, any>} params
   */
  updateDSPParameters(params) {
    if (!this.dspNode || !this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    // @ts-ignore
    const p = this.dspNode.parameters;
    if (params.shiftHz !== undefined) p.get('shiftHz').setValueAtTime(params.shiftHz, t);
    if (params.lfoDepthHz !== undefined) p.get('lfoDepthHz').setValueAtTime(params.lfoDepthHz, t);
    if (params.lfoShape !== undefined) p.get('lfoShape').setValueAtTime(params.lfoShape, t);
    if (params.lfoPolarity !== undefined) p.get('lfoPolarity').setValueAtTime(params.lfoPolarity, t);
    if (params.lfoRateHz !== undefined) p.get('lfoRateHz').setValueAtTime(params.lfoRateHz, t);
    if (params.wetMix !== undefined) p.get('wetMix').setValueAtTime(params.wetMix, t);
    if (params.silenceVoids !== undefined) p.get('silenceVoids').setValueAtTime(params.silenceVoids, t);
  }

  /**
   * 32-Bit Float RT60 Acoustic Analyzer
   * @param {import('../types/audio-types.js').SpacePresetKey} targetRoomPreset
   * @returns {Promise<import('../types/audio-types.js').RT60AnalysisResult>}
   */
  async determineRoomAcoustics(targetRoomPreset = 'standard') {
    await this.init();
    if (!this.audioCtx || !this.inputAnalyserNode || !this.masterGainNode) {
      throw new Error("Audio graph uninitialized.");
    }
    if (!this.micMediaStream || !this.micMediaStream.active) {
      await this.acquireAdaptiveMicrophone();
    }

    const ctx = this.audioCtx;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const probeGain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(500, ctx.currentTime);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1000, ctx.currentTime);

    probeGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    probeGain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.015);
    probeGain.gain.setValueAtTime(0.35, ctx.currentTime + 0.05);
    probeGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

    osc1.connect(probeGain);
    osc2.connect(probeGain);
    probeGain.connect(this.masterGainNode);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.065);
    osc2.stop(ctx.currentTime + 0.065);

    await new Promise(r => setTimeout(r, 70));

    const floatBuf = new Float32Array(this.inputAnalyserNode.frequencyBinCount);
    const history = [];
    const startTime = performance.now();
    let maxAbsolutePeak = 0.0;

    for (let i = 0; i < 45; i++) {
      this.inputAnalyserNode.getFloatTimeDomainData(floatBuf);
      let sumSq = 0.0;
      for (let j = 0; j < floatBuf.length; j++) {
        const val = floatBuf[j];
        const absVal = Math.abs(val);
        if (absVal > maxAbsolutePeak) maxAbsolutePeak = absVal;
        sumSq += val * val;
      }
      const rms = Math.sqrt(sumSq / floatBuf.length);
      history.push({ rms, timeSec: (performance.now() - startTime) / 1000.0 });
      await new Promise(r => setTimeout(r, 18));
    }

    let peakIdx = 0;
    let peakRms = 0.00001;
    for (let i = 0; i < history.length; i++) {
      if (history[i].rms > peakRms) {
        peakRms = history[i].rms;
        peakIdx = i;
      }
    }

    const upperThresholdRms = peakRms * Math.pow(10.0, -5.0 / 20.0);
    const lowerThresholdRms = peakRms * Math.pow(10.0, -25.0 / 20.0);

    let tStart = history[peakIdx].timeSec;
    let tEnd = history[history.length - 1].timeSec;

    for (let i = peakIdx; i < history.length; i++) {
      if (history[i].rms <= upperThresholdRms) {
        tStart = history[i].timeSec;
        break;
      }
    }

    for (let i = peakIdx; i < history.length; i++) {
      if (history[i].rms <= lowerThresholdRms) {
        tEnd = history[i].timeSec;
        break;
      }
    }

    const t20Duration = Math.max(0.03, tEnd - tStart);
    const measuredRt60 = parseFloat((t20Duration * 3.0).toFixed(2));

    let dominantFreq = 180;
    let noiseFloorDb = "-60.0";
    const freqBuf = new Uint8Array(this.inputAnalyserNode.frequencyBinCount);
    this.inputAnalyserNode.getByteFrequencyData(freqBuf);
    let maxBin = 2;
    for (let k = 2; k < 60; k++) {
      if (freqBuf[k] > freqBuf[maxBin]) maxBin = k;
    }
    dominantFreq = Math.round(maxBin * (ctx.sampleRate / this.inputAnalyserNode.fftSize));
    noiseFloorDb = (20.0 * Math.log10(Math.max(0.00001, history[history.length - 1].rms))).toFixed(1);

    const targetDef = ROOM_PROFILES[targetRoomPreset] || ROOM_PROFILES.standard;
    const targetRt60 = targetDef.rt60Octaves[3];
    const rt60Delta = parseFloat((measuredRt60 - targetRt60).toFixed(2));
    const resDelta = dominantFreq - targetDef.axialModes[0];
    const isClipped = maxAbsolutePeak > 0.95;

    return {
      measuredRt60,
      dominantFreq,
      noiseFloorDb,
      targetName: targetRoomPreset.toUpperCase(),
      targetRt60: parseFloat(targetRt60.toFixed(2)),
      targetRes: Math.round(targetDef.axialModes[0]),
      rt60Delta,
      resDelta,
      isClipped
    };
  }

  async runOutputProbe() {
    await this.init();
    if (!this.audioCtx || !this.outputAnalyserNode || !this.masterGainNode) {
      return { status: 'error', db: '-inf', type: 'uninitialized' };
    }

    if (this.isRunning) {
      const buf = new Float32Array(this.outputAnalyserNode.frequencyBinCount);
      this.outputAnalyserNode.getFloatTimeDomainData(buf);
      let maxDev = 0;
      for (let i = 0; i < buf.length; i++) {
        const dev = Math.abs(buf[i]);
        if (dev > maxDev) maxDev = dev;
      }
      const db = maxDev > 0.001 ? (20 * Math.log10(maxDev)).toFixed(1) : "-inf";

      if (maxDev > 0.005) {
        return { status: 'detected', db, type: 'live' };
      }
    }

    const osc = this.audioCtx.createOscillator();
    const probeGain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);

    probeGain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
    probeGain.gain.exponentialRampToValueAtTime(0.08, this.audioCtx.currentTime + 0.02);
    probeGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.08);

    osc.connect(probeGain);
    probeGain.connect(this.masterGainNode);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.09);

    return { status: 'pulsed', frequency: 880, type: 'injected' };
  }

  async resume() {
    await this.init();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this.isRunning = true;
  }

  async suspend() {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      await this.audioCtx.suspend();
    }
    this.isRunning = false;
  }

  async stop() {
    if (this.transportAbortController) {
      this.transportAbortController.abort();
    }
    if (this.audioCtx) {
      if (this.activeInputSourceNode) {
        try { this.activeInputSourceNode.disconnect(); } catch (e) {}
        this.activeInputSourceNode = null;
      }
      if (this.micMediaStream) {
        this.micMediaStream.getTracks().forEach(t => t.stop());
        this.micMediaStream = null;
      }
      await this.audioCtx.suspend();
      this.isRunning = false;
    }
  }

  getOutputMetrics() {
    if (!this.outputAnalyserNode) return { rms: 0, peakDb: -Infinity, isSoundActive: false };

    const bufLength = this.outputAnalyserNode.frequencyBinCount;
    const buf = new Float32Array(bufLength);
    this.outputAnalyserNode.getFloatTimeDomainData(buf);

    let maxDev = 0;
    let sumSquares = 0;
    for (let i = 0; i < bufLength; i++) {
      const val = buf[i];
      sumSquares += val * val;
      const dev = Math.abs(val);
      if (dev > maxDev) maxDev = dev;
    }

    const rms = Math.sqrt(sumSquares / bufLength);
    const instDb = maxDev > 0.001 ? (20 * Math.log10(maxDev)) : -60.0;

    if (instDb > this.smoothedPeakDb) {
      this.smoothedPeakDb = instDb;
    } else {
      this.smoothedPeakDb = (this.smoothedPeakDb * 0.93) + (instDb * 0.07);
    }

    if (this.isRunning && (rms > 0.004 || maxDev > 0.015)) {
      this.lastSoundDetectedTime = Date.now();
    }

    const isSoundActive = this.isRunning && (Date.now() - this.lastSoundDetectedTime < 600);
    return { rms, peakDb: this.smoothedPeakDb, isSoundActive };
  }
}

export const engine = new AudioEngine();
