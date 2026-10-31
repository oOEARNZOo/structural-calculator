const { test } = require('node:test');
const assert = require('node:assert/strict');
const { solve, validate } = require('../solver.js');
const base = { beamLength: 5, supportA: 'pin', supportB: 'roller', loadType: 'point', pointLoad: 10, pointDistance: 2.5, uniformLoad: 4, maxLoad: 6, loadStart: 0, loadEnd: 5 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);
test('point load: centre, asymmetric and both support endpoints', () => {
    for (const [position, a, b] of [[2.5, 5, 5], [1, 8, 2], [0, 10, 0], [5, 0, 10]]) {
        const result = solve({ ...base, pointDistance: position });
        near(result.reactionA, a); near(result.reactionB, b);
    }
});
test('uniform and partial triangular load resultants', () => {
    assert.deepEqual(solve({ ...base, loadType: 'uniform' }), { reactionA: 10, reactionB: 10, totalLoad: 20, centroid: 2.5 });
    const r = solve({ ...base, loadType: 'triangular', loadStart: 1, loadEnd: 4 });
    near(r.totalLoad, 9); near(r.centroid, 3); near(r.reactionA, 3.6); near(r.reactionB, 5.4);
});
test('all supported load cases satisfy force and moment equilibrium', () => {
    for (const loadType of ['point', 'uniform', 'triangular']) {
        for (const beamLength of [1, 5, 20]) {
            const m = { ...base, loadType, beamLength, pointDistance: beamLength * 0.27, loadStart: beamLength * 0.1, loadEnd: beamLength * 0.9 };
            const r = solve(m);
            near(r.reactionA + r.reactionB, r.totalLoad);
            near(r.reactionB * beamLength, r.totalLoad * r.centroid);
            assert.deepEqual(solve({ ...m, supportA: 'roller', supportB: 'pin' }), r);
        }
    }
});
test('invalid geometry, non-finite values and unsupported supports never produce a result', () => {
    for (const patch of [{ beamLength: 0 }, { pointDistance: 6 }, { pointDistance: NaN }, { pointLoad: Infinity }, { pointLoad: -1 }, { supportA: 'fixed' }, { supportB: 'pin' }, { loadType: 'triangular', loadEnd: 0 }, { loadType: 'triangular', loadStart: 6 }, { loadType: 'unknown' }]) {
        assert.equal(validate({ ...base, ...patch }).valid, false);
        assert.equal(solve({ ...base, ...patch }), null);
    }
    assert.equal(solve({ ...base, loadType: 'uniform', uniformLoad: Number.MAX_VALUE }), null);
});
const { analyze, validateLoads } = require('../solver.js');
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
    const { validateSupports } = require('../solver.js');
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
