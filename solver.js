/* Pure analysis functions, shared by the browser and Node verification. */
(function (root) {
    const finite = (value) => typeof value === "number" && Number.isFinite(value);
    function validate(model) {
        const errors = {};
        const positive = (key, label, unit) => {
            if (!finite(model[key]) || model[key] <= 0) errors[key] = `${label} must be greater than 0 ${unit}.`;
        };
        positive("beamLength", "Beam length", "m");
        if (model.loadType === "point") {
            positive("pointLoad", "Point load", "kN");
            if (!finite(model.pointDistance) || model.pointDistance < 0 || model.pointDistance > model.beamLength)
                errors.pointDistance = `Enter a position between 0 and ${finite(model.beamLength) && model.beamLength > 0 ? model.beamLength : "the beam length"} m.`;
        } else if (model.loadType === "uniform") {
            positive("uniformLoad", "Uniform load", "kN/m");
        } else if (model.loadType === "triangular") {
            positive("maxLoad", "Maximum load", "kN/m");
            if (!finite(model.loadStart) || model.loadStart < 0 || model.loadStart >= model.beamLength)
                errors.loadStart = "Load start must be within the beam, before its end.";
            if (!finite(model.loadEnd) || model.loadEnd <= model.loadStart || model.loadEnd > model.beamLength)
                errors.loadEnd = "Load end must be after the start and within the beam.";
        } else errors.loadType = "Choose a supported load case.";
        const supported = (model.supportA === "pin" && model.supportB === "roller") ||
            (model.supportA === "roller" && model.supportB === "pin");
        const supportMessage = supported ? "One pin + one roller. Reactions are calculated automatically."
            : model.supportA === "fixed" || model.supportB === "fixed"
                ? "Fixed supports are diagram-only. Their reactions require moment and stiffness analysis."
                : "Choose one pin and one roller to calculate reactions.";
        return { errors, supported, supportMessage, valid: supported && Object.keys(errors).length === 0 };
    }
    function solve(model) {
        if (!validate(model).valid) return null;
        const L = model.beamLength;
        let totalLoad, centroid;
        if (model.loadType === "point") { totalLoad = model.pointLoad; centroid = model.pointDistance; }
        else if (model.loadType === "uniform") { totalLoad = model.uniformLoad * L; centroid = L / 2; }
        else { const span = model.loadEnd - model.loadStart; totalLoad = model.maxLoad * span / 2; centroid = model.loadStart + span * 2 / 3; }
        const reactionB = totalLoad * (centroid / L);
        const reactionA = totalLoad - reactionB;
        if (![totalLoad, centroid, reactionA, reactionB].every(finite)) return null;
        return { reactionA, reactionB, totalLoad, centroid };
    }
    const api = { validate, solve };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.BeamAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
