/**
 * Hilbert SSB Frequency Shifter AudioWorkletProcessor v3.3.0
 */
class HilbertFrequencyShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'shiftHz', defaultValue: 0, minValue: -10000, maxValue: 10000 },
      { name: 'lfoDepthHz', defaultValue: 0, minValue: 0, maxValue: 1000 },
      { name: 'lfoRateHz', defaultValue: 1.0, minValue: 0.01, maxValue: 50 },
      { name: 'lfoShape', defaultValue: 0, minValue: 0, maxValue: 5 },
      { name: 'lfoPolarity', defaultValue: 0, minValue: -1, maxValue: 1 },
      { name: 'wetMix', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'silenceVoids', defaultValue: 0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.sRate = globalThis.sampleRate || 48000;
    this.twoPi = 2.0 * Math.PI;

    this.N = 127;
    this.M = 63;
    this.bufMask = 255;
    this.buffer = new Float32Array(256);
    this.bufIndex = 0;

    this.h = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      const k = i - this.M;
      if (k === 0 || k % 2 === 0) {
        this.h[i] = 0.0;
      } else {
        const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
        const w = a0 - a1 * Math.cos(2 * Math.PI * i / (this.N - 1))
                     + a2 * Math.cos(4 * Math.PI * i / (this.N - 1))
                     - a3 * Math.cos(6 * Math.PI * i / (this.N - 1));
        this.h[i] = (2.0 / (Math.PI * k)) * w;
      }
    }

    this.dcX1 = 0.0;
    this.dcY1 = 0.0;
    this.aa_x1 = 0.0; this.aa_x2 = 0.0;
    this.aa_y1 = 0.0; this.aa_y2 = 0.0;

    // Void 1: 1000–2000 Hz
    const w0_1 = this.twoPi * 1414.2 / this.sRate;
    const alpha_1 = Math.sin(w0_1) / (2.0 * 1.414);
    const cos_w0_1 = Math.cos(w0_1);
    const a0_1 = 1.0 + alpha_1;
    this.b0_1 = 1.0 / a0_1;
    this.b1_1 = (-2.0 * cos_w0_1) / a0_1;
    this.b2_1 = 1.0 / a0_1;
    this.a1_1 = (-2.0 * cos_w0_1) / a0_1;
    this.a2_1 = (1.0 - alpha_1) / a0_1;

    // Void 2: 8500–9500 Hz
    const w0_2 = this.twoPi * 8986.1 / this.sRate;
    const alpha_2 = Math.sin(w0_2) / (2.0 * 8.98);
    const cos_w0_2 = Math.cos(w0_2);
    const a0_2 = 1.0 + alpha_2;
    this.b0_2 = 1.0 / a0_2;
    this.b1_2 = (-2.0 * cos_w0_2) / a0_2;
    this.b2_2 = 1.0 / a0_2;
    this.a1_2 = (-2.0 * cos_w0_2) / a0_2;
    this.a2_2 = (1.0 - alpha_2) / a0_2;

    this.v1_s1_x1 = 0.0; this.v1_s1_x2 = 0.0; this.v1_s1_y1 = 0.0; this.v1_s1_y2 = 0.0;
    this.v1_s2_x1 = 0.0; this.v1_s2_x2 = 0.0; this.v1_s2_y1 = 0.0; this.v1_s2_y2 = 0.0;
    this.v2_s1_x1 = 0.0; this.v2_s1_x2 = 0.0; this.v2_s1_y1 = 0.0; this.v2_s1_y2 = 0.0;
    this.v2_s2_x1 = 0.0; this.v2_s2_x2 = 0.0; this.v2_s2_y1 = 0.0; this.v2_s2_y2 = 0.0;

    this.currentVoidMix = 0.0;
    this.carrierPhase = 0.0;
    this.lfoPhase = 0.0;
    this.shSample = 0.0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const inCh = input[0];
    const outCh = output[0];
    const outCh2 = output[1];
    const numSamples = inCh.length;

    const shiftHz = parameters.shiftHz;
    const lfoDepthHz = parameters.lfoDepthHz;
    const lfoRateHz = parameters.lfoRateHz;
    const lfoShape = Math.round(parameters.lfoShape[0] !== undefined ? parameters.lfoShape[0] : 0);
    const lfoPolarity = Math.round(parameters.lfoPolarity[0] !== undefined ? parameters.lfoPolarity[0] : 0);
    const wetMix = parameters.wetMix;
    const silenceVoidsActive = (parameters.silenceVoids[0] !== undefined && parameters.silenceVoids[0] > 0.5);
    const targetVoidMix = silenceVoidsActive ? 1.0 : 0.0;

    const baseShift = shiftHz[0] !== undefined ? shiftHz[0] : 0.0;
    const maxLfo = lfoDepthHz[0] !== undefined ? Math.abs(lfoDepthHz[0]) : 0.0;
    const peakPotentialShift = baseShift + maxLfo;

    let applyAA = false;
    let b0_aa = 1.0, b1_aa = 0.0, b2_aa = 0.0, a1_aa = 0.0, a2_aa = 0.0;

    if (peakPotentialShift > 100.0) {
      const nyquistCeiling = (this.sRate * 0.48) - peakPotentialShift;
      if (nyquistCeiling < 20000.0) {
        applyAA = true;
        const safeCutoff = Math.max(1500.0, nyquistCeiling);
        const w_aa = this.twoPi * safeCutoff / this.sRate;
        const cos_w_aa = Math.cos(w_aa);
        const alpha_aa = Math.sin(w_aa) / (2.0 * 0.7071);
        const a0_aa = 1.0 + alpha_aa;
        b0_aa = ((1.0 - cos_w_aa) * 0.5) / a0_aa;
        b1_aa = (1.0 - cos_w_aa) / a0_aa;
        b2_aa = b0_aa;
        a1_aa = (-2.0 * cos_w_aa) / a0_aa;
        a2_aa = (1.0 - alpha_aa) / a0_aa;
      }
    }

    for (let i = 0; i < numSamples; i++) {
      let rawSample = inCh[i];

      if (this.currentVoidMix !== targetVoidMix) {
        const step = (targetVoidMix - this.currentVoidMix) > 0 ? 0.015625 : -0.015625;
        this.currentVoidMix += step;
        if (Math.abs(this.currentVoidMix - targetVoidMix) < 0.016) {
          this.currentVoidMix = targetVoidMix;
        }
      }

      if (this.currentVoidMix > 0.001) {
        const v1_s1 = (this.b0_1 * rawSample) + (this.b1_1 * this.v1_s1_x1) + (this.b2_1 * this.v1_s1_x2) - (this.a1_1 * this.v1_s1_y1) - (this.a2_1 * this.v1_s1_y2);
        this.v1_s1_x2 = this.v1_s1_x1; this.v1_s1_x1 = rawSample;
        this.v1_s1_y2 = this.v1_s1_y1; this.v1_s1_y1 = v1_s1;

        const v1_s2 = (this.b0_1 * v1_s1) + (this.b1_1 * this.v1_s2_x1) + (this.b2_1 * this.v1_s2_x2) - (this.a1_1 * this.v1_s2_y1) - (this.a2_1 * this.v1_s2_y2);
        this.v1_s2_x2 = this.v1_s2_x1; this.v1_s2_x1 = v1_s1;
        this.v1_s2_y2 = this.v1_s2_y1; this.v1_s2_y1 = v1_s2;

        const v2_s1 = (this.b0_2 * v1_s2) + (this.b1_2 * this.v2_s1_x1) + (this.b2_2 * this.v2_s1_x2) - (this.a1_2 * this.v2_s1_y1) - (this.a2_2 * this.v2_s1_y2);
        this.v2_s1_x2 = this.v2_s1_x1; this.v2_s1_x1 = v1_s2;
        this.v2_s1_y2 = this.v2_s1_y1; this.v2_s1_y1 = v2_s1;

        const v2_s2 = (this.b0_2 * v2_s1) + (this.b1_2 * this.v2_s2_x1) + (this.b2_2 * this.v2_s2_x2) - (this.a1_2 * this.v2_s2_y1) - (this.a2_2 * this.v2_s2_y2);
        this.v2_s2_x2 = this.v2_s2_x1; this.v2_s2_x1 = v2_s1;
        this.v2_s2_y2 = this.v2_s2_y1; this.v2_s2_y1 = v2_s2;

        rawSample = ((1.0 - this.currentVoidMix) * rawSample) + (this.currentVoidMix * v2_s2);
      }

      const dcFiltered = rawSample - this.dcX1 + 0.996 * this.dcY1;
      this.dcX1 = rawSample;
      this.dcY1 = dcFiltered;

      const curLfoRate = lfoRateHz.length > 1 ? lfoRateHz[i] : lfoRateHz[0];
      const curLfoDepth = lfoDepthHz.length > 1 ? lfoDepthHz[i] : lfoDepthHz[0];

      let lfoVal = 0.0;
      switch (lfoShape) {
        case 0: lfoVal = Math.sin(this.lfoPhase); break;
        case 1: lfoVal = 2.0 * Math.abs((this.lfoPhase / Math.PI) - 1.0) - 1.0; break;
        case 2: lfoVal = this.lfoPhase < Math.PI ? 1.0 : -1.0; break;
        case 3: lfoVal = 1.0 - 2.0 * (this.lfoPhase / this.twoPi); break;
        case 4: lfoVal = 2.0 * (this.lfoPhase / this.twoPi) - 1.0; break;
        case 5: lfoVal = this.shSample; break;
      }

      let lfoMod = lfoVal;
      if (lfoPolarity === 1) {
        lfoMod = (lfoVal + 1.0) * 0.5;
      } else if (lfoPolarity === -1) {
        lfoMod = -((lfoVal + 1.0) * 0.5);
      }

      this.lfoPhase += (this.twoPi * curLfoRate) / this.sRate;
      if (this.lfoPhase >= this.twoPi) {
        this.lfoPhase = ((this.lfoPhase % this.twoPi) + this.twoPi) % this.twoPi;
        this.shSample = (Math.random() * 2.0) - 1.0;
      }

      const curShift = shiftHz.length > 1 ? shiftHz[i] : shiftHz[0];
      const instShift = curShift + (lfoMod * curLfoDepth);

      let processedInput = dcFiltered;
      if (applyAA) {
        const aa_out = (b0_aa * processedInput) + (b1_aa * this.aa_x1) + (b2_aa * this.aa_x2) - (a1_aa * this.aa_y1) - (a2_aa * this.aa_y2);
        this.aa_x2 = this.aa_x1; this.aa_x1 = processedInput;
        this.aa_y2 = this.aa_y1; this.aa_y1 = aa_out;
        processedInput = aa_out;
      }

      this.buffer[this.bufIndex] = processedInput;

      let Q = 0.0;
      for (let k = 0; k < this.N; k++) {
        const idx = (this.bufIndex - k + 256) & this.bufMask;
        Q += this.buffer[idx] * this.h[k];
      }

      const I = this.buffer[(this.bufIndex - this.M + 256) & this.bufMask];
      this.bufIndex = (this.bufIndex + 1) & this.bufMask;

      const cosPhi = Math.cos(this.carrierPhase);
      const sinPhi = Math.sin(this.carrierPhase);
      const wetSample = (I * cosPhi) - (Q * sinPhi);

      this.carrierPhase += (this.twoPi * instShift) / this.sRate;
      this.carrierPhase = ((this.carrierPhase % this.twoPi) + this.twoPi) % this.twoPi;

      const curWet = wetMix.length > 1 ? wetMix[i] : wetMix[0];
      const mixedSample = ((1.0 - curWet) * I) + (curWet * wetSample);
      const clamped = Math.max(-0.99, Math.min(0.99, mixedSample));

      outCh[i] = clamped;
      if (outCh2) outCh2[i] = clamped;
    }

    return true;
  }
}

registerProcessor('hilbert-frequency-shifter', HilbertFrequencyShifterProcessor);
