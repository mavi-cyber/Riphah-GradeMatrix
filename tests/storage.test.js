import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState, defaultState, exportBackup, importBackup } from '../js/storage.js';

function fakeStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value))
    };
}

function sampleState() {
    const state = defaultState();
    state.student.name = 'Ali';
    state.plan = { degreeCredits: '130', targetCgpa: '3.5' };
    state.semesters = [
        { id: 'a1', name: 'Semester 1', session: 'regular', summary: { credits: '18', sgpa: '3.45' } },
        { id: 'b2', name: 'Summer 1', session: 'summer', courses: [
            { id: 'c1', name: 'DSA', credits: '4', marks: '77', grade: 'B+', kind: 'credit', retakeOf: 'c0' },
            { id: 'c2', name: 'Seminar', credits: '1', marks: '', grade: '', kind: 'non-credit', retakeOf: '' }
        ] }
    ];
    return state;
}

test('a new user starts with one empty semester', () => {
    const state = loadState(fakeStorage());
    assert.equal(state.semesters.length, 1);
    assert.equal(state.semesters[0].name, 'Semester 1');
    assert.equal(state.semesters[0].courses.length, 0);
});

test('state survives a save and load', () => {
    const storage = fakeStorage();
    const state = sampleState();
    assert.equal(saveState(state, storage), true);
    assert.deepEqual(loadState(storage), state);
});

test('v1 semesters are migrated as summary-only records', () => {
    const state = loadState(fakeStorage({
        rihu_semesters: JSON.stringify([{ name: 'Semester 1', credits: 18, qualityPoints: 62.1, sgpa: 3.45 }, null])
    }));
    assert.equal(state.semesters.length, 1);
    assert.equal(state.semesters[0].name, 'Semester 1');
    assert.deepEqual(state.semesters[0].summary, { credits: '18', sgpa: '3.45' });
});

test('a v2 draft becomes an ordinary semester', () => {
    const state = loadState(fakeStorage({
        riphah_gradematrix_v2: JSON.stringify({
            student: { name: 'Ali' },
            semesters: [{ id: 's1', name: 'Semester 1', summary: { credits: 18, sgpa: 3.45 } }],
            draft: { title: 'Fall 2026', editingId: null, courses: [{ name: 'OS', credits: '3', marks: '81', grade: 'A' }] }
        })
    }));
    assert.equal(state.student.name, 'Ali');
    assert.equal(state.semesters.length, 2);
    assert.equal(state.semesters[1].name, 'Fall 2026');
    assert.equal(state.semesters[1].courses[0].name, 'OS');
    assert.equal(state.semesters[1].session, 'regular');
    assert.ok(state.semesters[1].courses[0].id);
    assert.equal(state.semesters[1].courses[0].kind, 'credit');
});

test('a v2 draft that was editing a semester replaces it', () => {
    const state = loadState(fakeStorage({
        riphah_gradematrix_v2: JSON.stringify({
            semesters: [{ id: 's1', name: 'Semester 1', courses: [{ name: 'Old', credits: '3', marks: '60', grade: 'C' }] }],
            draft: { title: 'Semester 1', editingId: 's1', courses: [{ name: 'New', credits: '3', marks: '90', grade: 'A+' }] }
        })
    }));
    assert.equal(state.semesters.length, 1);
    assert.equal(state.semesters[0].courses[0].name, 'New');
});

test('corrupt or malformed data falls back to defaults', () => {
    assert.equal(loadState(fakeStorage({ riphah_gradematrix: '{not json' })).semesters.length, 1);

    const odd = loadState(fakeStorage({
        riphah_gradematrix: JSON.stringify({ semesters: [42, { name: 'No body' }, { name: 'Ok', courses: [] }] })
    }));
    assert.equal(odd.semesters.length, 1);
    assert.equal(odd.semesters[0].name, 'Ok');
});

test('saveState reports a refused write', () => {
    const full = { setItem() { throw new Error('quota'); } };
    assert.equal(saveState(defaultState(), full), false);
});

test('a backup round-trips, and foreign files are rejected', () => {
    const state = sampleState();
    assert.deepEqual(importBackup(exportBackup(state)), state);
    assert.equal(importBackup('not json'), null);
    assert.equal(importBackup(JSON.stringify({ semesters: [] })), null);
    assert.equal(importBackup(JSON.stringify({ app: 'riphah-gradematrix' })), null);
});
