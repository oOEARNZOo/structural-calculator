class StructuralCalculator {
    constructor() {
        this.beamStart = 90;
        this.beamWidth = 720;
        this.beamY = 220;
        this.initializeElements();
        this.bindEvents();
        this.toggleLoadInputs();
        this.validateInputs();
        this.drawPreview();
    }

    initializeElements() {
        this.beamLengthInput = document.getElementById("beamLength");
        this.supportASelect = document.getElementById("supportA");
        this.supportBSelect = document.getElementById("supportB");
        this.loadTypeSelect = document.getElementById("loadType");
        this.pointLoadInput = document.getElementById("pointLoad");
        this.pointDistanceInput = document.getElementById("pointDistance");
        this.uniformLoadInput = document.getElementById("uniformLoad");
        this.maxLoadInput = document.getElementById("maxLoad");
        this.loadStartInput = document.getElementById("loadStart");
        this.loadEndInput = document.getElementById("loadEnd");
        this.calculateBtn = document.getElementById("calculateBtn");
        this.exampleBtn = document.getElementById("exampleBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.pointLoadInputs = document.getElementById("pointLoadInputs");
        this.uniformLoadInputs = document.getElementById("uniformLoadInputs");
        this.triangularLoadInputs = document.getElementById("triangularLoadInputs");
        this.supportNote = document.getElementById("supportNote");
        this.validationMessage = document.getElementById("validationMessage");
        this.diagramStatus = document.getElementById("diagramStatus");
        this.beamDiagram = document.getElementById("beamDiagram");
        this.diagramDesc = document.getElementById("diagramDesc");
        this.resultsContainer = document.getElementById("results");
        this.placeholder = this.resultsContainer.querySelector(".placeholder");
        this.calculationResult = document.getElementById("calculationResult");
        this.reactionAEl = document.getElementById("reactionA");
        this.reactionBEl = document.getElementById("reactionB");
        this.totalLoadEl = document.getElementById("totalLoad");
        this.centroidLocationEl = document.getElementById("centroidLocation");
        this.supportsGroup = document.getElementById("supports");
        this.loadsGroup = document.getElementById("loads");
        this.dimensionsGroup = document.getElementById("dimensions");
    }

    bindEvents() {
        this.loadTypeSelect.addEventListener("change", () => {
            this.toggleLoadInputs();
            this.resetResultPanel();
            this.validateInputs();
            this.drawPreview();
        });

        [this.supportASelect, this.supportBSelect].forEach((select) => {
            select.addEventListener("change", () => {
                this.resetResultPanel();
                this.validateInputs();
                this.drawPreview();
            });
        });

        this.calculateBtn.addEventListener("click", () => this.calculate());
        this.exampleBtn.addEventListener("click", () => this.loadExample());
        this.resetBtn.addEventListener("click", () => this.resetCalculator());

        this.getNumericInputs().forEach((input) => {
            input.addEventListener("input", () => {
                this.resetResultPanel();
                this.validateInputs();
                this.drawPreview();
            });
        });
    }

    getExamples() {
        return {
            point: {
                beamLength: 5,
                pointLoad: 10,
                pointDistance: 2.5,
            },
            uniform: {
                beamLength: 5,
                uniformLoad: 4,
            },
            triangular: {
                beamLength: 5,
                maxLoad: 6,
                loadStart: 0,
                loadEnd: 5,
            },
        };
    }

    getNumericInputs() {
        return [
            this.beamLengthInput,
            this.pointLoadInput,
            this.pointDistanceInput,
            this.uniformLoadInput,
            this.maxLoadInput,
            this.loadStartInput,
            this.loadEndInput,
        ];
    }

    toggleLoadInputs() {
        const loadType = this.loadTypeSelect.value;
        this.pointLoadInputs.classList.toggle("hidden", loadType !== "point");
        this.uniformLoadInputs.classList.toggle("hidden", loadType !== "uniform");
        this.triangularLoadInputs.classList.toggle("hidden", loadType !== "triangular");
    }

    validateInputs() {
        const result = this.validateCurrentInput();
        this.calculateBtn.disabled = !result.valid;
        this.calculateBtn.setAttribute("aria-disabled", String(!result.valid));
        this.validationMessage.textContent = result.message;
        this.validationMessage.classList.toggle("ok", result.valid);
        this.validationMessage.classList.toggle("error", !result.valid);
        this.updateSupportNote();
        return result.valid;
    }

    validateCurrentInput() {
        const supportCheck = this.validateSupportPair();
        if (!supportCheck.valid) {
            return supportCheck;
        }

        const beamLength = this.getNumber(this.beamLengthInput);
        if (!beamLength || beamLength <= 0) {
            return { valid: false, message: "Beam length must be greater than 0 m." };
        }

        switch (this.loadTypeSelect.value) {
            case "point": {
                const load = this.getNumber(this.pointLoadInput);
                const distance = this.getNumber(this.pointDistanceInput);

                if (!load || load <= 0) {
                    return { valid: false, message: "Point load must be greater than 0 kN." };
                }
                if (Number.isNaN(distance) || distance < 0 || distance > beamLength) {
                    return { valid: false, message: "Point load distance must be between 0 and beam length." };
                }
                break;
            }
            case "uniform": {
                const load = this.getNumber(this.uniformLoadInput);

                if (!load || load <= 0) {
                    return { valid: false, message: "UDL must be greater than 0 kN/m." };
                }
                break;
            }
            case "triangular": {
                const maxLoad = this.getNumber(this.maxLoadInput);
                const loadStart = this.getNumber(this.loadStartInput);
                const loadEnd = this.getNumber(this.loadEndInput);

                if (!maxLoad || maxLoad <= 0) {
                    return { valid: false, message: "Maximum triangular load must be greater than 0 kN/m." };
                }
                if (Number.isNaN(loadStart) || loadStart < 0) {
                    return { valid: false, message: "Load start must be 0 m or greater." };
                }
                if (!loadEnd || loadEnd <= loadStart || loadEnd > beamLength) {
                    return { valid: false, message: "Load end must be after load start and within beam length." };
                }
                break;
            }
            default:
                return { valid: false, message: "Selected load case is not supported." };
        }

        return { valid: true, message: "Inputs are ready for calculation." };
    }

    validateSupportPair() {
        const supportA = this.supportASelect.value;
        const supportB = this.supportBSelect.value;
        const isSimplePair =
            (supportA === "pin" && supportB === "roller") ||
            (supportA === "roller" && supportB === "pin");

        if (isSimplePair) {
            return { valid: true, message: "Support pair is statically determinate." };
        }

        if (supportA === "fixed" || supportB === "fixed") {
            return {
                valid: false,
                message: "Fixed support is shown in the diagram, but fixed-end reactions need moment/stiffness analysis.",
            };
        }

        return { valid: false, message: "Current solver supports one pin support and one roller support." };
    }

    updateSupportNote() {
        const supportCheck = this.validateSupportPair();
        this.supportNote.textContent = supportCheck.valid
            ? "Compatible support pair: one pin and one roller. Reaction calculation is available."
            : supportCheck.message;
        this.supportNote.classList.toggle("warning", !supportCheck.valid);
    }

    calculate() {
        if (!this.validateInputs()) {
            return;
        }

        const beamLength = this.getNumber(this.beamLengthInput);
        const loadType = this.loadTypeSelect.value;
        const result = this.calculateByType(beamLength, loadType);

        this.displayResults(result);
        this.updateDiagram(beamLength, loadType, result);
        this.diagramStatus.textContent = "Solved";
        this.diagramStatus.classList.add("ok");
        this.diagramStatus.classList.remove("warning");
    }

    calculateByType(beamLength, loadType) {
        if (loadType === "point") {
            return this.calculatePointLoad(beamLength);
        }
        if (loadType === "uniform") {
            return this.calculateUniformLoad(beamLength);
        }
        return this.calculateTriangularLoad(beamLength);
    }

    calculatePointLoad(beamLength) {
        const load = this.getNumber(this.pointLoadInput);
        const distance = this.getNumber(this.pointDistanceInput);
        const reactionB = (load * distance) / beamLength;
        const reactionA = load - reactionB;

        return {
            reactionA,
            reactionB,
            totalLoad: load,
            centroid: distance,
            label: `P = ${this.format(load)} kN`,
        };
    }

    calculateUniformLoad(beamLength) {
        const loadPerUnit = this.getNumber(this.uniformLoadInput);
        const totalLoad = loadPerUnit * beamLength;

        return {
            reactionA: totalLoad / 2,
            reactionB: totalLoad / 2,
            totalLoad,
            centroid: beamLength / 2,
            label: `w = ${this.format(loadPerUnit)} kN/m`,
        };
    }

    calculateTriangularLoad(beamLength) {
        const maxLoad = this.getNumber(this.maxLoadInput);
        const loadStart = this.getNumber(this.loadStartInput);
        const loadEnd = this.getNumber(this.loadEndInput);
        const loadLength = loadEnd - loadStart;
        const totalLoad = (maxLoad * loadLength) / 2;
        const centroid = loadStart + loadLength * (2 / 3);
        const reactionB = (totalLoad * centroid) / beamLength;
        const reactionA = totalLoad - reactionB;

        return {
            reactionA,
            reactionB,
            totalLoad,
            centroid,
            label: `wmax = ${this.format(maxLoad)} kN/m`,
        };
    }

    displayResults(result) {
        this.placeholder.classList.add("hidden");
        this.calculationResult.classList.remove("hidden");
        this.reactionAEl.textContent = `${this.format(result.reactionA)} kN`;
        this.reactionBEl.textContent = `${this.format(result.reactionB)} kN`;
        this.totalLoadEl.textContent = `Total load: ${this.format(result.totalLoad)} kN`;
        this.centroidLocationEl.textContent = `Resultant at: ${this.format(result.centroid)} m from A`;
    }

    resetCalculator() {
        this.supportASelect.value = "pin";
        this.supportBSelect.value = "roller";
        this.loadTypeSelect.value = "point";
        this.loadExampleValues("point");
        this.toggleLoadInputs();
        this.resetResultPanel();
        this.diagramStatus.textContent = "Preview";
        this.diagramStatus.classList.remove("ok");
        this.diagramStatus.classList.remove("warning");
        this.validateInputs();
        this.drawPreview();
    }

    loadExample() {
        this.loadExampleValues(this.loadTypeSelect.value);
        this.resetResultPanel();
        this.validateInputs();
        this.drawPreview();
    }

    resetResultPanel() {
        this.placeholder.classList.remove("hidden");
        this.calculationResult.classList.add("hidden");
    }

    loadExampleValues(loadType) {
        const example = this.getExamples()[loadType];
        this.beamLengthInput.value = example.beamLength;

        if (loadType === "point") {
            this.pointLoadInput.value = example.pointLoad;
            this.pointDistanceInput.value = example.pointDistance;
        }
        if (loadType === "uniform") {
            this.uniformLoadInput.value = example.uniformLoad;
        }
        if (loadType === "triangular") {
            this.maxLoadInput.value = example.maxLoad;
            this.loadStartInput.value = example.loadStart;
            this.loadEndInput.value = example.loadEnd;
        }
    }

    drawPreview() {
        const beamLength = this.getNumber(this.beamLengthInput);

        if (!beamLength || beamLength <= 0) {
            this.updateDiagram(5, null, this.getEmptyResult());
            this.diagramStatus.textContent = "Input issue";
            this.diagramStatus.classList.add("warning");
            this.diagramStatus.classList.remove("ok");
            return;
        }

        if (this.validateCurrentInput().valid) {
            const result = this.calculateByType(beamLength, this.loadTypeSelect.value);
            this.updateDiagram(beamLength, this.loadTypeSelect.value, result, false);
            this.diagramStatus.textContent = "Preview";
            this.diagramStatus.classList.remove("warning");
        } else {
            this.updateDiagram(beamLength, null, this.getEmptyResult());
            this.diagramStatus.textContent = "Input issue";
            this.diagramStatus.classList.add("warning");
        }
        this.diagramStatus.classList.remove("ok");
    }

    updateDiagram(beamLength, loadType, result, showReactions = true) {
        this.clearDiagram();
        this.drawSupports();
        this.drawBaseDimensions(beamLength);

        if (loadType === "point") {
            this.drawPointLoad(beamLength);
        }
        if (loadType === "uniform") {
            this.drawUniformLoad(result.label);
        }
        if (loadType === "triangular") {
            this.drawTriangularLoad(beamLength, result.label);
        }
        if (loadType && showReactions) {
            this.drawReactions(result);
        }
        this.updateDiagramLabel(loadType, result, showReactions);
    }

    updateDiagramLabel(loadType, result, showReactions) {
        const supportA = this.supportASelect.options[this.supportASelect.selectedIndex].text;
        const supportB = this.supportBSelect.options[this.supportBSelect.selectedIndex].text;
        const state = showReactions && loadType ? "solved" : "preview";
        const load = loadType ? `${loadType} load, ${result.label}` : "no active load";
        this.diagramDesc.textContent = `Beam free-body diagram ${state}. Support A: ${supportA}. Support B: ${supportB}. ${load}.`;
    }

    drawBaseDimensions(beamLength) {
        const g = this.createSvgElement("g");
        const y = 324;

        g.appendChild(this.line(this.beamStart, y, this.beamStart + this.beamWidth, y, "var(--muted)", 1.5));
        g.appendChild(this.line(this.beamStart, y - 8, this.beamStart, y + 8, "var(--muted)", 1.5));
        g.appendChild(this.line(this.beamStart + this.beamWidth, y - 8, this.beamStart + this.beamWidth, y + 8, "var(--muted)", 1.5));
        g.appendChild(this.text(this.beamStart + this.beamWidth / 2, y - 10, `L = ${this.format(beamLength)} m`, "svg-small", "middle"));

        this.dimensionsGroup.appendChild(g);
    }

    drawSupports() {
        this.supportsGroup.appendChild(this.drawSupport(this.supportASelect.value, this.beamStart, "A", "left"));
        this.supportsGroup.appendChild(this.drawSupport(this.supportBSelect.value, this.beamStart + this.beamWidth, "B", "right"));
    }

    drawSupport(type, x, label, side) {
        const g = this.createSvgElement("g");

        if (type === "fixed") {
            const wallX = side === "left" ? x - 36 : x + 24;
            g.appendChild(this.rect(wallX, this.beamY - 42, 12, 92, "var(--support)", "var(--support)", 1));
            for (let i = 0; i < 6; i += 1) {
                const y = this.beamY - 36 + i * 16;
                const x1 = side === "left" ? wallX - 12 : wallX + 12;
                const x2 = side === "left" ? wallX : wallX + 24;
                g.appendChild(this.line(x1, y + 12, x2, y, "var(--support)", 2));
            }
            g.appendChild(this.text(x, 315, label, "svg-label", "middle"));
            g.appendChild(this.text(x, 336, "Fixed", "svg-support-note", "middle"));
            return g;
        }

        if (type === "pin") {
            const triangle = this.createSvgElement("path");
            triangle.setAttribute("d", `M ${x} ${this.beamY + 10} L ${x - 28} ${this.beamY + 64} L ${x + 28} ${this.beamY + 64} Z`);
            triangle.setAttribute("fill", "var(--surface-elevated)");
            triangle.setAttribute("stroke", "var(--support)");
            triangle.setAttribute("stroke-width", "3");
            g.appendChild(triangle);
            g.appendChild(this.text(x, 315, label, "svg-label", "middle"));
            g.appendChild(this.text(x, 336, "Pin", "svg-support-note", "middle"));
            return g;
        }

        g.appendChild(this.circle(x, this.beamY + 22, 11, "var(--surface-elevated)", "var(--support)", 3));
        g.appendChild(this.circle(x - 18, this.beamY + 62, 8, "var(--surface-elevated)", "var(--support)", 2));
        g.appendChild(this.circle(x + 18, this.beamY + 62, 8, "var(--surface-elevated)", "var(--support)", 2));
        g.appendChild(this.line(x - 44, this.beamY + 74, x + 44, this.beamY + 74, "var(--support)", 3));
        g.appendChild(this.text(x, 315, label, "svg-label", "middle"));
        g.appendChild(this.text(x, 336, "Roller", "svg-support-note", "middle"));
        return g;
    }

    drawPointLoad(beamLength) {
        const load = this.getNumber(this.pointLoadInput);
        const distance = this.getNumber(this.pointDistanceInput);
        const x = this.beamStart + (distance / beamLength) * this.beamWidth;
        const g = this.createSvgElement("g");

        g.appendChild(this.arrow(x, 100, x, this.beamY - 14, "var(--load)", "arrow-down"));
        g.appendChild(this.text(x, 88, `P = ${this.format(load)} kN`, "svg-load", "middle"));
        g.appendChild(this.text(x, 252, `a = ${this.format(distance)} m`, "svg-small", "middle"));

        this.loadsGroup.appendChild(g);
    }

    drawUniformLoad(label) {
        const g = this.createSvgElement("g");
        const topY = 118;

        g.appendChild(this.line(this.beamStart, topY, this.beamStart + this.beamWidth, topY, "var(--load)", 2));

        for (let i = 0; i <= 9; i += 1) {
            const x = this.beamStart + (this.beamWidth / 9) * i;
            g.appendChild(this.arrow(x, topY, x, this.beamY - 14, "var(--load)", "arrow-down"));
        }

        g.appendChild(this.text(this.beamStart + this.beamWidth / 2, 96, label, "svg-load", "middle"));
        this.loadsGroup.appendChild(g);
    }

    drawTriangularLoad(beamLength, label) {
        const start = this.getNumber(this.loadStartInput);
        const end = this.getNumber(this.loadEndInput);
        const startX = this.beamStart + (start / beamLength) * this.beamWidth;
        const endX = this.beamStart + (end / beamLength) * this.beamWidth;
        const g = this.createSvgElement("g");
        const topY = 112;

        const triangle = this.createSvgElement("path");
        triangle.setAttribute("d", `M ${startX} ${this.beamY - 14} L ${endX} ${this.beamY - 14} L ${endX} ${topY} Z`);
        triangle.setAttribute("fill", "var(--load-soft)");
        triangle.setAttribute("stroke", "var(--load)");
        triangle.setAttribute("stroke-width", "2");
        g.appendChild(triangle);

        for (let i = 1; i <= 7; i += 1) {
            const progress = i / 7;
            const x = startX + (endX - startX) * progress;
            const y = this.beamY - 14 - (this.beamY - 14 - topY) * progress;
            g.appendChild(this.arrow(x, y, x, this.beamY - 14, "var(--load)", "arrow-down"));
        }

        g.appendChild(this.text(startX + (endX - startX) / 2, 92, label, "svg-load", "middle"));
        this.loadsGroup.appendChild(g);
    }

    drawReactions(result) {
        const g = this.createSvgElement("g");
        const ax = this.beamStart;
        const bx = this.beamStart + this.beamWidth;

        g.appendChild(this.arrow(ax, this.beamY + 78, ax, this.beamY + 14, "var(--reaction)", "arrow-up"));
        g.appendChild(this.arrow(bx, this.beamY + 78, bx, this.beamY + 14, "var(--reaction)", "arrow-up"));
        g.appendChild(this.text(ax, this.beamY + 96, `RA = ${this.format(result.reactionA)} kN`, "svg-reaction", "middle"));
        g.appendChild(this.text(bx, this.beamY + 96, `RB = ${this.format(result.reactionB)} kN`, "svg-reaction", "middle"));

        this.dimensionsGroup.appendChild(g);
    }

    clearDiagram() {
        this.supportsGroup.innerHTML = "";
        this.loadsGroup.innerHTML = "";
        this.dimensionsGroup.innerHTML = "";
    }

    getNumber(input) {
        return parseFloat(input.value);
    }

    getEmptyResult() {
        return {
            reactionA: 0,
            reactionB: 0,
            totalLoad: 0,
            centroid: 0,
            label: "",
        };
    }

    format(value) {
        return Number(value).toFixed(2);
    }

    createSvgElement(tag) {
        return document.createElementNS("http://www.w3.org/2000/svg", tag);
    }

    line(x1, y1, x2, y2, stroke, width) {
        const line = this.createSvgElement("line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", stroke);
        line.setAttribute("stroke-width", width);
        return line;
    }

    rect(x, y, width, height, fill, stroke, strokeWidth) {
        const rect = this.createSvgElement("rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", fill);
        rect.setAttribute("stroke", stroke);
        rect.setAttribute("stroke-width", strokeWidth);
        return rect;
    }

    circle(cx, cy, r, fill, stroke, strokeWidth) {
        const circle = this.createSvgElement("circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", r);
        circle.setAttribute("fill", fill);
        circle.setAttribute("stroke", stroke);
        circle.setAttribute("stroke-width", strokeWidth);
        return circle;
    }

    arrow(x1, y1, x2, y2, stroke, markerId) {
        const line = this.line(x1, y1, x2, y2, stroke, 3);
        line.setAttribute("marker-end", `url(#${markerId})`);
        return line;
    }

    text(x, y, content, className, anchor = "start") {
        const text = this.createSvgElement("text");
        text.setAttribute("x", x);
        text.setAttribute("y", y);
        text.setAttribute("class", className);
        text.setAttribute("text-anchor", anchor);
        text.textContent = content;
        return text;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new StructuralCalculator();
});
