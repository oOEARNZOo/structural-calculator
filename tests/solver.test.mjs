import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, validateLoads, validateSupports } from '../solver.js';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);
const beam = (loads, extra = {}) => ({ beamLength: 5, supportA: 'pin', supportB: 'roller', loads, ...extra });
test('point load: centre, asymmetric and both support endpoints', () => {
    for (const [position, a, b] of [[2.5, 5, 5], [1, 8, 2], [0, 10, 0], [5, 0, 10]]) {
        const r = analyze(beam([{ type: 'P', mag: 10, a: position }]));
        near(r.reactionA, a); near(r.reactionB, b);
    }
});
test('uniform load and partial distributed load resultants', () => {
    const full = analyze(beam([{ type: 'w', mag: 4, a: 0, b: 5 }]));
    near(full.reactionA, 10); near(full.reactionB, 10); near(full.total, 20); near(full.centroid, 2.5);
    const partial = analyze(beam([{ type: 'w', mag: 2, a: 1, b: 4 }]));
    near(partial.total, 6); near(partial.centroid, 2.5); near(partial.reactionA, 3); near(partial.reactionB, 3);
});
test('supported load cases satisfy force and moment equilibrium, in either support order', () => {
    for (const L of [1, 5, 20]) {
        for (const loads of [[{ type: 'P', mag: 10, a: L * 0.27 }], [{ type: 'w', mag: 4, a: 0, b: L }], [{ type: 'w', mag: 6, a: L * 0.1, b: L * 0.9 }]]) {
            const r = analyze(beam(loads, { beamLength: L }));
            near(r.reactionA + r.reactionB, r.total);
            near(r.reactionB * L, r.moment);
            const swapped = analyze(beam(loads, { beamLength: L, supportA: 'roller', supportB: 'pin' }));
            near(swapped.reactionA, r.reactionA); near(swapped.reactionB, r.reactionB);
        }
    }
});
test('invalid geometry and non-finite values never produce a result', () => {
    const P = { type: 'P', mag: 10, a: 2.5 };
    for (const patch of [{ beamLength: 0 }, { loads: [{ ...P, a: 6 }] }, { loads: [{ ...P, a: NaN }] }, { loads: [{ ...P, mag: Infinity }] }, { loads: [{ type: 'w', mag: 1, a: 3, b: 3 }] }])
        assert.equal(analyze(beam([P], patch)), null);
    assert.equal(analyze(beam([{ type: 'w', mag: Number.MAX_VALUE, a: 0, b: 5 }])), null);
});
test('multi-load analysis matches hand calculation and equilibrium', () => {
    const r = analyze({ beamLength: 6, loads: [{ type: 'P', mag: 12, a: 2 }, { type: 'w', mag: 4, a: 3, b: 6 }] });
    near(r.total, 24); near(r.moment, 12 * 2 + 12 * 4.5); near(r.reactionB, 13); near(r.reactionA, 11);
    near(r.shear(0), 11); near(r.shear(6), -13); near(r.bending(6), 0);
    near(r.maxShear, 13); assert.ok(r.balanced);
    assert.ok(Math.abs(r.maxMoment - r.bending(r.maxMomentX)) < 1e-9);
});
test('multi-load validation rejects off-beam, empty and reversed loads', () => {
    for (const loads of [[{ type: 'P', mag: 1, a: 7 }], [{ type: 'P', mag: NaN, a: 1 }], [{ type: 'w', mag: 1, a: 4, b: 2 }]])
        assert.equal(analyze({ beamLength: 6, loads }), null);
    assert.equal(validateLoads({ beamLength: 0, loads: [] }).valid, false);
    assert.equal(analyze({ beamLength: 6, loads: [] }).reactionA, 0);
});
test('support pairs: pin/roller in either order solve, others are preview-only', () => {
    const m = { beamLength: 6, loads: [{ type: 'P', mag: 12, a: 2 }] };
    const r = analyze({ ...m, supportA: 'pin', supportB: 'roller' });
    near(analyze({ ...m, supportA: 'roller', supportB: 'pin' }).reactionA, r.reactionA);
    for (const [a, b] of [['pin', 'pin'], ['roller', 'roller'], ['fixed', 'roller'], ['pin', 'fixed']]) {
        assert.equal(validateSupports(a, b).supported, false);
        assert.equal(analyze({ ...m, supportA: a, supportB: b }), null);
    }
});
test('cantilever: fixed + free solves by equilibrium with hogging moment', () => {
    const loads = [{ type: 'P', mag: 10, a: 4 }, { type: 'w', mag: 2, a: 1, b: 3 }];
    const A = analyze({ beamLength: 6, supportA: 'fixed', supportB: 'free', loads });
    near(A.reactionA, 14); near(A.reactionB, 0); near(A.fixedMoment, 40 + 4 * 2);
    near(A.bending(0), -48); near(A.bending(6), 0); near(A.peakMoment, -48); near(A.peakMomentX, 0);
    const B = analyze({ beamLength: 6, supportA: 'free', supportB: 'fixed', loads });
    near(B.reactionB, 14); near(B.reactionA, 0); near(B.fixedMoment, 10 * 2 + 4 * 4);
    near(B.bending(6), -36); near(B.bending(0), 0); near(B.shear(6), -14);
    assert.ok(A.balanced && B.balanced);
    for (const [a, b] of [['fixed', 'fixed'], ['fixed', 'pin'], ['free', 'pin'], ['free', 'free']])
        assert.equal(analyze({ beamLength: 6, supportA: a, supportB: b, loads }), null);
});
