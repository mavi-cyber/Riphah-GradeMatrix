// The transcript engine: turns the list of semesters into SGPAs, the CGPA after
// each semester, retake outcomes, academic standing and honours.
// Pure functions only. Clause numbers refer to the RIU Academic Regulations for
// Undergraduate Programs, 5th Revision 2024 (student handbook pages 31-49).

import { evaluateCourse } from './grading.js';

// 10(j)(i): only these grades may be repeated.
const REPEATABLE_GRADES = ['D', 'F', 'W'];
// 10(k): academic deficiency.
const MIN_CGPA = 2.0;
const FIRST_SEMESTER_DISMISSAL_GPA = 1.0;
const FIRST_SEMESTER_WARNING_GPA = 1.5;
const LAST_CHANCE_GPA = 2.0;
const PROBATIONS_BEFORE_RELEGATION = 3;
// 10(n), 10(o): semester honours. 10(l), 10(m): gold medals.
const VC_LIST_SGPA = 3.7;
const DEANS_LIST_SGPA = 3.5;
const MEDAL_CGPA = 3.5;
const MEDAL_MIN_GRADE_POINT = 2.0; // grade C
// 8(b)(iv), 8(b)(v): credit hours per semester.
const REGULAR_MIN_CREDITS = 9;
const REGULAR_MAX_CREDITS = 18;
const REGULAR_MAX_WITH_APPROVAL = 21;
const SUMMER_MAX_CREDITS = 8;

const KIND_LETTERS = { 'non-credit': 'NC', transferred: 'TR' };

// 10(d): shown to the second decimal. The nudge keeps values such as 2.675,
// which binary floats store a hair low, from rounding down.
export function formatGpa(value) {
    return (Math.round((value + 1e-9) * 100) / 100).toFixed(2);
}

const roundedGpa = value => Number(formatGpa(value));

// --- Courses ---

// 4(o) and 8(f)(vii): non-credit and transferred courses appear on the
// transcript but are not used in SGPA or CGPA.
function evaluateEntry(course) {
    const letter = KIND_LETTERS[course.kind];
    if (!letter) return evaluateCourse(course);
    const blank = !course.name.trim() && !String(course.credits).trim() && !String(course.marks).trim() && !course.grade;
    return blank ? { status: 'empty' } : { status: 'excluded', letter };
}

function buildEntries(semesters) {
    const entries = [];
    semesters.forEach((semester, semIndex) => {
        for (const course of semester.courses ?? []) {
            entries.push({
                course, semIndex, semId: semester.id,
                result: evaluateEntry(course),
                // normal | retake | replaced | lowered
                outcome: 'normal',
                replacedAt: null, replacedBy: null, target: null, note: null
            });
        }
    });
    return entries;
}

// The attempt that currently stands for a course, following earlier retakes.
function standingAttempt(entry) {
    let current = entry;
    while (current) {
        if (current.outcome === 'replaced') current = current.replacedBy;
        else if (current.outcome === 'lowered') current = current.target;
        else return current;
    }
    return null;
}

function isRepeatable(entry) {
    return (entry.result.status === 'ok' || entry.result.status === 'excluded')
        && REPEATABLE_GRADES.includes(entry.result.letter);
}

// 10(j)(iv): a higher or equal retake turns the old grade into R, which leaves
// the CGPA from the retake's semester on. A lower retake is recorded as W and
// the old grade stays.
function resolveRetakes(entries) {
    const byId = new Map(entries.map(entry => [entry.course.id, entry]));

    for (const entry of entries) {
        const linked = byId.get(entry.course.retakeOf);
        if (!linked || linked.semIndex >= entry.semIndex) continue;

        const standing = standingAttempt(linked);
        if (!standing || standing === entry) continue;
        entry.target = standing;

        if (!isRepeatable(standing)) {
            entry.note = 'not-repeatable';
            continue;
        }
        entry.outcome = 'retake';
        if (entry.result.status !== 'ok' || standing.result.status !== 'ok') continue;

        if (entry.result.gradePoint >= standing.result.gradePoint) {
            standing.outcome = 'replaced';
            standing.replacedAt = entry.semIndex;
            standing.replacedBy = entry;
        } else {
            entry.outcome = 'lowered';
        }
    }
}

// A graded attempt that counts in its own semester's SGPA.
const countsInSemester = entry => entry.result.status === 'ok' && entry.outcome !== 'lowered';

// Whether it still counts in the CGPA as it stood at the end of semester `upTo`.
const countsInCgpa = (entry, upTo) =>
    countsInSemester(entry) && entry.semIndex <= upTo && !(entry.replacedAt !== null && entry.replacedAt <= upTo);

// --- Semesters ---

function emptyTotals() {
    return {
        sgpa: 0, attemptedCredits: 0, qualityPoints: 0, registeredCredits: 0,
        counted: 0, excluded: 0, incomplete: 0, invalid: 0, retakes: 0
    };
}

function courseTotals(entries) {
    const totals = emptyTotals();
    for (const entry of entries) {
        const { result } = entry;
        const credits = Number(entry.course.credits);
        if (result.status !== 'empty' && credits > 0 && !KIND_LETTERS[entry.course.kind]) totals.registeredCredits += credits;
        if (entry.target) totals.retakes++;

        if (countsInSemester(entry)) {
            totals.attemptedCredits += result.credits;
            totals.qualityPoints += result.credits * result.gradePoint;
            totals.counted++;
        } else if (result.status === 'ok') {
            totals.excluded++;
        } else if (result.status !== 'empty') {
            totals[result.status]++;
        }
    }
    if (totals.attemptedCredits > 0) totals.sgpa = totals.qualityPoints / totals.attemptedCredits;
    return totals;
}

// A semester entered by totals only (credit hours and SGPA).
function summaryTotals(summary) {
    const totals = emptyTotals();
    const creditsText = String(summary.credits ?? '').trim();
    const sgpaText = String(summary.sgpa ?? '').trim();
    if (creditsText === '' && sgpaText === '') return totals;

    const credits = Number(creditsText);
    const sgpa = Number(sgpaText);
    totals.errors = {};
    if (creditsText !== '' && !(Number.isFinite(credits) && credits > 0)) {
        totals.errors.credits = 'total credits must be greater than 0';
    }
    if (sgpaText !== '' && !(Number.isFinite(sgpa) && sgpa >= 0 && sgpa <= 4)) {
        totals.errors.sgpa = 'SGPA must be between 0 and 4.00';
    }
    if (Object.keys(totals.errors).length > 0) return { ...totals, invalid: 1 };
    if (creditsText === '' || sgpaText === '') return { ...totals, incomplete: 1 };

    return { ...totals, sgpa, attemptedCredits: credits, qualityPoints: credits * sgpa, registeredCredits: credits };
}

// 8(b)(iv), 8(b)(v): a regular semester is 9 to 18 credit hours (21 with
// approval), a summer session at most 8.
function loadNote(row) {
    const credits = row.totals.registeredCredits;
    if (credits === 0) return null;
    if (row.session === 'summer') {
        return credits > SUMMER_MAX_CREDITS ? { level: 'over', text: `A summer session is limited to ${SUMMER_MAX_CREDITS} credit hours.` } : null;
    }
    if (credits > REGULAR_MAX_WITH_APPROVAL) return { level: 'over', text: `Above the ${REGULAR_MAX_WITH_APPROVAL} credit hour maximum for a semester.` };
    if (credits > REGULAR_MAX_CREDITS) return { level: 'over', text: `Above ${REGULAR_MAX_CREDITS} credit hours, which needs the Vice Chancellor's approval.` };
    if (credits < REGULAR_MIN_CREDITS) return { level: 'under', text: `A regular semester is at least ${REGULAR_MIN_CREDITS} credit hours.` };
    return null;
}

// --- Standing and honours ---

// 10(k): worked out after each regular semester that has grades.
function assessStanding(rows) {
    let probations = 0;
    let firstDone = false;
    let lastChance = false;

    for (const row of rows) {
        row.standing = null;
        if (!row.hasData || row.session === 'summer') continue;

        const sgpa = roundedGpa(row.totals.sgpa);
        const cgpa = roundedGpa(row.cgpaAfter);
        const isFirst = !firstDone;
        const wasLastChance = lastChance;
        firstDone = true;
        lastChance = false;

        if (isFirst && sgpa < FIRST_SEMESTER_DISMISSAL_GPA) {
            row.standing = { code: 'dismissal', label: 'Dismissal rule', detail: `A first-semester GPA below ${FIRST_SEMESTER_DISMISSAL_GPA.toFixed(1)} means dismissal from the program.` };
            continue;
        }
        if (wasLastChance && sgpa < LAST_CHANCE_GPA) {
            row.standing = { code: 'dismissal', label: 'Dismissal rule', detail: `After a serious warning, a semester GPA below ${LAST_CHANCE_GPA.toFixed(1)} means dismissal from the program.` };
            continue;
        }

        if (cgpa >= MIN_CGPA) {
            probations = 0;
            row.standing = { code: 'good', label: 'Good standing', detail: `CGPA is at or above the required ${MIN_CGPA.toFixed(1)}.` };
            continue;
        }

        probations++;
        if (isFirst && sgpa < FIRST_SEMESTER_WARNING_GPA) {
            lastChance = true;
            row.standing = { code: 'serious', label: 'Serious warning', detail: `A first-semester GPA below ${FIRST_SEMESTER_WARNING_GPA.toFixed(1)} is a last chance: the next semester GPA must reach ${LAST_CHANCE_GPA.toFixed(1)}.` };
        } else if (probations >= PROBATIONS_BEFORE_RELEGATION) {
            row.standing = { code: 'relegated', label: 'Relegation', detail: `${PROBATIONS_BEFORE_RELEGATION} probations in a row: only repeatable courses can be registered until the CGPA is back to ${MIN_CGPA.toFixed(1)}.` };
        } else {
            row.standing = { code: 'probation', label: `Probation ${probations} of ${PROBATIONS_BEFORE_RELEGATION}`, detail: `CGPA is below ${MIN_CGPA.toFixed(1)}. Registering next semester needs the Dean's approval.` };
        }
    }
}

// 10(n), 10(o): a regular semester with a high SGPA and no repeated course.
function honourFor(row) {
    if (!row.hasData || row.session === 'summer' || row.totals.retakes > 0) return null;
    const sgpa = roundedGpa(row.totals.sgpa);
    if (sgpa >= VC_LIST_SGPA) return { code: 'vc', label: "Vice Chancellor's List" };
    if (sgpa >= DEANS_LIST_SGPA) return { code: 'dean', label: "Dean's List" };
    return null;
}

// 10(l), 10(m): the academic conditions for a gold medal that can be checked here.
function medalTrack(rows, entries, cgpa) {
    const blockers = [];
    if (roundedGpa(cgpa) < MEDAL_CGPA) blockers.push(`CGPA is below ${MEDAL_CGPA.toFixed(1)}`);
    if (entries.some(e => e.result.status === 'ok' && e.result.gradePoint < MEDAL_MIN_GRADE_POINT)) blockers.push('a grade below C');
    if (entries.some(e => e.target)) blockers.push('a repeated course');
    if (entries.some(e => e.result.status === 'excluded' && ['W', 'I'].includes(e.result.letter))) blockers.push('a W or I grade');
    return { onTrack: blockers.length === 0, blockers, unchecked: rows.some(row => row.isSummary && row.hasData) };
}

// --- The whole transcript ---

export function buildTranscript(semesters) {
    const entries = buildEntries(semesters);
    resolveRetakes(entries);

    const rows = semesters.map((semester, semIndex) => {
        const own = entries.filter(entry => entry.semIndex === semIndex);
        const totals = semester.summary ? summaryTotals(semester.summary) : courseTotals(own);
        return {
            id: semester.id,
            name: semester.name,
            session: semester.session === 'summer' ? 'summer' : 'regular',
            isSummary: Boolean(semester.summary),
            entries: own,
            totals,
            hasData: totals.attemptedCredits > 0
        };
    });

    // CGPA as it stood at the end of each semester. A replaced grade keeps
    // counting until the semester of its retake, so earlier figures never change.
    const cumulativeAt = upTo => {
        let credits = 0, qualityPoints = 0, earnedCredits = 0;
        for (let i = 0; i <= upTo; i++) {
            if (!rows[i].isSummary) continue;
            credits += rows[i].totals.attemptedCredits;
            qualityPoints += rows[i].totals.qualityPoints;
            earnedCredits += rows[i].totals.attemptedCredits;
        }
        for (const entry of entries) {
            if (entry.semIndex <= upTo && entry.course.kind === 'transferred' && entry.result.status === 'excluded') {
                earnedCredits += Math.max(0, Number(entry.course.credits) || 0);
            }
            if (!countsInCgpa(entry, upTo)) continue;
            credits += entry.result.credits;
            qualityPoints += entry.result.credits * entry.result.gradePoint;
            if (entry.result.gradePoint > 0) earnedCredits += entry.result.credits;
        }
        return { credits, qualityPoints, earnedCredits, cgpa: credits > 0 ? qualityPoints / credits : 0 };
    };

    rows.forEach((row, index) => {
        row.cgpaAfter = cumulativeAt(index).cgpa;
        row.load = loadNote(row);
        row.honour = honourFor(row);
    });
    assessStanding(rows);

    const overall = rows.length > 0 ? cumulativeAt(rows.length - 1) : { credits: 0, qualityPoints: 0, earnedCredits: 0, cgpa: 0 };
    const graded = rows.filter(row => row.hasData);

    const gradeCounts = {};
    for (const entry of entries) {
        if (countsInCgpa(entry, rows.length - 1)) gradeCounts[entry.result.letter] = (gradeCounts[entry.result.letter] ?? 0) + 1;
    }

    return {
        rows,
        graded,
        gradeCounts,
        overall,
        latestSgpa: graded.length > 0 ? graded[graded.length - 1].totals.sgpa : 0,
        standing: [...rows].reverse().find(row => row.standing)?.standing ?? null,
        replacedCount: entries.filter(entry => entry.outcome === 'replaced').length,
        medal: medalTrack(rows, entries, overall.cgpa)
    };
}

// Earlier courses that the course at `semIndex` could be a retake of.
export function retakeChoices(transcript, semIndex, currentTargetId) {
    const choices = [];
    transcript.rows.slice(0, semIndex).forEach(row => {
        for (const entry of row.entries) {
            if (canBeRetaken(entry) || entry.course.id === currentTargetId) choices.push({ id: entry.course.id, name: entry.course.name, semester: row.name, letter: entry.result.letter });
        }
    });
    return choices;
}

export function canBeRetaken(entry) {
    return entry.outcome !== 'replaced' && entry.outcome !== 'lowered' && isRepeatable(entry);
}
