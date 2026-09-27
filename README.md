# Full Fledged Student Management ERP System

### Guru Tegh Bahadur Institute of Technology (GTBIT)
**Guru Gobind Singh Indraprastha University (GGSIPU), New Delhi**  
*Department of Computer Science & Engineering | Academic Session 2023–2027*

---

## 🎓 Project Synopsis & Credits

- **Degree**: Bachelor of Technology (B.Tech) in Computer Science & Engineering
- **Project Members**:
  - **Tejassveer Singh Vasant** (Enrollment / Roll No: `07113202723` / `071/CSE2/2023`)
  - **Dev Sharma** (Enrollment / Roll No: `60513202724` / `605/CSE2/2023`)
  - **Krishmeet Singh** (Enrollment / Roll No: `60713202724` / `607/CSE2/2023`)
  - **Hargun Kaur** (Enrollment / Roll No: `08313202723` / `083/CSE2/2023`)
- **Under the Guidance of**: **Ms. Basanti Pal Nandi**, Assistant Professor, CSE Dept.

---

## 🌟 Executive Overview

Educational institutions handle enormous volumes of academic and administrative data on a daily basis—ranging from admissions, course allocations, and daily attendance to internal evaluations, university examinations, fees collection, and placement drives. Conventional paper registers and disconnected spreadsheets suffer from high latency, data duplication, calculation discrepancies, and zero predictive visibility.

This **Full Fledged Student Management ERP System** digitizes and automates the entire academic and administrative lifecycle within a single, secure, role-governed web application.

Beyond standard institutional management features, this project incorporates two distinguishing flagship innovations:
1. **CGPA Probability Module (Core Innovation)**: A statistical prediction engine powered by a Python analytical service that estimates a student's probable semester CGPA *before* final results are declared. It models subject-wise historical difficulty indices, continuous internal assessments, and real-time attendance ratios, delivering an interactive **What-If Simulator** and early warning risk indicators.
2. **Smart Attendance Tracker (Enhanced Module)**: Real-time attendance percentage engine supporting dynamic QR-code session generation with live expiration timers, student mobile check-in simulation, 1-tap bulk faculty marking matrices, automated **<75% detention risk warning banners**, classes-needed recovery calculations, and compliance CSV export.

---

## 🏛️ System Architecture & Technology Stack

```
   ┌─────────────────────────────────────────────────────────────┐
   │                   React 19 + Vite Frontend                  │
   │      (Lucide Icons, Tailwind-compatible Glassmorphism,      │
   │           Canvas-Confetti, Responsive Dashboards)           │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ JSON REST APIs (JWT Bearer)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                  Node.js / Express Backend                  │
   │  (Role Authorization, Password Encryption, Route Handlers)   │
   └───────────────┬──────────────────────────────┬──────────────┘
                   │ SQL Queries                  │ Stdin JSON Pipe
                   ▼                              ▼
   ┌──────────────────────────────┐ ┌────────────────────────────┐
   │     Relational Database      │ │ Python Analytics Engine    │
   │  - SQLite (better-sqlite3)   │ │  (cgpa_engine.py:          │
   │    Active zero-config engine │ │   Difficulty Scoring,      │
   │  - MySQL 8.0 DDL provided    │ │   Regression, Confidence   │
   │    (mysql_schema.sql)        │ │   Interval Estimation)     │
   └──────────────────────────────┘ └────────────────────────────┘
```

- **Frontend**: React 19, Vite, Lucide React icons, Canvas-Confetti, Google Fonts (*Plus Jakarta Sans* and *JetBrains Mono*).
- **Backend**: Node.js v22, Express.js, JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), SQLite (`better-sqlite3`) in WAL mode with full foreign keys.
- **Predictive Engine**: Python 3 service (`python_service/cgpa_engine.py`) using weighted composite scoring and confidence band metrics, with seamless zero-latency fallback.
- **Enterprise Database DDL**: Comprehensive MySQL DDL script (`backend/mysql_schema.sql`) for production deployment on Render, Railway, AWS RDS, or cloud MySQL.

---

## 🚀 Key Modules & Feature Implementation Guide

The project covers all modules specified in Section 2 (A through N) of the official Project Synopsis and PPT:

### 1. User Authentication & Role Management (Section A)
- **Role-Based Access Control (RBAC)**: Distinct permissions and views for **Admin**, **Faculty**, **Student**, and **Parent**.
- **Security**: JWT-based session security with bcrypt hashed passwords.
- **Instant Persona Switcher**: Header bar allows reviewers to switch between Admin, Faculty, High-Performing Student, At-Risk Student, and Parent in one click.

### 2. Student Management (Section B)
- Complete directory with search, branch, and semester filters.
- Personal, academic, parent, and contact records.
- Detailed student profile modal displaying enrollment numbers, batch, CGPA, attendance %, and fee dues.
- New Student Admission Registration form with automated ID generation.

### 3. Faculty & Staff Management (Section C)
- Faculty profiles with qualifications, designation, and department.
- Weekly teaching workload hour counters and availability badges.
- Dynamic faculty-to-subject and faculty-to-class mapping.

### 4. Smart Attendance Tracker (Flagship Innovation — Section D)
- **Real-Time Attendance Engine**: Continuous computation of total, attended, and percentage figures.
- **75% Regulatory Threshold Monitor**: Proactive detention warnings when attendance dips below 75%.
- **Attendance Recovery Calculator**: Informs students exactly how many consecutive lectures they must attend to regain 75% eligibility.
- **Dynamic QR Code Session Generator**: Faculty can spin up a real-time QR code session with countdown timers.
- **Student Mobile QR Check-In**: Students can enter the active session token to instantly check in.
- **One-Tap Bulk Marking**: Faculty matrix to mark all students Present/Absent with one click.
- **Compliance Export**: One-click download of attendance registers in CSV format.

### 5. Academic & Course Management (Section E)
- Course, department, and semester catalog with credit allocations.
- Historical subject difficulty ratings.
- Interactive weekly timetable schedule (Monday through Friday) showing lecture slots, faculty assignments, and room numbers.

### 6. Examination & Result Management (Section F)
- Examination scheduling (Mid-Terms, End-Terms, Practicals) with date and maximum marks.
- Faculty Mark Entry dialog for internal assessments and end-term evaluations.
- **Official Statement of Grades (Report Card)**: University-formatted marksheet showing subject codes, credits, marks obtained, letter grades (O, A+, A, B+, B, C, F), semester SGPA, and cumulative CGPA.
- Print / Download PDF functionality.

### 7. CGPA Probability Module (Core Innovation — Section G)
- **Mathematical Formula**:
  $$\text{Difficulty Index} = 1.0 - \left(0.55 \times \frac{\text{Historical Avg Marks}}{100} + 0.45 \times \frac{\text{Historical Pass Rate}}{100}\right)$$
- Combines continuous internal assessment marks, subject difficulty weighting, and attendance multipliers.
- Calculates projected SGPA, projected CGPA, and a visual confidence band (e.g. 9.15 ± 0.28).
- **Interactive "What-If" Simulator**: Real-time slider allowing students to adjust hypothetical marks in difficult subjects (e.g., Theory of Computation, OS) to forecast the exact impact on their semester CGPA.
- Early warning flags for high-risk subjects.

### 8. Assignment & Academic Activities (Section H)
- Assignment creation with deadlines, maximum marks, and course linking.
- Student submission modal with notes and file attachment support.
- Faculty grading interface with score entry and pedagogical feedback.
- Centralized lecture notes and study material download repository.

### 9. Fees & Financial Management (Section I)
- Semester-wise fee breakdown (Tuition fee, Lab fees, University development fee).
- Pending dues tracker and payment status tracking.
- **"Redirect to Payment Page"**: Realistic payment gateway checkout modal supporting UPI (GPay/PhonePe), Credit/Debit Card, and Net Banking with instant mock processing and celebratory confetti.
- **Official Digital Fee Receipt**: Complete downloadable receipt with Transaction ID, timestamp, GSTIN, and student details.

### 10. Timetable, Notices & Campus Communication (Section J)
- Campus circulars and urgent notices categorized by Academic, Examination, Administrative, and Placement.
- Audience targeting (All Students, Faculty, Parents).
- Admin broadcasting modal with priority pinning.

### 11. Library & Hostel Management (Section K)
- **Library Catalog**: Searchable inventory of academic books, authors, call numbers, availability status, and automated fine calculation for overdue items.
- **Hostel Allocation**: Residential room occupancy tracking, hostel block assignments, and room facility status.

### 12. Placement & Internship Management (Training & Placement Cell — Section L)
- Corporate placement drives with visiting recruiters (Google, Microsoft, Zomato, Deloitte).
- Automated CGPA and backlog eligibility screening.
- 1-click student application process and status tracking.
- Department placement statistics (Highest CTC: ₹44.0 LPA, Average CTC: ₹11.2 LPA).

### 13. Additional Engagement Features (Section M)
- **Gamified Merit Leaderboard**: Academic ranking showcasing student points, badges (Dean's List, 100% Attendance Club, Research Star, Coding Prodigy).
- **Personalized Smart Study Planner**: Algorithmic study schedule generated based on identified weak subjects and low-attendance topics.
- **AI Career Compass**: Skill and career recommendation engine mapping academic performance to industry roles (e.g., Distributed Systems Engineer, AI/ML Researcher).

### 14. Role-Specific Dashboards (Section N)
- **Admin Dashboard**: System-wide statistics (student count, faculty count, fee collection totals, low-attendance alerts, quick management links).
- **Faculty Dashboard**: Class schedule, subjects taught, attendance pending alerts, assignment submission trackers.
- **Student Dashboard**: Quick CGPA cards, attendance meter, timetable preview, recent grades, and circulars.
- **Parent Dashboard**: Child's attendance overview, detention status alerts, examination performance, and pending fee status.

---

## 🔑 Pre-Seeded Demo Accounts & Credentials

You can test any role immediately using the 1-click quick-switch cards on the Login page, or login with these credentials:

| Role | Name | Email | Password | Notable Demo Scenario |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | System Administrator | `admin@gtbit.ac.in` | `Admin@123` | Institutional management, fee reports, system audits |
| **Faculty** | Ms. Basanti Pal Nandi | `basanti@gtbit.ac.in` | `Faculty@123` | Dynamic QR code sessions, bulk attendance, grading |
| **Student** | Tejassveer Singh Vasant | `tejassveer@gtbit.ac.in` | `Student@123` | High achiever (88.5% attendance, 9.15 CGPA), What-If simulator |
| **Student (At-Risk)** | Aman Gupta | `aman@gtbit.ac.in` | `Student@123` | **65.2% Attendance — Triggers <75% detention risk warning!** |
| **Parent** | Jaswinder Singh | `parent.tejassveer@gtbit.ac.in` | `Parent@123` | Parent monitoring view, child fee receipt and alerts |

---

## 💻 How to Run Locally

### Prerequisites
- Node.js v18 or higher (v22 tested)
- Python 3.8+ (for statistical CGPA analytics engine)
- Modern web browser (Chrome, Edge, Brave, Firefox)

### 1. Clone & Setup Backend
```bash
cd "Student Management ERP System/backend"
npm install
# To re-seed the SQLite database at any time:
node src/db/seed.js
# Start the backend API server (runs on port 5000):
npm run dev
```

### 2. Setup & Start Frontend
```bash
cd "Student Management ERP System/frontend"
npm install
# Start the Vite dev server (runs on port 3000):
npm run dev
```

### 3. Open the Application
Navigate in your browser to:
```
http://localhost:3000
```

---

## 🗄️ Relational Database Schema & MySQL Migration

The backend is configured with an active SQLite database (`backend/src/db/erp_system.db`) that runs out of the box with zero external configuration.

For cloud deployment using MySQL (AWS RDS, Render MySQL, Clever Cloud, etc.):
1. Import `backend/mysql_schema.sql` into your MySQL instance:
   ```bash
   mysql -u <username> -p <database_name> < backend/mysql_schema.sql
   ```
2. Configure `.env` in `backend/`:
   ```env
   PORT=5000
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=gtbit_erp
   JWT_SECRET=gtbit_erp_jwt_secret_key_2026
   ```

---

## 📸 Verification & Screenshots

All core modules have been validated end-to-end via automated browser subagents and manual QA. Browser video recordings and visual artifacts are archived in the IDE brain directory:
- **Demo Video Recording**: `gtbit_erp_demo_1790510421407.webp`
- **CGPA Probability What-If Engine**: `cgpa_probability_module_1790510589219.png`
- **Dynamic QR Code Attendance**: `qr_checkin_success_1790510824794.png`
- **Detention Risk Alert (<75% Threshold)**: `smart_attendance_tracker_risk_1790510966307.png`
- **Fees Payment & Digital Receipt**: `digital_fee_receipt_1790511075837.png`
- **Official Statement of Grades Report Card**: `examinations_report_card_1790511226524.png`

---

## 📚 References
1. Pressman, R. S., & Maxim, B. R. *Software Engineering: A Practitioner's Approach*. McGraw-Hill Education.
2. Elmasri, R., & Navathe, S. B. *Fundamentals of Database Systems*. Pearson.
3. Silberschatz, A., Korth, H. F., & Sudarshan, S. *Database System Concepts*. McGraw-Hill.
4. MDN Web Docs, *Web Development Documentation*. https://developer.mozilla.org/en-US/
5. W3Schools, *Web Development Tutorials and References*. https://www.w3schools.com/
6. Guru Tegh Bahadur Institute of Technology (GTBIT) / GGSIP University, New Delhi.
