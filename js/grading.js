// RIU grading rules. Pure functions only: no DOM, no storage.

// Ordered highest band first. baseTenths is the grade point at the band
// minimum, in tenths, so the +0.1 per mark rule stays in integer arithmetic.
export const GRADE_BANDS = [
    { letter: 'A+', min: 90, baseTenths: 40, label: 'A+ (4.0)' },
    { letter: 'A',  min: 80, baseTenths: 40, label: 'A (4.0)' },
    { letter: 'A-', min: 78, baseTenths: 38, label: 'A- (3.8 - 3.9)' },
    { letter: 'B+', min: 74, baseTenths: 34, label: 'B+ (3.4 - 3.7)' },
    { letter: 'B',  min: 70, baseTenths: 30, label: 'B (3.0 - 3.3)' },
    { letter: 'B-', min: 68, baseTenths: 28, label: 'B- (2.8 - 2.9)' },
    { letter: 'C+', min: 64, baseTenths: 24, label: 'C+ (2.4 - 2.7)' },
    { letter: 'C',  min: 60, baseTenths: 20, label: 'C (2.0 - 2.3)' },
    { letter: 'C-', min: 58, baseTenths: 18, label: 'C- (1.8 - 1.9)' },
    { letter: 'D+', min: 54, baseTenths: 14, label: 'D+ (1.4 - 1.7)' },
    { letter: 'D',  min: 50, baseTenths: 10, label: 'D (1.0 - 1.3)' },
    { letter: 'F',  min: 0,  baseTenths: 0,  label: 'F (0.0)' }
];

// Grades that carry no grade point and are left out of SGPA and CGPA.
const SPECIAL_GRADES = [
    { letter: 'I', label: 'I (Incomplete)' },
    { letter: 'W', label: 'W (Withdrawal)' },
    { letter: 'R', label: 'R (Replaced)' }
];

// Marks filled in when a student picks F without entering marks.
const F_DEFAULT_MARKS = 40;

export const GRADE_OPTIONS = [...GRADE_BANDS, ...SPECIAL_GRADES].map(({ letter, label }) => ({ letter, label }));

export function isSpecialGrade(letter) {
    return SPECIAL_GRADES.some(g => g.letter === letter);
}

// Marks are rounded once, half up, before any band lookup.
export function roundMarks(marks) {
    return Math.floor(marks + 0.5);
}

function bandForMarks(marks) {
    const rounded = roundMarks(marks);
    return GRADE_BANDS.find(band => rounded >= band.min);
}

export function letterFromMarks(marks) {
    return bandForMarks(marks).letter;
}

export function gradePointFromMarks(marks) {
    const band = bandForMarks(marks);
    if (band.letter === 'F') return 0;
    return Math.min(40, band.baseTenths + (roundMarks(marks) - band.min)) / 10;
}

// Baseline grade point of a letter, or null for I/W/R and unknown input.
export function gradePointFromLetter(letter) {
    const band = GRADE_BANDS.find(b => b.letter === String(letter).trim().toUpperCase());
    return band ? band.baseTenths / 10 : null;
}

// Baseline marks for a letter, or null when the letter has none.
export function minMarksForLetter(letter) {
    if (letter === 'F') return F_DEFAULT_MARKS;
    const band = GRADE_BANDS.find(b => b.letter === letter);
    return band ? band.min : null;
}

// Classifies one course row. Values may be numbers or raw input strings.
//   empty      - nothing entered, ignored
//   incomplete - something is still missing, not counted yet
//   invalid    - a value is out of range, see errors
//   excluded   - I/W/R, left out of the calculation
//   ok         - counted, with credits, gradePoint and letter
export function evaluateCourse({ credits, marks, grade } = {}) {
    const creditsText = String(credits ?? '').trim();
    const marksText = String(marks ?? '').trim();
    const letter = String(grade ?? '').trim().toUpperCase();

    if (creditsText === '' && marksText === '' && letter === '') return { status: 'empty' };

    const errors = {};
    const creditsNum = Number(creditsText);
    const marksNum = Number(marksText);

    if (creditsText !== '' && !(Number.isFinite(creditsNum) && creditsNum > 0)) {
        errors.credits = 'credit hours must be greater than 0';
    }
    if (marksText !== '' && !(Number.isFinite(marksNum) && marksNum >= 0 && marksNum <= 100)) {
        errors.marks = 'marks must be between 0 and 100';
    }
    if (Object.keys(errors).length > 0) return { status: 'invalid', errors };

    if (marksText === '' && isSpecialGrade(letter)) return { status: 'excluded', letter };

    if (creditsText === '') return { status: 'incomplete', missing: 'credit hours' };

    if (marksText !== '') {
        return {
            status: 'ok',
            credits: creditsNum,
            gradePoint: gradePointFromMarks(marksNum),
            letter: letterFromMarks(marksNum)
        };
    }

    const gradePoint = gradePointFromLetter(letter);
    if (gradePoint === null) return { status: 'incomplete', missing: 'marks or a grade' };
    return { status: 'ok', credits: creditsNum, gradePoint, letter };
}
