// Step 4: the printable transcript, student details and backup files.

import { formatGpa } from './transcript.js';
import { exportBackup, importBackup, defaultState } from './storage.js';
import { $, el, table } from './dom.js';
import { showConfirm } from './modal.js';
import { showToast } from './toast.js';

const STUDENT_FIELDS = { studentName: 'name', studentSap: 'sap', studentProgram: 'program' };

function detail(label, value) {
    return el('div', {}, [el('dt', { textContent: label }), el('dd', { textContent: value.trim() || 'Not provided' })]);
}

function figure(label, value) {
    return el('div', { className: 'sheet-figure' }, [
        el('span', { textContent: label }),
        el('strong', { textContent: value })
    ]);
}

// Rows for the courses that appear on a transcript: graded, or deliberately excluded.
// A replaced grade prints as R and a lower retake as W, each with a footnote mark.
function courseRows(entries) {
    const rows = [];
    for (const entry of entries) {
        const { course, result } = entry;
        if (result.status !== 'ok' && result.status !== 'excluded') continue;

        const graded = result.status === 'ok';
        const name = course.name.trim() || 'Untitled course';
        const points = graded ? result.gradePoint.toFixed(1) : 'n/a';
        const quality = graded ? (result.credits * result.gradePoint).toFixed(2) : 'n/a';

        if (entry.outcome === 'replaced') rows.push([`${name} *`, course.credits, course.marks, `R (was ${result.letter})`, points, quality]);
        else if (entry.outcome === 'lowered') rows.push([`${name} **`, course.credits, course.marks, `W (scored ${result.letter})`, 'n/a', 'n/a']);
        else rows.push([entry.target ? `${name} (retake)` : name, course.credits, course.marks, result.letter, points, quality]);
    }
    return rows;
}

function semesterBlock(row, semester) {
    const { totals } = row;
    const tags = [row.session === 'summer' ? 'Summer session' : '', row.honour ? row.honour.label : ''].filter(Boolean);
    const heading = el('div', { className: 'sheet-sem-head' }, [
        el('h4', { textContent: (row.name.trim() || 'Untitled semester') + (tags.length > 0 ? ` (${tags.join(', ')})` : '') }),
        el('span', { textContent: `${totals.attemptedCredits} credits · SGPA ${formatGpa(totals.sgpa)} · CGPA ${formatGpa(row.cgpaAfter)}` })
    ]);

    const body = semester.summary
        ? el('p', { className: 'sheet-note', textContent: 'Totals only. Course details were not entered for this semester.' })
        : table(['Course', 'Credits', 'Marks', 'Grade', 'Points', 'Quality Pts'], courseRows(row.entries));

    return el('section', { className: 'sheet-sem' }, [heading, body]);
}

export function renderReport(ctx) {
    const { student, semesters } = ctx.state;
    const { rows, graded, overall } = ctx.transcript;
    const outcomes = rows.flatMap(row => row.entries.map(entry => entry.outcome));
    const standing = ctx.transcript.standing;
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const blocks = rows
        .filter(row => row.hasData || row.totals.excluded > 0)
        .map(row => semesterBlock(row, semesters.find(sem => sem.id === row.id)));

    $('transcriptSheet').replaceChildren(
        el('header', { className: 'sheet-head' }, [
            el('img', { src: 'assets/imgs/logo.svg', width: 40, height: 40, alt: '' }),
            el('div', {}, [
                el('h3', { textContent: 'Riphah GradeMatrix' }),
                el('span', { textContent: 'Academic Grade Report (unofficial estimate)' })
            ]),
            el('span', { className: 'sheet-date', textContent: `Generated ${today}` })
        ]),
        el('dl', { className: 'sheet-details' }, [
            detail('Name', student.name),
            detail('SAP ID', student.sap),
            detail('Program', student.program)
        ]),
        el('div', { className: 'sheet-figures' }, [
            figure('CGPA', formatGpa(overall.cgpa)),
            figure('Credits in CGPA', String(overall.credits)),
            figure('Earned credits', String(overall.earnedCredits)),
            figure('Semesters', String(graded.length))
        ]),
        ...(standing && standing.code !== 'good' ? [el('p', { className: 'sheet-note', textContent: `Academic standing: ${standing.label}. ${standing.detail}` })] : []),
        ...(blocks.length > 0 ? blocks : [el('p', { className: 'sheet-note', textContent: 'No grades recorded yet.' })]),
        el('footer', { className: 'sheet-foot' }, [
            ...(outcomes.includes('replaced') ? [el('p', { textContent: '* Replaced by a later retake that scored the same or higher. It stays in its own semester\'s SGPA and is left out of the CGPA from the retake on.' })] : []),
            ...(outcomes.includes('lowered') ? [el('p', { textContent: '** A retake that scored lower than the earlier attempt is recorded as W. The earlier grade stands.' })] : []),
            el('p', { textContent: 'Quality points are credit hours multiplied by grade points. Grades I and W, and non-credit or transferred courses, are not used in SGPA or CGPA.' }),
            el('p', { textContent: 'This is an estimate from an independent student tool, not an official document. For official records consult the Student Services Department.' })
        ])
    );
}

export function syncReportInputs(ctx) {
    for (const [inputId, key] of Object.entries(STUDENT_FIELDS)) $(inputId).value = ctx.state.student[key];
}

function downloadBackup(ctx) {
    const blob = new Blob([exportBackup(ctx.state)], { type: 'application/json' });
    const link = el('a', {
        href: URL.createObjectURL(blob),
        download: `gradematrix-backup-${new Date().toISOString().slice(0, 10)}.json`
    });
    link.click();
    URL.revokeObjectURL(link.href);
}

async function restoreBackup(ctx, file) {
    const imported = importBackup(await file.text());
    if (!imported) {
        showToast('That file is not a GradeMatrix backup.', { type: 'error' });
        return;
    }
    showConfirm(
        'Replace your records?',
        `The backup holds ${imported.semesters.length} semester(s). Importing it replaces everything currently on this device.`,
        () => {
            ctx.replaceState(imported);
            showToast('Backup imported.');
        },
        'Import'
    );
}

export function initReportView(ctx) {
    syncReportInputs(ctx);
    for (const [inputId, key] of Object.entries(STUDENT_FIELDS)) {
        $(inputId).addEventListener('input', event => {
            ctx.state.student[key] = event.target.value;
            ctx.commit();
        });
    }

    $('pdfBtn').addEventListener('click', () => window.print());
    $('exportBtn').addEventListener('click', () => downloadBackup(ctx));
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', event => {
        const [file] = event.target.files;
        if (file) restoreBackup(ctx, file);
        event.target.value = '';
    });

    $('resetAllBtn').addEventListener('click', () => {
        showConfirm('Reset all records?', 'This clears every semester, your student details and your plan. It cannot be undone.', () => {
            ctx.replaceState(defaultState());
            showToast('All records have been cleared.');
        }, 'Reset');
    });
}
