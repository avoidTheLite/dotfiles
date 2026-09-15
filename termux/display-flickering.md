# Termux Display Flickering & Phase Alignment Investigation on Samsung Galaxy Tablets

This repo applies workaround 2 (`disable-terminal-margin-adjustment = true`) when `scripts/install.sh` detects Termux. Reload with `termux-reload-settings`. Workaround 3 stays commented in `termux/termux.properties`.

## Executive Summary
This document consolidates the diagnostic observations, technical root-cause analysis, system assumptions, and verified architectural behaviors regarding display flickering when running **Termux** in windowed and desktop modes (One UI / Samsung DeX) on Samsung Galaxy tablets.

---

## 1. System Context & Configuration
* **Device Environment:** Samsung Galaxy Tablet running One UI with Samsung DeX / Desktop mode support.
* **Display Operating Modes:**
  * **Tablet Mode (Standard Android):** Native multi-window split-screen and floating pop-up windows.
  * **Desktop Workspaces (Desktop 1, Desktop 2):** Virtual PC-like desktop spaces provided by Samsung DeX where applications are managed inside freeform movable windows.
* **Input Setup:** Samsung floating on-screen keyboard (does not physically dock or compress the application viewport height).

---

## 2. Empirical Observations & Clues

| # | Observation | Engineering Implication |
|---|---|---|
| **Clue 1** | **Extra Keys Height Shift & Ghosting:** In fullscreen or desktop mode, flickering is localized to the `ExtraKeysView`. Rows blink alternately with an overlapping "ghost row" in between. | Dual-frame buffer overlap. The GPU compositor fails to clear the previous frame buffer before redrawing the next layout pass. |
| **Clue 2** | **Intermittent Pause on Interaction:** Switching windows, refocusing, or toggling keyboard input pauses the flicker momentarily before it resumes. | System interactions trigger a global layout invalidation pass and V-Sync sync reset. Once idle, the timing loop drifts out of phase again. |
| **Clue 3** | **Text Overlap Trigger:** The main console content remains stable unless text approaches or overlaps the upper margin of the extra keys, causing the full canvas to flicker. | Boundary collision between two distinct UI subsystems: hardware-accelerated grid canvas (`TerminalView`) vs. standard Android layout widgets (`ExtraKeysView`). |
| **Clue 4** | **Sub-Visual Strobing (The "Smoking Gun"):** Stationary viewing appears stable, but head or eye movement reveals high-frequency on/off blinking. Terminal text remains high-refresh and solid. | Frame-rate mismatch interleaving. The layout is executing at an asynchronous fractional rate of the physical display refresh rate. |
| **Clue 5** | **60Hz vs. 90Hz Asymmetry:** At 60Hz, flicker is chaotic and aggressive (~50/50 duty cycle). At 90Hz, one row is visibly more solid/preferential. | Phase alignment / beat frequency. At 90Hz, one draw pass periodically aligns with a physical V-Sync strike, anchoring one row while the other slips. |
| **Clue 6** | **Power Saving Immediate Failure:** Enabling standard power saving (CPU capped at 70%, refresh locked to 60Hz) eliminates the temporary interaction pause and locks immediately into continuous blinking. | CPU throttling strips away execution headroom required by the layout thread to catch up and re-synchronize with the display clock. |
| **Clue 7** | **Snap vs. Freeform Discrepancy:** Snapping Termux to the left or right (split-screen) permanently eliminates flickering across both 60Hz and 90Hz, even when resized. Unsnapping into a freeform pop-over window immediately reintroduces flickering once resized. | Distinct Android API pipelines: Multi-Window Split-Screen API (static boundaries, prioritized V-Sync anchor) vs. Freeform / DeX Window API (dynamic padding, off-pipeline composition). |

---

## 3. Root Cause Analysis (Physics & Systems Architecture)

### A. Discrete Cell Quantization vs. Continuous Freeform Boundaries
* Standard mobile applications interpolate layouts smoothly across fractional dimensions.
* Termux strictly quantizes its viewport into discrete character cells ($Height_{cell} \times Width_{cell}$).
* An arbitrarily resized freeform window creates non-integer remaining space (e.g., $24.37$ rows).
* `TerminalView` rounds integer character heights while `ExtraKeysView` anchors to dynamic window pixel borders, forcing an infinite sub-pixel rounding calculation loop.

### B. Frame Rate Mismatch & Beat Frequency (Phase Slip)
* The Android `Choreographer` issues V-Sync pulses tied to the hardware panel clock ($90\text{Hz} = 11.1\text{ms}$, $60\text{Hz} = 16.6\text{ms}$).
* Dynamic DeX desktop overlays and power-saving profiles introduce fractional scaling and pull-down ratios (e.g., 3:2 pull-down between 60Hz logical targets and 90Hz panel clocks).
* The layout recalculation loop delays frame readiness beyond the V-Sync deadline, causing the frame submission clock to drift against the hardware display wipe.

### C. Surface Composition Pipeline (Split-Screen vs. Freeform)
* **Split-Screen API (Stable):** Android assigns fixed window bounds with direct hardware-accelerated canvas mapping and high-priority V-Sync anchoring.
* **Freeform Pop-Over API (Flickering):** Windows are treated as floating surfaces with dynamic shadow padding. The compositor manages them via an asynchronous secondary layer, where fractional margin invalidations continuously trigger buffer swaps out of sync.

---

## 4. Validated Source & Documentation Details

* **Terminal Margin Adjustment:** Termux source code incorporates an automated margin-shift mechanism designed to prevent docked soft keyboards from obscuring terminal rows. In windowed/freeform configurations, this logic misinterprets window boundaries, driving cyclic layout invalidations.
* **Android Variable Refresh Rate (VRR) & Choreographer:** Android enforces frame dispatch deadlines locked to integer subdivisions of the panel Tearing Effect (TE) clock. Missed deadlines cascade into dropped frames and jank.
* **Dumpsys Graphic Diagnostics (`dumpsys gfxinfo`):** Android provides low-level performance telemetry tracking `Draw`, `Process`, `Issue`, and `Swap Buffers` latency, recording frame drops as "Janky frames."

---

## 5. Summary of Mitigations & Workarounds

1. **Window Snapping (Most Robust):** Keep Termux snapped into a 2-way or 3-way split-screen partition rather than a loose floating pop-over window.
2. **Disable Margin Adjustments:**
   Add `disable-terminal-margin-adjustment = true` to `~/.termux/termux.properties` and reload via `termux-reload-settings`.
3. **Disable Extra Keys View:**
   If using an external or floating keyboard exclusively, set `extra-keys = []` in `termux.properties` to eliminate the competing UI layout container.
4. **Hardware Overlay Enforcement:**
   In Android Developer Options, enable **Disable HW overlays** to force the GPU to handle composition directly and eliminate ghost frame buffers.
