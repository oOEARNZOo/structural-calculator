/* Pure analysis functions, shared by the browser and Node verification.
   Model: { beamLength, supportA, supportB, loads: [{ type: "P", mag, a } | { type: "w", mag, a, b }] }
   Support A sits at x = 0 and support B at x = L. */
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const SAMPLES = 240;

function validateLoads(model) {
    const L = model.beamLength;
    const lengthError = !finite(L) || L <= 0 ? "Span must be greater than 0 m." : "";
    const onBeam = x => finite(x) && x >= 0 && (!finite(L) || x <= L);
    const errors = (model.loads || []).map(load => {
        const e = {};
        if (!finite(load.mag)) e.mag = "Enter a magnitude.";
        if (!onBeam(load.a)) e.a = "Position must lie on the beam.";
        if (load.type === "w" && (!finite(load.b) || load.b <= load.a || !onBeam(load.b))) e.b = "End must be after the start, within the beam.";
        return e;
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

/* Sample on a uniform grid plus both sides of every discontinuity so steps draw vertically. */
function sampleStations(L, pts, us) {
    const eps = L * 1e-6;
    const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => L * i / SAMPLES);
    for (const p of pts) xs.push(clamp(p.a - eps, 0, L), clamp(p.a + eps, 0, L));
    for (const u of us) xs.push(u.a, u.b);
    xs.push(eps, L - eps);
    return xs.filter(x => x >= 0 && x <= L).sort((a, b) => a - b);
}

/* Extremes of a sampled curve: largest |value|, signed max and min, each with its station. */
function extremes(xs, values) {
    const out = { absMax: 0, absMaxX: 0, peak: 0, max: -Infinity, maxX: 0, min: Infinity, minX: 0 };
    xs.forEach((x, i) => {
        const v = values[i];
        if (Math.abs(v) > Math.abs(out.peak)) { out.peak = v; out.absMax = Math.abs(v); out.absMaxX = x; }
        if (v > out.max) { out.max = v; out.maxX = x; }
        if (v < out.min) { out.min = v; out.minX = x; }
    });
    return out;
}

function analyze(model) {
    const supports = validateSupports(model.supportA, model.supportB);
    if (!validateLoads(model).valid || !supports.supported) return null;
    const L = model.beamLength;
    const pts = model.loads.filter(l => l.type === "P").map(l => ({ P: l.mag, a: l.a }));
    const us = model.loads.filter(l => l.type === "w").map(l => ({ w: l.mag, a: l.a, b: l.b }));

    // Each load reduces to a resultant force acting at an arm from x = 0.
    const terms = [
        ...pts.map(p => ({ force: p.P, arm: p.a })),
        ...us.map(u => ({ force: u.w * (u.b - u.a), arm: (u.a + u.b) / 2 }))
    ];
    const total = terms.reduce((sum, t) => sum + t.force, 0);
    const moment = terms.reduce((sum, t) => sum + t.force * t.arm, 0);

    const kind = supports.kind;
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

    const xs = sampleStations(L, pts, us);
    const vs = xs.map(shear), ms = xs.map(bending);
    const V = extremes(xs, vs), M = extremes(xs, ms);
    const residual = Math.abs(reactionA + reactionB - total);
    return {
        kind, fixedEnd, fixedMoment, reactionA, reactionB, total, moment, terms, xs, vs, ms, shear, bending,
        centroid: total ? moment / total : null,
        maxShear: V.absMax, maxShearX: V.absMaxX, topShear: V.max, topShearX: V.maxX, botShear: V.min, botShearX: V.minX,
        peakMoment: M.peak, peakMomentX: M.absMaxX, maxMoment: M.max, maxMomentX: M.maxX, minMoment: M.min,
        balanced: residual < 1e-6 * Math.max(1, Math.abs(total))
    };
}
export { validateLoads, validateSupports, analyze };
