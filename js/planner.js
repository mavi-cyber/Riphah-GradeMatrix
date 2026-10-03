// Forward-looking maths: targets, projections and what a final exam must deliver.
// Pure functions only. Grade bands come from grading.js and are not redefined here.

import { GRADE_BANDS } from './grading.js';

const MAX_GPA = 4;

// CGPA after taking `credits` more credit hours at an average of `gpa`.
export function projectCgpa(base, credits, gpa) {
    const totalCredits = base.credits + credits;
    return totalCredits > 0 ? (base.qualityPoints + credits * gpa) / totalCredits : 0;
}

// Average GPA needed over the remaining credits to finish on the target CGPA.
//   secured    - the target holds even with the lowest possible grades
//   possible   - reachable, see `required`
//   impossible - even straight 4.0s fall short, see `maxCgpa`
export function requiredGpa(base, targetCgpa, remainingCredits) {
    const required = (targetCgpa * (base.credits + remainingCredits) - base.qualityPoints) / remainingCredits;
    const maxCgpa = projectCgpa(base, remainingCredits, MAX_GPA);
    const minCgpa = projectCgpa(base, remainingCredits, 0);
    const status = required <= 0 ? 'secured' : required > MAX_GPA ? 'impossible' : 'possible';
    return { required, status, maxCgpa, minCgpa };
}

// For each passing grade, the marks needed in the final exam given the marks
// already secured. Totals are rounded half up before banding, so reaching
// half a mark below a band minimum is enough.
export function neededInFinal(securedMarks, finalMaxMarks) {
    return GRADE_BANDS
        .filter(band => band.letter !== 'F')
        .map(band => {
            const needed = Math.max(0, band.min - 0.5 - securedMarks);
            const status = needed === 0 ? 'secured' : needed > finalMaxMarks ? 'out-of-reach' : 'possible';
            return { letter: band.letter, minTotal: band.min, needed, status };
        });
}
