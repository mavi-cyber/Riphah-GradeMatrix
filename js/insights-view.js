// Step 2: charts and highlights drawn from the transcript.

import { GRADE_BANDS } from './grading.js';
import { formatGpa } from './transcript.js';
import { $, el, svg, table } from './dom.js';

const MAX_GPA = 4;

// --- Shared hover tooltip ---

function showTooltip(event, lines) {
    const tip = $('chartTooltip');
    tip.replaceChildren(...lines.map((line, i) => el(i === 0 ? 'strong' : 'span', { textContent: line })));
    tip.hidden = false;

    const anchor = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(anchor.left + anchor.width / 2, 90), window.innerWidth - 90);
    tip.style.left = `${x}px`;
    tip.style.top = `${anchor.top + window.scrollY - 8}px`;
}

function hideTooltip() {
    $('chartTooltip').hidden = true;
}

function hoverTarget(node, lines) {
    node.setAttribute('tabindex', '0');
    node.addEventListener('pointerenter', event => showTooltip(event, lines));
    node.addEventListener('focus', event => showTooltip(event, lines));
    node.addEventListener('pointerleave', hideTooltip);
    node.addEventListener('blur', hideTooltip);
    return node;
}

function shortName(name, index, crowded) {
    if (crowded) return `#${index + 1}`;
    const label = name.trim() || `Semester ${index + 1}`;
    return label.length > 14 ? `${label.slice(0, 13)}…` : label;
}

// --- SGPA / CGPA trend ---

function trendChart(graded) {
    const width = 720, height = 280;
    const plot = { left: 34, right: width - 62, top: 14, bottom: height - 34 };
    const xAt = i => graded.length === 1
        ? (plot.left + plot.right) / 2
        : plot.left + 16 + (i * (plot.right - plot.left - 32)) / (graded.length - 1);
    const yAt = gpa => plot.bottom - (gpa / MAX_GPA) * (plot.bottom - plot.top);
    const crowded = graded.length > 7;

    const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Line chart of SGPA and running CGPA for each semester' });

    for (let gpa = 0; gpa <= MAX_GPA; gpa++) {
        chart.append(
            svg('line', { class: 'grid-line', x1: plot.left, x2: plot.right, y1: yAt(gpa), y2: yAt(gpa) }),
            svg('text', { class: 'axis-label', x: plot.left - 8, y: yAt(gpa) + 4, 'text-anchor': 'end' }, [gpa.toFixed(1)])
        );
    }

    const series = [
        { name: 'SGPA', className: 'series-1', value: row => row.totals.sgpa },
        { name: 'CGPA', className: 'series-2', value: row => row.cgpaAfter }
    ];

    for (const s of series) {
        const points = graded.map((row, i) => `${xAt(i)},${yAt(s.value(row))}`).join(' ');
        chart.append(svg('polyline', { class: `line ${s.className}`, points }));
    }
    for (const s of series) {
        graded.forEach((row, i) => chart.append(
            svg('circle', { class: `marker ${s.className}`, cx: xAt(i), cy: yAt(s.value(row)), r: 4.5 })));
    }

    // Direct labels at the line ends, nudged apart when the two values are close.
    const last = graded[graded.length - 1];
    let [sgpaY, cgpaY] = [yAt(last.totals.sgpa), yAt(last.cgpaAfter)];
    if (Math.abs(sgpaY - cgpaY) < 14) {
        const middle = (sgpaY + cgpaY) / 2;
        const sgpaOnTop = sgpaY <= cgpaY;
        sgpaY = middle + (sgpaOnTop ? -7 : 7);
        cgpaY = middle + (sgpaOnTop ? 7 : -7);
    }
    const endX = xAt(graded.length - 1) + 12;
    chart.append(
        svg('text', { class: 'end-label', x: endX, y: sgpaY + 4 }, [`SGPA ${formatGpa(last.totals.sgpa)}`]),
        svg('text', { class: 'end-label', x: endX, y: cgpaY + 4 }, [`CGPA ${formatGpa(last.cgpaAfter)}`])
    );

    // One full-height hover band per semester, wider than the marks themselves.
    const band = graded.length === 1 ? plot.right - plot.left : (plot.right - plot.left - 32) / (graded.length - 1);
    graded.forEach((row, i) => {
        chart.append(svg('text', { class: 'axis-label', x: xAt(i), y: height - 12, 'text-anchor': 'middle' }, [shortName(row.name, i, crowded)]));
        chart.append(hoverTarget(
            svg('rect', { class: 'hit', x: xAt(i) - band / 2, y: plot.top, width: band, height: plot.bottom - plot.top }),
            [row.name.trim() || `Semester ${i + 1}`, `SGPA ${formatGpa(row.totals.sgpa)}`, `CGPA ${formatGpa(row.cgpaAfter)}`]
        ));
    });

    return chart;
}

// --- Grade distribution ---

function gradeChart(gradeCounts) {
    const letters = GRADE_BANDS.map(band => band.letter);
    const width = 420, height = 220;
    const plot = { left: 10, right: width - 10, top: 22, bottom: height - 30 };
    const slot = (plot.right - plot.left) / letters.length;
    const barWidth = Math.min(22, slot - 6);
    const highest = Math.max(1, ...letters.map(letter => gradeCounts[letter] ?? 0));

    const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Bar chart of how many courses received each letter grade' });
    chart.append(svg('line', { class: 'grid-line', x1: plot.left, x2: plot.right, y1: plot.bottom, y2: plot.bottom }));

    letters.forEach((letter, i) => {
        const count = gradeCounts[letter] ?? 0;
        const centre = plot.left + slot * i + slot / 2;
        const barHeight = (count / highest) * (plot.bottom - plot.top);

        chart.append(svg('text', { class: 'axis-label', x: centre, y: height - 10, 'text-anchor': 'middle' }, [letter]));
        if (count === 0) return;

        // Rounded at the data end only, square on the baseline.
        const x = centre - barWidth / 2, y = plot.bottom - barHeight, r = Math.min(4, barHeight);
        const path = `M${x},${plot.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V${plot.bottom} Z`;
        chart.append(
            svg('path', { class: 'bar series-1', d: path }),
            svg('text', { class: 'value-label', x: centre, y: y - 6, 'text-anchor': 'middle' }, [String(count)]),
            hoverTarget(
                svg('rect', { class: 'hit', x: centre - slot / 2, y: plot.top, width: slot, height: plot.bottom - plot.top }),
                [`Grade ${letter}`, `${count} course${count === 1 ? '' : 's'}`]
            )
        );
    });

    return chart;
}

// --- Highlights ---

function fact(label, value) {
    return el('div', {}, [el('dt', { textContent: label }), el('dd', { textContent: value })]);
}

function highlights(transcript) {
    const { graded, gradeCounts, standing, medal, replacedCount } = transcript;
    const named = row => `${row.name.trim() || 'Untitled semester'} (${formatGpa(row.totals.sgpa)})`;
    const best = graded.reduce((a, b) => (b.totals.sgpa > a.totals.sgpa ? b : a));
    const lowest = graded.reduce((a, b) => (b.totals.sgpa < a.totals.sgpa ? b : a));
    const courses = Object.values(gradeCounts).reduce((sum, n) => sum + n, 0);
    const first = graded[0], last = graded[graded.length - 1];
    const change = last.cgpaAfter - first.cgpaAfter;

    const facts = [fact('Best semester', named(best))];
    if (graded.length > 1) {
        facts.push(fact('Lowest semester', named(lowest)));
        facts.push(fact('CGPA since first semester', `${change >= 0 ? '+' : ''}${change.toFixed(2)}`));
    }
    facts.push(fact('Courses graded', courses > 0 ? String(courses) : 'No course details entered'));
    if (gradeCounts.F) facts.push(fact('Failed courses', String(gradeCounts.F)));
    if (replacedCount > 0) facts.push(fact('Grades replaced by a retake', String(replacedCount)));

    const honours = graded.filter(row => row.honour);
    if (honours.length > 0) facts.push(fact('Honour list semesters', honours.map(row => row.name.trim() || 'Untitled').join(', ')));
    if (standing) facts.push(fact('Academic standing', standing.label));
    facts.push(fact('Gold medal conditions', medal.onTrack
        ? (medal.unchecked ? 'Met so far (totals-only semesters not checked)' : 'Met so far')
        : `Not met: ${medal.blockers.join(', ')}`));
    return facts;
}

export function renderInsights(ctx) {
    const { graded, gradeCounts } = ctx.transcript;
    const hasData = graded.length > 0;
    $('insightsEmpty').hidden = hasData;
    $('insightsBody').hidden = !hasData;
    if (!hasData) return;

    $('trendChart').replaceChildren(trendChart(graded));
    $('trendTable').replaceChildren(table(
        ['Semester', 'Credits', 'SGPA', 'CGPA'],
        graded.map(row => [row.name.trim() || 'Untitled semester', String(row.totals.attemptedCredits), formatGpa(row.totals.sgpa), formatGpa(row.cgpaAfter)])
    ));

    const hasCourses = Object.keys(gradeCounts).length > 0;
    $('gradeChart').replaceChildren(hasCourses
        ? gradeChart(gradeCounts)
        : el('p', { className: 'form-hint', textContent: 'Add course details to a semester to see your grade spread.' }));

    $('highlights').replaceChildren(...highlights(ctx.transcript));
}
