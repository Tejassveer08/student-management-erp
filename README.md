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
   │      (Lucide Icons, Glassmorphism UI, Canvas-Confetti,      │
   │           Role-Based Dashboards & Data Filtering)           │
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

- **Frontend**: React 19, Vite, Lucide React icons, Canvas-Confetti, Google Fonts (*Plus Jakarta Sans* and *JetBrains Mono*).
- **Backend**: Node.js, Express.js, JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Mongoose ODM (`mongodb` / MongoDB Atlas), optional Groq AI integration (`GROQ_API_KEY`).
- **Predictive Engine**: Python 3 service (`python_service/cgpa_engine.py`) using weighted composite scoring and confidence band metrics, with seamless zero-latency fallback.

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
- **Role-Based Access Control (RBAC)**: Distinct permissions and views for **Admin**, **Faculty**, **Student**, and **Parent**.

### 2. Student & Faculty Management
- **Student Directory**: Search and filter all 905 students by **Semester (All Semesters / Sem 1–6)** and **Section (`CSE-1..3`, `CSE-E1..E2`, `IT-1..3`, `ECE-1..3`, `AIML-1..2`, `AIDS-1..2`)**.
- **Faculty Directory**: 20 faculty across all 5 departments with qualifications, designations, office rooms, workload hours, and `FacultyClassMap` subject/section allocations.

### 3. Smart Attendance Tracker & Early-Warning Risk Cohort
- **Dynamic QR Session & Mobile Check-In**: Faculty generate timed QR tokens; students check in live.
- **Section-Wise One-Tap Roll Call**: Switch between all 15 sections (`CSE-1` through `AIDS-2`) to mark attendance.
- **Live Early-Warning Risk Cohort**: Admin dashboard dynamically lists all students falling below the `75%` attendance threshold, sorted by lowest attendance percentage.

### 4. Examinations, 6-Semester Marksheets & CGPA Probability
- **Semester 1–6 Marksheet Selector**: View individual semester marks, letter grades (`O`, `A+`, `A`, `B+`, `B`, `C`, `F`), credits, and SGPA for any student across all 6 semesters.
- **Faculty Marks Entry**: Scoped via `FacultyClassMap` so faculty across CSE, IT, ECE, AI-ML, and AI-DS can record and moderate marks.
- **CGPA Probability & What-If Simulator**: Projects semester SGPA/CGPA using historical difficulty, internal scores, and attendance.

### 5. Timetable, Assignments & Study Notes
- **Multi-Section Weekly Timetable**: Monday–Friday lecture and lab slots across all sections and department faculty.
- **Assignments & Study Materials**: 20 assignments and 22 lecture note PDFs/PPTXs across core and department subjects.

### 6. Semester-Wise Fees & Digital Receipts
- **30 Semester-Wise Fee Structures**: Breakdown of Tuition, Lab & Development, Exam, and Library/Sports fees for Semesters 1–6 across all 5 B.Tech courses.
- **Checkout & Receipts**: Supports Paid, Partial/Pending, and Overdue+Fine tracking with instant payment simulation and digital receipts.

### 7. GTBIT Societies, Campus Forum, Library, Placements & Notices
- **29 GTBIT Societies**: Membership applications and **Society Duty Attendance** requests reviewed by subject faculty.
- **Campus Doubt Forum**: Threaded discussions across Subjects, Societies, and General topics with faculty-verified answers and optional Groq AI support.
- **Library & Hostel**: 20 engineering titles with 32 issue/return/overdue records, plus hostel block/room allocations.
- **Department-Specific Placements**: 12 active/upcoming drives (Google, Microsoft, Zomato, Atlassian, Adobe, Razorpay, Qualcomm, Texas Instruments, NVIDIA, Databricks, Fractal Analytics, Jio Platforms AI Lab).
- **Notices Bulletin**: 10 pinned and department-targeted campus circulars.

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
JWT_SECRET=gtbit_erp_jwt_secret_key_2026
GROQ_API_KEY=<optional_groq_api_key>
```

### 2. Setup, Seed & Start Backend
```bash
cd "Student Management ERP System/backend"
npm install
# Seed MongoDB Atlas with 929 users, 905 students, 20 faculty, 27k+ marks & attendance:
npm run seed
# Start the backend API server (runs on port 5000):
node src/server.js
```

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
