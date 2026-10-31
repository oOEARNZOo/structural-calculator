/* UI state and SVG rendering. Engineering calculations live in solver.js. */
const STORAGE_KEY = "structural-calculator.setup.v2";
const KN_PER_KIP = 4.4482216, M_PER_FT = 0.3048;
/* Display factor per quantity: SI value ÷ factor = displayed value. */
const UNIT_SETS = {
    si: { length: 1, force: 1, line: 1, moment: 1, labels: { length: "m", force: "kN", line: "kN/m", moment: "kN·m" } },
    imperial: { length: M_PER_FT, force: KN_PER_KIP, line: KN_PER_KIP / M_PER_FT, moment: KN_PER_KIP * M_PER_FT, labels: { length: "ft", force: "kip", line: "kip/ft", moment: "kip·ft" } }
};
const PRESETS = {
    centre: { L: 5, loads: [{ type: "P", mag: 10, a: 2.5 }] },
    two: { L: 6, loads: [{ type: "P", mag: 8, a: 2 }, { type: "P", mag: 8, a: 4 }] },
    udl: { L: 6, loads: [{ type: "w", mag: 5, a: 0, b: 6 }] },
    mixed: { L: 6, loads: [{ type: "P", mag: 12, a: 2 }, { type: "w", mag: 4, a: 3, b: 6 }] }
};

class StructuralCalculator {
    constructor() {
        this.left = 60; this.width = 880;
        this.units = "si";
        this.supportA = "pin";
        this.supportB = "roller";
        this.supportFields = { A: document.getElementById("supportA"), B: document.getElementById("supportB") };
        this.probe = 2.5;
        this.L = 6;
        this.loads = [];
        this.nextId = 1;
        this.preset = null;
        this.svgs = { fbd: document.getElementById("fbd"), sfd: document.getElementById("sfd"), bmd: document.getElementById("bmd") };
        this.lengthField = document.getElementById("beamLength");
        this.probeField = document.getElementById("probe");
        this.bindEvents();
        if (!this.restore()) this.applyPreset("mixed");
        this.renderLoads();
        this.refresh();
    }

    get u() { return UNIT_SETS[this.units]; }
    toDisplay(value, kind) { return Number.isFinite(value) ? String(Math.round(value / this.u[kind] * 1e4) / 1e4) : ""; }
    fromDisplay(text, kind) { return text === "" ? NaN : Number(text) * this.u[kind]; }
    fmt(value, kind) { return this.format(value / this.u[kind]); }
    format(value) { return Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 0.005) ? value.toExponential(2) : (Math.abs(value) < 0.005 ? 0 : value).toFixed(2); }
    model() { return { beamLength: this.L, supportA: this.supportA, supportB: this.supportB, loads: this.loads.map(({ type, mag, a, b }) => ({ type, mag, a, b })) }; }

    bindEvents() {
        this.lengthField.addEventListener("input", () => {
            this.L = this.fromDisplay(this.lengthField.value, "length");
            this.preset = null;
            this.refresh();
        });
        for (const side of ["A", "B"]) this.supportFields[side].addEventListener("change", () => { this[`support${side}`] = this.supportFields[side].value; this.refresh(); });
        document.getElementById("addPoint").addEventListener("click", () => this.addLoad({ type: "P", mag: 5, a: this.half() }));
        document.getElementById("addUniform").addEventListener("click", () => this.addLoad({ type: "w", mag: 2, a: 0, b: Number.isFinite(this.L) ? this.L : 1 }));
        document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => this.applyPreset(button.dataset.preset, true)));
        document.querySelectorAll("[data-units]").forEach(button => button.addEventListener("click", () => this.setUnits(button.dataset.units)));
        this.probeField.addEventListener("input", () => { this.probe = this.probeField.valueAsNumber; this.drawResults(); });
        document.getElementById("resetBtn").addEventListener("click", () => this.reset());
        document.getElementById("saveBtn").addEventListener("click", () => this.save());
        document.getElementById("exportBtn").addEventListener("click", () => this.exportDiagram());
    }

    half() { return Number.isFinite(this.L) && this.L > 0 ? Math.round(this.L / 2 * 100) / 100 : 0; }

    addLoad(load) {
        this.loads.push({ id: this.nextId++, ...load });
        this.preset = null;
        this.renderLoads();
        this.refresh();
    }

    applyPreset(key, announce) {
        const preset = PRESETS[key];
        this.L = preset.L;
        this.loads = preset.loads.map((load, i) => ({ id: i + 1, b: NaN, ...load }));
        this.nextId = this.loads.length + 1;
        this.preset = key;
        this.probe = preset.L / 2;
        this.lengthField.value = this.toDisplay(this.L, "length");
        this.renderLoads();
        this.refresh();
        if (announce) this.notify("Preset applied.");
    }

    reset() {
        this.units = "si";
        this.supportA = "pin";
        this.supportB = "roller";
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
        this.L = 0;
        this.loads = [];
        this.nextId = 1;
        this.preset = null;
        this.probe = 0;
        this.lengthField.value = "0";
        this.renderLoads();
        this.refresh();
        this.notify("All values reset to 0. Saved setup cleared.");
    }

    setUnits(units) {
        this.units = units;
        this.lengthField.value = this.toDisplay(this.L, "length");
        this.renderLoads();
        this.refresh();
    }

    /* Rebuild the load cards. Called only when loads are added, removed or units change, so typing keeps focus. */
    renderLoads() {
        const list = document.getElementById("loadList");
        list.replaceChildren(...this.loads.map((load, i) => this.loadCard(load, i)));
    }

    loadCard(load, index) {
        const isUdl = load.type === "w";
        const card = document.createElement("div");
        card.className = "load-card";
        card.dataset.id = load.id;
        const head = document.createElement("div");
        head.className = "load-head";
        const tag = document.createElement("span"); tag.className = "load-tag"; tag.textContent = `${load.type}${index + 1}`;
        const title = document.createElement("span"); title.className = "load-title"; title.textContent = isUdl ? "Distributed load" : "Point load";
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "icon-button"; remove.setAttribute("aria-label", `Remove load ${tag.textContent}`);
        remove.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        remove.addEventListener("click", () => {
            this.loads = this.loads.filter(l => l.id !== load.id);
            this.preset = null;
            this.renderLoads();
            this.refresh();
            this.notify(`Load ${tag.textContent} removed.`);
        });
        head.append(tag, title, remove);
        const fields = document.createElement("div");
        fields.className = `load-fields${isUdl ? "" : " two"}`;
        const labels = this.u.labels;
        const defs = isUdl
            ? [["mag", `w (${labels.line})`, "line", "0.5"], ["a", `Start, a (${labels.length})`, "length", "0.1"], ["b", `End, b (${labels.length})`, "length", "0.1"]]
            : [["mag", `P (${labels.force})`, "force", "0.5"], ["a", `Position, a (${labels.length})`, "length", "0.1"]];
        for (const [key, label, kind, step] of defs) {
            const wrap = document.createElement("div"); wrap.className = "load-field";
            const id = `${key}-${load.id}`;
            const lab = document.createElement("label"); lab.htmlFor = id; lab.textContent = label;
            const input = document.createElement("input");
            input.type = "number"; input.id = id; input.step = step; input.value = this.toDisplay(load[key], kind);
            input.setAttribute("aria-describedby", `${id}-error`);
            input.addEventListener("input", () => { load[key] = this.fromDisplay(input.value, kind); this.preset = null; this.refresh(); });
            const error = document.createElement("p"); error.className = "field-error"; error.id = `${id}-error`;
            wrap.append(lab, input, error);
            fields.append(wrap);
        }
        card.append(head, fields);
        return card;
    }

    refresh() {
        const m = this.model();
        const check = BeamAnalysis.validateLoads(m);
        this.check = check;
        this.result = BeamAnalysis.analyze(m);
        const supports = BeamAnalysis.validateSupports(this.supportA, this.supportB);
        this.supports = supports;
        this.supportFields.A.value = this.supportA;
        this.supportFields.B.value = this.supportB;
        const note = document.getElementById("supportNote");
        note.textContent = supports.message;
        note.classList.toggle("warning", !supports.supported);
        document.getElementById("loadCount").textContent = `(${this.loads.length})`;
        document.getElementById("noLoads").classList.toggle("hidden", this.loads.length > 0);
        this.lengthField.setAttribute("aria-invalid", String(Boolean(check.lengthError)));
        document.getElementById("beamLengthError").textContent = check.lengthError;
        this.loads.forEach((load, i) => {
            for (const key of ["mag", "a", "b"]) {
                const input = document.getElementById(`${key}-${load.id}`);
                if (!input) continue;
                input.setAttribute("aria-invalid", String(Boolean(check.errors[i][key])));
                document.getElementById(`${key}-${load.id}-error`).textContent = check.errors[i][key] || "";
            }
        });
        document.querySelectorAll("[data-preset]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.preset === this.preset)));
        document.querySelectorAll("[data-units]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.units === this.units)));
        document.querySelectorAll(".forceUnit").forEach(el => { el.textContent = this.u.labels.force; });
        document.querySelectorAll(".momentUnit").forEach(el => { el.textContent = this.u.labels.moment; });
        document.getElementById("lengthUnit").textContent = this.u.labels.length;
        document.getElementById("exportBtn").disabled = !this.result;
        document.getElementById("saveBtn").disabled = !this.result;
        const validL = Number.isFinite(this.L) && this.L > 0;
        this.probeField.max = validL ? this.L : 1;
        this.probeField.step = validL ? this.L / 600 : 0.01;
        this.probeField.disabled = !this.result;
        this.probe = Math.min(Math.max(Number.isFinite(this.probe) ? this.probe : 0, 0), validL ? this.L : 1);
        this.probeField.value = this.probe;
        this.drawResults();
        clearTimeout(this.announcementTimer);
        this.announcementTimer = setTimeout(() => {
            document.getElementById("resultAnnouncement").textContent = this.result
                ? `Reaction A: ${this.fmt(this.result.reactionA, "force")} ${this.u.labels.force}. Reaction B: ${this.fmt(this.result.reactionB, "force")} ${this.u.labels.force}.`
                : "Reactions unavailable. Check the beam settings.";
        }, 500);
    }

    drawResults() {
        const r = this.result, L = this.L;
        const message = document.getElementById("validationMessage");
        const status = document.getElementById("diagramStatus");
        document.getElementById("results").querySelectorAll(".kpi").forEach(k => k.classList.toggle("stale", !r));
        message.classList.toggle("hidden", Boolean(r));
        message.textContent = r ? "" : !this.supports.supported ? `Preview only. ${this.supports.message}` : "Check the highlighted fields to resume analysis.";
        status.classList.toggle("warning", !r || !r.balanced);
        status.textContent = !r ? (this.supports.supported ? "Check inputs" : "Preview only") : r.balanced ? "✓ ΣFy = 0 · ΣM = 0" : "Check inputs";
        for (const svg of Object.values(this.svgs)) svg.replaceChildren();
        if (!r) {
            this.drawFbd(null);
            for (const id of ["reactionA", "reactionB", "maxShear", "maxMoment"]) document.getElementById(id).textContent = "–";
            for (const id of ["reactionANote", "reactionBNote", "maxShearNote", "maxMomentNote"]) document.getElementById(id).textContent = "Analysis paused";
            for (const id of ["probeX", "probeV", "probeM"]) document.getElementById(id).textContent = "";
            document.getElementById("calculationSteps").replaceChildren(this.paragraph("Calculation steps appear when the beam and loads are valid.", "placeholder"));
            document.getElementById("stepsSummary").textContent = "";
            return;
        }
        const f = (v, kind) => this.fmt(v, kind);
        const lu = this.u.labels;
        document.getElementById("reactionA").textContent = f(r.reactionA, "force");
        document.getElementById("reactionB").textContent = f(r.reactionB, "force");
        document.getElementById("reactionANote").textContent = this.reactionNote(r, "A", "x = 0");
        document.getElementById("reactionBNote").textContent = this.reactionNote(r, "B", `x = ${f(L, "length")} ${lu.length}`);
        document.getElementById("maxShear").textContent = f(r.maxShear, "force");
        document.getElementById("maxShearNote").textContent = `at x = ${f(r.maxShearX, "length")} ${lu.length}`;
        document.getElementById("maxMoment").textContent = f(r.peakMoment, "moment");
        document.getElementById("maxMomentNote").textContent = `at x = ${f(r.peakMomentX, "length")} ${lu.length} · governs design`;
        this.drawFbd(r);
        this.drawShear(r);
        this.drawMoment(r);
        this.drawProbe(r);
        this.drawSteps(r);
    }

    X(x) { return this.left + x / this.L * this.width; }
    clip(px) { return px < 140 ? "start" : px > 860 ? "end" : "middle"; }
    head(x, tip, size) { return `${x - size},${tip - size * 1.6} ${x + size},${tip - size * 1.6} ${x},${tip}`; }

    drawFbd(r) {
        const svg = this.svgs.fbd, X = x => this.X(x), f = (v, k) => this.fmt(v, k), lu = this.u.labels;
        const loads = Number.isFinite(this.L) && this.L > 0 && this.check.valid ? this.loads : [];
        if (Number.isFinite(this.L) && this.L > 0) svg.append(this.line("probeLine", X(this.probe), 10, X(this.probe), 235, "var(--ink)", 1, "4 4", 0.35));
        for (const load of loads.filter(l => l.type === "w")) {
            const x1 = X(load.a), x2 = X(load.b);
            svg.append(this.el("rect", { x: x1, y: 66, width: Math.max(x2 - x1, 0), height: 40, fill: "var(--load)", opacity: 0.08 }), this.line("", x1, 66, x2, 66, "var(--load)", 2.5));
            svg.append(this.text((x1 + x2) / 2, 54, `w = ${f(load.mag, "line")} ${lu.line}`, "svg-load", "middle"));
            const n = Math.max(1, Math.round((x2 - x1) / 44));
            for (let i = 0; i <= n; i++) {
                const x = x1 + (x2 - x1) * i / n;
                svg.append(this.line("", x, 66, x, 104, "var(--load)", 1.6), this.el("polygon", { points: this.head(x, 111, 5), fill: "var(--load)" }));
            }
        }
        svg.append(this.el("rect", { x: 60, y: 112, width: 880, height: 9, rx: 1.5, fill: "var(--beam)" }));
        for (const load of loads.filter(l => l.type === "P")) {
            const x = X(load.a);
            svg.append(this.line("", x, 34, x, 100, "var(--load)", 3), this.el("polygon", { points: this.head(x, 111, 7), fill: "var(--load)" }), this.text(x, 24, `P = ${f(load.mag, "force")} ${lu.force}`, "svg-load", this.clip(x)));
        }
        svg.append(this.support(this.supportA, 60, "A"), this.support(this.supportB, 940, "B"));
        if (r && r.fixedEnd && Math.abs(r.fixedMoment) > 1e-9) svg.append(this.momentArc(r.fixedEnd === "A" ? 60 : 940, r.fixedEnd === "A", (r.fixedEnd === "A") === r.fixedMoment >= 0));
        for (const [x, label, value, anchor, tx] of r ? [[60, "RA", r.reactionA, "start", 74], [940, "RB", r.reactionB, "end", 926]].filter(([, label]) => (label === "RA" ? this.supportA : this.supportB) !== "free") : []) {
            const up = value >= 0;
            svg.append(this.line("", x, 222, x, up ? 172 : 212, "var(--reaction)", 3), this.el("polygon", { points: up ? `${x},162 ${x - 7},175 ${x + 7},175` : `${x},222 ${x - 7},209 ${x + 7},209`, fill: "var(--reaction)" }), this.text(tx, 206, `${label} = ${f(value, "force")} ${lu.force}${r.fixedEnd === label[1] ? ` · M = ${f(r.fixedMoment, "moment")} ${lu.moment}` : ""}`, "svg-reaction", anchor));
        }
    }

    /* Curved reaction-moment arrow on the outer side of the fixed end; counterclockwise when ccw is true. */
    momentArc(x, leftSide, ccw) {
        const g = this.el("g"), top = 76, bottom = 156, r = 40, fromTop = ccw === leftSide;
        const [y1, y2] = fromTop ? [top, bottom] : [bottom, top];
        const sweep = ccw ? 0 : 1, dir = leftSide ? 1 : -1;
        g.append(this.el("path", { d: `M ${x} ${y1} A ${r} ${r} 0 0 ${sweep} ${x} ${y2}`, fill: "none", stroke: "var(--reaction)", "stroke-width": 3 }),
            this.el("polygon", { points: `${x - dir * 4},${y2 - 7} ${x - dir * 4},${y2 + 7} ${x + dir * 8},${y2}`, fill: "var(--reaction)" }));
        const title = this.el("title"); title.textContent = `Reaction moment at ${leftSide ? "A" : "B"}, ${ccw ? "counterclockwise" : "clockwise"}`; g.append(title);
        return g;
    }

    reactionNote(r, side, where) {
        const type = side === "A" ? this.supportA : this.supportB, value = side === "A" ? r.reactionA : r.reactionB;
        if (type === "free") return `No reaction at free end, ${where}`;
        const moment = r.fixedEnd === side ? ` · M = ${this.fmt(r.fixedMoment, "moment")} ${this.u.labels.moment}` : "";
        return `${value >= 0 ? "↑ Upward" : "↓ Downward"} at ${type}, ${where}${moment}`;
    }

    support(type, x, side) {
        const g = this.el("g"), stroke = { stroke: "var(--support)", fill: "var(--surface)" };
        const title = this.el("title"); title.textContent = `Support ${side}: ${type}`; g.append(title);
        if (type === "free") return g;
        if (type === "fixed") {
            const wall = side === "A" ? x - 12 : x, dir = side === "A" ? -1 : 1;
            g.append(this.el("rect", { x: wall, y: 84, width: 12, height: 74, fill: "var(--support)" }));
            for (let i = 0; i < 5; i++) g.append(this.line("", wall + (dir < 0 ? 0 : 12), 92 + i * 15, wall + dir * 12 + (dir < 0 ? 0 : 12), 104 + i * 15, "var(--support)", 2));
        } else {
            const roller = type === "roller", base = roller ? 143 : 149;
            g.append(this.el("polygon", { points: `${x},121 ${x - 16},${base} ${x + 16},${base}`, ...stroke, "stroke-width": 2 }));
            if (roller) g.append(this.el("circle", { cx: x - 10, cy: 148, r: 4, ...stroke, "stroke-width": 1.8 }), this.el("circle", { cx: x + 10, cy: 148, r: 4, ...stroke, "stroke-width": 1.8 }));
            g.append(this.line("", x - 24, 153, x + 24, 153, "var(--support)", 2));
        }
        return g;
    }

    drawShear(r) {
        const svg = this.svgs.sfd, base = 95, scale = r.maxShear > 0 ? 72 / r.maxShear : 0, y = v => base - v * scale;
        let line = `M60 ${base}`;
        r.xs.forEach((x, i) => { line += ` L${this.X(x).toFixed(1)} ${y(r.vs[i]).toFixed(1)}`; });
        line += ` L940 ${base}`;
        const topX = this.X(r.topShearX), botX = this.X(r.botShearX);
        svg.append(this.line("", 60, base, 940, base, "var(--baseline)", 1), this.el("path", { d: `${line} Z`, fill: "var(--shear)", opacity: 0.14 }), this.el("path", { d: line, fill: "none", stroke: "var(--shear)", "stroke-width": 2.5, "stroke-linejoin": "round" }),
            this.text(topX, y(r.topShear) - 10, `${r.topShear >= 0 ? "+" : ""}${this.fmt(r.topShear, "force")}`, "svg-shear", this.clip(topX)), this.text(botX, y(r.botShear) + 22, this.fmt(r.botShear, "force"), "svg-shear", this.clip(botX)),
            this.line("", this.X(this.probe), 0, this.X(this.probe), 190, "var(--ink)", 1, "4 4", 0.35));
        this.sy = y;
    }

    drawMoment(r) {
        const svg = this.svgs.bmd, hasNeg = r.minMoment < -1e-6, base = hasNeg ? 95 : 165;
        const abs = Math.max(Math.abs(r.maxMoment), Math.abs(r.minMoment)), scale = abs > 0 ? (hasNeg ? 70 : 130) / abs : 0, y = m => base - m * scale;
        let line = `M60 ${base}`;
        r.xs.forEach((x, i) => { line += ` L${this.X(x).toFixed(1)} ${y(r.ms[i]).toFixed(1)}`; });
        line += ` L940 ${base}`;
        svg.append(this.line("", 60, base, 940, base, "var(--baseline)", 1), this.el("path", { d: `${line} Z`, fill: "var(--moment)", opacity: 0.14 }), this.el("path", { d: line, fill: "none", stroke: "var(--moment)", "stroke-width": 2.5, "stroke-linejoin": "round" }),
            this.text(this.X(r.peakMomentX), y(r.peakMoment) + (r.peakMoment < 0 ? 22 : -10), this.fmt(r.peakMoment, "moment"), "svg-moment", this.clip(this.X(r.peakMomentX))),
            this.line("", this.X(this.probe), 0, this.X(this.probe), 180, "var(--ink)", 1, "4 4", 0.35));
        this.my = y;
        const L = this.L, step = L <= 6 ? 1 : L <= 15 ? 2 : 5, ticks = [];
        for (let t = 0; t <= L + 1e-9; t += step) ticks.push(t);
        if (Math.abs(ticks[ticks.length - 1] - L) > 1e-6) ticks.push(L);
        svg.append(this.line("", 60, 186, 940, 186, "var(--muted)", 1));
        for (const t of ticks) svg.append(this.line("", this.X(t), 186, this.X(t), 192, "var(--muted)", 1), this.text(this.X(t), 206, String(Math.round(t / this.u.length * 100) / 100), "svg-tick", "middle"));
    }

    drawProbe(r) {
        const x = this.probe, v = r.shear(x), m = r.bending(x), px = this.X(x);
        this.svgs.sfd.append(this.el("circle", { cx: px, cy: this.sy(v), r: 5, fill: "var(--surface)", stroke: "var(--shear)", "stroke-width": 2.5 }));
        this.svgs.bmd.append(this.el("circle", { cx: px, cy: this.my(m), r: 5, fill: "var(--surface)", stroke: "var(--moment)", "stroke-width": 2.5 }));
        this.svgs.fbd.querySelector("#probeLine")?.setAttribute("x1", px);
        const lu = this.u.labels;
        document.getElementById("probeX").textContent = `x = ${this.fmt(x, "length")} ${lu.length}`;
        document.getElementById("probeV").textContent = `V = ${this.fmt(v, "force")} ${lu.force}`;
        document.getElementById("probeM").textContent = `M = ${this.fmt(m, "moment")} ${lu.moment}`;
    }

    drawSteps(r) {
        const f = (v, k) => this.fmt(v, k), lu = this.u.labels, L = f(this.L, "length");
        const terms = r.terms.length ? r.terms.map(t => `${f(t.force, "force")}×${f(t.arm, "length")}`).join(" + ") : "0";
        const momentValue = f(r.moment, "moment");
        const peak = `M<sub>max</sub> = ${f(r.peakMoment, "moment")} ${lu.moment} at x = ${f(r.peakMomentX, "length")} ${lu.length}`;
        const fixedTerms = r.terms.map(t => `${f(t.force, "force")}×${f(r.fixedEnd === "A" ? t.arm : this.L - t.arm, "length")}`).join(" + ") || "0";
        const steps = r.kind === "cantilever" ? [
            ["Vertical equilibrium — ΣF<sub>y</sub> = 0", [`R<sub>${r.fixedEnd}</sub> = ${f(r.total, "force")} ${lu.force}`], "reaction"],
            [`Moments about the fixed end — ΣM<sub>${r.fixedEnd}</sub> = 0`, [`M<sub>${r.fixedEnd}</sub> = ${fixedTerms} = ${f(r.fixedMoment, "moment")} ${lu.moment}`], "moment"],
            ["Maximum moment occurs at the fixed end", [peak], "moment"]
        ] : [
            ["Moments about A — ΣM<sub>A</sub> = 0", [`R<sub>B</sub> · ${L} = ${terms} = ${momentValue}`, `R<sub>B</sub> = ${momentValue} / ${L} = ${f(r.reactionB, "force")} ${lu.force}`], "reaction"],
            ["Vertical equilibrium — ΣF<sub>y</sub> = 0", [`R<sub>A</sub> = ${f(r.total, "force")} − ${f(r.reactionB, "force")} = ${f(r.reactionA, "force")} ${lu.force}`], "reaction"],
            ["Maximum moment where V changes sign", [peak], "moment"]
        ];
        document.getElementById("stepsSummary").textContent = `Total load ${f(r.total, "force")} ${lu.force}${r.centroid === null ? "" : ` · resultant at x̄ = ${f(r.centroid, "length")} ${lu.length}`}`;
        document.getElementById("calculationSteps").replaceChildren(...steps.map(([title, lines, tone], i) => {
            const li = document.createElement("li");
            const badge = document.createElement("span"); badge.className = "step-number"; badge.textContent = i + 1;
            const body = document.createElement("div"); body.className = "step-body";
            const label = document.createElement("span"); label.innerHTML = title;
            body.append(label);
            lines.forEach((line, j) => {
                const code = document.createElement("code");
                code.innerHTML = line; // Built only from numbers formatted by this class and static markup.
                if (j === lines.length - 1) code.className = `result ${tone}`;
                body.append(code);
            });
            li.append(badge, body);
            return li;
        }));
    }

    paragraph(text, className) { const p = document.createElement("p"); p.className = className; p.textContent = text; return p; }

    save() {
        if (!this.result) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ L: this.L, supportA: this.supportA, supportB: this.supportB, units: this.units, probe: this.probe, loads: this.loads.map(({ type, mag, a, b }) => ({ type, mag, a, b: Number.isFinite(b) ? b : null })) }));
            this.notify("Setup saved in this browser. It will return on your next visit.");
        } catch { this.notify("This browser could not save your setup. Your current analysis is still available."); }
    }

    restore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const loads = (saved.loads || []).map(l => ({ type: l.type === "w" ? "w" : "P", mag: l.mag, a: l.a, b: l.b === null ? NaN : l.b }));
            const supports = ["pin", "roller", "fixed", "free"].includes(saved.supportA) && ["pin", "roller", "fixed", "free"].includes(saved.supportB) ? [saved.supportA, saved.supportB] : ["pin", "roller"];
            if (!BeamAnalysis.analyze({ beamLength: saved.L, supportA: supports[0], supportB: supports[1], loads })) return false;
            [this.supportA, this.supportB] = supports;
            this.L = saved.L; this.units = UNIT_SETS[saved.units] ? saved.units : "si"; this.probe = Number.isFinite(saved.probe) ? saved.probe : saved.L / 2;
            this.loads = loads.map((l, i) => ({ id: i + 1, ...l })); this.nextId = this.loads.length + 1;
            this.lengthField.value = this.toDisplay(this.L, "length");
            this.notify("Your saved beam setup has been restored.");
            return true;
        } catch { return false; /* Invalid or inaccessible storage does not interrupt the calculator. */ }
    }

    exportDiagram() {
        if (!this.result) return;
        const svg = this.svgs.fbd, clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("width", "1000"); clone.setAttribute("height", "240");
        // Resolve variables and typography so the exported SVG works without this page's CSS.
        const sources = [svg, ...svg.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
        sources.forEach((source, i) => {
            const css = getComputedStyle(source);
            for (const property of ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight"]) copies[i].setAttribute(property, css.getPropertyValue(property));
        });
        clone.insertBefore(this.el("rect", { width: 1000, height: 240, fill: "#FFFFFF" }), clone.firstChild);
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "beam-free-body-diagram.svg";
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.notify("Free-body diagram exported as SVG.");
    }

    notify(message) {
        clearTimeout(this.notificationTimer);
        document.getElementById("actionMessage").textContent = message;
        this.notificationTimer = setTimeout(() => { document.getElementById("actionMessage").textContent = ""; }, 6000);
    }

    el(tag, attrs = {}) { const node = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node; }
    line(id, x1, y1, x2, y2, stroke, width, dash, opacity) {
        const node = this.el("line", { x1, y1, x2, y2, stroke, "stroke-width": width });
        if (id) node.id = id;
        if (dash) node.setAttribute("stroke-dasharray", dash);
        if (opacity !== undefined) node.setAttribute("opacity", opacity);
        return node;
    }
    text(x, y, content, className, anchor) { const node = this.el("text", { x, y, class: className, "text-anchor": anchor }); node.textContent = content; return node; }
}

document.addEventListener("DOMContentLoaded", () => { new StructuralCalculator(); });
