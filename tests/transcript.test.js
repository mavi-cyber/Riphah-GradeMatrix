import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTranscript, formatGpa, retakeChoices } from '../js/transcript.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

let nextId = 0;
function course(fields) {
    return { id: `c${++nextId}`, name: '', credits: '3', marks: '', grade: '', kind: 'credit', retakeOf: '', ...fields };
}
function semester(name, courses, extra = {}) {
    return { id: `s-${name}`, name, session: 'regular', courses, ...extra };
}
function totalsOnly(name, credits, sgpa) {
    return { id: `s-${name}`, name, session: 'regular', summary: { credits, sgpa } };
}

test('GPA is shown to two decimals, rounding half up', () => {
    assert.equal(formatGpa(107 / 40), '2.68');
    assert.equal(formatGpa(3.125), '3.13');
    assert.equal(formatGpa(3.124), '3.12');
    assert.equal(formatGpa(0), '0.00');
});

test('SGPA leaves out W and I, and counts F as zero', () => {
    const { rows, overall } = buildTranscript([semester('1', [
        course({ marks: '85' }),                 // 4.0
        course({ marks: '72' }),                 // 3.2
        course({ credits: '2', marks: '40' }),   // F
        course({ grade: 'W' }),
        course({ grade: 'I' }),
        course({ marks: '150' })                 // invalid, ignored
    ])]);
    assert.equal(rows[0].totals.attemptedCredits, 8);
    near(rows[0].totals.sgpa, 21.6 / 8);
    assert.equal(rows[0].totals.excluded, 2);
    assert.equal(rows[0].totals.invalid, 1);
    assert.equal(overall.earnedCredits, 6);
    near(overall.cgpa, 21.6 / 8);
});

test('a higher retake turns the old grade into R from the retake semester on', () => {
    const failed = course({ name: 'Calculus', marks: '45' });      // F
    const other = course({ marks: '80' });                         // 4.0
    const middle = course({ marks: '70' });                        // 3.0
    const retake = course({ name: 'Calculus', marks: '74', retakeOf: failed.id });  // 3.4
    const { rows, overall, replacedCount } = buildTranscript([
        semester('1', [failed, other]),
        semester('2', [middle]),
        semester('3', [retake])
    ]);

    // The old semester's SGPA and the CGPAs recorded before the retake do not change.
    near(rows[0].totals.sgpa, 2.0);
    near(rows[0].cgpaAfter, 2.0);
    near(rows[1].cgpaAfter, (12 + 0 + 9) / 9);
    // From the retake semester the F is out and the new grade is in.
    near(rows[2].cgpaAfter, (12 + 9 + 10.2) / 9);
    near(overall.cgpa, 31.2 / 9);
    assert.equal(overall.credits, 9);

    assert.equal(rows[0].entries[0].outcome, 'replaced');
    assert.equal(rows[2].entries[0].outcome, 'retake');
    assert.equal(replacedCount, 1);
});

test('a lower retake is recorded as W and the old grade stays', () => {
    const first = course({ marks: '52' });                              // D, 1.2
    const retake = course({ marks: '40', retakeOf: first.id });         // F
    const { rows, overall } = buildTranscript([semester('1', [first]), semester('2', [retake, course({ marks: '80' })])]);

    assert.equal(rows[0].entries[0].outcome, 'normal');
    assert.equal(rows[1].entries[0].outcome, 'lowered');
    near(rows[1].totals.sgpa, 4.0);
    assert.equal(rows[1].totals.attemptedCredits, 3);
    near(overall.cgpa, (3.6 + 12) / 6);
});

test('an equal retake replaces the old grade', () => {
    const first = course({ marks: '40' });
    const retake = course({ marks: '45', retakeOf: first.id });
    const { rows } = buildTranscript([semester('1', [first]), semester('2', [retake])]);
    assert.equal(rows[0].entries[0].outcome, 'replaced');
});

test('only D, F and W can be repeated', () => {
    const good = course({ marks: '70' });                               // B
    const attempt = course({ marks: '90', retakeOf: good.id });
    const { rows, overall } = buildTranscript([semester('1', [good]), semester('2', [attempt])]);
    assert.equal(rows[1].entries[0].note, 'not-repeatable');
    assert.equal(rows[0].entries[0].outcome, 'normal');
    assert.equal(overall.credits, 6);
});

test('a withdrawn course can be repeated and stays W', () => {
    const withdrawn = course({ grade: 'W' });
    const retake = course({ marks: '77', retakeOf: withdrawn.id });
    const { rows, overall } = buildTranscript([semester('1', [withdrawn]), semester('2', [retake])]);
    assert.equal(rows[0].entries[0].outcome, 'normal');
    assert.equal(rows[1].entries[0].outcome, 'retake');
    near(overall.cgpa, 3.7);
});

test('a third attempt is compared with the attempt that currently stands', () => {
    const first = course({ marks: '52' });                              // D 1.2
    const second = course({ marks: '40', retakeOf: first.id });         // lower: W
    const third = course({ marks: '80', retakeOf: second.id });         // beats the D
    const { rows, overall } = buildTranscript([semester('1', [first]), semester('2', [second]), semester('3', [third])]);
    assert.equal(rows[1].entries[0].outcome, 'lowered');
    assert.equal(rows[0].entries[0].outcome, 'replaced');
    assert.equal(rows[0].entries[0].replacedAt, 2);
    near(overall.cgpa, 4.0);
});

test('non-credit and transferred courses stay out of the GPA', () => {
    const { rows, overall } = buildTranscript([semester('1', [
        course({ marks: '80' }),
        course({ marks: '90', kind: 'non-credit' }),
        course({ credits: '3', grade: 'B', kind: 'transferred' })
    ])]);
    near(rows[0].totals.sgpa, 4.0);
    assert.equal(rows[0].totals.attemptedCredits, 3);
    assert.equal(overall.credits, 3);
    assert.equal(overall.earnedCredits, 6);
    assert.equal(rows[0].entries[2].result.letter, 'TR');
});

test('totals-only semesters are validated and blended in', () => {
    const { rows, overall } = buildTranscript([
        totalsOnly('1', '18', '3.5'),
        semester('2', [course({ credits: '6', marks: '70' })]),
        totalsOnly('3', '18', '4.5')
    ]);
    near(rows[0].cgpaAfter, 3.5);
    near(overall.cgpa, (63 + 18) / 24);
    assert.equal(rows[2].totals.invalid, 1);
    assert.ok(rows[2].totals.errors.sgpa);
    assert.equal(rows[2].hasData, false);
});

test('nothing entered is zero, not NaN', () => {
    assert.equal(buildTranscript([]).overall.cgpa, 0);
    assert.equal(buildTranscript([semester('1', [])]).rows[0].cgpaAfter, 0);
});

test('academic standing follows the deficiency rules', () => {
    const at = sgpa => totalsOnly(`x${++nextId}`, '15', String(sgpa));
    const codes = list => buildTranscript(list).rows.map(row => row.standing?.code);

    assert.deepEqual(codes([at(3.0)]), ['good']);
    assert.deepEqual(codes([at(0.9)]), ['dismissal']);
    assert.deepEqual(codes([at(1.2), at(1.9)]), ['serious', 'dismissal']);
    assert.deepEqual(codes([at(1.2), at(2.1)]), ['serious', 'probation']);
    assert.deepEqual(codes([at(1.8), at(1.8), at(1.8)]), ['probation', 'probation', 'relegated']);
    // Standing looks at the CGPA, so one weak semester on a healthy CGPA is still good standing,
    // and recovering resets the probation count.
    assert.deepEqual(codes([at(1.8), at(3.0), at(1.9)]), ['probation', 'good', 'good']);
    assert.deepEqual(codes([at(1.8), at(2.4), at(0.5)]), ['probation', 'good', 'probation']);
});

test('summer sessions are not assessed for standing or honours', () => {
    const summer = semester('S', [course({ marks: '95' })], { session: 'summer' });
    const { rows } = buildTranscript([totalsOnly('1', '15', '3.0'), summer]);
    assert.equal(rows[1].standing, null);
    assert.equal(rows[1].honour, null);
});

test('semester honours need a high SGPA and no repeated course', () => {
    const failed = course({ marks: '40' });
    const { rows } = buildTranscript([
        totalsOnly('1', '15', '3.7'),
        totalsOnly('2', '15', '3.5'),
        totalsOnly('3', '15', '3.49'),
        semester('4', [failed]),
        semester('5', [course({ marks: '95', retakeOf: failed.id })])
    ]);
    assert.equal(rows[0].honour.code, 'vc');
    assert.equal(rows[1].honour.code, 'dean');
    assert.equal(rows[2].honour, null);
    assert.equal(rows[4].honour, null);
});

test('semester load is checked against the credit hour limits', () => {
    const load = (credits, session) => buildTranscript([
        semester('1', [course({ credits: String(credits), marks: '80' })], { session })
    ]).rows[0].load?.level;
    assert.equal(load(6, 'regular'), 'under');
    assert.equal(load(18, 'regular'), undefined);
    assert.equal(load(19, 'regular'), 'over');
    assert.equal(load(8, 'summer'), undefined);
    assert.equal(load(9, 'summer'), 'over');
});

test('gold medal track lists what stands in the way', () => {
    assert.equal(buildTranscript([semester('1', [course({ marks: '90' })])]).medal.onTrack, true);
    const blocked = buildTranscript([semester('1', [course({ marks: '90' }), course({ marks: '58' }), course({ grade: 'W' })])]).medal;
    assert.equal(blocked.onTrack, false);
    assert.ok(blocked.blockers.includes('a grade below C'));
    assert.ok(blocked.blockers.includes('a W or I grade'));
});

test('retake choices offer only earlier D, F and W courses', () => {
    const failed = course({ name: 'Calc', marks: '40' });
    const passed = course({ name: 'OOP', marks: '80' });
    const withdrawn = course({ name: 'DLD', grade: 'W' });
    const transcript = buildTranscript([semester('1', [failed, passed, withdrawn]), semester('2', [course({ marks: '60' })])]);
    assert.deepEqual(retakeChoices(transcript, 1, '').map(c => c.name), ['Calc', 'DLD']);
    assert.deepEqual(retakeChoices(transcript, 0, ''), []);
});
