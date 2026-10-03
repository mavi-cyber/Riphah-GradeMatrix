// Step 3: target CGPA and the final exam calculator.

import { projectCgpa, requiredGpa, neededInFinal } from './planner.js';
import { formatGpa } from './transcript.js';
import { $, el, table } from './dom.js';

const SCENARIO_GPAS = [4.0, 3.5, 3.0, 2.5, 2.0];

function setResult(node, text, tone = '') {
    node.textContent = text;
    node.className = tone ? `result result-${tone}` : 'result';
}

function progressBar(done, total) {
    const percent = Math.min(100, (done / total) * 100);
    const bar = el('div', { className: 'progress', role: 'img', ariaLabel: `${percent.toFixed(0)} percent of degree credits recorded` }, [
        el('div', { className: 'progress-fill' })
    ]);
    bar.firstChild.style.width = `${percent}%`;
    return el('div', { className: 'progress-block' }, [
        bar,
        el('span', { className: 'form-hint', textContent: `${done} of ${total} credit hours recorded (${percent.toFixed(0)}%)` })
    ]);
}

function renderTarget(ctx) {
    const base = ctx.transcript.overall;
    const { degreeCredits, targetCgpa } = ctx.state.plan;
    const result = $('planResult');
    $('planProgress').replaceChildren();
    $('planScenarios').replaceChildren();

    const total = Number(degreeCredits);
    if (degreeCredits.trim() === '') {
        setResult(result, 'Enter the total credit hours in your degree to begin.');
        return;
    }
    if (!(total > 0)) {
        setResult(result, 'Total credit hours must be greater than 0.', 'bad');
        return;
    }

    $('planProgress').replaceChildren(progressBar(base.credits, total));
    const remaining = total - base.credits;
    if (remaining <= 0) {
        setResult(result, `You have already recorded all ${total} credit hours. Your CGPA stands at ${formatGpa(base.cgpa)}.`);
        return;
    }

    $('planScenarios').replaceChildren(
        el('p', { className: 'form-hint', textContent: `If your remaining ${remaining} credit hours average:` }),
        table(['Average GPA', 'Final CGPA'], SCENARIO_GPAS.map(gpa => [formatGpa(gpa), formatGpa(projectCgpa(base, remaining, gpa))]))
    );

    const target = Number(targetCgpa);
    if (targetCgpa.trim() === '') {
        setResult(result, 'Add a target CGPA to see what you need.');
        return;
    }
    if (!(target >= 0 && target <= 4)) {
        setResult(result, 'Target CGPA must be between 0 and 4.00.', 'bad');
        return;
    }

    const plan = requiredGpa(base, target, remaining);
    if (plan.status === 'possible') {
        setResult(result, `To finish on ${formatGpa(target)}, average ${formatGpa(plan.required)} across your remaining ${remaining} credit hours.`, 'good');
    } else if (plan.status === 'secured') {
        setResult(result, `Already secured: you will finish on ${formatGpa(target)} or higher whatever happens. The lowest possible finish is ${formatGpa(plan.minCgpa)}.`, 'good');
    } else {
        setResult(result, `Out of reach: even a 4.00 in every remaining course ends on ${formatGpa(plan.maxCgpa)}.`, 'bad');
    }
}

const FINALS_STATUS = {
    'secured': 'Already secured',
    'possible': 'Within reach',
    'out-of-reach': 'Out of reach'
};

function renderFinals() {
    const securedText = $('finalsSecured').value.trim();
    const maxText = $('finalsMax').value.trim();
    const message = $('finalsMessage');
    $('finalsResult').replaceChildren();

    if (securedText === '' || maxText === '') {
        setResult(message, 'Enter the marks you already hold and what the final is out of. The end semester exam is usually 40 to 50 marks of the 100.');
        return;
    }
    const secured = Number(securedText), finalMax = Number(maxText);
    if (!(secured >= 0) || !(finalMax > 0)) {
        setResult(message, 'Marks secured cannot be negative, and the final must be out of more than 0.', 'bad');
        return;
    }
    if (secured + finalMax > 100) {
        setResult(message, 'Marks secured plus the final exam cannot add up to more than 100.', 'bad');
        return;
    }

    setResult(message, `Best possible total: ${(secured + finalMax).toFixed(1).replace('.0', '')} out of 100.`);
    $('finalsResult').replaceChildren(table(
        ['Grade', 'Total needed', 'Needed in final', 'Status'],
        neededInFinal(secured, finalMax).map(row => {
            const status = el('span', { className: `status status-${row.status}`, textContent: FINALS_STATUS[row.status] });
            const needed = row.status === 'secured' ? '0' : `${row.needed.toFixed(1).replace('.0', '')} of ${finalMax}`;
            return [row.letter, String(row.minTotal), needed, status];
        })
    ));
}

export function renderPlanner(ctx) {
    renderTarget(ctx);
}

export function syncPlannerInputs(ctx) {
    $('planDegreeCredits').value = ctx.state.plan.degreeCredits;
    $('planTarget').value = ctx.state.plan.targetCgpa;
}

export function initPlannerView(ctx) {
    syncPlannerInputs(ctx);
    $('planDegreeCredits').addEventListener('input', event => {
        ctx.state.plan.degreeCredits = event.target.value;
        ctx.commit();
    });
    $('planTarget').addEventListener('input', event => {
        ctx.state.plan.targetCgpa = event.target.value;
        ctx.commit();
    });

    $('finalsSecured').addEventListener('input', renderFinals);
    $('finalsMax').addEventListener('input', renderFinals);
    renderFinals();
}
