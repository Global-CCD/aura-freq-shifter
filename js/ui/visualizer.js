// @ts-check
/**
 * @fileoverview High-DPI Canvas Oscilloscope with Startup Detection Grace Window
 */
import { engine } from '../core/audio-engine.js';
import { DOM } from './dom-selectors.js';

let animFrameId = null;

export function syncCanvasDimensions() {
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById("scopeCanvas"));
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }
}

export function drawIdleFrame() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById("scopeCanvas"));
  if (!canvas) return;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  const w = canvas.width;
  const h = canvas.height;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  ctx2d.fillStyle = isDark ? "#05070a" : "#f6f8fa";
  ctx2d.fillRect(0, 0, w, h);

  ctx2d.strokeStyle = isDark ? "#161b22" : "#e1e4e8";
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.moveTo(0, h / 2);
  ctx2d.lineTo(w, h / 2);
  ctx2d.stroke();
}

export function startVisualizer() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById("scopeCanvas"));
  if (!canvas) return;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  function render() {
    if (!engine.isRunning) {
      drawIdleFrame();
      return;
    }

    animFrameId = requestAnimationFrame(render);
    const w = canvas.width;
    const h = canvas.height;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    const bgColor = isDark ? "#05070a" : "#f6f8fa";
    const gridColor = isDark ? "#161b22" : "#e1e4e8";
    const outWaveColor = isDark ? "#2ecc71" : "#16a34a";
    const inWaveColor = isDark ? "#38bdf8" : "#0284c7";

    ctx2d.fillStyle = bgColor;
    ctx2d.fillRect(0, 0, w, h);

    const modeSelect = /** @type {HTMLSelectElement|null} */ (DOM.control("monitor-mode"));
    const mode = modeSelect ? modeSelect.value : "dual-overlay";

    if (!engine.inputAnalyserNode || !engine.outputAnalyserNode) return;

    const bufferLength = engine.outputAnalyserNode.frequencyBinCount;
    const inputBuf = new Float32Array(bufferLength);
    const outputBuf = new Float32Array(bufferLength);

    engine.inputAnalyserNode.getFloatTimeDomainData(inputBuf);
    engine.outputAnalyserNode.getFloatTimeDomainData(outputBuf);

    const metrics = engine.getOutputMetrics();
    const confirmBadge = DOM.display("sound-confirmed-badge");

    // Startup Detection Grace Window (400ms buffer clearance before testing silence)
    const elapsedSinceStart = Date.now() - engine.startTime;

    if (confirmBadge) {
      if (elapsedSinceStart < 400 && !metrics.isSoundActive) {
        confirmBadge.className = "badge-indicator badge-amber";
        confirmBadge.innerHTML = `<span class="pulse-dot"></span> DETECTING SIGNAL...`;
      } else if (metrics.isSoundActive) {
        confirmBadge.className = "badge-indicator badge-green";
        confirmBadge.innerHTML = `<span class="pulse-dot"></span> SOUND CONFIRMED (${metrics.peakDb.toFixed(1)} dBFS)`;
      } else {
        confirmBadge.className = "badge-indicator badge-amber";
        confirmBadge.innerHTML = `<span>●</span> OUTPUT SILENT (&lt; -50 dBFS)`;
      }
    }

    const dspLoadEl = DOM.display("dsp-load");
    if (dspLoadEl) {
      const peakDisplay = metrics.peakDb > -58 ? `${metrics.peakDb.toFixed(1)} dB` : "-inf dB";
      dspLoadEl.textContent = `${engine.audioCtx ? engine.audioCtx.sampleRate : 48000} Hz | Peak: ${peakDisplay}`;
    }

    const dpr = window.devicePixelRatio || 1;

    if (mode === "split-stacked") {
      const halfH = h / 2;
      ctx2d.strokeStyle = gridColor;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, halfH / 2); ctx2d.lineTo(w, halfH / 2);
      ctx2d.moveTo(0, halfH); ctx2d.lineTo(w, halfH);
      ctx2d.moveTo(0, halfH + halfH / 2); ctx2d.lineTo(w, halfH + halfH / 2);
      ctx2d.stroke();

      ctx2d.lineWidth = 2 * dpr;
      ctx2d.strokeStyle = inWaveColor;
      ctx2d.beginPath();
      let sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = inputBuf[i];
        const y = (halfH / 2) + (v * (halfH / 2));
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();

      ctx2d.strokeStyle = outWaveColor;
      ctx2d.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = outputBuf[i];
        const y = halfH + (halfH / 2) + (v * (halfH / 2));
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();
      return;
    }

    ctx2d.lineWidth = 1;
    ctx2d.strokeStyle = gridColor;
    ctx2d.beginPath();
    ctx2d.moveTo(0, h / 2);
    ctx2d.lineTo(w, h / 2);
    ctx2d.stroke();

    const sliceWidth = w / bufferLength;

    if (mode === "dual-overlay" || mode === "input-only") {
      ctx2d.lineWidth = (mode === "dual-overlay" ? 1.8 : 2.0) * dpr;
      ctx2d.strokeStyle = inWaveColor;
      ctx2d.beginPath();
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = inputBuf[i];
        const y = (h / 2) + (v * (h / 2));
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();
    }

    if (mode === "dual-overlay" || mode === "output-only") {
      ctx2d.lineWidth = 2.0 * dpr;
      ctx2d.strokeStyle = outWaveColor;
      ctx2d.beginPath();
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = outputBuf[i];
        const y = (h / 2) + (v * (h / 2));
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();
    }
  }

  render();
}
