/**
 * Rumble / Haptic Feedback test — HTML UI version
 *
 * Same four named presets as rumble_test.js but the entire UI is built
 * from HTML elements managed through the HTMLMenu system.
 *
 * The canvas (640x180) is used only as an animation strip: ring bursts
 * expand outward in the preset's color whenever a rumble effect fires.
 * All interactive controls (preset buttons, trigger bars, last-call
 * snippet) live in the #rumblePanel div outside the canvas.
 */

const RUMBLE_PRESETS = [
    { id: "presetTap",    label: "Tap",    button: "FACE_DOWN",  strong: 0,   weak: 0.4, duration: 80,   colorHex: "#4ade80" },
    { id: "presetImpact", label: "Impact", button: "FACE_RIGHT", strong: 1,   weak: 0.5, duration: 300,  colorHex: "#f87171" },
    { id: "presetEngine", label: "Engine", button: "FACE_LEFT",  strong: 0.6, weak: 0.2, duration: 1000, colorHex: "#fbbf24" },
    { id: "presetBuzz",   label: "Buzz",   button: "FACE_UP",    strong: 0,   weak: 1,   duration: 600,  colorHex: "#c084fc" },
];

// ─────────────────────────────────────────────────────────────────
//  HTML UI panel — extends HTMLMenu
// ─────────────────────────────────────────────────────────────────

class RumbleUI extends HTMLMenu {
    constructor(game, canvas) {
        super(game, "#rumblePanel", "#container", canvas, true);
        this._lastStatus = null;
        this._lastLt     = -1;
        this._lastRt     = -1;
    }

    Start() {
        super.Start();

        this.SetupElements([
            "#statusDot",
            "#statusText",
            "#ltBar",
            "#rtBar",
            "#ltValue",
            "#rtValue",
            "#lastCallSnippet",
        ]);

        this.SetupButtons([
            { selector: "#presetTap",    callback: () => this.game.OnPresetClick(0) },
            { selector: "#presetImpact", callback: () => this.game.OnPresetClick(1) },
            { selector: "#presetEngine", callback: () => this.game.OnPresetClick(2) },
            { selector: "#presetBuzz",   callback: () => this.game.OnPresetClick(3) },
            { selector: "#fireBtn",      callback: () => this.game.OnFireCustom() },
        ]);
    }

    // Updates the status bar only when the value actually changes.
    SetStatus(text, connected) {
        if (text === this._lastStatus) return;
        this._lastStatus = text;
        this.elements["#statusText"].textContent = text;
        const dot = this.elements["#statusDot"];
        if (connected) dot.classList.add("connected");
        else           dot.classList.remove("connected");
    }

    // Updates LT / RT bars and values, suppressing updates when unchanged.
    SetBars(lt, rt) {
        if (lt !== this._lastLt) {
            this._lastLt = lt;
            this.elements["#ltBar"].style.width    = (lt * 100).toFixed(1) + "%";
            this.elements["#ltValue"].textContent  = lt.toFixed(3);
        }
        if (rt !== this._lastRt) {
            this._lastRt = rt;
            this.elements["#rtBar"].style.width    = (rt * 100).toFixed(1) + "%";
            this.elements["#rtValue"].textContent  = rt.toFixed(3);
        }
    }

    // Shows the last fired API call in the snippet area.
    SetLastCall(text, colorHex) {
        const el = this.elements["#lastCallSnippet"];
        el.textContent = text;
        el.style.color = colorHex;
        el.classList.remove("placeholder");
    }

    // Briefly flashes the active preset card.
    FlashPreset(index) {
        const btn = document.querySelector(`#${RUMBLE_PRESETS[index].id}`);
        if (!btn) return;
        btn.classList.add("active");
        setTimeout(() => btn.classList.remove("active"), 350);
    }
}

// ─────────────────────────────────────────────────────────────────
//  Game — canvas animation + input routing
// ─────────────────────────────────────────────────────────────────

class RumbleTestHtml extends Game {
    constructor(renderer) {
        super(renderer);

        this.Configure({ screenWidth: 640, screenHeight: 640 });

        this.ui             = null; // reference to the RumbleUI (HTMLMenu)
        this.customStrong   = 0;
        this.customWeak     = 0;
        this.bursts         = [];  // active ring-burst animations
        this.failBursts     = [];  // "no gamepad" error animations
        this.waveTime       = 0;
        this.motorStrong    = 0;   // strong motor value of the currently playing rumble
        this.motorWeak      = 0;   // weak motor value of the currently playing rumble
        this.motorRemaining = 0;   // seconds remaining in the active preset/custom rumble
        this.motorColor     = { r: 0.388, g: 0.400, b: 0.941 };  // preset accent color (indigo default)
        this.smoothStrong   = 0;   // lerped effective strong — instant attack, slow decay
        this.smoothWeak     = 0;   // lerped effective weak   — instant attack, slow decay

        // Stable color instances (avoid per-frame allocation)
        this.colorBg      = Color.FromHex("#0d0f14");
        this.colorIdleDot = Color.FromHex("#1e293b");
        this.colorFail    = Color.FromHex("#f87171");

        drawStats = false;
    }

    Start() {
        super.Start();

        // Register all presets — single source of truth
        for (const p of RUMBLE_PRESETS) {
            Input.RegisterRumble(p.label, p.strong, p.weak, p.duration);
        }

        this.ui = new RumbleUI(this, canvas);
        this.ui.Start();
    }

    // ── Public methods called by both HTML buttons and gamepad/keyboard ──

    OnPresetClick(index) {
        const p = RUMBLE_PRESETS[index];
        if (Input.gamepads.length === 0) {
            this._addFailBurst();
            return;
        }
        Input.ExecuteRumble(p.label);
        this.ui.SetLastCall(`Input.ExecuteRumble( "${p.label}" );`, p.colorHex);
        this.ui.FlashPreset(index);
        this._addBurst(p.colorHex, p.strong, p.weak, p.duration);
    }

    OnFireCustom() {
        if (Input.gamepads.length === 0) {
            this._addFailBurst();
            return;
        }
        Input.RumbleGamepad(0, this.customStrong, this.customWeak, 500);
        this.ui.SetLastCall(
            `Input.RumbleGamepad( 0,  ${this.customStrong.toFixed(2)},  ${this.customWeak.toFixed(2)},  500 );`,
            "#6366f1"
        );
        this._addBurst("#6366f1", this.customStrong, this.customWeak);
    }

    // ── Internal helpers ──

    _addBurst(colorHex, strong, weak, durationMs = 500) {
        const base = Color.FromHex(colorHex);
        this.bursts.push({ r: base.r, g: base.g, b: base.b, strong, weak, t: 0, duration: 0.75 });
        this.motorStrong    = strong;
        this.motorWeak      = weak;
        this.motorRemaining = durationMs / 1000;
        this.motorColor     = { r: base.r, g: base.g, b: base.b };
    }

    // Fired when the user triggers a rumble but no gamepad is connected.
    // Draws a rapid jitter of short dashes radiating from the center.
    _addFailBurst() {
        this.failBursts.push({ t: 0, duration: 0.6 });
    }

    // ── Game loop ──

    Update(deltaTime) {
        super.Update(deltaTime);

        // Preset shortcuts — keyboard and gamepad face buttons
        for (let i = 0; i < RUMBLE_PRESETS.length; i++) {
            const keyCode = KEY_1 + i;
            if (Input.IsKeyDown(keyCode) || Input.IsGamepadButtonDown(0, RUMBLE_PRESETS[i].button)) {
                this.OnPresetClick(i);
            }
        }

        // Custom section — read live trigger values
        this.customStrong = Input.GetGamepadTriggerValue(0, "LT");
        this.customWeak   = Input.GetGamepadTriggerValue(0, "RT");
        this.ui.SetBars(this.customStrong, this.customWeak);

        // Custom fire — gamepad START or keyboard Enter
        if (Input.IsGamepadButtonDown(0, "START") || Input.IsKeyDown(KEY_ENTER)) {
            this.OnFireCustom();
        }

        // Status bar
        const connected = Input.gamepads.length > 0;
        this.ui.SetStatus(
            connected
                ? `Connected: ${Input.gamepads[0].gamepad.id}`
                : "No gamepad detected — keyboard shortcuts still work",
            connected
        );

        // Age and cull burst animations
        this.waveTime += deltaTime;
        for (const b of this.bursts)     b.t += deltaTime;
        for (const b of this.failBursts) b.t += deltaTime;
        this.bursts     = this.bursts.filter(b => b.t < b.duration);
        this.failBursts = this.failBursts.filter(b => b.t < b.duration);
        if (this.motorRemaining > 0)
            this.motorRemaining = Math.max(0, this.motorRemaining - deltaTime);

        // Smooth motor values for the oscilloscope wave:
        // attack is near-instant so the wave reacts immediately when a rumble fires;
        // decay is gradual so the wave settles back to idle instead of snapping off.
        const motorOn0  = this.motorRemaining > 0;
        const rawStrong = Math.max(this.customStrong, motorOn0 ? this.motorStrong : 0);
        const rawWeak   = Math.max(this.customWeak,   motorOn0 ? this.motorWeak   : 0);
        const ATTACK    = Math.min(1, deltaTime * 25); // ~40 ms to 95%
        const DECAY     = Math.min(1, deltaTime * 4);  // ~250 ms half-fade
        this.smoothStrong = rawStrong > this.smoothStrong
            ? this.smoothStrong + (rawStrong - this.smoothStrong) * ATTACK
            : this.smoothStrong + (rawStrong - this.smoothStrong) * DECAY;
        this.smoothWeak = rawWeak > this.smoothWeak
            ? this.smoothWeak + (rawWeak - this.smoothWeak) * ATTACK
            : this.smoothWeak + (rawWeak - this.smoothWeak) * DECAY;
    }

    Draw() {
        super.Draw();

        // Background
        this.renderer.DrawFillBasicRectangle(0, 0, this.screenWidth, this.screenHeight, this.colorBg);

        // Idle center dot (hidden once a burst is active)
        if (this.bursts.length === 0 && this.failBursts.length === 0) {
            this.renderer.DrawFillCircle(this.screenHalfWidth, this.screenHalfHeight, 5, this.colorIdleDot);
        }

        // Ring burst animations
        for (const b of this.bursts) {
            const progress  = b.t / b.duration;
            const baseAlpha = 1 - progress;
            const maxRadius = 180 + b.strong * 60 + b.weak * 40;

            for (let i = 0; i < 5; i++) {
                const ringProgress = Math.max(0, progress - i * 0.07);
                if (ringProgress <= 0) continue;

                const radius    = ringProgress * maxRadius;
                const ringAlpha = baseAlpha * (1 - i / 5);
                const lineWidth = 2.5 - i * 0.3;
                const col       = new Color(b.r, b.g, b.b, ringAlpha);

                this.renderer.DrawStrokeCircle(this.screenHalfWidth, this.screenHalfHeight, radius, col, lineWidth);
            }
        }

        // Fail burst — rapid jittering cross/dash pattern in red
        const cx = this.screenHalfWidth;
        const cy = this.screenHalfHeight;
        for (const b of this.failBursts) {
            const progress = b.t / b.duration;
            // Flicker: visible on odd frames during first half, always fading out in second half
            const flicker  = progress < 0.5 ? (Math.sin(b.t * 80) > 0 ? 1 : 0.2) : 1;
            const alpha    = (1 - progress) * flicker;

            // Radiating short dashes at 8 angles
            const dashCount = 8;
            const innerR    = 18 + progress * 24;
            const outerR    = 40 + progress * 50;
            for (let i = 0; i < dashCount; i++) {
                const angle = (i / dashCount) * Math.PI * 2;
                const col   = new Color(this.colorFail.r, this.colorFail.g, this.colorFail.b, alpha);
                this.renderer.DrawLine(
                    cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR,
                    cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR,
                    col, 2
                );
            }

            // Central X
            const xSize = 12;
            const xCol  = new Color(this.colorFail.r, this.colorFail.g, this.colorFail.b, alpha);
            this.renderer.DrawLine(cx - xSize, cy - xSize, cx + xSize, cy + xSize, xCol, 3);
            this.renderer.DrawLine(cx + xSize, cy - xSize, cx - xSize, cy + xSize, xCol, 3);
        }

        this._drawOscilloscopeWave();
    }

    /**
     * Draws an oscilloscope-style wave across the bottom strip of the canvas,
     * below the HTML overlay panel.
     *
     * Reflects the real-time output of the rumble motors:
     *
     *  Input                    │ Effect on wave shape              │ Color
     *  ─────────────────────────┼───────────────────────────────────┼───────────────────
     *  (idle)                   │ Gentle double-sine drift          │ Dim indigo (always)
     *  Strong motor (LT / preset)│ Slow wide swell, thicker line    │ Purple
     *  Weak motor   (RT / preset)│ Fast tight ripple, thicker line  │ Cyan
     *
     * effectiveStrong/effectiveWeak = max(live trigger, active preset value).
     * When a preset fires its declared duration, motorRemaining decays to 0
     * and the wave returns to idle — matching exactly what the gamepad is doing.
     */
    _drawOscilloscopeWave() {
        const WAVE_Y   = this.screenHeight - 175;
        const WAVE_X0  = 20;
        const WAVE_X1  = this.screenWidth - 20;
        const WAVE_PTS = 120;

        // Use smoothed motor values so the wave rises instantly and fades gracefully
        const effectStrong = this.smoothStrong;
        const effectWeak   = this.smoothWeak;
        const effect       = Math.max(effectStrong, effectWeak);

        // Motor-color mode: preset is firing, OR we're still in the smooth decay
        // phase after a preset ended (smooth > live trigger)
        const motorDecaying = effectStrong > this.customStrong + 0.02
                           || effectWeak   > this.customWeak   + 0.02;
        const useMotorColor = this.motorRemaining > 0 || motorDecaying;

        // ── Oscilloscope reticle grid ─────────────────────────────
        // Five horizontal reference lines + vertical tick marks every 60px.
        // All drawn in dim indigo so they read as a scope screen background.
        this.renderer.DrawLine(WAVE_X0, WAVE_Y,      WAVE_X1, WAVE_Y,      new Color(0.38, 0.40, 0.94, 0.12), 1);
        this.renderer.DrawLine(WAVE_X0, WAVE_Y - 22, WAVE_X1, WAVE_Y - 22, new Color(0.38, 0.40, 0.94, 0.07), 1);
        this.renderer.DrawLine(WAVE_X0, WAVE_Y + 22, WAVE_X1, WAVE_Y + 22, new Color(0.38, 0.40, 0.94, 0.07), 1);
        this.renderer.DrawLine(WAVE_X0, WAVE_Y - 44, WAVE_X1, WAVE_Y - 44, new Color(0.38, 0.40, 0.94, 0.04), 1);
        this.renderer.DrawLine(WAVE_X0, WAVE_Y + 44, WAVE_X1, WAVE_Y + 44, new Color(0.38, 0.40, 0.94, 0.04), 1);
        for (let x = WAVE_X0; x <= WAVE_X1; x += 60)
            this.renderer.DrawLine(x, WAVE_Y - 5, x, WAVE_Y + 5, new Color(0.38, 0.40, 0.94, 0.16), 1);

        // ── Wave shape ────────────────────────────────────────────
        const waveY = (x) =>
            WAVE_Y
            // Strong motor — heavy low-freq motor: broad slow-rolling swell + harmonic
            + effectStrong * 26 * Math.sin(x * 0.016 + this.waveTime * 35.0)
            + effectStrong * 10 * Math.sin(x * 0.032 + this.waveTime * 55.0)
            // Weak motor — high-freq buzz motor: tight rapid ripple + overtone
            + effectWeak   *  9 * Math.sin(x * 0.095 - this.waveTime * 180.0)
            + effectWeak   *  5 * Math.sin(x * 0.190 - this.waveTime * 280.0)
            // Idle baseline
            + 2.5          *      Math.sin(x * 0.025 + this.waveTime * 18.0)
            + 1.2          *      Math.sin(x * 0.058 - this.waveTime * 32.0);

        const drawPass = (col, lineW) => {
            for (let i = 0; i < WAVE_PTS; i++) {
                const x0 = WAVE_X0 + (i       / WAVE_PTS) * (WAVE_X1 - WAVE_X0);
                const x1 = WAVE_X0 + ((i + 1) / WAVE_PTS) * (WAVE_X1 - WAVE_X0);
                this.renderer.DrawLine(x0, waveY(x0), x1, waveY(x1), col, lineW);
            }
        };

        // ── Line color ────────────────────────────────────────────
        // Preset active / fading: use the preset's accent color.
        // Raw trigger only: blend purple (strong) ↔ cyan (weak) by intensity.
        // Idle: dim indigo.
        let lr, lg, lb;
        if (useMotorColor && effect > 0.02) {
            lr = this.motorColor.r;
            lg = this.motorColor.g;
            lb = this.motorColor.b;
        } else if (effect > 0.02) {
            const total = effectStrong + effectWeak + 0.0001;
            lr = (0.70 * effectStrong + 0.30 * effectWeak) / total;
            lg = (0.45 * effectStrong + 0.82 * effectWeak) / total;
            lb = 0.98;
        } else {
            lr = 0.38; lg = 0.40; lb = 0.94;
        }

        // ── CRT phosphor bloom: halo → mid-glow → sharp line ─────
        if (effect > 0.02) {
            drawPass(new Color(lr, lg, lb, effect * 0.08), 14 + effect * 8); // wide halo
            drawPass(new Color(lr, lg, lb, effect * 0.22), 4  + effect * 3); // mid glow
            drawPass(new Color(lr, lg, lb, effect * 0.92), 1.5 + effect * 1.5); // sharp core
        } else {
            drawPass(new Color(lr, lg, lb, 0.05), 7);    // subtle idle halo
            drawPass(new Color(lr, lg, lb, 0.25), 1.5);  // sharp idle line
        }
    }
}

window.onload = () => {
    Init(RumbleTestHtml);
};
