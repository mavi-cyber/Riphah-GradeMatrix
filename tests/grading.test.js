import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    roundMarks, letterFromMarks, gradePointFromMarks, gradePointFromLetter,
    minMarksForLetter, evaluateCourse
} from '../js/grading.js';

test('marks round half up, once', () => {
    assert.equal(roundMarks(79.5), 80);
    assert.equal(roundMarks(79.49), 79);
    assert.equal(roundMarks(50), 50);
});

test('band boundaries map to the RIU table', () => {
    const cases = [
        [100, 'A+', 4.0], [90, 'A+', 4.0], [89, 'A', 4.0], [80, 'A', 4.0],
        [79, 'A-', 3.9], [78, 'A-', 3.8], [77, 'B+', 3.7], [74, 'B+', 3.4],
        [73, 'B', 3.3], [70, 'B', 3.0], [69, 'B-', 2.9], [68, 'B-', 2.8],
        [67, 'C+', 2.7], [64, 'C+', 2.4], [63, 'C', 2.3], [60, 'C', 2.0],
        [59, 'C-', 1.9], [58, 'C-', 1.8], [57, 'D+', 1.7], [54, 'D+', 1.4],
        [53, 'D', 1.3], [50, 'D', 1.0], [49, 'F', 0], [0, 'F', 0]
    ];
    for (const [marks, letter, gp] of cases) {
        assert.equal(letterFromMarks(marks), letter, `letter for ${marks}`);
        assert.equal(gradePointFromMarks(marks), gp, `grade point for ${marks}`);
    }
});

test('letter and grade point agree on fractional marks', () => {
    assert.equal(letterFromMarks(79.5), 'A');
    assert.equal(gradePointFromMarks(79.5), 4.0);
    assert.equal(letterFromMarks(49.5), 'D');
    assert.equal(gradePointFromMarks(49.5), 1.0);
    assert.equal(letterFromMarks(49.4), 'F');
});

test('letters convert to baseline points and marks', () => {
    assert.equal(gradePointFromLetter('B+'), 3.4);
    assert.equal(gradePointFromLetter(' a- '), 3.8);
    assert.equal(gradePointFromLetter('W'), null);
    assert.equal(minMarksForLetter('A'), 80);
    assert.equal(minMarksForLetter('F'), 40);
    assert.equal(minMarksForLetter('I'), null);
});

test('evaluateCourse classifies rows', () => {
    assert.equal(evaluateCourse({ name: 'Only a name' }).status, 'empty');
    assert.deepEqual(evaluateCourse({ credits: '3', marks: '77' }),
        { status: 'ok', credits: 3, gradePoint: 3.7, letter: 'B+' });
    assert.deepEqual(evaluateCourse({ credits: '3', grade: 'B' }),
        { status: 'ok', credits: 3, gradePoint: 3.0, letter: 'B' });
    assert.equal(evaluateCourse({ credits: '3' }).status, 'incomplete');
    assert.equal(evaluateCourse({ marks: '80' }).status, 'incomplete');
    assert.equal(evaluateCourse({ credits: '3', grade: 'W' }).status, 'excluded');
    assert.ok(evaluateCourse({ credits: '3', marks: '101' }).errors.marks);
    assert.ok(evaluateCourse({ credits: '0', marks: '80' }).errors.credits);
    assert.ok(evaluateCourse({ credits: '-2', marks: '-1' }).errors.credits);
});
