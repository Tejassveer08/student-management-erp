# Full Fledged Student Management ERP System

### Guru Tegh Bahadur Institute of Technology (GTBIT)
**Guru Gobind Singh Indraprastha University (GGSIPU), New Delhi**  
*B.Tech (CSE, IT, ECE, AI-ML, AI-DS) | Academic Session 2023–2027*

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

Educational institutions handle enormous volumes of academic and administrative data on a daily basis—ranging from admissions, course allocations, and daily attendance to internal evaluations, university examinations, fees collection, societies, campus forums, and placement drives. Conventional paper registers and disconnected spreadsheets suffer from high latency, data duplication, calculation discrepancies, and zero predictive visibility.

This **Full Fledged Student Management ERP System** digitizes and automates the entire academic and administrative lifecycle within a single, secure, role-governed web application backed by **MongoDB Atlas**.

Flagship innovations include:
1. **CGPA Probability Module (Core Innovation)**: A statistical prediction engine powered by a Python analytical service that estimates a student's probable semester CGPA *before* final results are declared. It models subject-wise historical difficulty indices, continuous internal assessments, and real-time attendance ratios, delivering an interactive **What-If Simulator** and early-warning risk indicators.
2. **Smart Attendance Tracker (Enhanced Module)**: Real-time attendance engine supporting dynamic QR-code session generation with live expiration timers, student mobile check-in, section-wise 1-tap bulk faculty marking (`CSE-1..3`, `CSE-E1..E2`, `IT-1..3`, `ECE-1..3`, `AIML-1..2`, `AIDS-1..2`), automated **<75% detention risk alerts**, live Admin **Early-Warning Risk Cohort**, classes-needed recovery calculations, Society Duty Attendance credit, and CSV export.

---

## 🏛️ System Architecture & Technology Stack

```
   ┌─────────────────────────────────────────────────────────────┐
   │                   React 19 + Vite Frontend                  │
   │   ("Aurora" design system, Lucide, Recharts, QR codes,      │
   │    ⌘K command palette, role dashboards, light/dark theme)   │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ JSON REST APIs (JWT Bearer)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                  Node.js / Express Backend                  │
   │   (RBAC Middleware, Bcrypt Auth, Mongoose ODM, Groq AI)     │
   └───────────────┬──────────────────────────────┬──────────────┘
                   │ Mongoose / TLS               │ Stdin JSON Pipe
                   ▼                              ▼
   ┌──────────────────────────────┐ ┌────────────────────────────┐
   │        MongoDB Atlas         │ │ Python Analytics Engine    │
   │  - Cluster0 Cloud Database   │ │  (cgpa_engine.py:          │
   │  - 929 Users / 905 Students  │ │   Difficulty Scoring,      │
   │  - 20 Faculty across 5 Depts │ │   Regression, Confidence   │
   │  - 27k+ Attendance & Marks   │ │   Interval Estimation)     │
   └──────────────────────────────┘ └────────────────────────────┘
```

- **Frontend**: React 19, Vite, Lucide React icons, Recharts, `qrcode` (scannable attendance QR), Canvas-Confetti, Google Fonts (*Bricolage Grotesque*, *Plus Jakarta Sans* and *JetBrains Mono*). The "Aurora" design system (cool porcelain surfaces, an indigo-to-violet brand gradient with lime and rose signal colours, rounded cards, pill controls and a frosted floating dock) lives in `src/index.css` and `src/components/ui`. Navigation is a floating dock with a full-screen module launcher; floating drawers replace modals; every module is lazy-loaded and deep-linkable (`#/attendance`, `#/cgpa-simulator`, …), with a ⌘K / Ctrl+K command palette.
- **Backend**: Node.js, Express.js, JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Mongoose ODM (`mongodb` / MongoDB Atlas), optional Groq AI integration (`GROQ_API_KEY`).
- **Predictive Engine**: Python 3 service (`python_service/cgpa_engine.py`) run as one long-lived worker that scores batches of students over newline-delimited JSON. An identical JavaScript model takes over automatically if Python isn't installed (or set `CGPA_ENGINE=js`). Both read the live Governance policy: attendance threshold, grading scale and model weights.

---

## 📊 Seeded Institutional Scale (MongoDB Atlas)

The database (`backend/src/db/seed.js`) provisions a realistic, full-campus dataset:

| Entity | Count | Details |
| :--- | :--- | :--- |
| **Users** | **929** | 1 Admin, 20 Faculty, 3 Parents, 905 Students (every user has individual login credentials) |
| **Departments & Courses** | **5** | **CSE**, **IT**, **ECE**, **AI-ML**, **AI-DS** |
| **Students** | **905** | 5 core demo students + 900 uniquely named students across 15 sections (`CSE-1..3`, `CSE-E1..E2`, `IT-1..3`, `ECE-1..3`, `AIML-1..2`, `AIDS-1..2`) and Semesters 1–6 |
| **Faculty** | **20** | 4 faculty per department across CSE, IT, ECE, AI-ML, AI-DS with employee IDs, designations, subjects, timetables, assignments, and notes |
| **Subjects** | **49** | Core Semester 1–6 subjects + 17 department-specific subjects |
| **Exam Marks** | **27,150** | Individual randomized marks for all 905 students across all **6 semesters (Semesters 1–6)** |
| **Attendance Records** | **27,150** | Randomized attendance across all 905 students and all 6 semesters (`55%`–`98%`) |
| **Fee Structures** | **30** | Semester-wise fee structures for **Semesters 1–6** across all **5 B.Tech courses** + 905 payment records |
| **GTBIT Societies** | **29** | Official campus technical, cultural, and entrepreneurial societies + duty attendance requests |
| **Forum Threads & Posts** | **12 / 18** | Subject doubts, society inquiries, and general placement/exam discussions |
| **Library Books & Issues** | **20 / 32** | Textbooks across CSE, AI-ML, Data Science, ECE, Cybersecurity + issue/overdue records |
| **Placement Drives** | **12** | Department-targeted opportunities across CSE, IT, ECE, AI-ML, and AI-DS + 29 applications |
| **Bulletin Notices** | **10** | Circulars across all departments (`Urgent`, `Academic`, `Placement`, `Event`) |

---

## 🚀 Key Modules & Feature Implementation Guide

### 1. User Authentication & Role Management
- **Strict Manual Sign-In**: No quick sign-in or auto-login; every user enters their identifier and password.
- **Flexible Identifier Login**: Supports **Email** (`admin@gtbit.ac.in`), **Student Roll No** (`071/CSE2/2023`, `001/CSE-M/2025`), **Enrollment No**, or **Faculty Employee ID** (`FAC-CSE-001`, `FAC-IT-001`).
- **Role-Based Access Control (RBAC)**: Distinct permissions and views for **Admin**, **Faculty**, **Student**, and **Parent**. Every record-level read goes through one scoping rule: students see only themselves, parents only linked wards, faculty only the sections they teach.
- **Account security**: Login is rate-limited (8 failed attempts lock an ID for 15 minutes). Users change their own password from the account menu; admins can issue an audited temporary password from a student's record. There are no public reset or role-switch endpoints.

### 2. Student & Faculty Management
- **Student Directory**: Search and filter all 905 students by **Semester (All Semesters / Sem 1–6)** and **Section (`CSE-1..3`, `CSE-E1..E2`, `IT-1..3`, `ECE-1..3`, `AIML-1..2`, `AIDS-1..2`)**.
- **Admissions**: Admitting a student (one at a time or by CSV batch) creates their login with a unique temporary password and raises this semester's fee invoice. Optionally it also creates a linked guardian login for the parent portal.
- **Faculty Directory**: 20 faculty across all 5 departments with qualifications, designations, office rooms, workload hours, and `FacultyClassMap` subject/section allocations.

### 3. Smart Attendance Tracker & Early-Warning Risk Cohort
- **Rotating QR Roll Call**: Faculty open a timed roll call. The QR (and the short code under it, e.g. `183-7F3K2A`) changes every 30 seconds, so a shared screenshot quickly stops working. Scanning with a phone camera opens the portal and checks the student in. Students can only check in to their own section, and check-ins appear on the faculty roster live.
- **Attendance alerts**: When a student falls under the threshold in a subject, they and their guardian get an in-app alert saying how many consecutive classes they need to recover.
- **Section-Wise One-Tap Roll Call**: Switch between all 15 sections (`CSE-1` through `AIDS-2`) to mark attendance.
- **Live Early-Warning Risk Cohort**: Admin dashboard dynamically lists all students falling below the `75%` attendance threshold, sorted by lowest attendance percentage.

### 4. Examinations, 6-Semester Marksheets & CGPA Probability
- **Semester 1–6 Marksheet Selector**: View individual semester marks, letter grades (`O`, `A+`, `A`, `B+`, `B`, `C`, `P`, `F`), credits, and SGPA, choosing between the mid-term and end-term statements of each semester.
- **Result declaration**: Students and parents only see marks once results are declared. Publishing end-term results recomputes each student's CGPA and earned credits from the official grading scale, and notifies students and guardians.
- **Faculty Marks Entry**: Scoped via `FacultyClassMap` (subject *and* section) with range checks (25 / 15 / 60). Once results are declared, only the examination cell can moderate marks, and every change is written to the audit trail.
- **CGPA Probability & What-If Simulator**: Projects semester SGPA/CGPA using historical difficulty, internal scores, and attendance.

### 5. Timetable, Assignments & Study Notes
- **Multi-Section Weekly Timetable**: Monday–Friday lecture and lab slots across all sections and department faculty.
- **Assignments & Study Materials**: Real file uploads (PDF, Office, ZIP, images, code; up to 15 MB) for submissions, assignment briefs and lecture notes, stored in `backend/uploads/`. Students only see their own programme's work. Grading is validated against max marks. New assignments, new notes and grades notify the right students.

### 6. Semester-Wise Fees & Digital Receipts
- **30 Semester-Wise Fee Structures**: Breakdown of Tuition, Lab & Development, Exam, and Library/Sports fees for Semesters 1–6 across all 5 B.Tech courses.
- **Ledger, fines & receipts**: Invoices turn Overdue after the due date and accrue the `late_fee_per_day` fine (capped at 20%) unless accounts waives it. Part payments are supported, receipt numbers are sequential, a paid invoice can't be paid twice, and every payment is logged.
- **Payments**: The accounts office records counter payments (cash, cheque/DD, UPI, NEFT) with their reference numbers. No online payment gateway is connected yet, so guardian "Pay" records the payment against the reference they enter.

### 7. GTBIT Societies, Campus Forum, Library, Placements & Notices
- **29 GTBIT Societies**: Membership applications and **Society Duty Attendance** requests reviewed by subject faculty.
- **Campus Doubt Forum**: Threaded discussions across Subjects, Societies, and General topics with faculty-verified answers and optional Groq AI support.
- **Library & Hostel**: Atomic issue/return with stock checks, a 4-book limit, ₹5/day overdue fines and a campus-wide circulation desk. Hostel allocation keeps occupancy in sync when students move or vacate, and only admins see occupant names.
- **Department-Specific Placements**: 12 drives (Google, Microsoft, Zomato, Atlassian, Adobe, Razorpay, Qualcomm, Texas Instruments, NVIDIA, Databricks, Fractal Analytics, Jio Platforms AI Lab).
  - Eligibility and deadlines are enforced.
  - The TnP admin moves each applicant through Applied → Shortlisted → Interviewing → Selected / Not selected, and students are notified at each step.
  - Season stats come from real offers.
- **Merit leaderboard & planner**: Merit points and badges are computed from live CGPA, attendance, coursework and society roles. The study planner sets weekly hours per subject from the student's attendance, internal marks and subject difficulty, explains why, and resets each Monday.
- **Notices Bulletin**: Each role only sees notices addressed to it. Urgent or pinned notices also go out as alerts, and faculty can delete only their own posts.
- **Governance**: Edits to the attendance threshold, grading scale, late fee and CGPA weights are validated, audited and take effect everywhere within seconds. Changing the grading scale re-grades stored marks and recomputes CGPAs.

---

## 🔑 Pre-Seeded Login Credentials

All 929 accounts can sign in using their **Email**, **Roll No / Enrollment No** (students), or **Employee ID** (faculty):

| Role | Name / Cohort | Login ID / Email | Password |
| :--- | :--- | :--- | :--- |
| **Admin** | Prof. Basanti Pal Nandi (Dean Academics) | `admin@gtbit.ac.in` | `admin123` |
| **Faculty (CSE)** | Ms. Basanti Pal Nandi | `FAC-CSE-001` or `faculty.nandi@gtbit.ac.in` | `faculty123` |
| **Faculty (IT / ECE / AI-ML / AI-DS)** | Department Faculty (`FAC-IT-001`..`004`, `FAC-ECE-001`..`004`, `FAC-AIML-001`..`004`, `FAC-AIDS-001`..`004`) | e.g. `FAC-IT-001` or `fac-it-001@gtbit.ac.in` | `faculty123` |
| **Student (Core Demo)** | Tejassveer Singh Vasant | `071/CSE2/2023` or `tejassveer@gtbit.ac.in` | `student123` |
| **Student (At-Risk Demo)** | Aman Gupta | `012/CSE2/2023` or `aman@gtbit.ac.in` | `student123` |
| **Students (900 Branch Cohort)** | Any student across CSE, IT, ECE, AI-ML, AI-DS | Their `roll_no`, `enrollment_no`, or `@gtbit.ac.in` email | `student123` |

> These shared passwords exist only in the seed data. Students admitted through the portal get unique temporary passwords, and everyone can change theirs from the account menu.
| **Parent** | Mr. Kuldeep Singh Vasant | `parent.tejassveer@gmail.com` | `parent123` |

---

## 💻 How to Run Locally

### Prerequisites
- Node.js v18 or higher (v22 tested)
- Python 3.8+ (for statistical CGPA analytics engine)
- MongoDB Atlas connection string (`MONGO_URI`)

### 1. Configure Environment (`backend/.env`)
Create or verify `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=Cluster0
JWT_SECRET=<a long random string — required when NODE_ENV=production>
GROQ_API_KEY=<optional_groq_api_key>
# Optional
CORS_ORIGIN=http://localhost:3000      # only needed if the frontend is served from another origin
CGPA_ENGINE=js                         # force the JavaScript model instead of the Python worker
PYTHON_BIN=python3                     # Python executable for the CGPA worker
```

On start-up the server runs idempotent maintenance:
- It corrects the seeded grading scale to the official GGSIPU bands.
- It derives CGPAs from declared results.
- It syncs ID counters, refreshes overdue fees and recomputes the merit leaderboard.

### 2. Setup, Seed & Start Backend
```bash
cd "Student Management ERP System/backend"
npm install
# Seed MongoDB Atlas with 929 users, 905 students, 20 faculty, 27k+ marks & attendance:
npm run seed
# Start the backend API server (runs on port 5000):
node src/server.js
# With the server running, check role boundaries and security regressions:
npm test
```

> **QR check-in from phones:** the QR encodes the address the faculty member opened the portal on. For students to scan it with their phones, open the portal using the computer's LAN IP (for example `http://192.168.1.20:3000`) or a deployed URL, not `localhost`.

### 3. Setup & Start Frontend
```bash
cd "Student Management ERP System/frontend"
npm install
# Start the Vite dev server (runs on port 3000):
npm run dev
```

### 4. Open the Application
Navigate in your browser to:
```
http://localhost:3000
```

---

## 📚 References
1. Pressman, R. S., & Maxim, B. R. *Software Engineering: A Practitioner's Approach*. McGraw-Hill Education.
2. Elmasri, R., & Navathe, S. B. *Fundamentals of Database Systems*. Pearson.
3. Silberschatz, A., Korth, H. F., & Sudarshan, S. *Database System Concepts*. McGraw-Hill.
4. MDN Web Docs, *Web Development Documentation*. https://developer.mozilla.org/en-US/
5. MongoDB & Mongoose ODM Documentation. https://mongoosejs.com/
6. Guru Tegh Bahadur Institute of Technology (GTBIT) / GGSIP University, New Delhi.
