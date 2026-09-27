const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'erp_system.db');
const db = new Database(dbPath, { verbose: null });

// Enable foreign key constraints and WAL mode for high performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function initSchema() {
  const schemaSql = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'faculty', 'student', 'parent')) NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Departments
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      head_of_department TEXT
    );

    -- Courses
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      duration_semesters INTEGER DEFAULT 8,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    -- Faculty
    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      department_id INTEGER NOT NULL,
      designation TEXT NOT NULL,
      qualification TEXT,
      weekly_workload_hours INTEGER DEFAULT 16,
      office_room TEXT,
      status TEXT DEFAULT 'Active',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    -- Students
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      parent_user_id INTEGER,
      roll_no TEXT UNIQUE NOT NULL,
      enrollment_no TEXT UNIQUE NOT NULL,
      course_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      semester INTEGER NOT NULL DEFAULT 4,
      section TEXT NOT NULL DEFAULT 'CSE-2',
      admission_year INTEGER NOT NULL DEFAULT 2023,
      dob TEXT,
      blood_group TEXT,
      address TEXT,
      status TEXT DEFAULT 'Active',
      current_cgpa REAL DEFAULT 8.45,
      total_credits_earned INTEGER DEFAULT 76,
      parent_name TEXT,
      parent_phone TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    -- Subjects
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      semester INTEGER NOT NULL,
      credits INTEGER NOT NULL DEFAULT 4,
      type TEXT CHECK(type IN ('Theory', 'Practical')) NOT NULL DEFAULT 'Theory',
      faculty_id INTEGER,
      historical_pass_pct REAL DEFAULT 88.5,
      historical_avg_marks REAL DEFAULT 72.4,
      difficulty_index REAL DEFAULT 0.45, -- 0.1 (easy) to 1.0 (very hard)
      syllabus_outline TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
    );

    -- Timetable / Class Schedules
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      section TEXT NOT NULL,
      day_of_week TEXT NOT NULL, -- Monday, Tuesday, etc.
      start_time TEXT NOT NULL,  -- e.g. 09:00
      end_time TEXT NOT NULL,    -- e.g. 10:00
      room_no TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
    );

    -- Attendance Sessions
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      section TEXT NOT NULL,
      semester INTEGER NOT NULL,
      session_date DATE NOT NULL,
      slot_time TEXT NOT NULL,
      topic_covered TEXT,
      session_token TEXT UNIQUE,
      qr_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
    );

    -- Attendance Records
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('Present', 'Absent', 'Late')) NOT NULL,
      method TEXT CHECK(method IN ('Faculty_Manual', 'QR_Scan', 'One_Tap')) DEFAULT 'Faculty_Manual',
      marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, student_id),
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Examinations
    CREATE TABLE IF NOT EXISTS examinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, -- e.g. 'Mid-Term Minor Exam 2026', 'End-Term Major Examination'
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      exam_type TEXT CHECK(exam_type IN ('Minor', 'Major', 'Practical', 'Internal')) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT CHECK(status IN ('Scheduled', 'Ongoing', 'Completed', 'Results_Declared')) DEFAULT 'Scheduled'
    );

    -- Exam Marks
    CREATE TABLE IF NOT EXISTS exam_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      internal_assessment REAL DEFAULT 0, -- out of 25
      assignment_score REAL DEFAULT 0,    -- out of 15
      external_exam REAL DEFAULT 0,       -- out of 60
      total_score REAL DEFAULT 0,         -- out of 100
      letter_grade TEXT DEFAULT 'B',
      grade_points REAL DEFAULT 7.0,
      remarks TEXT,
      UNIQUE(exam_id, subject_id, student_id),
      FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Assignments
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      max_marks INTEGER DEFAULT 20,
      due_date DATETIME NOT NULL,
      attachment_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
    );

    -- Assignment Submissions
    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      submission_text TEXT,
      file_url TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      marks_obtained REAL,
      faculty_feedback TEXT,
      status TEXT CHECK(status IN ('Submitted', 'Graded', 'Late', 'Resubmission_Requested')) DEFAULT 'Submitted',
      UNIQUE(assignment_id, student_id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Study Materials / Notes
    CREATE TABLE IF NOT EXISTS study_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      unit_name TEXT,
      file_type TEXT DEFAULT 'PDF',
      file_url TEXT,
      file_size TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
    );

    -- Fee Structures
    CREATE TABLE IF NOT EXISTS fee_structures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      tuition_fee REAL NOT NULL,
      lab_development_fee REAL NOT NULL,
      exam_fee REAL NOT NULL,
      library_sports_fee REAL NOT NULL,
      total_amount REAL NOT NULL,
      due_date DATE NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    -- Student Fee Payments
    CREATE TABLE IF NOT EXISTS student_fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      fee_structure_id INTEGER NOT NULL,
      amount_due REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      fine_amount REAL DEFAULT 0,
      status TEXT CHECK(status IN ('Paid', 'Pending', 'Overdue', 'Partial')) DEFAULT 'Pending',
      payment_method TEXT,
      transaction_id TEXT,
      receipt_no TEXT UNIQUE,
      payment_date DATETIME,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE
    );

    -- Notices & Announcements
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT CHECK(category IN ('General', 'Academic', 'Exam', 'Placement', 'Event', 'Urgent')) DEFAULT 'General',
      target_audience TEXT CHECK(target_audience IN ('All', 'Students', 'Faculty', 'Parents')) DEFAULT 'All',
      department_id INTEGER,
      posted_by TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    -- Library Books
    CREATE TABLE IF NOT EXISTS library_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      edition TEXT,
      total_copies INTEGER DEFAULT 5,
      available_copies INTEGER DEFAULT 5,
      shelf_location TEXT
    );

    -- Library Issues
    CREATE TABLE IF NOT EXISTS library_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      issue_date DATE NOT NULL,
      due_date DATE NOT NULL,
      return_date DATE,
      fine_amount REAL DEFAULT 0,
      status TEXT CHECK(status IN ('Issued', 'Returned', 'Overdue')) DEFAULT 'Issued',
      FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Hostel Rooms
    CREATE TABLE IF NOT EXISTS hostel_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_name TEXT NOT NULL,
      room_no TEXT NOT NULL,
      floor INTEGER NOT NULL,
      capacity INTEGER DEFAULT 2,
      occupied_count INTEGER DEFAULT 0,
      fee_per_semester REAL DEFAULT 28000,
      UNIQUE(block_name, room_no)
    );

    -- Hostel Allocations
    CREATE TABLE IF NOT EXISTS hostel_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      student_id INTEGER UNIQUE NOT NULL,
      allocation_date DATE NOT NULL,
      status TEXT CHECK(status IN ('Allocated', 'Vacated')) DEFAULT 'Allocated',
      FOREIGN KEY (room_id) REFERENCES hostel_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Placement Drives (TnP Managed)
    CREATE TABLE IF NOT EXISTS placement_drives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      company_logo TEXT,
      role_title TEXT NOT NULL,
      job_location TEXT NOT NULL,
      ctc_lpa REAL NOT NULL, -- in Lakhs Per Annum e.g. 14.5
      eligibility_min_cgpa REAL DEFAULT 7.0,
      drive_date DATE NOT NULL,
      deadline DATE NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('Upcoming', 'Active', 'Closed')) DEFAULT 'Active'
    );

    -- Placement Applications
    CREATE TABLE IF NOT EXISTS placement_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resume_link TEXT,
      status TEXT CHECK(status IN ('Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Not_Selected')) DEFAULT 'Applied',
      feedback TEXT,
      UNIQUE(drive_id, student_id),
      FOREIGN KEY (drive_id) REFERENCES placement_drives(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Gamification & Student Points
    CREATE TABLE IF NOT EXISTS student_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER UNIQUE NOT NULL,
      academic_score INTEGER DEFAULT 0,
      attendance_score INTEGER DEFAULT 0,
      assignment_score INTEGER DEFAULT 0,
      total_merit_points INTEGER DEFAULT 0,
      merit_rank INTEGER DEFAULT 1,
      badges_json TEXT DEFAULT '[]',
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Smart Study Planner
    CREATE TABLE IF NOT EXISTS study_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('Critical', 'High', 'Moderate', 'Review')) DEFAULT 'Moderate',
      recommended_weekly_hours REAL DEFAULT 4.0,
      completed_hours_this_week REAL DEFAULT 1.5,
      weak_topics TEXT,
      notes TEXT,
      UNIQUE(student_id, subject_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    -- In-App Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT CHECK(type IN ('attendance_alert', 'cgpa_warning', 'exam_result', 'fee_reminder', 'assignment_due', 'general')) DEFAULT 'general',
      link_url TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- RBAC: Faculty to Class & Subject Mapping (DB-level scoping)
    CREATE TABLE IF NOT EXISTS faculty_class_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      section TEXT NOT NULL,
      academic_year TEXT DEFAULT '2025-2026',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(faculty_id, subject_id, semester, section),
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    -- RBAC: Parent to Student Ward Links (DB-level scoping)
    CREATE TABLE IF NOT EXISTS ward_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_user_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      relationship TEXT DEFAULT 'Father',
      is_primary INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parent_user_id, student_id),
      FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- RBAC: Audit Logs for Admin Overrides and Destructive Actions
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_role TEXT NOT NULL,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Institutional Governance Settings (Admin-configurable)
    CREATE TABLE IF NOT EXISTS institution_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'Academic',
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `;

  db.exec(schemaSql);
  console.log('Database schema successfully initialized.');
}

initSchema();

module.exports = db;
