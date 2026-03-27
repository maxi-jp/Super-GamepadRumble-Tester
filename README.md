# 🎮 Super Gamepad Rumble Tester

Interactive browser-based haptic feedback tester — fire named rumble presets or dial custom strong/weak motor intensities live with the triggers. No install, no dependencies, just open and feel.

**[▶ Try it live](https://maxi-jp.github.io/Super-GamepadRumble-Tester/)**

---

## Features

- **4 named presets** — each mapped to a face button (A/B/X/Y) or keyboard keys 1–4:
  - 🟢 **Tap** — short, light high-freq buzz (`weak: 0.4, 80ms`)
  - 🔴 **Impact** — sudden heavy hit (`strong: 1, weak: 0.5, 300ms`)
  - 🟡 **Engine** — low continuous rumble (`strong: 0.6, weak: 0.2, 1000ms`)
  - 🟣 **Buzz** — sustained high-freq vibration (`weak: 1, 600ms`)
- **Custom section** — pull LT (strong motor) and RT (weak motor) to any intensity, then fire with START or Enter
- **Live API display** — the exact `Input.RumbleGamepad()` or `Input.ExecuteRumble()` call is shown after each trigger
- **No install, no build step** — open `index.html` in any modern Chromium browser and plug in a gamepad

---

## Usage

1. Clone or download this repository
2. Open `index.html` in a browser (Chrome or Edge recommended — Firefox does not support the Vibration API for gamepads)
3. Connect a gamepad via USB or Bluetooth
4. Press A / B / X / Y (or keys 1–4) to fire presets, or pull the triggers for a custom effect

> **Browser support:** Chrome and Edge support the [Gamepad Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator). Firefox and Safari do not currently support rumble.

---

## Project structure

```
index.html        # Entry point & page shell
styles.css        # CSS styles
engine.js         # HTML5_Engine bundle (renderer, input, game loop…)
rumble_test.js    # Rumble tester game logic
```

---

## Built with

[HTML5_Engine](https://github.com/maxi-jp/HTML5_Engine) — a lightweight vanilla-JS 2D game engine with Canvas/WebGL rendering and a unified input system including `Input.RumbleGamepad()`, `Input.RegisterRumble()`, and `Input.ExecuteRumble()`.

---
