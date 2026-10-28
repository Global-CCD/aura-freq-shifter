# DSP Frequency Shifter & Live Audio Router v4.0.0

Fully refactored production Single-Page Web Application featuring clean DOM decoupling, centralized Observable state, modular CSS design tokens, and typed JSDoc architecture.

## Architecture Highlights
- **Decoupled DOM:** Zero inline event handlers (`onclick`, `onchange`). All actions route through declarative `data-action` and `data-control` attributes via document-level event delegation.
- **Dynamic `<template>` Elements:** Clean native cloning for repeatable UI components (RT60 Scorecards, Table rows).
- **Observable State Store:** Unified, subscription-driven unidirectional data flow.
- **Pure Audio Engine:** `core/audio-engine.js` has zero DOM dependencies and can be tested in isolation.
- **Static Type Safety:** Fully documented with JSDoc (`// @ts-check`).

## Local Development
```bash
npm run dev
# or
npx serve public
```
