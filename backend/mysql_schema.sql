-- =====================================================================
-- Full Fledged Student Management ERP System - MySQL Schema DDL
-- Institution: Guru Tegh Bahadur Institute of Technology (GGSIPU)
-- Authors: Dev Sharma, Krishmeet, Hargun Kaur, Tejassveer
-- Guide: Ms. Basanti Pal Nandi
-- Relational Integrity: Student -> Course -> Subject -> Attendance -> Exam -> Result -> Fees
-- =====================================================================

CREATE DATABASE IF NOT EXISTS erp_gtbit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erp_gtbit;

-- 1. Users table (Centralized authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'faculty', 'student', 'parent') NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  head_of_department VARCHAR(150)
) ENGINE=InnoDB;

-- 3. Courses
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_id INT NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  duration_semesters INT DEFAULT 8,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Faculty
CREATE TABLE IF NOT EXISTS faculty (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  department_id INT NOT NULL,
  designation VARCHAR(100) NOT NULL,
  qualification VARCHAR(150),
  weekly_workload_hours INT DEFAULT 16,
  office_room VARCHAR(50),
  status VARCHAR(30) DEFAULT 'Active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Students
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  parent_user_id INT,
  roll_no VARCHAR(50) NOT NULL UNIQUE,
  enrollment_no VARCHAR(50) NOT NULL UNIQUE,
  course_id INT NOT NULL,
  department_id INT NOT NULL,
  semester INT NOT NULL DEFAULT 4,
  section VARCHAR(20) NOT NULL DEFAULT 'CSE-2',
  admission_year INT NOT NULL DEFAULT 2023,
  dob DATE,
  blood_group VARCHAR(10),
  address TEXT,
  status VARCHAR(30) DEFAULT 'Active',
  current_cgpa DECIMAL(4,2) DEFAULT 8.45,
  total_credits_earned INT DEFAULT 76,
  parent_name VARCHAR(150),
  parent_phone VARCHAR(30),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Subjects (With Difficulty Index for CGPA Probability Module)
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  semester INT NOT NULL,
  credits INT NOT NULL DEFAULT 4,
  type ENUM('Theory', 'Practical') NOT NULL DEFAULT 'Theory',
  faculty_id INT,
  historical_pass_pct DECIMAL(5,2) DEFAULT 88.50,
  historical_avg_marks DECIMAL(5,2) DEFAULT 72.40,
  difficulty_index DECIMAL(4,3) DEFAULT 0.450,
  syllabus_outline TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7. Timetable / Schedule Slots
CREATE TABLE IF NOT EXISTS timetable_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  faculty_id INT NOT NULL,
  semester INT NOT NULL,
  section VARCHAR(20) NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  room_no VARCHAR(50) NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Attendance Sessions (Smart Attendance with QR Tokens)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  faculty_id INT NOT NULL,
  section VARCHAR(20) NOT NULL,
  semester INT NOT NULL,
  session_date DATE NOT NULL,
  slot_time VARCHAR(50) NOT NULL,
  topic_covered VARCHAR(255),
  session_token VARCHAR(100) UNIQUE,
  qr_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  status ENUM('Present', 'Absent', 'Late') NOT NULL,
  method ENUM('Faculty_Manual', 'QR_Scan', 'One_Tap') DEFAULT 'Faculty_Manual',
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_session_student (session_id, student_id),
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Examinations
CREATE TABLE IF NOT EXISTS examinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  semester INT NOT NULL,
  academic_year VARCHAR(30) NOT NULL,
  exam_type ENUM('Minor', 'Major', 'Practical', 'Internal') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('Scheduled', 'Ongoing', 'Completed', 'Results_Declared') DEFAULT 'Scheduled'
) ENGINE=InnoDB;

-- 11. Exam Marks (With Continuous Assessments)
CREATE TABLE IF NOT EXISTS exam_marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  subject_id INT NOT NULL,
  student_id INT NOT NULL,
  internal_assessment DECIMAL(5,2) DEFAULT 0.00,
  assignment_score DECIMAL(5,2) DEFAULT 0.00,
  external_exam DECIMAL(5,2) DEFAULT 0.00,
  total_score DECIMAL(5,2) DEFAULT 0.00,
  letter_grade VARCHAR(5) DEFAULT 'B',
  grade_points DECIMAL(3,1) DEFAULT 7.0,
  remarks VARCHAR(255),
  UNIQUE KEY unique_exam_sub_student (exam_id, subject_id, student_id),
  FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Assignments & Submissions
CREATE TABLE IF NOT EXISTS assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  faculty_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  max_marks INT DEFAULT 20,
  due_date DATETIME NOT NULL,
  attachment_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  student_id INT NOT NULL,
  submission_text TEXT,
  file_url VARCHAR(500),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  marks_obtained DECIMAL(5,2),
  faculty_feedback TEXT,
  status ENUM('Submitted', 'Graded', 'Late', 'Resubmission_Requested') DEFAULT 'Submitted',
  UNIQUE KEY unique_assign_student (assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. Study Materials
CREATE TABLE IF NOT EXISTS study_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  faculty_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  unit_name VARCHAR(100),
  file_type VARCHAR(20) DEFAULT 'PDF',
  file_url VARCHAR(500),
  file_size VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 14. Fee Structures & Payments
CREATE TABLE IF NOT EXISTS fee_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  semester INT NOT NULL,
  academic_year VARCHAR(30) NOT NULL,
  tuition_fee DECIMAL(10,2) NOT NULL,
  lab_development_fee DECIMAL(10,2) NOT NULL,
  exam_fee DECIMAL(10,2) NOT NULL,
  library_sports_fee DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_fee_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  fee_structure_id INT NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0.00,
  fine_amount DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('Paid', 'Pending', 'Overdue', 'Partial') DEFAULT 'Pending',
  payment_method VARCHAR(50),
  transaction_id VARCHAR(100),
  receipt_no VARCHAR(100) UNIQUE,
  payment_date DATETIME,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Notices
CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category ENUM('General', 'Academic', 'Exam', 'Placement', 'Event', 'Urgent') DEFAULT 'General',
  target_audience ENUM('All', 'Students', 'Faculty', 'Parents') DEFAULT 'All',
  department_id INT,
  posted_by VARCHAR(100) NOT NULL,
  is_pinned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 16. Library Books & Issues
CREATE TABLE IF NOT EXISTS library_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  isbn VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  edition VARCHAR(50),
  total_copies INT DEFAULT 5,
  available_copies INT DEFAULT 5,
  shelf_location VARCHAR(50)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS library_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  student_id INT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE,
  fine_amount DECIMAL(8,2) DEFAULT 0.00,
  status ENUM('Issued', 'Returned', 'Overdue') DEFAULT 'Issued',
  FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 17. Hostel Rooms & Allocations
CREATE TABLE IF NOT EXISTS hostel_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  block_name VARCHAR(50) NOT NULL,
  room_no VARCHAR(20) NOT NULL,
  floor INT NOT NULL,
  capacity INT DEFAULT 2,
  occupied_count INT DEFAULT 0,
  fee_per_semester DECIMAL(10,2) DEFAULT 28000.00,
  UNIQUE KEY unique_hostel_room (block_name, room_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hostel_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  student_id INT NOT NULL UNIQUE,
  allocation_date DATE NOT NULL,
  status ENUM('Allocated', 'Vacated') DEFAULT 'Allocated',
  FOREIGN KEY (room_id) REFERENCES hostel_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 18. Placement Drives & Applications (TnP Managed)
CREATE TABLE IF NOT EXISTS placement_drives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  company_logo VARCHAR(500),
  role_title VARCHAR(150) NOT NULL,
  job_location VARCHAR(100) NOT NULL,
  ctc_lpa DECIMAL(5,2) NOT NULL,
  eligibility_min_cgpa DECIMAL(4,2) DEFAULT 7.00,
  drive_date DATE NOT NULL,
  deadline DATE NOT NULL,
  description TEXT,
  status ENUM('Upcoming', 'Active', 'Closed') DEFAULT 'Active'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS placement_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drive_id INT NOT NULL,
  student_id INT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resume_link VARCHAR(500),
  status ENUM('Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Not_Selected') DEFAULT 'Applied',
  feedback TEXT,
  UNIQUE KEY unique_drive_student (drive_id, student_id),
  FOREIGN KEY (drive_id) REFERENCES placement_drives(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 19. Gamification & Student Points
CREATE TABLE IF NOT EXISTS student_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL UNIQUE,
  academic_score INT DEFAULT 0,
  attendance_score INT DEFAULT 0,
  assignment_score INT DEFAULT 0,
  total_merit_points INT DEFAULT 0,
  merit_rank INT DEFAULT 1,
  badges_json TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 20. Smart Study Planner
CREATE TABLE IF NOT EXISTS study_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  priority ENUM('Critical', 'High', 'Moderate', 'Review') DEFAULT 'Moderate',
  recommended_weekly_hours DECIMAL(4,1) DEFAULT 4.0,
  completed_hours_this_week DECIMAL(4,1) DEFAULT 1.5,
  weak_topics TEXT,
  notes TEXT,
  UNIQUE KEY unique_study_plan (student_id, subject_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 21. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('attendance_alert', 'cgpa_warning', 'exam_result', 'fee_reminder', 'assignment_due', 'general') DEFAULT 'general',
  link_url VARCHAR(255),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
