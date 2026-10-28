/**
 * AudioEngine v3.3.0 - Indoor & Outdoor Spatial Acoustics & Automated Diagnostics
 */
export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.dspNode = null;
    this.masterGainNode = null;
    this.inputAnalyserNode = null;
    this.outputAnalyserNode = null;

    this.activeInputSourceNode = null;
    this.micMediaStream = null;
    this.currentNoiseNode = null;
    this.currentFileSourceNode = null;
    this.virtualRoomNode = null;
    this.fileAudioBuffer = null;

    this.noiseBuffers = {};
    this.irBufferCache = new Map();

    this.currentRoomPreset = 'standard';
    this.enableCoreParams = true;
    this.enableSecondaryParams = true;

    this.isRunning = false;
    this.transportLock = false;
    this.transportAbortController = null;

    this.smoothedPeakDb = -Infinity;
    this.lastSoundDetectedTime = 0;
  }

  async acquireDirectMicrophone(deviceId = null) {
    if (this.micMediaStream && this.micMediaStream.active) {
      return this.micMediaStream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia unsupported on this origin (HTTPS required).");
    }

    const constraints = {
      audio: (deviceId && deviceId !== 'default' && deviceId !== '')
        ? { deviceId: { exact: deviceId } }
        : true
    };

    try {
      this.micMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.micMediaStream;
    } catch (err) {
      if (constraints.audio && typeof constraints.audio === 'object' && constraints.audio.deviceId) {
        this.micMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return this.micMediaStream;
      }
      throw err;
    }
  }

  async init() {
    if (this.audioCtx) return;

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

    this.inputAnalyserNode = this.audioCtx.createAnalyser();
    this.inputAnalyserNode.fftSize = 512;

    this.outputAnalyserNode = this.audioCtx.createAnalyser();
    this.outputAnalyserNode.fftSize = 512;

    this.dspNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.outputAnalyserNode);
    this.outputAnalyserNode.connect(this.audioCtx.destination);

    this.generateSeamlessNoiseBuffers();
  }

  generateSeamlessNoiseBuffers() {
    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * 4;
    const fadeLength = Math.floor(ctx.sampleRate * 0.025);
    const colors = ['white', 'pink', 'brown', 'blue', 'violet'];

    colors.forEach(col => {
      const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buf.getChannelData(0);

      if (col === 'white') {
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2.0 - 1.0) * 0.35;
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
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
          b6 = white * 0.115926;
        }
      } else if (col === 'brown') {
        let lastOut = 0.0, sum = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * 1.8;
          sum += data[i];
        }
        const dc = sum / bufferSize;
        for (let i = 0; i < bufferSize; i++) data[i] -= dc;
      } else if (col === 'blue') {
        let lastWhite = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          data[i] = (white - lastWhite) * 0.35;
          lastWhite = white;
        }
      } else if (col === 'violet') {
        let last1 = 0.0, last2 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2.0 - 1.0;
          data[i] = (white - 2.0 * last1 + last2) * 0.2;
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

  getAnalyticalImpulseBuffer(presetKey, p, useSecondary) {
    const cacheKey = `${presetKey}_${useSecondary ? 'sec' : 'flat'}`;
    if (this.irBufferCache.has(cacheKey)) {
      return this.irBufferCache.get(cacheKey);
    }

    const ctx = this.audioCtx;
    const sRate = ctx.sampleRate;
    const length = Math.floor(sRate * p.irLengthSec);
    const impulse = ctx.createBuffer(2, length, sRate);

    for (let ch = 0; ch < 2; ch++) {
      const chData = impulse.getChannelData(ch);
      const itdOffsetSamples = (ch === 1) ? Math.floor(sRate * p.itdSec) : 0;
      const preDelay = p.preDelaySamples + itdOffsetSamples;

      for (let i = 0; i < length; i++) {
        if (i < preDelay) {
          chData[i] = 0.0;
          continue;
        }

        const t = (i - preDelay) / sRate;
        const decay = Math.exp(-t / p.decayRate);
        const noise = (Math.random() * 2.0) - 1.0;

        if (useSecondary) {
          const hfAtten = 1.0 / (1.0 + (p.hfDamping * t * 4.0));
          const bassBoost = 1.0 + (p.bassWarmth - 1.0) * Math.exp(-t / 0.8);
          chData[i] = noise * decay * p.reflectionGain * hfAtten * bassBoost;
        } else {
          chData[i] = noise * decay * p.reflectionGain;
        }
      }
    }

    this.irBufferCache.set(cacheKey, impulse);
    return impulse;
  }

  createVirtualRoomStream(presetKey = 'standard') {
    this.currentRoomPreset = presetKey;
    const ctx = this.audioCtx;
    const sRate = ctx.sampleRate;
    const merger = ctx.createGain();

    // 15-Profile Indoor & Outdoor Acoustic Continuum
    const profiles = {
      // --- INDOOR ENCLOSED ARCHITECTURE ---
      micro_helmet: {
        isOutdoor: false, resonanceFreq: 1150, resonanceQ: 3.2, airGain: 0.12,
        irLengthSec: 0.06, decayRate: 0.008, preDelaySamples: 0,
        itdSec: 0.0003, reflectionGain: 0.45, hfDamping: 0.00, bassWarmth: 0.85
      },
      cockpit: {
        isOutdoor: false, resonanceFreq: 720, resonanceQ: 2.6, airGain: 0.14,
        irLengthSec: 0.12, decayRate: 0.016, preDelaySamples: Math.floor(sRate * 0.002),
        itdSec: 0.0008, reflectionGain: 0.42, hfDamping: 0.00, bassWarmth: 0.90
      },
      booth: {
        isOutdoor: false, resonanceFreq: 520, resonanceQ: 2.2, airGain: 0.16,
        irLengthSec: 0.18, decayRate: 0.025, preDelaySamples: 0,
        itdSec: 0.0012, reflectionGain: 0.40, hfDamping: 0.00, bassWarmth: 0.95
      },
      office: {
        isOutdoor: false, resonanceFreq: 240, resonanceQ: 1.6, airGain: 0.19,
        irLengthSec: 0.45, decayRate: 0.065, preDelaySamples: Math.floor(sRate * 0.006),
        itdSec: 0.0025, reflectionGain: 0.38, hfDamping: 0.08, bassWarmth: 1.05
      },
      standard: {
        isOutdoor: false, resonanceFreq: 175, resonanceQ: 1.4, airGain: 0.22,
        irLengthSec: 0.75, decayRate: 0.12, preDelaySamples: 0,
        itdSec: 0.0035, reflectionGain: 0.35, hfDamping: 0.00, bassWarmth: 1.00
      },
      auditorium: {
        isOutdoor: false, resonanceFreq: 95, resonanceQ: 1.1, airGain: 0.26,
        irLengthSec: 2.2, decayRate: 0.35, preDelaySamples: Math.floor(sRate * 0.022),
        itdSec: 0.0080, reflectionGain: 0.32, hfDamping: 0.25, bassWarmth: 1.15
      },
      cathedral: {
        isOutdoor: false, resonanceFreq: 48, resonanceQ: 0.8, airGain: 0.32,
        irLengthSec: 6.0, decayRate: 0.95, preDelaySamples: Math.floor(sRate * 0.045),
        itdSec: 0.0150, reflectionGain: 0.28, hfDamping: 0.50, bassWarmth: 1.30
      },
      hangar: {
        isOutdoor: false, resonanceFreq: 34, resonanceQ: 0.7, airGain: 0.36,
        irLengthSec: 7.8, decayRate: 1.25, preDelaySamples: Math.floor(sRate * 0.065),
        itdSec: 0.0220, reflectionGain: 0.25, hfDamping: 0.70, bassWarmth: 1.40
      },
      subterranean_vault: {
        isOutdoor: false, resonanceFreq: 28, resonanceQ: 0.65, airGain: 0.38,
        irLengthSec: 9.5, decayRate: 1.50, preDelaySamples: Math.floor(sRate * 0.075),
        itdSec: 0.0280, reflectionGain: 0.24, hfDamping: 0.80, bassWarmth: 1.50
      },

      // --- OUTDOOR OPEN-AIR ENVIRONMENTS ---
      urban_balcony: {
        isOutdoor: true, resonanceFreq: 180, resonanceQ: 0.9, airGain: 0.18,
        irLengthSec: 0.55, decayRate: 0.07, preDelaySamples: Math.floor(sRate * 0.008),
        itdSec: 0.0040, reflectionGain: 0.35, hfDamping: 0.15, bassWarmth: 0.90
      },
      amphitheater: {
        isOutdoor: true, resonanceFreq: 110, resonanceQ: 0.75, airGain: 0.22,
        irLengthSec: 1.6, decayRate: 0.22, preDelaySamples: Math.floor(sRate * 0.025),
        itdSec: 0.0120, reflectionGain: 0.30, hfDamping: 0.35, bassWarmth: 0.95
      },
      forest_clearing: {
        isOutdoor: true, resonanceFreq: 85, resonanceQ: 0.6, airGain: 0.25,
        irLengthSec: 2.5, decayRate: 0.35, preDelaySamples: Math.floor(sRate * 0.040),
        itdSec: 0.0180, reflectionGain: 0.28, hfDamping: 0.55, bassWarmth: 1.05
      },
      quarry: {
        isOutdoor: true, resonanceFreq: 55, resonanceQ: 0.65, airGain: 0.30,
        irLengthSec: 5.5, decayRate: 0.85, preDelaySamples: Math.floor(sRate * 0.060),
        itdSec: 0.0250, reflectionGain: 0.26, hfDamping: 0.65, bassWarmth: 1.20
      },
      alpine_valley: {
        isOutdoor: true, resonanceFreq: 32, resonanceQ: 0.5, airGain: 0.35,
        irLengthSec: 9.0, decayRate: 1.45, preDelaySamples: Math.floor(sRate * 0.090),
        itdSec: 0.0350, reflectionGain: 0.22, hfDamping: 0.85, bassWarmth: 1.35
      },
      mega_canyon: {
        isOutdoor: true, resonanceFreq: 18, resonanceQ: 0.45, airGain: 0.40,
        irLengthSec: 12.5, decayRate: 2.10, preDelaySamples: Math.floor(sRate * 0.120),
        itdSec: 0.0450, reflectionGain: 0.19, hfDamping: 0.95, bassWarmth: 1.55
      }
    };

    const p = profiles[presetKey] || profiles.standard;

    // Ambient Air Draft / Wind Breeze Generator
    const ambientNoise = ctx.createBufferSource();
    ambientNoise.buffer = p.isOutdoor ? this.noiseBuffers['pink'] : this.noiseBuffers['pink'];
    ambientNoise.loop = true;

    const ambientFilter = ctx.createBiquadFilter();
    if (this.enableCoreParams) {
      ambientFilter.type = p.isOutdoor ? 'lowpass' : 'bandpass';
      ambientFilter.frequency.value = p.resonanceFreq * (p.isOutdoor ? 2.5 : 1.0);
      ambientFilter.Q.value = p.resonanceQ;
    } else {
      ambientFilter.type = 'allpass';
    }

    const ambientGain = ctx.createGain();
    ambientGain.gain.value = this.enableCoreParams ? p.airGain : 0.001;

    ambientNoise.connect(ambientFilter);
    ambientFilter.connect(ambientGain);
    ambientGain.connect(merger);
    ambientNoise.start();

    // Convolver using cached spatial impulse response
    const convolver = ctx.createConvolver();
    convolver.buffer = this.getAnalyticalImpulseBuffer(presetKey, p, this.enableSecondaryParams);

    ambientGain.connect(convolver);
    convolver.connect(merger);

    merger._stop = () => {
      try { ambientNoise.stop(); } catch(e) {}
    };

    return merger;
  }

  async attachInputSource(type, deviceId = null, passthrough = true, color = 'pink', roomPreset = 'standard') {
    await this.init();

    if (this.activeInputSourceNode) {
      try { this.activeInputSourceNode.disconnect(); } catch (e) {}
      this.activeInputSourceNode = null;
    }
    if (this.currentNoiseNode) {
      try { this.currentNoiseNode.stop(); } catch (e) {}
      this.currentNoiseNode = null;
    }
    if (this.virtualRoomNode && this.virtualRoomNode._stop) {
      this.virtualRoomNode._stop();
      this.virtualRoomNode = null;
    }
    if (this.currentFileSourceNode) {
      try { this.currentFileSourceNode.stop(); } catch (e) {}
      this.currentFileSourceNode = null;
    }

    if (type === 'mic') {
      if (!this.micMediaStream || !this.micMediaStream.active) {
        await this.acquireDirectMicrophone(deviceId);
      }
      this.activeInputSourceNode = this.audioCtx.createMediaStreamSource(this.micMediaStream);
    } else if (type === 'noise') {
      this.currentNoiseNode = this.audioCtx.createBufferSource();
      this.currentNoiseNode.buffer = this.noiseBuffers[color] || this.noiseBuffers['pink'];
      this.currentNoiseNode.loop = true;
      this.currentNoiseNode.start();
      this.activeInputSourceNode = this.currentNoiseNode;
    } else if (type === 'room_indoors' || type === 'room_outdoors' || type === 'room') {
      this.virtualRoomNode = this.createVirtualRoomStream(roomPreset);
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

    this.activeInputSourceNode.connect(this.inputAnalyserNode);
    if (passthrough) {
      this.activeInputSourceNode.connect(this.dspNode);
    }
  }

  async setOutputSink(deviceId) {
    await this.init();
    const targetSink = (!deviceId || deviceId === 'default') ? '' : deviceId;

    if (typeof this.audioCtx.setSinkId === 'function') {
      try {
        if (this.audioCtx.sinkId !== targetSink) {
          await this.audioCtx.setSinkId(targetSink);
        }
        return { supported: true, fallback: false, deviceId: targetSink || 'default' };
      } catch (err) {
        return { supported: true, fallback: true, deviceId: 'default', message: err.message };
      }
    }
    return { supported: false, fallback: true, deviceId: 'default' };
  }

  setMasterGain(value) {
    if (this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setValueAtTime(parseFloat(value), this.audioCtx.currentTime);
    }
  }

  updateDSPParameters(params) {
    if (!this.dspNode || !this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    if (params.shiftHz !== undefined) this.dspNode.parameters.get('shiftHz').setValueAtTime(params.shiftHz, t);
    if (params.lfoDepthHz !== undefined) this.dspNode.parameters.get('lfoDepthHz').setValueAtTime(params.lfoDepthHz, t);
    if (params.lfoShape !== undefined) this.dspNode.parameters.get('lfoShape').setValueAtTime(params.lfoShape, t);
    if (params.lfoPolarity !== undefined) this.dspNode.parameters.get('lfoPolarity').setValueAtTime(params.lfoPolarity, t);
    if (params.lfoRateHz !== undefined) this.dspNode.parameters.get('lfoRateHz').setValueAtTime(params.lfoRateHz, t);
    if (params.wetMix !== undefined) this.dspNode.parameters.get('wetMix').setValueAtTime(params.wetMix, t);
    if (params.silenceVoids !== undefined) this.dspNode.parameters.get('silenceVoids').setValueAtTime(params.silenceVoids, t);
  }

  async determineRoomAcoustics(targetRoomPreset = 'standard') {
    await this.init();
    if (!this.micMediaStream || !this.micMediaStream.active) {
      await this.acquireDirectMicrophone();
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
      if (this.inputAnalyserNode) {
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
      }
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
    let noiseFloorDb = -60.0;
    if (this.inputAnalyserNode) {
      const freqBuf = new Uint8Array(this.inputAnalyserNode.frequencyBinCount);
      this.inputAnalyserNode.getByteFrequencyData(freqBuf);
      let maxBin = 2;
      for (let k = 2; k < 60; k++) {
        if (freqBuf[k] > freqBuf[maxBin]) maxBin = k;
      }
      dominantFreq = Math.round(maxBin * (ctx.sampleRate / this.inputAnalyserNode.fftSize));
      noiseFloorDb = (20.0 * Math.log10(Math.max(0.00001, history[history.length - 1].rms))).toFixed(1);
    }

    const targets = {
      micro_helmet: { name: "Acoustic Helmet", rt60: 0.02, res: 1150 },
      cockpit: { name: "Aircraft Cockpit", rt60: 0.05, res: 720 },
      booth: { name: "Vocal Isolation Pod", rt60: 0.08, res: 520 },
      office: { name: "Small Studio", rt60: 0.35, res: 240 },
      standard: { name: "Standard Tracking Space", rt60: 0.75, res: 175 },
      auditorium: { name: "Recital Hall", rt60: 1.80, res: 95 },
      cathedral: { name: "Gothic Cathedral", rt60: 5.50, res: 48 },
      hangar: { name: "Airship Hangar", rt60: 7.20, res: 34 },
      subterranean_vault: { name: "Salt Mine Vault", rt60: 8.80, res: 28 },
      urban_balcony: { name: "Urban Courtyard", rt60: 0.40, res: 180 },
      amphitheater: { name: "Open Amphitheater", rt60: 1.20, res: 110 },
      forest_clearing: { name: "Pine Forest", rt60: 1.90, res: 85 },
      quarry: { name: "Granite Quarry", rt60: 4.80, res: 55 },
      alpine_valley: { name: "Alpine Valley", rt60: 8.50, res: 32 },
      mega_canyon: { name: "Desert Mega-Canyon", rt60: 12.00, res: 18 }
    };

    const target = targets[targetRoomPreset] || targets.standard;
    const rt60Delta = parseFloat((measuredRt60 - target.rt60).toFixed(2));
    const resDelta = dominantFreq - target.res;
    const isClipped = maxAbsolutePeak > 0.95;

    return {
      measuredRt60,
      dominantFreq,
      noiseFloorDb,
      targetName: target.name,
      targetRt60: target.rt60,
      targetRes: target.res,
      rt60Delta,
      resDelta,
      isClipped
    };
  }

  async runOutputProbe() {
    await this.init();

    if (this.outputAnalyserNode && this.isRunning) {
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
    if (this.audioCtx.state === 'suspended') {
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
