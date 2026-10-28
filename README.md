# DSP Frequency Shifter & Live Audio Router v3.2.0

Production Single-Page Web Application featuring modular ES architecture, zero-trig k-rate anti-aliasing guard, binaural ITD spatial modeling across 9 environments (0.08 m³ to 650,000 m³), 4th-order click-free Silence Voids, and 32-bit float RT60 decay determination.

## Key Advancements in v3.2.0
- **Zero-Trig k-Rate DSP Loop:** Butterworth anti-aliasing coefficients update once per 128-sample block, removing 48,000 trig calls/second from the audio thread.
- **Click-Free Silence Voids Crossfade:** 64-sample linear gain ramp prevents audio step-transients when toggling 1–2 kHz and 8.5–9.5 kHz notches.
- **Binaural Interaural Time Difference (ITD):** Distinct delay offsets between Left and Right channels ($0.3\text{ ms}$ to $35\text{ ms}$) produce genuine 3D spatial width on headphones.
- **Microphone Clipping Detection:** RT60 analyzer flags input overload ($> 0.95$ peak).

## Local Development
```bash
npm run dev
# or
npx serve public
```
