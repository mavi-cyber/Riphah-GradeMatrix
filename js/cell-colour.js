// How a grade point maps to a cell's colour. Shared by the matrix and the policy page.

const MAX_GPA = 4;

// Colour strength for a grade point, as a share of the ramp. Squared so that the
// top of the scale, where most grades sit, is spread over more of the ramp.
export function strength(gradePoint) {
    return Math.max(8, 100 * ((gradePoint - 1) / (MAX_GPA - 1)) ** 2);
}

// Text colour class that stays readable on that strength of background.
export function inkClass(gradePoint) {
    const p = strength(gradePoint);
    return p >= 64 ? 'cell-hi' : p >= 45 ? 'cell-mid' : 'cell-low';
}
