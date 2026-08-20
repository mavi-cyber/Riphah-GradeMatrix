# Riphah GradeMatrix

An independent, client-side SGPA and CGPA calculation system designed for university students to seamlessly track academic performance, semester grades, and credit hours in accordance with **Riphah International University (RIU)** academic regulations.

---

## Key Features
* **Current Semester SGPA Calculator**: Dynamically add courses, credit hours, and marks or letter grades. Includes automatic two-way synchronization between numeric marks and grade point equivalents.
* **Cumulative CGPA Tracker**: Easily track past and active semester records with persistent local storage (`localStorage`). Save active semester courses directly into your cumulative history with a single click.
* **Live Report Preview & PDF Export**: Fill out student details (Name, SAP ID, Program) to instantly generate a printable academic grade report form and export it as a PDF.
* **Institutional Grading Standards**: Integrated reference guide for RIU grading policy (from 90+ A+ down to F, including special grades like I, W, and R).
* **Responsive Dark-Themed UI**: Clean, modern dark mode layout tailored for readability across desktop and mobile devices.
---

## Tech Stack
* **Frontend**: HTML5, CSS3 (Custom Properties / Flexbox / Grid)
* **Scripting**: Vanilla JavaScript (ES6+) with Web Storage API (`localStorage`)
* **Styling**: Responsive dark-mode layout optimized for web and print media queries
---

## Project Structure
```text
Riphah-GradeMatrix/
├── index.html       # Main SGPA & CGPA Calculator interface
├── about.html       # RIU Grading System & Student Handbook download view
├── style.css        # Comprehensive dark-mode stylesheet & print media styling
├── script.js        # Core calculation logic, grade mapping, and storage management
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
