import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectCgpa, requiredGpa, neededInFinal } from '../js/planner.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

// 60 credits at a CGPA of 3.0
const base = { credits: 60, qualityPoints: 180 };

test('projectCgpa blends past and future credits', () => {
    near(projectCgpa(base, 60, 4.0), 3.5);
    near(projectCgpa(base, 0, 4.0), 3.0);
    assert.equal(projectCgpa({ credits: 0, qualityPoints: 0 }, 0, 4.0), 0);
});

test('requiredGpa reports what the remaining credits must average', () => {
    const reachable = requiredGpa(base, 3.25, 60);
    assert.equal(reachable.status, 'possible');
    near(reachable.required, 3.5);
    near(reachable.maxCgpa, 3.5);
    near(reachable.minCgpa, 1.5);

    assert.equal(requiredGpa(base, 3.8, 60).status, 'impossible');
    assert.equal(requiredGpa(base, 1.5, 60).status, 'secured');
    assert.equal(requiredGpa(base, 3.5, 60).status, 'possible');
});

test('neededInFinal works back from each grade band', () => {
    const rows = neededInFinal(50, 40);
    const byLetter = Object.fromEntries(rows.map(row => [row.letter, row]));

    assert.equal(rows.some(row => row.letter === 'F'), false);
    assert.equal(byLetter['A+'].needed, 39.5);
    assert.equal(byLetter['A+'].status, 'possible');
    assert.equal(byLetter.A.needed, 29.5);
    assert.equal(byLetter.D.needed, 0);
    assert.equal(byLetter.D.status, 'secured');

    assert.equal(neededInFinal(40, 40).find(row => row.letter === 'A+').status, 'out-of-reach');
});
