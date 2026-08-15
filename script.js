let savedSemesters = JSON.parse(localStorage.getItem('rihu_semesters')) || [];

window.onload = function() {
    if(document.querySelectorAll('#courseRows tr').length === 0) {
        addCourseRow();
    }
    renderHistory();
    updatePreview();
};

function addCourseRow(name = '', credits = '', marksVal = '', gradeVal = '') {
    const tbody = document.getElementById('courseRows');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="c-name" placeholder="e.g. Cyber Security" value="${name}" oninput="triggerRecalculation()"></td>
        <td><input type="number" class="c-credits" min="1" max="6" placeholder="e.g. 3" value="${credits}" oninput="triggerRecalculation()"></td>
        <td><input type="number" class="c-marks" min="0" max="100" placeholder="0-100" value="${marksVal}" oninput="handleMarksInput(this)"></td>
        <td>
            <select class="c-grade" onchange="handleGradeInput(this)">
                <option value="">Select Grade</option>
                <option value="A+" ${gradeVal === 'A+' ? 'selected' : ''}>A+ (4.0)</option>
                <option value="A" ${gradeVal === 'A' ? 'selected' : ''}>A (4.0)</option>
                <option value="A-" ${gradeVal === 'A-' ? 'selected' : ''}>A- (3.8 - 3.9)</option>
                <option value="B+" ${gradeVal === 'B+' ? 'selected' : ''}>B+ (3.4 - 3.7)</option>
                <option value="B" ${gradeVal === 'B' ? 'selected' : ''}>B (3.0 - 3.3)</option>
                <option value="B-" ${gradeVal === 'B-' ? 'selected' : ''}>B- (2.8 - 2.9)</option>
                <option value="C+" ${gradeVal === 'C+' ? 'selected' : ''}>C+ (2.4 - 2.7)</option>
                <option value="C" ${gradeVal === 'C' ? 'selected' : ''}>C (2.0 - 2.3)</option>
                <option value="C-" ${gradeVal === 'C-' ? 'selected' : ''}>C- (1.8 - 1.9)</option>
                <option value="D+" ${gradeVal === 'D+' ? 'selected' : ''}>D+ (1.4 - 1.7)</option>
                <option value="D" ${gradeVal === 'D' ? 'selected' : ''}>D (1.0 - 1.3)</option>
                <option value="F" ${gradeVal === 'F' ? 'selected' : ''}>F (0.0)</option>
                <option value="I" ${gradeVal === 'I' ? 'selected' : ''}>I (Incomplete)</option>
                <option value="W" ${gradeVal === 'W' ? 'selected' : ''}>W (Withdrawal)</option>
                <option value="R" ${gradeVal === 'R' ? 'selected' : ''}>R (Replaced)</option>
            </select>
        </td>
        <td class="no-print"><button class="btn btn-danger" onclick="removeCourseRow(this)">Remove</button></td>
    `;
    tbody.appendChild(row);
    triggerRecalculation();
}

function removeCourseRow(btn) {
    btn.closest('tr').remove();
    triggerRecalculation();
}

// Two-way autofill: Marks -> Grade
function handleMarksInput(marksInput) {
    const row = marksInput.closest('tr');
    const gradeSelect = row.querySelector('.c-grade');
    const marksVal = marksInput.value.trim();

    if (marksVal === '') {
        gradeSelect.value = '';
        triggerRecalculation();
        return;
    }

    const marks = parseFloat(marksVal);
    if (!isNaN(marks) && marks >= 0 && marks <= 100) {
        if (marks >= 90) gradeSelect.value = 'A+';
        else if (marks >= 80) gradeSelect.value = 'A';
        else if (marks >= 78) gradeSelect.value = 'A-';
        else if (marks >= 74) gradeSelect.value = 'B+';
        else if (marks >= 70) gradeSelect.value = 'B';
        else if (marks >= 68) gradeSelect.value = 'B-';
        else if (marks >= 64) gradeSelect.value = 'C+';
        else if (marks >= 60) gradeSelect.value = 'C';
        else if (marks >= 58) gradeSelect.value = 'C-';
        else if (marks >= 54) gradeSelect.value = 'D+';
        else if (marks >= 50) gradeSelect.value = 'D';
        else gradeSelect.value = 'F';
    }
    triggerRecalculation();
}

// Two-way autofill: Grade -> Approximate/Baseline Marks
function handleGradeInput(gradeSelect) {
    const row = gradeSelect.closest('tr');
    const marksInput = row.querySelector('.c-marks');
    const grade = gradeSelect.value;

    const gradeToMarksMap = {
        'A+': 90, 'A': 80, 'A-': 78, 'B+': 74, 'B': 70,
        'B-': 68, 'C+': 64, 'C': 60, 'C-': 58, 'D+': 54,
        'D': 50, 'F': 40
    };

    if (gradeToMarksMap[grade] !== undefined) {
        marksInput.value = gradeToMarksMap[grade];
    } else {
        marksInput.value = '';
    }
    triggerRecalculation();
}

function clearCurrentSemester() {
    document.getElementById('currentSemTitle').value = '';
    document.getElementById('courseRows').innerHTML = '';
    addCourseRow();
    triggerRecalculation();
}

function getGradePointFromGrade(gradeStr) {
    const cleanGrade = gradeStr.trim().toUpperCase();
    switch (cleanGrade) {
        case 'A+': case 'A': return 4.0;
        case 'A-': return 3.8;
        case 'B+': return 3.4;
        case 'B': return 3.0;
        case 'B-': return 2.8;
        case 'C+': return 2.4;
        case 'C': return 2.0;
        case 'C-': return 1.8;
        case 'D+': return 1.4;
        case 'D': return 1.0;
        case 'F': return 0.0;
        case 'I': case 'W': case 'R': return null;
        default: return null;
    }
}

function getGradePointFromMarks(marks) {
    let integerMarks = Math.floor(marks);
    let decimalPart = marks - integerMarks;
    let roundedMarks = decimalPart >= 0.5 ? Math.ceil(marks) : Math.floor(marks);

    if (roundedMarks < 50) return 0.0; 
    if (roundedMarks >= 90) return 4.0; 

    let baseGP, baseMark;
    if (roundedMarks >= 80) { baseGP = 4.0; baseMark = 80; }
    else if (roundedMarks >= 78) { baseGP = 3.8; baseMark = 78; }
    else if (roundedMarks >= 74) { baseGP = 3.4; baseMark = 74; }
    else if (roundedMarks >= 70) { baseGP = 3.0; baseMark = 70; }
    else if (roundedMarks >= 68) { baseGP = 2.8; baseMark = 68; }
    else if (roundedMarks >= 64) { baseGP = 2.4; baseMark = 64; }
    else if (roundedMarks >= 60) { baseGP = 2.0; baseMark = 60; }
    else if (roundedMarks >= 58) { baseGP = 1.8; baseMark = 58; }
    else if (roundedMarks >= 54) { baseGP = 1.4; baseMark = 54; }
    else if (roundedMarks >= 50) { baseGP = 1.0; baseMark = 50; }

    let calculatedGP = baseGP + (0.1 * (roundedMarks - baseMark));
    return Math.min(calculatedGP, 4.0);
}

function computeCurrentSemesterData() {
    const rows = document.querySelectorAll('#courseRows tr');
    let totalQualityPoints = 0;
    let totalCredits = 0;
    let validCoursesCount = 0;

    rows.forEach(row => {
        const creditsInput = row.querySelector('.c-credits');
        const marksInput = row.querySelector('.c-marks');
        const gradeSelect = row.querySelector('.c-grade');
        
        const creditsVal = creditsInput.value.trim();
        const marksVal = marksInput.value.trim();
        const gradeVal = gradeSelect.value;

        if (creditsVal === '' && marksVal === '' && gradeVal === '') return;

        const credits = parseFloat(creditsVal);
        if (isNaN(credits) || credits <= 0) return;

        let gp = null;
        if (marksVal !== '') {
            let marks = parseFloat(marksVal);
            if (marks < 0 || marks > 100) return;
            gp = getGradePointFromMarks(marks);
        } else if (gradeVal !== '') {
            gp = getGradePointFromGrade(gradeVal);
            if (gp === null) return;
        } else {
            return;
        }

        totalQualityPoints += credits * gp;
        totalCredits += credits;
        validCoursesCount++;
    });

    let sgpa = totalCredits > 0 ? (totalQualityPoints / totalCredits) : 0.00;
    return { sgpa, totalCredits, totalQualityPoints, validCoursesCount };
}

function triggerRecalculation() {
    const currentSem = computeCurrentSemesterData();
    const semTitle = document.getElementById('currentSemTitle').value.trim() || "Active Semester";

    document.getElementById('sgpaDisplay').innerText = currentSem.sgpa.toFixed(2);
    document.getElementById('qpDisplay').innerText = currentSem.totalQualityPoints.toFixed(2);

    let cumulativeQP = currentSem.totalQualityPoints;
    let cumulativeCredits = currentSem.totalCredits;

    savedSemesters.forEach(sem => {
        cumulativeQP += sem.qualityPoints;
        cumulativeCredits += sem.credits;
    });

    let overallCgpa = cumulativeCredits > 0 ? (cumulativeQP / cumulativeCredits) : 0.00;
    document.getElementById('cgpaDisplay').innerText = overallCgpa.toFixed(2);
    document.getElementById('totalCreditsDisplay').innerText = cumulativeCredits;

    renderPreviewTranscript(currentSem, semTitle, overallCgpa);
}

function saveCurrentSemesterToHistory() {
    const currentSem = computeCurrentSemesterData();
    const semTitleInput = document.getElementById('currentSemTitle');
    const name = semTitleInput.value.trim() || "Active Semester";

    if (currentSem.validCoursesCount === 0 || currentSem.totalCredits <= 0) {
        showAlert("No Courses", "Please add at least one valid course with credits and marks/grades before saving.", "error");
        return;
    }

    let isDuplicate = savedSemesters.some(sem => sem.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        showAlert("Duplicate Semester", `A semester with the name "${name}" already exists in your history.`, "error");
        return;
    }

    savedSemesters.push({
        name: name,
        credits: currentSem.totalCredits,
        qualityPoints: currentSem.totalQualityPoints,
        sgpa: currentSem.sgpa
    });

    localStorage.setItem('rihu_semesters', JSON.stringify(savedSemesters));
    renderHistory();
    clearCurrentSemester();
    showAlert("Semester Saved", `"${name}" has been successfully added to your Cumulative Record!`, "success");
}

function addManualSemester() {
    let nameInput = document.getElementById('pastSemName');
    let creditsInput = document.getElementById('pastSemCredits');
    let gpaInput = document.getElementById('pastSemGpa');

    let name = nameInput.value.trim();
    if (name === '') {
        showAlert("Semester Name Required", "Please provide a semester name for your manual entry.", "error");
        return;
    }

    let credits = parseFloat(creditsInput.value);
    let sgpa = parseFloat(gpaInput.value);

    let isDuplicate = savedSemesters.some(sem => sem.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        showAlert("Duplicate Semester", `A semester with the name "${name}" already exists.`, "error");
        return;
    }

    if (isNaN(credits) || credits <= 0 || isNaN(sgpa) || sgpa < 0 || sgpa > 4.0) {
        showAlert("Invalid Input", "Please enter valid total credits and SGPA (0-4.0).", "error");
        return;
    }

    savedSemesters.push({
        name: name,
        credits: credits,
        qualityPoints: credits * sgpa,
        sgpa: sgpa
    });

    localStorage.setItem('rihu_semesters', JSON.stringify(savedSemesters));
    renderHistory();
    triggerRecalculation();

    nameInput.value = '';
    creditsInput.value = '';
    gpaInput.value = '';
}

function renderHistory() {
    const historyRows = document.getElementById('historyRows');
    historyRows.innerHTML = '';

    if (savedSemesters.length === 0) {
        historyRows.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted);">No semesters added yet.</td></tr>`;
        return;
    }

    savedSemesters.forEach((sem, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${sem.name}</td>
            <td>${sem.credits}</td>
            <td>${sem.sgpa.toFixed(2)}</td>
            <td class="no-print"><button class="btn btn-danger" onclick="deleteSemester(${index})">Delete</button></td>
        `;
        historyRows.appendChild(tr);
    });
}

function renderPreviewTranscript(currentSem, semTitle, overallCgpa) {
    const printRows = document.getElementById('printTranscriptRows');
    printRows.innerHTML = '';

    let hasRows = false;

    savedSemesters.forEach(sem => {
        hasRows = true;
        const ptr = document.createElement('tr');
        ptr.innerHTML = `<td>${sem.name}</td><td>${sem.credits}</td><td>${sem.sgpa.toFixed(2)}</td>`;
        printRows.appendChild(ptr);
    });

    if (currentSem.validCoursesCount > 0) {
        hasRows = true;
        const currentPtr = document.createElement('tr');
        currentPtr.innerHTML = `<td>${semTitle} (Active)</td><td>${currentSem.totalCredits}</td><td>${currentSem.sgpa.toFixed(2)}</td>`;
        printRows.appendChild(currentPtr);
    }

    if (!hasRows) {
        printRows.innerHTML = `<tr><td colspan="3" style="color: var(--text-muted);">No records recorded.</td></tr>`;
    }

    document.getElementById('badgeLabel').innerText = 'Cumulative CGPA';
    document.getElementById('prevCgpa').innerText = overallCgpa.toFixed(2);
    updatePreviewFields();
}

function deleteSemester(index) {
    savedSemesters.splice(index, 1);
    localStorage.setItem('rihu_semesters', JSON.stringify(savedSemesters));
    renderHistory();
    triggerRecalculation();
}

function resetAllData() {
    showConfirm(
        "Confirm Reset", 
        "Are you sure you want to clear all saved semester history?", 
        function() {
            localStorage.removeItem('rihu_semesters');
            savedSemesters = [];
            renderHistory();
            clearCurrentSemester();
            showAlert("Reset Complete", "All saved records have been cleared.", "success");
        }
    );
}

function updatePreview() {
    updatePreviewFields();
}

function updatePreviewFields() {
    const name = document.getElementById('studentName').value.trim();
    const sap = document.getElementById('studentSap').value.trim();
    const program = document.getElementById('studentProgram').value.trim();

    document.getElementById('prevName').innerText = name !== '' ? name : 'Not Provided';
    document.getElementById('prevSap').innerText = sap !== '' ? sap : 'Not Provided';
    document.getElementById('prevProgram').innerText = program !== '' ? program : 'Not Provided';
}

function generatePDF() {
    window.print();
}

function showAlert(title, message, type = 'success') {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    
    const iconEl = document.getElementById('modalIcon');
    if (type === 'error') {
        iconEl.className = 'modal-icon error-icon';
        iconEl.innerHTML = '&#33;';
    } else {
        iconEl.className = 'modal-icon success-icon';
        iconEl.innerHTML = '&#10003;';
    }

    document.getElementById('modalButtons').innerHTML = `<button class="btn" onclick="closeModal()">OK</button>`;
    document.getElementById('customModal').style.display = 'flex';
}

function showConfirm(title, message, onConfirmCallback) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    
    const iconEl = document.getElementById('modalIcon');
    iconEl.className = 'modal-icon error-icon';
    iconEl.innerHTML = '?';

    document.getElementById('modalButtons').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="modalConfirmBtn" style="margin-top:0;">Confirm</button>
    `;
    
    document.getElementById('customModal').style.display = 'flex';
    document.getElementById('modalConfirmBtn').onclick = function() {
        closeModal();
        onConfirmCallback();
    };
}

function closeModal() {
    document.getElementById('customModal').style.display = 'none';
}