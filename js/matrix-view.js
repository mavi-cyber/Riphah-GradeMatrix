// The Matrix: the whole degree as one grid. Semesters are columns, courses are
// cells. A cell's height follows its credit hours and its colour follows its
// grade points. Retakes are joined to the course they repeat by a thread, and
// the handbook's R and W outcomes are applied by the transcript engine.

import { GRADE_OPTIONS, letterFromMarks, minMarksForLetter, isSpecialGrade } from './grading.js';
import { formatGpa, retakeChoices, canBeRetaken } from './transcript.js';
import { blankCourse, newCourseSemester, newSummarySemester } from './storage.js';
import { strength, inkClass } from './cell-colour.js';
import { $, el, svg } from './dom.js';
import { showToast } from './toast.js';

const CREDIT_CHOICES = ['1', '2', '3', '4', '5', '6'];
const DEFAULT_PAINT_CREDITS = '3';
// R is never picked by hand: it is what an old grade becomes once a retake beats it.
const PICKABLE_GRADES = GRADE_OPTIONS.map(g => g.letter).filter(letter => letter !== 'R');
const KINDS = [
    { value: 'credit', label: 'Credit course' },
    { value: 'non-credit', label: 'Non-credit' },
    { value: 'transferred', label: 'Transferred' }
];
const SESSIONS = [
    { value: 'regular', label: 'Regular semester' },
    { value: 'summer', label: 'Summer session' }
];

// What the editor is open on: { semId, courseId } for a course, { semId } for a semester.
let selection = null;
// Refreshes the open editor's calculated parts; set while an editor is open.
let refreshEditor = null;
// The grade letter loaded on the brush, or null when not painting.
let brush = null;

const semesterById = (ctx, id) => ctx.state.semesters.find(sem => sem.id === id);
const rowById = (ctx, id) => ctx.transcript.rows.find(row => row.id === id);
const isBlank = course => !course.name.trim() && !course.credits && !course.marks && !course.grade && !course.retakeOf;
const sentence = text => text[0].toUpperCase() + text.slice(1) + '.';

function entryFor(ctx, semId, courseId) {
    return rowById(ctx, semId)?.entries.find(entry => entry.course.id === courseId);
}

// --- Cells ---

// Taller cells for heavier courses, so visual weight matches weight in the GPA.
function cellHeight(creditsText) {
    const credits = Number(creditsText);
    return credits > 0 ? 46 + Math.min(credits, 6) * 15 : 76;
}

// What a cell shows: the big letter, the small note under the name, and its style.
function describe(entry, rows) {
    const { result, course } = entry;

    if (entry.outcome === 'replaced') {
        return { big: 'R', note: `was ${result.letter} · out of CGPA from ${rows[entry.replacedAt].name.trim() || 'the retake'}`, classes: ['cell-off', 'cell-replaced'] };
    }
    if (entry.outcome === 'lowered') {
        return { big: 'W', note: `scored ${result.letter}, lower than before`, classes: ['cell-off'] };
    }
    if (result.status === 'ok') {
        const tag = entry.note === 'not-repeatable' ? ' · not a valid retake' : entry.outcome === 'retake' ? ' · retake' : '';
        return {
            big: result.letter,
            note: `${result.gradePoint.toFixed(1)} pts${tag}`,
            classes: [result.gradePoint === 0 ? 'cell-fail' : inkClass(result.gradePoint)],
            strength: result.gradePoint === 0 ? null : strength(result.gradePoint)
        };
    }
    if (result.status === 'excluded') {
        const note = course.kind === 'non-credit' ? 'non-credit' : course.kind === 'transferred' ? 'transferred' : 'not counted';
        return { big: result.letter, note, classes: ['cell-off'] };
    }
    if (result.status === 'invalid') return { big: '!', note: 'check values', classes: ['cell-bad'] };
    return {
        big: '?',
        note: result.status === 'incomplete' ? `needs ${result.missing}` : entry.outcome === 'retake' ? 'retake · no grade yet' : 'tap to fill',
        classes: ['cell-empty']
    };
}

function courseCell(entry, rows) {
    const { course } = entry;
    const view = describe(entry, rows);
    const name = course.name.trim() || 'Untitled';
    const selected = selection?.courseId === course.id;

    const cell = el('button', {
        className: ['cell', ...view.classes, selected ? 'selected' : ''].join(' ').trim(),
        ariaLabel: `${name}, ${course.credits || 'no'} credit hours, ${view.big === '?' ? 'no grade yet' : `grade ${view.big}`}, ${view.note}`
    }, [
        el('span', { className: 'cell-top' }, [
            el('span', { className: 'cell-letter', textContent: view.big }),
            el('span', { className: 'cell-credits', textContent: course.credits ? `${course.credits} cr` : '' })
        ]),
        el('span', { className: 'cell-name', textContent: name }),
        el('span', { className: 'cell-note', textContent: view.note })
    ]);

    cell.dataset.course = course.id;
    cell.style.minHeight = `${cellHeight(course.credits)}px`;
    if (view.strength) cell.style.setProperty('--p', `${view.strength}%`);
    return cell;
}

// A semester entered by totals only is one solid block.
function summaryCell(row, isSelected) {
    const { totals } = row;
    const ok = row.hasData;
    const cell = el('button', {
        className: `cell cell-block ${ok ? inkClass(totals.sgpa) : totals.invalid ? 'cell-bad' : 'cell-empty'}${isSelected ? ' selected' : ''}`,
        ariaLabel: ok ? `Totals only: ${totals.attemptedCredits} credit hours at SGPA ${formatGpa(totals.sgpa)}` : 'Totals not entered yet'
    }, [
        el('span', { className: 'cell-letter', textContent: ok ? formatGpa(totals.sgpa) : totals.invalid ? '!' : '?' }),
        el('span', { className: 'cell-name', textContent: ok ? `${totals.attemptedCredits} credit hours` : 'tap to enter totals' }),
        el('span', { className: 'cell-note', textContent: 'totals only' })
    ]);
    cell.style.minHeight = `${ok ? Math.min(90 + totals.attemptedCredits * 7, 300) : 110}px`;
    if (ok) cell.style.setProperty('--p', `${strength(totals.sgpa)}%`);
    return cell;
}

function badge(className, text, title) {
    return el('span', { className: `badge-chip ${className}`, textContent: text, title });
}

function column(row, rows) {
    const semSelected = selection?.semId === row.id && !selection.courseId;
    const badges = [];
    if (row.session === 'summer') badges.push(badge('badge-plain', 'Summer', 'Summer session'));
    if (row.honour) badges.push(badge('badge-honour', row.honour.label, `SGPA of ${formatGpa(row.totals.sgpa)} with no repeated course`));
    if (row.standing && row.standing.code !== 'good') badges.push(badge('badge-alert', row.standing.label, row.standing.detail));
    if (row.load?.level === 'over') badges.push(badge('badge-alert', 'Over load', row.load.text));

    const head = el('button', { className: semSelected ? 'col-head selected' : 'col-head', title: 'Rename, change or delete this semester' }, [
        el('span', { className: 'col-name', textContent: row.name.trim() || 'Untitled' }),
        el('span', { className: 'col-sgpa', textContent: row.hasData ? formatGpa(row.totals.sgpa) : '-' }),
        el('span', { className: 'col-meta', textContent: row.hasData ? `${row.totals.attemptedCredits} cr · CGPA ${formatGpa(row.cgpaAfter)}` : 'no grades yet' }),
        ...(badges.length > 0 ? [el('span', { className: 'col-badges' }, badges)] : [])
    ]);

    const cells = row.isSummary
        ? [summaryCell(row, semSelected)]
        : [
            ...row.entries.map(entry => courseCell(entry, rows)),
            el('button', { className: 'add-cell', textContent: '+', title: 'Add a course', ariaLabel: `Add a course to ${row.name || 'this semester'}` })
        ];

    const col = el('section', { className: 'col' }, [head, ...cells]);
    col.dataset.id = row.id;
    return col;
}

// --- Threads: a line from each retake back to the course it repeats ---

function drawThreads(ctx) {
    const matrix = $('matrix');
    const box = matrix.getBoundingClientRect();
    const layer = svg('svg', { class: 'threads', width: matrix.scrollWidth, height: matrix.scrollHeight, 'aria-hidden': 'true' });

    for (const row of ctx.transcript.rows) {
        for (const entry of row.entries) {
            if (!entry.target) continue;
            const from = matrix.querySelector(`[data-course="${entry.target.course.id}"]`);
            const to = matrix.querySelector(`[data-course="${entry.course.id}"]`);
            if (!from || !to) continue;

            const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
            const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top;
            const x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top;
            const bend = Math.max(24, (x2 - x1) / 2);
            const active = selection && (selection.courseId === entry.course.id || selection.courseId === entry.target.course.id);
            layer.append(
                svg('path', { class: active ? 'thread active' : 'thread', d: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}` }),
                svg('circle', { class: active ? 'thread-end active' : 'thread-end', cx: x2, cy: y2, r: 4 })
            );
        }
    }
    matrix.append(layer);
}

export function renderMatrix(ctx) {
    const { rows } = ctx.transcript;
    const adder = el('div', { className: 'col col-new' }, [
        el('button', { className: 'btn', id: 'addSemesterBtn', textContent: '+ Semester' }),
        el('button', { className: 'btn btn-ghost btn-small', id: 'addSummaryBtn', textContent: '+ By SGPA only', title: 'For a past semester where you only know the totals' })
    ]);
    $('matrix').replaceChildren(...rows.map(row => column(row, rows)), adder);
    drawThreads(ctx);
    refreshEditor?.();
}

// --- Editor ---

function chips(items, onPick) {
    const row = el('div', { className: 'chips' }, items.map(item => {
        const value = item.value ?? item, label = item.label ?? item;
        const chip = el('button', { className: 'chip', textContent: label });
        chip.dataset.value = value;
        chip.addEventListener('click', () => onPick(value));
        return chip;
    }));
    row.setActive = value => {
        for (const chip of row.children) chip.setAttribute('aria-pressed', String(chip.dataset.value === value));
    };
    return row;
}

function editorRow(label, ...controls) {
    return el('div', { className: 'editor-row' }, [el('span', { className: 'editor-label', textContent: label }), ...controls]);
}

function closeEditorPanel() {
    refreshEditor = null;
    $('editor').hidden = true;
    document.body.classList.remove('editing');
}

function showEditor(ctx, children, refresh) {
    $('editor').replaceChildren(...children);
    $('editor').hidden = false;
    document.body.classList.add('editing');
    refreshEditor = refresh;
    // Redraw so the selected cell is outlined (this also runs refresh).
    renderMatrix(ctx);
    // The editor covers the lower part of the screen, so bring the selection up above it.
    $('matrix').querySelector('.selected')?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
}

function closeEditor(ctx) {
    if (!selection) return;
    // A cell that was opened and left completely blank is not kept.
    if (selection.courseId) {
        const semester = semesterById(ctx, selection.semId);
        const index = semester?.courses.findIndex(course => course.id === selection.courseId) ?? -1;
        if (index >= 0 && isBlank(semester.courses[index])) semester.courses.splice(index, 1);
    }
    selection = null;
    closeEditorPanel();
    ctx.commit();
}

function editorHead(ctx, titleInput) {
    return el('div', { className: 'editor-head' }, [
        titleInput,
        el('button', { className: 'btn btn-small', textContent: 'Done', onclick: () => closeEditor(ctx) })
    ]);
}

// One sentence on what the handbook does with this course.
function outcomeText(ctx, entry) {
    const { result, course } = entry;
    const rows = ctx.transcript.rows;

    if (entry.outcome === 'replaced') {
        return `Replaced: a retake in ${rows[entry.replacedAt].name.trim() || 'a later semester'} scored the same or higher, so this ${result.letter} becomes R. It still counts in this semester's SGPA, and leaves your CGPA from the retake on.`;
    }
    if (entry.outcome === 'lowered') {
        return `This retake scored ${result.letter}, lower than the earlier ${entry.target.result.letter}. By rule it is recorded as W and the earlier grade stays.`;
    }
    if (entry.note === 'not-repeatable') {
        return `Only a D, F or W can be repeated, and the linked course has ${entry.target.result.letter ?? 'no grade yet'}. Both are being counted as separate courses.`;
    }
    if (result.status === 'ok') {
        const base = `${result.letter} · ${result.gradePoint.toFixed(1)} grade points · ${(result.credits * result.gradePoint).toFixed(2)} quality points.`;
        if (entry.outcome !== 'retake') return base;
        return entry.target.outcome === 'replaced'
            ? `${base} This retake replaces the earlier ${entry.target.result.letter}, which becomes R.`
            : `${base} Retake of a withdrawn course.`;
    }
    if (result.status === 'excluded') {
        if (course.kind === 'non-credit') return 'Non-credit: shown on the transcript, not used in SGPA or CGPA.';
        if (course.kind === 'transferred') return 'Transferred: its credit hours count towards the degree, its grade is not used in SGPA or CGPA.';
        return `${result.letter} carries no grade points and is not used in SGPA or CGPA.`;
    }
    if (result.status === 'invalid') return Object.values(result.errors).map(sentence).join(' ');
    if (result.status === 'incomplete') return `Still needs ${result.missing}.`;
    return 'Pick the credit hours, then slide the marks or tap a grade.';
}

function openCourseEditor(ctx, semester, course) {
    if (selection?.courseId === course.id) return;
    closeEditor(ctx);
    if (!semester.courses.includes(course)) return;
    selection = { semId: semester.id, courseId: course.id };
    const semIndex = ctx.state.semesters.indexOf(semester);
    const changed = () => ctx.commit();

    const name = el('input', { type: 'text', className: 'editor-title', placeholder: 'Course name', value: course.name, ariaLabel: 'Course name' });
    name.addEventListener('input', () => { course.name = name.value; changed(); });

    const creditsInput = el('input', { type: 'number', className: 'editor-number', min: 1, max: 6, placeholder: 'cr', value: course.credits, ariaLabel: 'Credit hours' });
    creditsInput.addEventListener('input', () => { course.credits = creditsInput.value; changed(); });
    const creditChips = chips(CREDIT_CHOICES, value => {
        course.credits = creditsInput.value = value;
        changed();
    });

    const setMarks = value => {
        course.marks = value;
        const marks = Number(value);
        const valid = value.trim() !== '' && marks >= 0 && marks <= 100;
        course.grade = valid ? letterFromMarks(marks) : '';
        changed();
    };
    const range = el('input', { type: 'range', className: 'editor-range', min: 0, max: 100, step: 1, ariaLabel: 'Marks slider' });
    const marksInput = el('input', { type: 'number', className: 'editor-number', min: 0, max: 100, placeholder: '0-100', value: course.marks, ariaLabel: 'Marks' });
    range.addEventListener('input', () => { marksInput.value = range.value; setMarks(range.value); });
    marksInput.addEventListener('input', () => setMarks(marksInput.value));

    const gradeChips = chips(PICKABLE_GRADES, letter => {
        course.grade = letter;
        course.marks = marksInput.value = String(minMarksForLetter(letter) ?? '');
        changed();
    });

    const kindChips = chips(KINDS, value => { course.kind = value; changed(); });

    // "Retake of": only offered when an earlier semester holds a D, F or W.
    const retakeSelect = el('select', { className: 'editor-select', ariaLabel: 'Retake of' });
    retakeSelect.addEventListener('change', () => {
        course.retakeOf = retakeSelect.value;
        const original = ctx.state.semesters.flatMap(sem => sem.courses ?? []).find(c => c.id === course.retakeOf);
        if (original) {
            if (!course.name.trim()) course.name = name.value = original.name;
            if (!course.credits) course.credits = creditsInput.value = original.credits;
        }
        changed();
    });
    const retakeRow = editorRow('Retake of', retakeSelect);

    const retakeLater = el('button', { className: 'btn btn-ghost btn-small', textContent: 'Retake this course' });
    retakeLater.addEventListener('click', () => addRetake(ctx, semester, course));

    const remove = el('button', { className: 'btn btn-danger btn-small', textContent: 'Delete course' });
    remove.addEventListener('click', () => {
        const index = semester.courses.indexOf(course);
        semester.courses.splice(index, 1);
        selection = null;
        closeEditorPanel();
        ctx.commit();
        if (isBlank(course)) return;
        showToast(`"${course.name.trim() || 'Untitled'}" deleted.`, {
            actionLabel: 'Undo',
            onAction: () => {
                semester.courses.splice(Math.min(index, semester.courses.length), 0, course);
                ctx.commit();
            }
        });
    });

    const result = el('p', { className: 'editor-result' });

    showEditor(ctx, [
        editorHead(ctx, name),
        editorRow('Credits', creditChips, creditsInput),
        editorRow('Marks', range, marksInput),
        editorRow('Grade', gradeChips),
        // The less common settings stay folded away so the editor leaves room for the grid,
        // and open by themselves when this course already uses one of them.
        el('details', { className: 'editor-more', open: course.kind !== 'credit' || Boolean(course.retakeOf) }, [
            el('summary', { textContent: 'More: course type and retake' }),
            editorRow('Type', kindChips),
            retakeRow
        ]),
        el('div', { className: 'editor-foot' }, [retakeLater, remove]),
        result
    ], () => {
        const entry = entryFor(ctx, semester.id, course.id);
        if (!entry) return;

        creditChips.setActive(course.credits);
        gradeChips.setActive(entry.result.status === 'ok' ? entry.result.letter : course.grade);
        kindChips.setActive(course.kind);
        if (document.activeElement !== range) range.value = course.marks || 0;

        const choices = retakeChoices(ctx.transcript, semIndex, course.retakeOf);
        retakeRow.hidden = choices.length === 0;
        retakeSelect.replaceChildren(
            new Option('No, this is a first attempt', ''),
            ...choices.map(c => new Option(`${c.name.trim() || 'Untitled'} (${c.semester.trim() || 'Untitled'}, ${c.letter})`, c.id))
        );
        retakeSelect.value = choices.some(c => c.id === course.retakeOf) ? course.retakeOf : '';

        retakeLater.hidden = !canBeRetaken(entry);
        result.className = entry.result.status === 'invalid' ? 'editor-result bad' : 'editor-result';
        result.textContent = outcomeText(ctx, entry);
    });

    if (!course.name) name.focus();
}

// Adds a linked retake in a later semester and opens it.
function addRetake(ctx, semester, original) {
    const { semesters } = ctx.state;
    let target = semesters[semesters.length - 1];
    if (target === semester || target.summary) {
        target = newCourseSemester(`Semester ${semesters.length + 1}`);
        semesters.push(target);
    }
    const retake = { ...blankCourse(), name: original.name, credits: original.credits, retakeOf: original.id };
    target.courses.push(retake);
    closeEditor(ctx);
    openCourseEditor(ctx, target, retake);
}

function openSemesterEditor(ctx, semester) {
    closeEditor(ctx);
    selection = { semId: semester.id };
    const changed = () => ctx.commit();

    const name = el('input', { type: 'text', className: 'editor-title', placeholder: 'Semester name', value: semester.name, ariaLabel: 'Semester name' });
    name.addEventListener('input', () => { semester.name = name.value; changed(); });

    const sessionChips = chips(SESSIONS, value => { semester.session = value; changed(); });
    const rows = [editorRow('Session', sessionChips)];

    if (semester.summary) {
        const credits = el('input', { type: 'number', className: 'editor-number wide', min: 1, placeholder: 'e.g. 18', value: semester.summary.credits, ariaLabel: 'Total credits' });
        const sgpa = el('input', { type: 'number', className: 'editor-number wide', min: 0, max: 4, step: 0.01, placeholder: 'e.g. 3.45', value: semester.summary.sgpa, ariaLabel: 'SGPA' });
        credits.addEventListener('input', () => { semester.summary.credits = credits.value; changed(); });
        sgpa.addEventListener('input', () => { semester.summary.sgpa = sgpa.value; changed(); });
        rows.push(editorRow('Total credits', credits), editorRow('SGPA', sgpa));
    }

    const remove = el('button', { className: 'btn btn-danger btn-small', textContent: 'Delete semester' });
    remove.addEventListener('click', () => {
        const { semesters } = ctx.state;
        const index = semesters.indexOf(semester);
        semesters.splice(index, 1);
        selection = null;
        closeEditorPanel();
        ctx.commit();
        showToast(`"${semester.name.trim() || 'Untitled'}" deleted.`, {
            actionLabel: 'Undo',
            onAction: () => {
                semesters.splice(Math.min(index, semesters.length), 0, semester);
                ctx.commit();
            }
        });
    });

    const result = el('p', { className: 'editor-result' });
    const notes = el('ul', { className: 'editor-notes' });

    showEditor(ctx, [
        editorHead(ctx, name),
        ...rows,
        result,
        notes,
        el('div', { className: 'editor-foot' }, [el('span'), remove])
    ], () => {
        const row = rowById(ctx, semester.id);
        if (!row) return;
        sessionChips.setActive(row.session);

        const errors = Object.values(row.totals.errors ?? {});
        result.className = errors.length > 0 ? 'editor-result bad' : 'editor-result';
        result.textContent = errors.length > 0 ? errors.map(sentence).join(' ')
            : row.hasData ? `SGPA ${formatGpa(row.totals.sgpa)} over ${row.totals.attemptedCredits} credit hours. CGPA after this semester: ${formatGpa(row.cgpaAfter)}.`
            : semester.summary ? 'Enter the total credit hours and the SGPA for this semester.'
            : 'No grades yet. Tap + in the column to add a course.';

        // What the handbook says about this semester.
        const lines = [];
        if (row.honour) lines.push(`${row.honour.label}: SGPA of ${row.honour.code === 'vc' ? '3.70' : '3.50'} or more with no repeated course.`);
        if (row.standing) lines.push(`${row.standing.label}. ${row.standing.detail}`);
        if (row.load) lines.push(row.load.text);
        notes.replaceChildren(...lines.map(line => el('li', { textContent: line })));
    });
}

// --- Brush ---

function setBrush(letter) {
    brush = letter;
    document.body.classList.toggle('painting', brush !== null);
    for (const chip of $('paintChips').children) {
        chip.setAttribute('aria-pressed', String(chip.dataset.value === brush));
    }
    $('paintHint').textContent = brush
        ? `Brush loaded with ${brush}. Tap cells to paint them, or + to add a painted course. Tap ${brush} again to stop.`
        : 'Pick a grade, then tap cells to paint them. Great for trying out a future semester.';
}

function paint(course) {
    course.grade = brush;
    course.marks = String(minMarksForLetter(brush) ?? '');
    if (!course.credits.trim() && !isSpecialGrade(brush)) course.credits = DEFAULT_PAINT_CREDITS;
}

// --- Wiring ---

function addSemester(ctx, semester) {
    ctx.state.semesters.push(semester);
    ctx.commit();
    openSemesterEditor(ctx, semester);
    $('matrix').querySelector(`[data-id="${semester.id}"]`).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

export function initMatrixView(ctx) {
    $('paintChips').replaceChildren(...PICKABLE_GRADES.map(letter => {
        const chip = el('button', { className: 'chip', textContent: letter });
        chip.dataset.value = letter;
        chip.addEventListener('click', () => {
            closeEditor(ctx);
            setBrush(brush === letter ? null : letter);
        });
        return chip;
    }));
    setBrush(null);

    $('matrix').addEventListener('click', event => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.id === 'addSemesterBtn') return addSemester(ctx, newCourseSemester(`Semester ${ctx.state.semesters.length + 1}`));
        if (target.id === 'addSummaryBtn') return addSemester(ctx, newSummarySemester(`Semester ${ctx.state.semesters.length + 1}`));

        const semester = semesterById(ctx, target.closest('.col')?.dataset.id);
        if (!semester) return;

        if (target.matches('.col-head, .cell-block')) {
            openSemesterEditor(ctx, semester);
        } else if (target.matches('.add-cell')) {
            const course = blankCourse();
            semester.courses.push(course);
            if (brush) {
                paint(course);
                ctx.commit();
            } else {
                ctx.commit();
                openCourseEditor(ctx, semester, course);
            }
        } else if (target.matches('.cell')) {
            const course = semester.courses.find(c => c.id === target.dataset.course);
            if (brush) {
                paint(course);
                ctx.commit();
            } else {
                openCourseEditor(ctx, semester, course);
            }
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (selection) closeEditor(ctx);
        else if (brush) setBrush(null);
    });

    // Threads are measured from the cells, so they are redrawn when the layout shifts.
    window.addEventListener('resize', () => {
        $('matrix').querySelector('.threads')?.remove();
        drawThreads(ctx);
    });
}

// Called when the whole state is swapped (import, reset, sandbox discard).
export function resetMatrixView() {
    selection = null;
    closeEditorPanel();
}
