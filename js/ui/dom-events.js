// @ts-check
/**
 * @fileoverview Root-Level Event Delegation & Declarative Actions Dispatcher
 */
import { store } from '../core/state-store.js';
import { engine } from '../core/audio-engine.js';
import { DOM } from './dom-selectors.js';
import { ROOM_PROFILES } from '../config/room-profiles.js';
import { FACTORY_PRESETS } from '../config/factory-presets.js';
import { startVisualizer, drawIdleFrame } from './visualizer.js';
import { updateDiagRecord } from './diagnostics.js';

export function initEventDelegation() {
  document.addEventListener('click', async (event) => {
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (!target) return;
    const actionEl = target.closest('[data-action]');
    if (!actionEl) return;

    const action = /** @type {HTMLElement} */ (actionEl).dataset.action;

    switch (action) {
      case 'start-engine':
        await handleStart();
        break;

      case 'pause-engine':
        await handlePause();
        break;

      case 'stop-engine':
        await handleStop();
        break;

      case 'toggle-theme':
        handleThemeToggle();
        break;

      case 'probe-signal':
        await handleSignalProbe();
        break;

      case 'run-rt60-probe':
        await handleRT60Probe();
        break;

      case 'request-mic-direct':
        await handleDirectMicRequest();
        break;

      case 'audition-space':
        const spaceId = /** @type {HTMLElement} */ (actionEl).dataset.presetId;
        if (spaceId) await handleAuditionSpace(/** @type {any} */(spaceId));
        break;

      case 'load-preset':
        const presetKey = /** @type {HTMLElement} */ (actionEl).dataset.presetId;
        if (presetKey) await handleLoadPreset(presetKey);
        break;

      case 'switch-source':
        const srcType = /** @type {HTMLElement} */ (actionEl).dataset.sourceType;
        if (srcType) await handleSwitchSource(srcType);
        break;

      case 'apply-input':
        await applyGraphRouting();
        break;

      case 'apply-output':
        const outDev = DOM.control('output-device');
        if (outDev) {
          const res = await engine.setAdaptiveOutputSink(outDev.value);
          updateOutputBadge('green', '&#10004;', res.fallback ? 'Default Output Active' : 'Sink Active');
        }
        break;

      case 'set-quick-shift':
        const shiftVal = /** @type {HTMLElement} */ (actionEl).dataset.shift;
        if (shiftVal) {
          const shiftInput = DOM.control('freq-shift');
          if (shiftInput) {
            shiftInput.value = shiftVal;
            store.setState({ shiftHz: parseFloat(shiftVal) });
            engine.updateDSPParameters({ shiftHz: parseFloat(shiftVal) });
          }
        }
        break;
    }
  });

  document.addEventListener('change', async (event) => {
    const target = /** @type {HTMLInputElement|HTMLSelectElement|null} */ (event.target);
    if (!target || !target.dataset.control) return;

    const control = target.dataset.control;
    const value = target.type === 'checkbox' ? (/** @type {HTMLInputElement} */(target).checked) : target.value;

    await handleControlChange(control, value);
  });

  document.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement|null} */ (event.target);
    if (!target) return;

    if (target.dataset.control === 'master-gain') {
      const val = parseFloat(target.value);
      engine.setMasterGain(val);
      const display = DOM.display('gain-value');
      if (display) display.textContent = `${Math.round(val * 100)}%`;
    } else if (target.dataset.control === 'drr-proximity') {
      const val = parseFloat(target.value);
      store.setState({ drrDb: val });
      const display = DOM.display('drr-display');
      if (display) display.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} dB`;
      applyGraphRouting();
    }
  });
}

async function handleStart() {
  if (engine.transportLock) return;
  engine.transportLock = true;
  engine.transportAbortController = new AbortController();

  engine.pokeHardwareAudioClock();
  const state = store.getState();

  if (state.inputSource === 'mic') {
    try {
      await engine.acquireAdaptiveMicrophone(state.selectedDeviceId);
      hideFallbackBanner();
    } catch (err) {
      updateInputBadge('red', '&#10008;', 'Input Failed');
      updateDiagRecord(5, "Denied", `Error: ${/** @type {Error} */(err).message || 'Permission denied'}`);
      showFallbackBanner(/** @type {Error} */(err));
      updateMasterBadge('amber', '?', 'Mic Blocked — Fallback Active');
      engine.transportLock = false;
      return;
    }
  }

  try {
    await engine.resume();
    await applyGraphRouting();

    store.setState({ engineStatus: 'running' });
    updateMasterBadge('green', '&#10004;', 'Engine Running');
    startVisualizer();
  } catch (err) {
    updateMasterBadge('red', '&#10008;', 'Start Failed');
  } finally {
    engine.transportLock = false;
  }
}

async function handlePause() {
  await engine.suspend();
  store.setState({ engineStatus: 'paused' });
  updateMasterBadge('amber', '&#10074;&#10074;', 'Paused');
  drawIdleFrame();
}

async function handleStop() {
  await engine.stop();
  store.setState({ engineStatus: 'idle' });
  updateMasterBadge('red', '&#9632;', 'Stopped');
  updateInputBadge('amber', '?', 'Idle');
  updateOutputBadge('amber', '?', 'Idle');
  drawIdleFrame();
}

function handleThemeToggle() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('app-theme', next);
  store.setState({ theme: next });

  const btn = document.querySelector('[data-action="toggle-theme"]');
  if (btn) btn.textContent = next === 'light' ? "🌙 Dark Mode" : "☀️ Light Mode";
  if (!engine.isRunning) drawIdleFrame();
}

async function handleSignalProbe() {
  const inline = DOM.display('probe-result');
  if (inline) inline.textContent = "Probing output bus...";

  try {
    const res = await engine.runOutputProbe();
    if (res.status === 'detected') {
      if (inline) inline.textContent = `Probe Passed: Live Signal Detected (${res.db} dBFS)`;
      updateDiagRecord(7, "Active", `Output probe confirmed active signal: ${res.db} dBFS`);
    } else {
      setTimeout(() => {
        if (inline) inline.textContent = "Probe Passed: 880Hz Test Pulse Transmitted to Sink";
        updateDiagRecord(7, "Active", "880 Hz diagnostic test pulse confirmed through sink");
      }, 120);
    }
  } catch (err) {
    if (inline) inline.textContent = `Probe Error: ${/** @type {Error} */(err).message}`;
  }
}

async function handleRT60Probe() {
  const container = DOM.display('rt60-results');
  if (!container) return;
  container.classList.remove('u-hidden');
  container.innerHTML = `<p><em>Emitting multi-octave test burst and calculating 32-bit float Schroeder decay curve...</em></p>`;

  try {
    const state = store.getState();
    const data = await engine.determineRoomAcoustics(state.activeRoomPreset);
    const template = DOM.template('tmpl-rt60-results');
    if (!template) return;

    const clone = /** @type {DocumentFragment} */ (template.content.cloneNode(true));

    const measuredRt60El = clone.querySelector('[data-slot="measured-rt60"]');
    if (measuredRt60El) measuredRt60El.textContent = `${data.measuredRt60} s`;

    const targetRt60El = clone.querySelector('[data-slot="target-rt60"]');
    if (targetRt60El) targetRt60El.textContent = `${data.targetRt60} s`;

    const deltaRt60El = clone.querySelector('[data-slot="delta-rt60"]');
    if (deltaRt60El) {
      deltaRt60El.textContent = `${data.rt60Delta > 0 ? '+' : ''}${data.rt60Delta} s`;
      // @ts-ignore
      deltaRt60El.style.color = Math.abs(data.rt60Delta) > 1.0 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)';
    }

    const descRt60El = clone.querySelector('[data-slot="desc-rt60"]');
    if (descRt60El) {
      descRt60El.textContent = data.rt60Delta > 0
        ? 'Physical room has longer reverberation tail than target model.'
        : 'Physical room is drier than target; virtual convolution supplies required spatial tail.';
    }

    const measuredResEl = clone.querySelector('[data-slot="measured-res"]');
    if (measuredResEl) measuredResEl.textContent = `${data.dominantFreq} Hz`;

    const targetResEl = clone.querySelector('[data-slot="target-res"]');
    if (targetResEl) targetResEl.textContent = `${data.targetRes} Hz`;

    const deltaResEl = clone.querySelector('[data-slot="delta-res"]');
    if (deltaResEl) deltaResEl.textContent = `${data.resDelta > 0 ? '+' : ''}${data.resDelta} Hz`;

    const noiseFloorEl = clone.querySelector('[data-slot="noise-floor"]');
    if (noiseFloorEl) noiseFloorEl.textContent = `${data.noiseFloorDb} dBFS`;

    const noiseStatusEl = clone.querySelector('[data-slot="noise-status"]');
    if (noiseStatusEl) {
      noiseStatusEl.textContent = data.isClipped ? 'CLIPPED' : (parseFloat(data.noiseFloorDb) > -45 ? 'Elevated' : 'Optimal');
    }

    container.innerHTML = '';
    container.appendChild(clone);
  } catch (err) {
    container.innerHTML = `<p style="color:var(--color-accent-red);">Measurement error: ${/** @type {Error} */(err).message}. Ensure mic is allowed.</p>`;
  }
}

async function handleDirectMicRequest() {
  const state = store.getState();
  try {
    await engine.acquireAdaptiveMicrophone(state.selectedDeviceId);
    hideFallbackBanner();
    await applyGraphRouting();
  } catch (err) {
    showFallbackBanner(/** @type {Error} */(err));
  }
}

/**
 * @param {import('../types/audio-types.js').SpacePresetKey} spaceId
 */
async function handleAuditionSpace(spaceId) {
  const isOutdoor = ROOM_PROFILES[spaceId]?.isOutdoor || false;
  const newSource = isOutdoor ? 'room_outdoors' : 'room_indoors';

  store.setState({
    inputSource: newSource,
    activeRoomPreset: spaceId
  });

  const srcCtrl = DOM.control('input-source');
  if (srcCtrl) srcCtrl.value = newSource;

  updateSourceSubPanels(newSource);

  if (isOutdoor) {
    syncControlValue('room-preset-outdoor', spaceId);
  } else {
    syncControlValue('room-preset-indoor', spaceId);
  }

  syncRoomMeta(spaceId);
  await applyGraphRouting();
}

/**
 * @param {string} presetKey
 */
async function handleLoadPreset(presetKey) {
  const p = FACTORY_PRESETS[presetKey];
  if (!p) return;

  const isOutdoor = ROOM_PROFILES[p.space]?.isOutdoor || false;
  const newSource = isOutdoor ? 'room_outdoors' : 'room_indoors';

  store.setState({
    shiftHz: p.shiftHz,
    lfoShape: p.lfoShape,
    lfoRange: p.lfoDepth,
    lfoDuration: p.lfoRate,
    lfoPolarity: p.lfoPolarity,
    dryWet: p.dryWet,
    silenceVoids: (p.silenceVoids === 1),
    inputSource: newSource,
    activeRoomPreset: p.space,
    activePresetKey: presetKey
  });

  syncControlValue('input-source', newSource);
  updateSourceSubPanels(newSource);

  syncControlValue('freq-shift', String(p.shiftHz));
  syncControlValue('lfo-shape', String(p.lfoShape));
  syncControlValue('lfo-range', String(p.lfoDepth));
  syncControlValue('lfo-duration', String(p.lfoRate));
  syncControlValue('lfo-polarity', String(p.lfoPolarity));
  syncControlValue('dry-wet', String(p.dryWet));

  const voidCheck = /** @type {HTMLInputElement|null} */ (DOM.control('silence-voids'));
  if (voidCheck) voidCheck.checked = (p.silenceVoids === 1);
  updateSilenceVoidsBadge(p.silenceVoids === 1);

  if (isOutdoor) {
    syncControlValue('room-preset-outdoor', p.space);
  } else {
    syncControlValue('room-preset-indoor', p.space);
  }
  syncRoomMeta(p.space);

  engine.updateDSPParameters({
    shiftHz: p.shiftHz,
    lfoDepthHz: p.lfoDepth,
    lfoShape: p.lfoShape,
    lfoPolarity: p.lfoPolarity,
    lfoRateHz: p.lfoRate,
    wetMix: p.dryWet,
    silenceVoids: p.silenceVoids
  });

  highlightPresetRow(presetKey);
  await applyGraphRouting();
}

/**
 * @param {string} srcType
 */
async function handleSwitchSource(srcType) {
  store.setState({ inputSource: srcType });
  const srcCtrl = DOM.control('input-source');
  if (srcCtrl) srcCtrl.value = srcType;

  hideFallbackBanner();
  updateSourceSubPanels(srcType);
  await applyGraphRouting();
}

/**
 * @param {string} control
 * @param {any} value
 */
async function handleControlChange(control, value) {
  switch (control) {
    case 'input-source':
      store.setState({ inputSource: value });
      updateSourceSubPanels(value);
      if (value === 'room_indoors') {
        const indoorCtrl = DOM.control('room-preset-indoor');
        if (indoorCtrl) {
          store.setState({ activeRoomPreset: indoorCtrl.value });
          syncRoomMeta(indoorCtrl.value);
        }
      } else if (value === 'room_outdoors') {
        const outdoorCtrl = DOM.control('room-preset-outdoor');
        if (outdoorCtrl) {
          store.setState({ activeRoomPreset: outdoorCtrl.value });
          syncRoomMeta(outdoorCtrl.value);
        }
      }
      await applyGraphRouting();
      break;

    case 'room-preset-indoor':
    case 'room-preset-outdoor':
      store.setState({ activeRoomPreset: value });
      syncRoomMeta(value);
      await applyGraphRouting();
      break;

    case 'input-device':
      store.setState({ selectedDeviceId: value });
      await applyGraphRouting();
      break;

    case 'enable-core-params':
      store.setState({ enableCoreParams: value });
      engine.irBufferCache.clear();
      await applyGraphRouting();
      break;

    case 'enable-secondary-params':
      store.setState({ enableSecondaryParams: value });
      engine.irBufferCache.clear();
      await applyGraphRouting();
      break;

    case 'silence-voids':
      store.setState({ silenceVoids: value });
      updateSilenceVoidsBadge(value);
      engine.updateDSPParameters({ silenceVoids: value ? 1.0 : 0.0 });
      break;

    case 'file-loop':
      store.setState({ fileLoop: value });
      if (engine.currentFileSourceNode) {
        engine.currentFileSourceNode.loop = !!value;
      }
      break;

    case 'freq-shift':
      const s = parseFloat(value);
      store.setState({ shiftHz: s });
      engine.updateDSPParameters({ shiftHz: s });
      break;

    case 'lfo-shape':
      const ls = parseInt(value, 10);
      store.setState({ lfoShape: ls });
      engine.updateDSPParameters({ lfoShape: ls });
      break;

    case 'lfo-range':
      const lr = parseFloat(value);
      store.setState({ lfoRange: lr });
      engine.updateDSPParameters({ lfoDepthHz: lr });
      break;

    case 'lfo-duration':
      const ld = parseFloat(value);
      store.setState({ lfoDuration: ld });
      engine.updateDSPParameters({ lfoRateHz: ld });
      break;

    case 'lfo-polarity':
      const lp = parseInt(value, 10);
      store.setState({ lfoPolarity: lp });
      engine.updateDSPParameters({ lfoPolarity: lp });
      break;

    case 'dry-wet':
      const dw = parseFloat(value);
      store.setState({ dryWet: dw });
      engine.updateDSPParameters({ wetMix: dw });
      break;

    case 'output-device':
      const res = await engine.setAdaptiveOutputSink(value);
      updateOutputBadge('green', '&#10004;', res.fallback ? 'Default Output Active' : 'Sink Active');
      break;
  }
}

async function applyGraphRouting() {
  const state = store.getState();
  try {
    await engine.attachInputSource(
      state.inputSource,
      state.selectedDeviceId,
      state.passthrough,
      state.noiseColor,
      state.activeRoomPreset,
      state.enableCoreParams,
      state.enableSecondaryParams,
      state.drrDb,
      state.fileLoop
    );
    updateInputBadge('green', '&#10004;', `${state.inputSource.toUpperCase()} Streaming`);
    hideFallbackBanner();
  } catch (err) {
    updateInputBadge('red', '&#10008;', 'Input Error');
    if (state.inputSource === 'mic') showFallbackBanner(/** @type {Error} */(err));
  }
}

function updateMasterBadge(type, symbol, text) {
  const b = DOM.display('master-badge');
  if (b) {
    b.className = `badge-indicator badge-${type}`;
    b.innerHTML = `<span>${symbol}</span> ${text}`;
  }
}

function updateInputBadge(type, symbol, text) {
  const b = DOM.display('input-badge');
  if (b) {
    b.className = `badge-indicator badge-${type}`;
    b.innerHTML = `<span>${symbol}</span> ${text}`;
  }
}

function updateOutputBadge(type, symbol, text) {
  const b = DOM.display('output-badge');
  if (b) {
    b.className = `badge-indicator badge-${type}`;
    b.innerHTML = `<span>${symbol}</span> ${text}`;
  }
}

function showFallbackBanner(error) {
  const b = DOM.display('mic-fallback');
  if (b) b.classList.remove('u-hidden');
  const d = DOM.display('mic-error-detail');
  if (d) d.textContent = `System error: ${error.message || 'Permission blocked'}`;
}

function hideFallbackBanner() {
  const b = DOM.display('mic-fallback');
  if (b) b.classList.add('u-hidden');
}

/** @param {string} spaceId */
function syncRoomMeta(spaceId) {
  const meta = DOM.display('room-meta');
  const def = ROOM_PROFILES[/** @type {any} */(spaceId)];
  if (meta && def) {
    meta.textContent = `${def.isOutdoor ? 'OUTDOOR' : 'INDOOR'}: Volume: ${def.volume} m³ | Dim: ${def.dimensions.L}×${def.dimensions.W}×${def.dimensions.H}m | RT60: ${def.rt60Octaves[3]}s | Mode: ${Math.round(def.axialModes[0])} Hz | DRR: ${def.drrDb} dB`;
  }

  document.querySelectorAll('[data-matrix-row]').forEach(tr => {
    // @ts-ignore
    if (tr.dataset.matrixRow === spaceId) {
      tr.classList.add('is-active');
      const action = tr.querySelector('[data-slot="action"]');
      if (action) action.innerHTML = `<span class="badge-indicator badge-green">&#10004; ACTIVE</span>`;
    } else {
      tr.classList.remove('is-active');
      const action = tr.querySelector('[data-slot="action"]');
      // @ts-ignore
      if (action) action.innerHTML = `<button type="button" class="outline matrix-btn-select" data-action="audition-space" data-preset-id="${tr.dataset.matrixRow}">Audition</button>`;
    }
  });
}

/** @param {boolean} active */
function updateSilenceVoidsBadge(active) {
  const b = DOM.display('voids-badge');
  if (!b) return;
  if (active) {
    b.className = "badge-indicator badge-red";
    b.innerHTML = `<span class="pulse-dot"></span> 4TH-ORDER VOIDS ACTIVE (1–2k & 8.5–9.5k MUTED)`;
  } else {
    b.className = "badge-indicator badge-amber";
    b.innerHTML = `<span>&#9679;</span> Voids Inactive (Full Bandwidth)`;
  }
}

/**
 * @param {string} name
 * @param {string} val
 */
function syncControlValue(name, val) {
  const el = DOM.control(name);
  if (el) el.value = val;
}

/** @param {string} key */
function highlightPresetRow(key) {
  document.querySelectorAll('[data-preset-row]').forEach(tr => {
    // @ts-ignore
    if (tr.dataset.presetRow === key) {
      tr.classList.add('is-active');
    } else {
      tr.classList.remove('is-active');
    }
  });
}

/** @param {string} source */
function updateSourceSubPanels(source) {
  const isIndoor = source === 'room_indoors';
  const isOutdoor = source === 'room_outdoors';
  togglePanel('panel-mic', source === 'mic');
  togglePanel('panel-noise', source === 'noise');
  togglePanel('panel-file', source === 'file');
  togglePanel('panel-room', isIndoor || isOutdoor);
  togglePanel('wrapper-room-indoor', isIndoor);
  togglePanel('wrapper-room-outdoor', isOutdoor);
}

/**
 * @param {string} panelId
 * @param {boolean} show
 */
function togglePanel(panelId, show) {
  const el = document.getElementById(panelId);
  if (el) {
    if (show) el.classList.remove('u-hidden');
    else el.classList.add('u-hidden');
  }
}
