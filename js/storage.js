// Persistence. Everything the app remembers lives under one key, with a version inside.

const STORAGE_KEY = 'riphah_gradematrix';
const APP_ID = 'riphah-gradematrix';
const VERSION = 3;

// Older layouts, read once and converted:
// v2 kept a separate "draft" semester next to the saved ones.
const V2_KEY = 'riphah_gradematrix_v2';
// v1 stored only an array of { name, credits, qualityPoints, sgpa }.
const V1_KEY = 'rihu_semesters';

export function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function blankCourse() {
    return { id: newId(), name: '', credits: '', marks: '', grade: '', kind: 'credit', retakeOf: '' };
}

export function newCourseSemester(name) {
    return { id: newId(), name, session: 'regular', courses: [] };
}

export function newSummarySemester(name) {
    return { id: newId(), name, session: 'regular', summary: { credits: '', sgpa: '' } };
}

export function defaultState() {
    return {
        version: VERSION,
        student: { name: '', sap: '', program: '' },
        plan: { degreeCredits: '', targetCgpa: '' },
        semesters: [newCourseSemester('Semester 1')]
    };
}

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}

const COURSE_KINDS = ['credit', 'non-credit', 'transferred'];

function cleanCourse(course) {
    return {
        id: text(course?.id) || newId(),
        name: text(course?.name),
        credits: text(course?.credits),
        marks: text(course?.marks),
        grade: text(course?.grade),
        kind: COURSE_KINDS.includes(course?.kind) ? course.kind : 'credit',
        // The id of the earlier course this one repeats, or '' for a first attempt.
        retakeOf: text(course?.retakeOf)
    };
}

function cleanSemester(semester) {
    if (!semester || typeof semester !== 'object') return null;
    const base = {
        id: text(semester.id) || newId(),
        name: text(semester.name),
        session: semester.session === 'summer' ? 'summer' : 'regular'
    };

    if (Array.isArray(semester.courses)) {
        return { ...base, courses: semester.courses.map(cleanCourse) };
    }
    if (semester.summary && typeof semester.summary === 'object') {
        return { ...base, summary: { credits: text(semester.summary.credits), sgpa: text(semester.summary.sgpa) } };
    }
    return null;
}

// Stored and imported data is not trusted: anything malformed is dropped or
// replaced by a default instead of breaking the page.
function cleanState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;

    state.student = {
        name: text(raw.student?.name),
        sap: text(raw.student?.sap),
        program: text(raw.student?.program)
    };
    state.plan = {
        degreeCredits: text(raw.plan?.degreeCredits),
        targetCgpa: text(raw.plan?.targetCgpa)
    };
    if (Array.isArray(raw.semesters)) {
        state.semesters = raw.semesters.map(cleanSemester).filter(Boolean);
    }
    return state;
}

function draftHasContent(draft) {
    return Array.isArray(draft?.courses)
        && draft.courses.some(c => text(c?.name).trim() || text(c?.credits) || text(c?.marks) || text(c?.grade));
}

// v2 -> v3: the draft becomes an ordinary semester (or replaces the one it was editing).
function migrateV2(raw) {
    const state = cleanState(raw);
    if (!draftHasContent(raw.draft)) return state;

    const courses = raw.draft.courses.map(cleanCourse);
    const editing = state.semesters.find(sem => sem.id === raw.draft.editingId);
    if (editing) {
        delete editing.summary;
        editing.courses = courses;
        editing.name = text(raw.draft.title) || editing.name;
    } else {
        state.semesters.push({ id: newId(), name: text(raw.draft.title) || 'Current Semester', session: 'regular', courses });
    }
    return state;
}

function migrateV1(legacySemesters) {
    const semesters = legacySemesters
        .filter(sem => sem && typeof sem === 'object')
        .map(sem => ({ name: sem.name, summary: { credits: sem.credits, sgpa: sem.sgpa } }));
    return cleanState({ semesters });
}

function readJson(storage, key) {
    try {
        return JSON.parse(storage.getItem(key));
    } catch {
        return null;
    }
}

export function loadState(storage = localStorage) {
    const current = readJson(storage, STORAGE_KEY);
    if (current) return cleanState(current);

    const v2 = readJson(storage, V2_KEY);
    if (v2) return migrateV2(v2);

    const v1 = readJson(storage, V1_KEY);
    if (Array.isArray(v1)) return migrateV1(v1);

    return defaultState();
}

// Returns false when the browser refuses the write (private mode, full quota).
export function saveState(state, storage = localStorage) {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch {
        return false;
    }
}

// --- Backup files ---

export function exportBackup(state) {
    return JSON.stringify({ app: APP_ID, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

// Returns a clean state, or null when the text is not a GradeMatrix backup.
export function importBackup(fileText) {
    let raw;
    try {
        raw = JSON.parse(fileText);
    } catch {
        return null;
    }
    if (!raw || raw.app !== APP_ID || !Array.isArray(raw.semesters)) return null;
    return cleanState(raw);
}
