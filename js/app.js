// @ts-check
/**
 * @fileoverview Application Composition Root & Automated Startup Coordinator
 */
import { store } from './core/state-store.js';
import { engine } from './core/audio-engine.js';
import { DOM } from './ui/dom-selectors.js';
import { initEventDelegation } from './ui/dom-events.js';
import { syncCanvasDimensions, drawIdleFrame } from './ui/visualizer.js';
import { initDiagnosticsTable, runPreFlightHealthCheck } from './ui/diagnostics.js';

window.addEventListener("DOMContentLoaded", async () => {
  // 1. Theme initialization
  const savedTheme = localStorage.getItem('app-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  store.setState({ theme: savedTheme });

  // 2. Visualizer High-DPI sizing and idle frame
  syncCanvasDimensions();
  drawIdleFrame();

  const resizeObserver = new ResizeObserver(() => {
    syncCanvasDimensions();
    if (!engine.isRunning) drawIdleFrame();
  });
  const vizWrapper = document.querySelector(".visualizer-wrapper");
  if (vizWrapper) resizeObserver.observe(vizWrapper);

  // 3. Root-Level Event Delegation
  initEventDelegation();

  // 4. Audio File Upload handler
  const fileInput = /** @type {HTMLInputElement|null} */ (DOM.control('file-input'));
  if (fileInput) {
    fileInput.addEventListener('change', async (evt) => {
      // @ts-ignore
      const file = evt.target.files[0];
      if (!file) return;
      const info = DOM.display('file-info');
      if (info) info.textContent = `Decoding ${file.name}...`;

      await engine.init();
      if (!engine.audioCtx) return;
      try {
        const buf = await file.arrayBuffer();
        engine.fileAudioBuffer = await engine.audioCtx.decodeAudioData(buf);
        if (info) info.textContent = `Ready: ${file.name} (${engine.fileAudioBuffer.duration.toFixed(1)}s)`;
      } catch (e) {
        if (info) info.textContent = `Decode error: ${/** @type {Error} */(e).message}`;
      }
    });
  }

  // 5. Hardware Device Change listener
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      await runPreFlightHealthCheck();
    });
  }

  // 6. Automated Diagnostics: Initiates immediately on app load
  await initDiagnosticsTable();
  await runPreFlightHealthCheck();
});
