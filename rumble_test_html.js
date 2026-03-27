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

        this.Configure({ screenWidth: 640, screenHeight: 520 });

        this.ui           = null;
        this.customStrong = 0;
        this.customWeak   = 0;
        this.bursts       = [];   // active ring-burst animations
        this.failBursts   = [];   // "no gamepad" error animations

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
        this._addBurst(p.colorHex, p.strong, p.weak);
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

    _addBurst(colorHex, strong, weak) {
        const base = Color.FromHex(colorHex);
        this.bursts.push({ r: base.r, g: base.g, b: base.b, strong, weak, t: 0, duration: 0.75 });
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
        for (const b of this.bursts)     b.t += deltaTime;
        for (const b of this.failBursts) b.t += deltaTime;
        this.bursts     = this.bursts.filter(b => b.t < b.duration);
        this.failBursts = this.failBursts.filter(b => b.t < b.duration);
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
    }
}

window.onload = () => {
    Init(RumbleTestHtml);
};
