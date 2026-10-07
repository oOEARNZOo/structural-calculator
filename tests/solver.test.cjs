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
