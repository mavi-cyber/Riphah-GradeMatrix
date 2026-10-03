// Entry point: owns the state, the headline numbers and the tool panels,
// and tells each view when to redraw.

import { buildTranscript, formatGpa } from './transcript.js';
import { requiredGpa } from './planner.js';
import { loadState, saveState } from './storage.js';
import { $ } from './dom.js';
import { initModal } from './modal.js';
import { showToast } from './toast.js';
import { initMatrixView, renderMatrix, resetMatrixView } from './matrix-view.js';
import { renderInsights } from './insights-view.js';
import { initPlannerView, renderPlanner, syncPlannerInputs } from './planner-view.js';
import { initReportView, renderReport, syncReportInputs } from './report-view.js';

const PANELS = ['insights', 'planner', 'report'];
const TWEEN_MS = 450;

let saveWarningShown = false;
// While the sandbox is open this holds the state to go back to, and nothing is saved.
let sandboxSnapshot = null;
let shownCgpa = 0;
let tweenFrame = 0;

const ctx = {
    state: loadState(),
    transcript: null,

    // Call after any change to state.
    commit() {
        ctx.transcript = buildTranscript(ctx.state.semesters);
        persist();
        renderMatrix(ctx);
        renderHero();
        renderInsights(ctx);
        renderPlanner(ctx);
        renderReport(ctx);
    },

    replaceState(next) {
        Object.assign(ctx.state, next);
        resetMatrixView();
        syncPlannerInputs(ctx);
        syncReportInputs(ctx);
        ctx.commit();
    }
};

function persist() {
    if (sandboxSnapshot !== null) return;
    if (saveState(ctx.state) || saveWarningShown) return;
    saveWarningShown = true;
    showToast('Your browser is blocking storage, so changes will be lost when this tab closes.', { type: 'error' });
}

// --- Headline ---

// Counts the big number up or down to its new value.
function tweenCgpa(target) {
    cancelAnimationFrame(tweenFrame);
    const from = shownCgpa;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || from === target) {
        shownCgpa = target;
        $('cgpaDisplay').textContent = formatGpa(target);
        return;
    }

    const start = performance.now();
    const step = now => {
        const t = Math.min((now - start) / TWEEN_MS, 1);
        shownCgpa = from + (target - from) * (1 - (1 - t) ** 3);
        $('cgpaDisplay').textContent = formatGpa(shownCgpa);
        if (t < 1) tweenFrame = requestAnimationFrame(step);
    };
    tweenFrame = requestAnimationFrame(step);
}

function moodFor(cgpa, hasGrades) {
    if (!hasGrades) return 'Tap + in a column to drop in your first course.';
    if (cgpa >= 3.5) return 'Flying high. Keep the matrix glowing.';
    if (cgpa >= 3.0) return 'Solid ground. A few stronger cells and you are flying.';
    if (cgpa >= 2.5) return 'Room to climb. Every cell you lift moves this number.';
    return 'The next semester is a fresh column. Paint it well.';
}

function goalText() {
    const base = ctx.transcript.overall;
    const total = Number(ctx.state.plan.degreeCredits);
    const target = Number(ctx.state.plan.targetCgpa);
    const hasPlan = ctx.state.plan.targetCgpa.trim() !== '' && target >= 0 && target <= 4 && total > base.credits;
    if (!hasPlan) return 'Set a goal';

    const plan = requiredGpa(base, target, total - base.credits);
    if (plan.status === 'secured') return `Goal ${formatGpa(target)}: secured`;
    if (plan.status === 'impossible') return `Goal ${formatGpa(target)}: out of reach (max ${formatGpa(plan.maxCgpa)})`;
    return `Goal ${formatGpa(target)}: average ${formatGpa(plan.required)} from here`;
}

function renderHero() {
    const { overall, graded, latestSgpa } = ctx.transcript;
    tweenCgpa(overall.cgpa);
    $('moodLine').textContent = moodFor(overall.cgpa, graded.length > 0);
    $('latestSgpaDisplay').textContent = formatGpa(latestSgpa);
    $('earnedCreditsDisplay').textContent = overall.earnedCredits;
    $('semesterCount').textContent = graded.length;
    $('goalChip').textContent = goalText();

    // Academic standing by the handbook's deficiency rules, shown only when it needs attention.
    const { standing } = ctx.transcript;
    const alert = standing && standing.code !== 'good';
    $('standingChip').hidden = !alert;
    if (alert) {
        $('standingChip').textContent = standing.label;
        $('standingChip').title = standing.detail;
    }
}

// --- Tool panels ---

function showPanel(name) {
    const open = PANELS.includes(name);
    $('drawer').hidden = !open;
    $('drawerBackdrop').hidden = !open;
    document.body.classList.toggle('drawer-open', open);
    for (const id of PANELS) $(`view-${id}`).hidden = id !== name;
    for (const tab of document.querySelectorAll('.tab')) {
        tab.setAttribute('aria-pressed', String(tab.dataset.view === name));
    }
    if (open) $('drawer').scrollTop = 0;
}

function initPanels() {
    const go = name => {
        location.hash = location.hash.slice(1) === name ? '' : name;
    };
    for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => go(tab.dataset.view));
    $('goalChip').addEventListener('click', () => go('planner'));
    $('drawerClose').addEventListener('click', () => { location.hash = ''; });
    $('drawerBackdrop').addEventListener('click', () => { location.hash = ''; });

    window.addEventListener('hashchange', () => showPanel(location.hash.slice(1)));
    showPanel(location.hash.slice(1));
}

// --- Sandbox ---

function setSandbox(snapshot) {
    sandboxSnapshot = snapshot;
    $('whatIfBanner').hidden = snapshot === null;
    $('whatIfBtn').hidden = snapshot !== null;
    document.body.classList.toggle('what-if', snapshot !== null);
}

function initSandbox() {
    $('whatIfBtn').addEventListener('click', () => setSandbox(JSON.stringify(ctx.state)));
    $('whatIfKeep').addEventListener('click', () => {
        setSandbox(null);
        persist();
        showToast('Changes kept.');
    });
    $('whatIfDiscard').addEventListener('click', () => {
        const original = JSON.parse(sandboxSnapshot);
        setSandbox(null);
        ctx.replaceState(original);
        showToast('Back to your saved records.');
    });
}

initModal();
initPanels();
initSandbox();
initMatrixView(ctx);
initPlannerView(ctx);
initReportView(ctx);
ctx.commit();
