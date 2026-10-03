// Policy page: draws the grading scale as matrix cells and runs the "try it" slider.
// Everything is read from grading.js, so this page can never drift from the calculator.

import { GRADE_BANDS, GRADE_OPTIONS, isSpecialGrade, roundMarks, letterFromMarks, gradePointFromMarks } from './grading.js';
import { buildTranscript } from './transcript.js';
import { strength, inkClass } from './cell-colour.js';
import { $, el } from './dom.js';

const MAX_MARKS = 100;
const SPECIAL_MEANING = { I: 'Incomplete', W: 'Withdrawal', R: 'Replaced by a retake' };

const tenth = value => value.toFixed(1);

// The marks a band covers, and the grade points at its bottom and top.
function bandRange(band, index) {
    const topMarks = index === 0 ? MAX_MARKS : GRADE_BANDS[index - 1].min - 1;
    return {
        marks: band.letter === 'F' ? `Below ${GRADE_BANDS[index - 1].min}` : index === 0 ? `${band.min} and above` : `${band.min} to ${topMarks}`,
        low: gradePointFromMarks(band.min),
        high: gradePointFromMarks(topMarks)
    };
}

function scaleCell(band, index) {
    const range = bandRange(band, index);
    const failed = band.letter === 'F';
    const cell = el('div', { className: `cell cell-static ${failed ? 'cell-fail' : inkClass(range.low)}` }, [
        el('span', { className: 'cell-letter', textContent: band.letter }),
        el('span', { className: 'cell-name', textContent: range.marks }),
        el('span', { className: 'cell-note', textContent: range.low === range.high ? `${tenth(range.low)} points` : `${tenth(range.low)} to ${tenth(range.high)} points` })
    ]);
    if (!failed) cell.style.setProperty('--p', `${strength(range.low)}%`);
    cell.dataset.letter = band.letter;
    return cell;
}

function specialCell({ letter }) {
    return el('div', { className: 'cell cell-static cell-off' }, [
        el('span', { className: 'cell-letter', textContent: letter }),
        el('span', { className: 'cell-name', textContent: SPECIAL_MEANING[letter] }),
        el('span', { className: 'cell-note', textContent: 'no points, not counted' })
    ]);
}

// Explains in words how the grade point for these marks is reached.
function explain(marks) {
    const rounded = roundMarks(marks);
    const letter = letterFromMarks(marks);
    const points = gradePointFromMarks(marks);
    const band = GRADE_BANDS.find(b => b.letter === letter);
    const base = gradePointFromMarks(band.min);
    const above = rounded - band.min;
    const roundedNote = rounded === marks ? '' : `${marks} rounds to ${rounded}. `;

    if (letter === 'F') return `${roundedNote}Anything below ${GRADE_BANDS[GRADE_BANDS.length - 2].min} is an F and earns no grade points.`;
    if (points === base && above > 0) return `${roundedNote}${letter} is capped at ${tenth(base)}, so every mark in this band earns the same.`;
    if (above === 0) return `${roundedNote}${rounded} is the lowest mark for ${letter}, which earns ${tenth(base)}.`;
    return `${roundedNote}${rounded} is ${above} above the ${letter} minimum of ${band.min}, so ${tenth(base)} + ${tenth(above / 10)} = ${tenth(points)}.`;
}

function updateTry() {
    const marks = Number($('tryMarks').value);
    const letter = letterFromMarks(marks);
    const points = gradePointFromMarks(marks);

    $('tryNumber').textContent = marks;
    $('tryLetter').textContent = letter;
    $('tryPoints').textContent = `${tenth(points)} grade points`;
    $('tryExplain').textContent = explain(marks);

    const result = $('tryResult');
    result.className = `cell cell-static try-result ${letter === 'F' ? 'cell-fail' : inkClass(points)}`;
    result.style.setProperty('--p', `${strength(points)}%`);

    for (const cell of $('scaleGrid').children) cell.classList.toggle('selected', cell.dataset.letter === letter);
}

$('scaleGrid').replaceChildren(
    ...GRADE_BANDS.map(scaleCell),
    ...GRADE_OPTIONS.filter(option => isSpecialGrade(option.letter)).map(specialCell)
);
$('tryMarks').addEventListener('input', updateTry);
updateTry();

// --- Retake demo: the real engine deciding between R and W ---

const RETAKE_FIRST_TRIES = [
    { value: 'F', label: 'F (45 marks)', course: { marks: '45', grade: 'F' } },
    { value: 'D', label: 'D (52 marks)', course: { marks: '52', grade: 'D' } },
    { value: 'W', label: 'W (withdrew)', course: { marks: '', grade: 'W' } }
];
let retakeFirstTry = 'F';

function fillCell(cell, letter, name, note, gradePoint) {
    const counted = gradePoint !== null;
    cell.className = `cell cell-static ${!counted ? 'cell-off' : gradePoint === 0 ? 'cell-fail' : inkClass(gradePoint)}`;
    cell.style.setProperty('--p', counted && gradePoint > 0 ? `${strength(gradePoint)}%` : '0%');
    cell.children[0].textContent = letter;
    cell.children[1].textContent = name;
    cell.children[2].textContent = note;
}

function updateRetake() {
    const marks = $('retakeMarks').value;
    const first = RETAKE_FIRST_TRIES.find(option => option.value === retakeFirstTry);
    const base = { name: 'Calculus', credits: '3', kind: 'credit' };
    const { rows } = buildTranscript([
        { id: 'old', name: 'Earlier', courses: [{ ...base, id: 'first', retakeOf: '', ...first.course }] },
        { id: 'new', name: 'Retake', courses: [{ ...base, id: 'again', retakeOf: 'first', marks, grade: letterFromMarks(Number(marks)) }] }
    ]);
    const [oldEntry] = rows[0].entries, [newEntry] = rows[1].entries;
    const oldLetter = oldEntry.result.letter, newLetter = newEntry.result.letter;

    $('retakeNumber').textContent = marks;
    for (const chip of $('retakeOld').children) chip.setAttribute('aria-pressed', String(chip.dataset.value === retakeFirstTry));

    if (oldEntry.outcome === 'replaced') {
        fillCell($('retakeOldCell'), 'R', 'Calculus', `was ${oldLetter}, out of CGPA`, null);
        fillCell($('retakeNewCell'), newLetter, 'Calculus', `${tenth(newEntry.result.gradePoint)} points, counts`, newEntry.result.gradePoint);
        $('retakeExplain').textContent = `${newLetter} is not lower than ${oldLetter}, so the old ${oldLetter} becomes R and the ${newLetter} counts in the CGPA.`;
    } else if (newEntry.outcome === 'lowered') {
        fillCell($('retakeOldCell'), oldLetter, 'Calculus', `${tenth(oldEntry.result.gradePoint)} points, stays`, oldEntry.result.gradePoint);
        fillCell($('retakeNewCell'), 'W', 'Calculus', `scored ${newLetter}, not counted`, null);
        $('retakeExplain').textContent = `${newLetter} is lower than the earlier ${oldLetter}, so the ${oldLetter} stays and the retake is recorded as W.`;
    } else {
        fillCell($('retakeOldCell'), 'W', 'Calculus', 'withdrawn, never counted', null);
        fillCell($('retakeNewCell'), newLetter, 'Calculus', `${tenth(newEntry.result.gradePoint)} points, counts`, newEntry.result.gradePoint);
        $('retakeExplain').textContent = `A withdrawn course was never counted, so it stays W and the retake's ${newLetter} simply counts.`;
    }
}

$('retakeOld').replaceChildren(...RETAKE_FIRST_TRIES.map(option => {
    const chip = el('button', { className: 'chip', textContent: option.label });
    chip.dataset.value = option.value;
    chip.addEventListener('click', () => {
        retakeFirstTry = option.value;
        updateRetake();
    });
    return chip;
}));
$('retakeMarks').addEventListener('input', updateRetake);
updateRetake();
