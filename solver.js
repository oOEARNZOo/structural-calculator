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
    /* Multi-load analysis. loads: [{ type: "P", mag, a } | { type: "w", mag, a, b }], pin at x = 0, roller at x = L. */
    function validateLoads(model) {
        const errors = [];
        const L = model.beamLength;
        const lengthError = !finite(L) || L <= 0 ? "Span must be greater than 0 m." : "";
        (model.loads || []).forEach((load, i) => {
            const e = {};
            if (!finite(load.mag)) e.mag = "Enter a magnitude.";
            if (!finite(load.a) || load.a < 0 || (finite(L) && load.a > L)) e.a = "Position must lie on the beam.";
            if (load.type === "w" && (!finite(load.b) || load.b <= load.a || (finite(L) && load.b > L))) e.b = "End must be after the start, within the beam.";
            errors[i] = e;
        });
        return { lengthError, errors, valid: !lengthError && errors.every(e => Object.keys(e).length === 0) };
    }
    /* Statically determinate cases: one pin + one roller (either order), or a cantilever (fixed + free). */
    function validateSupports(supportA = "pin", supportB = "roller") {
        const has = type => supportA === type || supportB === type;
        const simple = has("pin") && has("roller");
        const cantilever = has("fixed") && has("free");
        const message = simple ? "One pin + one roller. Reactions are calculated automatically."
            : cantilever ? "Cantilever: the fixed end carries the vertical force and a moment."
                : has("fixed") ? "Fixed + pin, roller or fixed is statically indeterminate and needs beam stiffness (EI). Preview only."
                    : has("free") ? "A free end can't hold the beam up. Add a pin, roller or fixed support."
                        : "Two identical supports can't be solved from equilibrium alone. Choose one pin and one roller.";
        return { supported: simple || cantilever, kind: simple ? "simple" : cantilever ? "cantilever" : null, message };
    }
    function analyze(model) {
        if (!validateLoads(model).valid || !validateSupports(model.supportA, model.supportB).supported) return null;
        const L = model.beamLength;
        const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
        const pts = model.loads.filter(l => l.type === "P").map(l => ({ P: l.mag, a: l.a }));
        const us = model.loads.filter(l => l.type === "w").map(l => ({ w: l.mag, a: l.a, b: l.b }));
        let total = 0, moment = 0;
        const terms = [];
        for (const p of pts) { total += p.P; moment += p.P * p.a; terms.push({ force: p.P, arm: p.a }); }
        for (const u of us) { const W = u.w * (u.b - u.a), arm = (u.a + u.b) / 2; total += W; moment += W * arm; terms.push({ force: W, arm }); }
        const kind = validateSupports(model.supportA, model.supportB).kind;
        const fixedEnd = kind === "cantilever" ? (model.supportA === "fixed" ? "A" : "B") : null;
        // Loads' moment about x = 0 is the fixed-end moment at A; about x = L it is total·L − moment.
        const fixedMoment = fixedEnd === "A" ? moment : fixedEnd === "B" ? total * L - moment : 0;
        const reactionB = fixedEnd === "A" ? 0 : fixedEnd === "B" ? total : moment / L;
        const reactionA = total - reactionB;
        const startMoment = fixedEnd === "A" ? moment : 0;
        if (![total, moment, reactionA, reactionB].every(finite)) return null;
        const shear = x => {
            if (x <= 0) return reactionA;
            if (x >= L) return -reactionB;
            let v = reactionA;
            for (const p of pts) if (p.a < x) v -= p.P;
            for (const u of us) v -= u.w * clamp(x - u.a, 0, u.b - u.a);
            return v;
        };
        const bending = x => {
            let m = reactionA * x - startMoment;
            for (const p of pts) if (x > p.a) m -= p.P * (x - p.a);
            for (const u of us) { const s1 = Math.max(x - u.a, 0), s2 = Math.max(x - u.b, 0); m -= u.w * (s1 * s1 - s2 * s2) / 2; }
            return m;
        };
        // Sample on a uniform grid plus both sides of every discontinuity so steps draw vertically.
        const eps = L * 1e-6;
        let xs = Array.from({ length: 241 }, (_, i) => L * i / 240);
        for (const p of pts) xs.push(clamp(p.a - eps, 0, L), clamp(p.a + eps, 0, L));
        for (const u of us) xs.push(u.a, u.b);
        xs.push(eps, L - eps);
        xs = xs.filter(x => x >= 0 && x <= L).sort((a, b) => a - b);
        const vs = xs.map(shear), ms = xs.map(bending);
        let peakMoment = 0, peakMomentX = 0, maxShear = 0, maxShearX = 0, maxMoment = -Infinity, maxMomentX = 0, minMoment = Infinity, topShear = -Infinity, topShearX = 0, botShear = Infinity, botShearX = 0;
        xs.forEach((x, i) => {
            if (Math.abs(vs[i]) > maxShear) { maxShear = Math.abs(vs[i]); maxShearX = x; }
            if (vs[i] > topShear) { topShear = vs[i]; topShearX = x; }
            if (vs[i] < botShear) { botShear = vs[i]; botShearX = x; }
            if (Math.abs(ms[i]) > Math.abs(peakMoment)) { peakMoment = ms[i]; peakMomentX = x; }
            if (ms[i] > maxMoment) { maxMoment = ms[i]; maxMomentX = x; }
            if (ms[i] < minMoment) minMoment = ms[i];
        });
        const residual = Math.abs(reactionA + reactionB - total);
        return { kind, fixedEnd, fixedMoment, peakMoment, peakMomentX, reactionA, reactionB, total, moment, centroid: total ? moment / total : null, terms, xs, vs, ms, shear, bending,
            maxShear, maxShearX, maxMoment, maxMomentX, minMoment, topShear, topShearX, botShear, botShearX, balanced: residual < 1e-6 * Math.max(1, Math.abs(total)) };
    }
    const api = { validate, solve, validateLoads, validateSupports, analyze };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.BeamAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
