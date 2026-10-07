/* UI state and SVG rendering. Engineering calculations live in solver.js. */
class StructuralCalculator {
    constructor() {
        this.beamStart = 110;
        this.beamWidth = 680;
        this.beamY = 220;
        this.numericKeys = ["beamLength", "pointLoad", "pointDistance", "uniformLoad", "maxLoad", "loadStart", "loadEnd"];
        this.selectKeys = ["supportA", "supportB", "loadType"];
        this.fields = Object.fromEntries([...this.numericKeys, ...this.selectKeys].map(key => [key, document.getElementById(key)]));
        this.svg = document.getElementById("beamDiagram");
        this.frame = this.svg.parentElement;
        this.handle = document.getElementById("loadHandle");
        this.slider = document.getElementById("pointPositionSlider");
        this.groups = Object.fromEntries(["supports", "loads", "dimensions"].map(key => [key, document.getElementById(key)]));
        this.bindEvents();
        this.restore();
        this.refresh();
        new ResizeObserver(() => this.positionHandle()).observe(this.svg);
    }

    model() {
        return Object.fromEntries([...this.numericKeys, ...this.selectKeys].map(key =>
            [key, this.numericKeys.includes(key) ? this.fields[key].valueAsNumber : this.fields[key].value]));
    }

    bindEvents() {
        for (const key of [...this.numericKeys, ...this.selectKeys]) {
            this.fields[key].addEventListener(this.numericKeys.includes(key) ? "input" : "change", () => {
                this.clearExampleSelection();
                this.refresh();
            });
        }
        document.getElementById("resetBtn").addEventListener("click", () => {
            for (const key of [...this.numericKeys, ...this.selectKeys]) {
                const field = this.fields[key];
                field.value = field.tagName === "SELECT" ? field.options[0].value : field.defaultValue;
            }
            try { localStorage.removeItem("structural-calculator.setup.v1"); } catch { /* Storage can be unavailable. */ }
            this.markExample("center");
            this.refresh();
            this.notify("Default setup restored. Saved setup cleared.");
        });
        document.querySelectorAll("[data-example]").forEach(button => button.addEventListener("click", () => this.applyExample(button.dataset.example)));
        document.getElementById("saveBtn").addEventListener("click", () => this.save());
        document.getElementById("exportBtn").addEventListener("click", () => this.exportDiagram());
        this.slider.addEventListener("input", () => this.moveLoad(this.slider.valueAsNumber));

        this.handle.addEventListener("pointerdown", event => {
            if (event.button !== 0 || this.handle.disabled) return;
            this.dragId = event.pointerId;
            this.handle.setPointerCapture(event.pointerId);
            this.handle.classList.add("dragging");
            const bounds = this.handle.getBoundingClientRect();
            this.dragOffset = event.clientX - bounds.left - bounds.width / 2;
        });
        this.handle.addEventListener("pointermove", event => {
            if (this.dragId !== event.pointerId) return;
            const point = this.svg.createSVGPoint();
            point.x = event.clientX - this.dragOffset;
            point.y = event.clientY;
            const x = point.matrixTransform(this.svg.getScreenCTM().inverse()).x;
            this.moveLoad((x - this.beamStart) / this.beamWidth * this.model().beamLength);
        });
        const endDrag = () => { this.dragId = null; this.handle.classList.remove("dragging"); };
        this.handle.addEventListener("pointerup", endDrag);
        this.handle.addEventListener("pointercancel", endDrag);
        this.handle.addEventListener("lostpointercapture", endDrag);
        this.handle.addEventListener("keydown", event => {
            const m = this.model();
            const step = event.shiftKey ? m.beamLength / 10 : m.beamLength / 100;
            const values = { ArrowLeft: m.pointDistance - step, ArrowDown: m.pointDistance - step,
                ArrowRight: m.pointDistance + step, ArrowUp: m.pointDistance + step, Home: 0, End: m.beamLength };
            if (Object.hasOwn(values, event.key)) { event.preventDefault(); this.moveLoad(values[event.key]); }
        });
    }

    moveLoad(distance) {
        const L = this.model().beamLength;
        this.fields.pointDistance.value = Math.min(L, Math.max(0, Math.round(distance * 100) / 100));
        this.clearExampleSelection();
        this.refresh();
    }

    clearExampleSelection() { document.querySelectorAll("[data-example]").forEach(b => b.setAttribute("aria-pressed", "false")); }
    markExample(name) { document.querySelectorAll("[data-example]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.example === name))); }

    applyExample(name) {
        const type = ["uniform", "triangular"].includes(name) ? name : "point";
        const values = { beamLength: 5, supportA: "pin", supportB: "roller", loadType: type,
            pointLoad: 10, pointDistance: name === "near" ? 1 : 2.5, uniformLoad: 4, maxLoad: 6, loadStart: 0, loadEnd: 5 };
        for (const [key, value] of Object.entries(values)) this.fields[key].value = value;
        this.markExample(name);
        this.refresh();
    }

    refresh() {
        const m = this.model();
        const check = BeamAnalysis.validate(m);
        this.currentModel = m;
        this.currentCheck = check;
        this.result = BeamAnalysis.solve(m);
        for (const [type, id] of [["point", "pointLoadInputs"], ["uniform", "uniformLoadInputs"], ["triangular", "triangularLoadInputs"]])
            document.getElementById(id).classList.toggle("hidden", m.loadType !== type);
        for (const key of this.numericKeys) {
            this.fields[key].setAttribute("aria-invalid", String(Boolean(check.errors[key])));
            document.getElementById(`${key}Error`).textContent = check.errors[key] || "";
        }
        const note = document.getElementById("supportNote");
        note.textContent = check.supportMessage;
        note.classList.toggle("warning", !check.supported);
        const message = document.getElementById("validationMessage");
        message.textContent = this.result ? "Results update as you edit." : !check.supported ? "Diagram preview only. Reactions unavailable."
            : Object.keys(check.errors).length ? "Check the highlighted fields to resume analysis." : "Values are too large to calculate. Reduce the load or beam length.";
        message.classList.toggle("error", !this.result);
        const status = document.getElementById("diagramStatus");
        status.textContent = this.result ? "Live result" : !check.supported ? "Preview only" : "Check inputs";
        status.classList.toggle("warning", !this.result);
        document.getElementById("diagramSubtitle").textContent = `${this.fields.loadType.selectedOptions[0].text} · ${check.supported ? "Simply supported beam" : "Support preview"}`;
        document.querySelector(".placeholder").classList.toggle("hidden", Boolean(this.result));
        document.querySelector(".placeholder").textContent = !check.supported ? check.supportMessage : "Correct the inputs above to see support reactions.";
        document.getElementById("calculationResult").classList.toggle("hidden", !this.result);
        document.getElementById("balanceNote").textContent = this.result ? "✓ Equilibrium satisfied" : "Analysis paused";
        document.getElementById("exportBtn").disabled = !this.result;
        document.getElementById("saveBtn").disabled = !this.result;
        if (this.result) this.displayResults(m, this.result);
        else document.getElementById("calculationSteps").textContent = "Calculation steps will appear when the beam setup is valid.";
        this.draw(m, check, this.result);
        this.handle.disabled = !Number.isFinite(m.beamLength) || m.beamLength <= 0 || Boolean(check.errors.pointDistance);
        this.handle.classList.toggle("hidden", m.loadType !== "point" || this.handle.disabled);
        this.slider.closest(".mobile-position").classList.toggle("hidden", m.loadType !== "point");
        this.slider.disabled = this.handle.disabled;
        this.slider.max = Number.isFinite(m.beamLength) && m.beamLength > 0 ? m.beamLength : 5;
        this.slider.step = Number(this.slider.max) / 100;
        this.slider.value = Number.isFinite(m.pointDistance) ? m.pointDistance : 0;
        document.getElementById("sliderPosition").textContent = Number.isFinite(m.pointDistance) ? `${this.format(m.pointDistance)} m from A` : "Check position";
        this.positionHandle();
        document.getElementById("interactionHint").textContent = m.loadType === "point"
            ? "Move the load using the handle, position field or mobile slider. Arrow keys work too."
            : m.loadType === "uniform" ? "Uniform intensity is applied along the full beam. Edit its value in Applied load."
                : "The load increases from left to right. Edit its start, end and maximum intensity.";
        clearTimeout(this.announcementTimer);
        this.announcementTimer = setTimeout(() => {
            document.getElementById("resultAnnouncement").textContent = this.result
                ? `Reaction A: ${this.format(this.result.reactionA)} kilonewtons. Reaction B: ${this.format(this.result.reactionB)} kilonewtons.`
                : "Reactions unavailable. Check the beam settings.";
        }, 500);
    }

    positionHandle() {
        const m = this.currentModel;
        if (!m || m.loadType !== "point" || !Number.isFinite(m.pointDistance) || !Number.isFinite(m.beamLength) || m.beamLength <= 0) return;
        const x = this.beamStart + Math.min(1, Math.max(0, m.pointDistance / m.beamLength)) * this.beamWidth;
        const point = this.svg.createSVGPoint(); point.x = x; point.y = 150;
        const screen = point.matrixTransform(this.svg.getScreenCTM());
        const bounds = this.frame.getBoundingClientRect();
        this.handle.style.left = `${screen.x - bounds.left + this.frame.scrollLeft}px`;
        this.handle.style.top = `${screen.y - bounds.top + this.frame.scrollTop}px`;
        this.handle.setAttribute("aria-label", `Move point load: ${this.format(m.pointDistance)} m from A. Use arrow keys, Home or End.`);
    }

    displayResults(m, r) {
        document.getElementById("reactionA").textContent = `${this.format(r.reactionA)} kN`;
        document.getElementById("reactionB").textContent = `${this.format(r.reactionB)} kN`;
        document.querySelectorAll(".result-direction").forEach((el, i) => {
            el.textContent = [r.reactionA, r.reactionB][i] === 0 ? "No vertical reaction" : "↑ Upward reaction";
        });
        document.getElementById("totalLoad").textContent = `Total load: ${this.format(r.totalLoad)} kN`;
        document.getElementById("centroidLocation").textContent = `Resultant: ${this.format(r.centroid)} m from A`;
        const f = v => this.format(v);
        const total = m.loadType === "point" ? `W = P = ${f(r.totalLoad)} kN`
            : m.loadType === "uniform" ? `W = w × L = ${f(m.uniformLoad)} × ${f(m.beamLength)} = ${f(r.totalLoad)} kN`
                : `W = ½ × wmax × (end − start) = ½ × ${f(m.maxLoad)} × ${f(m.loadEnd - m.loadStart)} = ${f(r.totalLoad)} kN`;
        const centroid = m.loadType === "point" ? `x̄ = a = ${f(r.centroid)} m`
            : m.loadType === "uniform" ? `x̄ = L / 2 = ${f(m.beamLength)} / 2 = ${f(r.centroid)} m`
                : `x̄ = start + ⅔ × (end − start) = ${f(m.loadStart)} + ⅔ × ${f(m.loadEnd - m.loadStart)} = ${f(r.centroid)} m`;
        const rows = [["Resultant load", total], ["Resultant position", centroid], ["Moments about A", `ΣMA = 0 → RB = W × x̄ / L = ${f(r.totalLoad)} × ${f(r.centroid)} / ${f(m.beamLength)} = ${f(r.reactionB)} kN`],
            ["Vertical equilibrium", `ΣFy = 0 → RA = W − RB = ${f(r.totalLoad)} − ${f(r.reactionB)} = ${f(r.reactionA)} kN`]];
        const steps = document.getElementById("calculationSteps");
        steps.replaceChildren(...rows.map(([label, value]) => {
            const row = document.createElement("p"), strong = document.createElement("strong"), span = document.createElement("span");
            strong.textContent = label; span.textContent = value; row.append(strong, span); return row;
        }));
    }

    save() {
        if (!this.result) return;
        try { localStorage.setItem("structural-calculator.setup.v1", JSON.stringify(this.currentModel)); this.notify("Setup saved in this browser. It will return on your next visit."); }
        catch { this.notify("This browser could not save your setup. Your current analysis is still available."); }
    }

    restore() {
        try {
            const raw = localStorage.getItem("structural-calculator.setup.v1");
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || !BeamAnalysis.solve(saved)) return;
            for (const key of [...this.numericKeys, ...this.selectKeys]) {
                if (this.numericKeys.includes(key) ? Number.isFinite(saved[key]) : [...this.fields[key].options].some(o => o.value === saved[key])) this.fields[key].value = saved[key];
            }
            this.clearExampleSelection();
            this.notify("Your saved beam setup has been restored.");
        } catch { /* Invalid or inaccessible storage does not interrupt the calculator. */ }
    }

    exportDiagram() {
        if (!this.result) return;
        const clone = this.svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("width", "900"); clone.setAttribute("height", "430");
        // Resolve variables and typography so the exported SVG works without this page's CSS.
        const sources = [this.svg, ...this.svg.querySelectorAll("*")];
        const copies = [clone, ...clone.querySelectorAll("*")];
        sources.forEach((source, i) => {
            const css = getComputedStyle(source);
            for (const property of ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight"]) {
                const value = css.getPropertyValue(property).replace(/url\(["']?[^)]*#([^"')]+)["']?\)/g, "url(#$1)");
                copies[i].setAttribute(property, value);
            }
        });
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "beam-reaction-diagram.svg";
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.notify("Beam diagram exported as SVG.");
    }

    notify(message) {
        clearTimeout(this.notificationTimer);
        document.getElementById("actionMessage").textContent = message;
        this.notificationTimer = setTimeout(() => { document.getElementById("actionMessage").textContent = ""; }, 6000);
    }

    draw(m, check, result) {
        for (const group of Object.values(this.groups)) group.replaceChildren();
        const L = Number.isFinite(m.beamLength) && m.beamLength > 0 ? m.beamLength : null;
        this.groups.supports.append(this.drawSupport(m.supportA, this.beamStart, "A"), this.drawSupport(m.supportB, this.beamStart + this.beamWidth, "B"));
        if (L) this.drawDimensions(L);
        if (L && Object.keys(check.errors).length === 0) {
            if (m.loadType === "point") this.drawPointLoad(m);
            if (m.loadType === "uniform") this.drawUniformLoad(m);
            if (m.loadType === "triangular") this.drawTriangularLoad(m);
        }
        if (result) this.drawReactions(result);
        document.getElementById("diagramDesc").textContent = `${L ? `${this.format(L)} metre` : "Invalid length"} beam. Support A: ${m.supportA}. Support B: ${m.supportB}. ${result ? `${m.loadType} load. Reaction A ${this.format(result.reactionA)} kN, reaction B ${this.format(result.reactionB)} kN.` : "Preview only. Reactions unavailable."}`;
    }

    drawSupport(type, x, label) {
        const g = this.element("g");
        const title = this.element("title"); title.textContent = `Support ${label}: ${type}`; g.append(title);
        if (type === "fixed") {
            const wallX = label === "A" ? x - 12 : x;
            g.append(this.rect(wallX, 180, 12, 88, "var(--support)"));
            for (let i = 0; i < 6; i++) g.append(this.line(wallX - 10, 184 + i * 14, wallX + 22, 170 + i * 14, "var(--support)", 2));
        } else {
            const triangle = this.element("path", { d: `M ${x} 230 L ${x - 24} 270 L ${x + 24} 270 Z`, fill: "var(--surface)", stroke: "var(--support)", "stroke-width": 2.5 });
            g.append(triangle);
            if (type === "roller") g.append(this.circle(x - 14, 278, 6), this.circle(x + 14, 278, 6));
            g.append(this.line(x - 32, type === "roller" ? 287 : 276, x + 32, type === "roller" ? 287 : 276, "var(--support)", 2));
        }
        g.append(this.text(x, 310, `${label} · ${type[0].toUpperCase()}${type.slice(1)}`, "svg-support-note"));
        return g;
    }

    drawDimensions(L) {
        const x = this.beamStart, end = x + this.beamWidth, y = 390;
        this.groups.dimensions.append(this.line(x, y, end, y, "var(--muted)", 1), this.line(x, y - 6, x, y + 6, "var(--muted)", 1), this.line(end, y - 6, end, y + 6, "var(--muted)", 1), this.text(450, 382, `L = ${this.format(L)} m`, "svg-small"));
    }

    drawPointLoad(m) {
        const x = this.beamStart + m.pointDistance / m.beamLength * this.beamWidth;
        this.groups.loads.append(this.arrow(x, 102, x, 203, "var(--load)", "arrow-down"), this.text(Math.min(680, Math.max(220, x)), 82, `P = ${this.format(m.pointLoad)} kN`, "svg-load"), this.text(Math.min(670, Math.max(230, x)), 252, `a = ${this.format(m.pointDistance)} m`, "svg-small"));
    }

    drawUniformLoad(m) {
        this.groups.loads.append(this.line(this.beamStart, 120, this.beamStart + this.beamWidth, 120, "var(--load)", 2));
        for (let i = 0; i <= 9; i++) { const x = this.beamStart + this.beamWidth / 9 * i; this.groups.loads.append(this.arrow(x, 120, x, 203, "var(--load)", "arrow-down")); }
        this.groups.loads.append(this.text(450, 94, `w = ${this.format(m.uniformLoad)} kN/m`, "svg-load"));
    }

    drawTriangularLoad(m) {
        const start = this.beamStart + m.loadStart / m.beamLength * this.beamWidth;
        const end = this.beamStart + m.loadEnd / m.beamLength * this.beamWidth;
        this.groups.loads.append(this.element("path", { d: `M ${start} 203 L ${end} 203 L ${end} 110 Z`, fill: "var(--load-soft)", stroke: "var(--load)", "stroke-width": 2 }));
        for (let i = 1; i <= 7; i++) { const p = i / 7, x = start + (end - start) * p; this.groups.loads.append(this.arrow(x, 203 - 93 * p, x, 203, "var(--load)", "arrow-down")); }
        this.groups.loads.append(this.text(Math.min(640, Math.max(260, (start + end) / 2)), 86, `wmax = ${this.format(m.maxLoad)} kN/m`, "svg-load"));
    }

    drawReactions(r) {
        for (const [x, label, value] of [[this.beamStart, "RA", r.reactionA], [this.beamStart + this.beamWidth, "RB", r.reactionB]]) {
            const arrowX = label === "RA" ? x - 54 : x + 54;
            if (value > 0) this.groups.dimensions.append(this.arrow(arrowX, 292, arrowX, 232, "var(--reaction)", "arrow-up"));
            this.groups.dimensions.append(this.text(label === "RA" ? x + 25 : x - 25, 346, `${label} = ${this.format(value)} kN`, "svg-reaction"));
        }
    }

    format(value) { return Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 0.005) ? value.toExponential(2) : value.toFixed(2); }
    element(tag, attrs = {}) { const el = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); return el; }
    line(x1, y1, x2, y2, stroke, width) { return this.element("line", { x1, y1, x2, y2, stroke, "stroke-width": width }); }
    rect(x, y, width, height, fill) { return this.element("rect", { x, y, width, height, fill }); }
    circle(cx, cy, r) { return this.element("circle", { cx, cy, r, fill: "var(--surface)", stroke: "var(--support)", "stroke-width": 2 }); }
    arrow(x1, y1, x2, y2, stroke, marker) { const el = this.line(x1, y1, x2, y2, stroke, 2.5); el.setAttribute("marker-end", `url(#${marker})`); return el; }
    text(x, y, content, className) { const el = this.element("text", { x, y, class: className, "text-anchor": "middle" }); el.textContent = content; return el; }
}

document.addEventListener("DOMContentLoaded", () => { new StructuralCalculator(); });
