<p align="center">
  <img src="assets/imgs/logo.svg" width="120" alt="Riphah GradeMatrix logo">
</p>

# Riphah GradeMatrix

An independent, client-side SGPA and CGPA calculation system designed for university students to seamlessly track academic performance, semester grades, and credit hours in accordance with **Riphah International University (RIU)** academic regulations.

---

## Key Features
**The Matrix**
* **Your degree as one grid**: Every semester is a column and every course is a cell. A taller cell means more credit hours and a stronger colour means a higher grade, so the picture shows at a glance where your CGPA comes from.
* **Tap to edit**: Tap a cell to name the course, pick its credit hours, slide the marks or tap a letter grade. The cell recolours and the CGPA counts up or down as you go. Everything saves automatically.
* **Paint brush**: Load a grade on the brush and tap cells to paint them, or tap + to drop in painted courses. Handy for sketching a future semester in seconds.
* **Sandbox**: Try anything without touching your saved records, then keep or discard it.
* **Retakes by the rulebook**: Link a course to the earlier D, F or W it repeats and a thread joins the two cells. A higher or equal retake turns the old grade into R; a lower one is recorded as W and the old grade stays. Earlier semesters' figures are never rewritten.
* **Standing and honours**: Each semester is checked for probation, relegation, the Dean's List and the Vice Chancellor's List, and flagged on its column.
* **Summer sessions, non-credit and transferred courses**: Marked as such and kept out of the GPA where the regulations say so.
* **Totals-only semesters**: For a past semester where you only know the credits and SGPA.

**Tools**
* **Insights**: SGPA and running CGPA charted by semester, a grade distribution chart, and highlights.
* **Plan**: The average you need from here on to reach a target CGPA, and a final exam calculator showing the marks needed for each grade.
* **Report**: A full transcript PDF with every semester and its courses, credits, marks, grades, grade points and quality points. Also backup and restore of your records as a file.

**Rules followed**

The calculations follow the RIU Academic Regulations for Undergraduate Programs, 5th Revision 2024 (version 2.1), which apply from the Fall 2023 intake: the grade table, marks rounding, the SGPA and CGPA formulas, W, I, F and R, repeating courses, academic deficiency, semester honours and credit hour limits.

**Throughout**
* **Institutional Grading Standards**: Integrated reference guide for RIU grading policy (from 90+ A+ down to F, including special grades like I, W, and R).
* **Light and Dark Themes**: Follows your system theme, with a toggle in the header.
---

## Tech Stack
* **Frontend**: HTML5, CSS3 (Custom Properties / Flexbox / Grid)
* **Scripting**: Vanilla JavaScript (ES modules, no build step) with Web Storage API (`localStorage`)
* **Testing**: Node.js built-in test runner (`node --test`)
* **Styling**: Responsive light and dark themes built on CSS custom properties, with print styles for the report
---

## Project Structure
```text
Riphah-GradeMatrix/
├── index.html       # Main SGPA & CGPA Calculator interface
├── about.html       # Grading policy: the scale, a try-it slider, and how SGPA/CGPA are worked out
├── style.css        # Theme tokens, layout, and print styling
├── js/
│   ├── app.js             # Entry point: state, headline number, tool panels
│   ├── grading.js         # RIU grade table: marks to letter and grade points (no DOM)
│   ├── transcript.js      # SGPA, CGPA, retakes (R and W), standing, honours, load limits (no DOM)
│   ├── planner.js         # Target CGPA and final exam maths (no DOM)
│   ├── storage.js         # Saved state, validation, migration, backup files
│   ├── matrix-view.js     # The grid of cells, the cell editor and the paint brush
│   ├── insights-view.js   # Charts and highlights
│   ├── planner-view.js    # Target CGPA and final exam screens
│   ├── report-view.js     # Transcript, student details, backup
│   ├── policy.js          # Policy page: scale drawn as cells, marks slider
│   ├── cell-colour.js     # Grade point to cell colour, shared by matrix and policy page
│   ├── dom.js             # Small DOM helpers
│   ├── modal.js           # Confirm dialog
│   ├── toast.js           # Short messages with optional Undo
│   └── theme.js           # Light/dark theme toggle
├── tests/           # Unit tests for grading, transcript, planner and storage
├── package.json     # Marks the project as ES modules and defines `npm test`
└── assets/
    ├── imgs/        # Logo and favicons
    └── btns/        # UI icons (e.g., GitHub pill link)

```
---

## Getting Started
To run or inspect the project locally, follow these steps:
1. **Clone the repository**:
```bash
git clone https://github.com/mavi-cyber/Riphah-GradeMatrix.git
```
2. **Navigate to the project directory**:
```bash
cd Riphah-GradeMatrix
```

3. **Run locally using Live Server**:
* Open the project folder in **Visual Studio Code**.
* Install the **Live Server** extension by **Ritwick Dey** from the VS Code Extensions marketplace (if not already installed).
* Right-click on `index.html` in the Explorer sidebar and select **"Open with Live Server"** to launch the application locally with live reload capabilities.
* The scripts are ES modules, so the page must be served over HTTP. Opening `index.html` directly from disk (`file://`) will not run them.

4. **Run the tests** (requires Node.js 20 or newer):
```bash
npm test
```
---

## Contributing
Contributions, feature requests, and bug reports are welcome! If you would like to contribute to Riphah GradeMatrix:
1. Fork the Project Repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.
---

## Licensing
Distributed under the **GNU General Public License v3.0 (GPLv3)**. See [LICENSE](LICENSE) or repository settings for more information.

---

## View Live Site
Access the [live web application](https://mavi-cyber.github.io/Riphah-GradeMatrix/) deployed via GitHub Pages

---

## Disclaimer
*Riphah GradeMatrix* is an independent student estimation tool designed to assist with tracking SGPA and CGPA based on **Riphah International University (RIU)** policies. For official academic records, transcripts, and credit mapping, always consult the University Student Services Department.

---

## Author & Credits
Developed by **Mavi** <br>
GitHub: [@mavi-cyber](https://github.com/mavi-cyber/Riphah-GradeMatrix)
