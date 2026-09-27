const bcrypt = require('bcryptjs');
const db = require('./database');

async function seedDatabase() {
  console.log('Starting seed process for Student Management ERP System...');

  // Hash standard passwords
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('admin123', salt);
  const facultyPass = bcrypt.hashSync('faculty123', salt);
  const studentPass = bcrypt.hashSync('student123', salt);
  const parentPass = bcrypt.hashSync('parent123', salt);

  // Clear existing data cleanly in reverse order of foreign keys
  const tables = [
    'notifications', 'study_plans', 'student_points', 'placement_applications', 'placement_drives',
    'hostel_allocations', 'hostel_rooms', 'library_issues', 'library_books', 'notices',
    'student_fee_payments', 'fee_structures', 'study_materials', 'assignment_submissions',
    'assignments', 'exam_marks', 'examinations', 'attendance_records', 'attendance_sessions',
    'timetable_slots', 'subjects', 'students', 'faculty', 'courses', 'departments', 'users'
  ];

  for (const t of tables) {
    try {
      db.prepare(`DELETE FROM ${t}`).run();
    } catch (e) {
      // ignore table empty error
    }
  }

  // 1. Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, full_name, phone, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Admin
  const adminUserId = insertUser.run(
    'admin@gtbit.ac.in',
    adminPass,
    'admin',
    'Prof. Basanti Pal Nandi (HOD & Dean Academics)',
    '+91 98112 34567',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  // Faculty Members
  const facNandiId = insertUser.run(
    'faculty.nandi@gtbit.ac.in',
    facultyPass,
    'faculty',
    'Ms. Basanti Pal Nandi',
    '+91 98112 34568',
    'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const facSharmaId = insertUser.run(
    'faculty.sharma@gtbit.ac.in',
    facultyPass,
    'faculty',
    'Dr. Rajesh Sharma',
    '+91 98765 43210',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const facSinghId = insertUser.run(
    'faculty.singh@gtbit.ac.in',
    facultyPass,
    'faculty',
    'Dr. Jaspreet Singh',
    '+91 98101 23456',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  // Parents
  const parentTejassveerId = insertUser.run(
    'parent.tejassveer@gmail.com',
    parentPass,
    'parent',
    'Mr. Kuldeep Singh Vasant',
    '+91 98188 12345',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const parentDevId = insertUser.run(
    'parent.dev@gmail.com',
    parentPass,
    'parent',
    'Mrs. Sunita Sharma',
    '+91 98188 54321',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const parentAmanId = insertUser.run(
    'parent.aman@gmail.com',
    parentPass,
    'parent',
    'Mr. Ramesh Gupta',
    '+91 98111 99887',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  // Students (Project Authors from GTBIT)
  const studentTejassveerUserId = insertUser.run(
    'tejassveer@gtbit.ac.in',
    studentPass,
    'student',
    'Tejassveer Singh Vasant',
    '+91 99102 33445',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const studentDevUserId = insertUser.run(
    'dev.sharma@gtbit.ac.in',
    studentPass,
    'student',
    'Dev Sharma',
    '+91 98103 44556',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const studentKrishmeetUserId = insertUser.run(
    'krishmeet@gtbit.ac.in',
    studentPass,
    'student',
    'Krishmeet Singh',
    '+91 98104 55667',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const studentHargunUserId = insertUser.run(
    'hargun@gtbit.ac.in',
    studentPass,
    'student',
    'Hargun Kaur',
    '+91 98105 66778',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  const studentAmanUserId = insertUser.run(
    'aman.gupta@gtbit.ac.in',
    studentPass,
    'student',
    'Aman Gupta',
    '+91 98106 77889',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'
  ).lastInsertRowid;

  // 2. Departments & Courses
  const deptCSEId = db.prepare(`
    INSERT INTO departments (code, name, head_of_department)
    VALUES (?, ?, ?)
  `).run('CSE', 'Computer Science and Engineering', 'Ms. Basanti Pal Nandi').lastInsertRowid;

  const deptITId = db.prepare(`
    INSERT INTO departments (code, name, head_of_department)
    VALUES (?, ?, ?)
  `).run('IT', 'Information Technology', 'Dr. Jaspreet Singh').lastInsertRowid;

  const courseBTechCSEId = db.prepare(`
    INSERT INTO courses (department_id, code, name, duration_semesters)
    VALUES (?, ?, ?, ?)
  `).run(deptCSEId, 'BTECH-CSE', 'Bachelor of Technology in Computer Science & Engineering', 8).lastInsertRowid;

  // 3. Faculty details
  const insertFaculty = db.prepare(`
    INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, weekly_workload_hours, office_room, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const facNandi = insertFaculty.run(facNandiId, 'FAC-CSE-001', deptCSEId, 'Assistant Professor & Guide', 'M.Tech (CSE), Ph.D (Pursuing)', 18, 'Room 304-A', 'Active').lastInsertRowid;
  const facSharma = insertFaculty.run(facSharmaId, 'FAC-CSE-002', deptCSEId, 'Associate Professor', 'Ph.D in Computer Science', 16, 'Room 302-B', 'Active').lastInsertRowid;
  const facSingh = insertFaculty.run(facSinghId, 'FAC-CSE-003', deptCSEId, 'Professor', 'Ph.D, M.Tech (AI/ML)', 14, 'Room 301-A', 'Active').lastInsertRowid;

  // 4. Student Profiles
  const insertStudent = db.prepare(`
    INSERT INTO students (user_id, parent_user_id, roll_no, enrollment_no, course_id, department_id, semester, section, admission_year, dob, blood_group, address, status, current_cgpa, total_credits_earned, parent_name, parent_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sTejassveerId = insertStudent.run(
    studentTejassveerUserId,
    parentTejassveerId,
    '071/CSE2/2023',
    '07113202723',
    courseBTechCSEId,
    deptCSEId,
    4,
    'CSE-2',
    2023,
    '2005-04-12',
    'B+',
    'C-4/22 Rajouri Garden, New Delhi',
    'Active',
    8.78,
    76,
    'Mr. Kuldeep Singh Vasant',
    '+91 98188 12345'
  ).lastInsertRowid;

  const sDevId = insertStudent.run(
    studentDevUserId,
    parentDevId,
    '605/CSE2/2023',
    '60513202724',
    courseBTechCSEId,
    deptCSEId,
    4,
    'CSE-2',
    2023,
    '2005-08-20',
    'O+',
    'B-12 Janakpuri, New Delhi',
    'Active',
    8.45,
    76,
    'Mrs. Sunita Sharma',
    '+91 98188 54321'
  ).lastInsertRowid;

  const sKrishmeetId = insertStudent.run(
    studentKrishmeetUserId,
    null,
    '607/CSE2/2023',
    '60713202724',
    courseBTechCSEId,
    deptCSEId,
    4,
    'CSE-2',
    2023,
    '2005-02-15',
    'A+',
    'E-18 Vikaspuri, New Delhi',
    'Active',
    8.62,
    76,
    'S. Gurmeet Singh',
    '+91 98104 99887'
  ).lastInsertRowid;

  const sHargunId = insertStudent.run(
    studentHargunUserId,
    null,
    '083/CSE2/2023',
    '08313202723',
    courseBTechCSEId,
    deptCSEId,
    4,
    'CSE-2',
    2023,
    '2005-11-09',
    'O-',
    'WZ-42 Tagore Garden, New Delhi',
    'Active',
    8.91,
    76,
    'S. Harpreet Singh',
    '+91 98105 11223'
  ).lastInsertRowid;

  // Student with lower attendance (<75%) to showcase the Early Warning & Smart Attendance alert system!
  const sAmanId = insertStudent.run(
    studentAmanUserId,
    parentAmanId,
    '012/CSE2/2023',
    '01213202723',
    courseBTechCSEId,
    deptCSEId,
    4,
    'CSE-2',
    2023,
    '2005-06-18',
    'AB+',
    'H-78 Paschim Vihar, New Delhi',
    'Active',
    6.95,
    72,
    'Mr. Ramesh Gupta',
    '+91 98111 99887'
  ).lastInsertRowid;

  // 5. Subjects for Semester 4 B.Tech CSE
  const insertSubject = db.prepare(`
    INSERT INTO subjects (course_id, code, name, semester, credits, type, faculty_id, historical_pass_pct, historical_avg_marks, difficulty_index, syllabus_outline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const subOS = insertSubject.run(
    courseBTechCSEId,
    'ETCS-202',
    'Operating Systems',
    4,
    4,
    'Theory',
    facSharma,
    84.5,
    68.2,
    0.58,
    'Unit 1: Process Management & Threads, Unit 2: CPU Scheduling & Synchronization, Unit 3: Deadlocks & Memory Management, Unit 4: File Systems & I/O'
  ).lastInsertRowid;

  const subAlgo = insertSubject.run(
    courseBTechCSEId,
    'ETCS-204',
    'Design and Analysis of Algorithms',
    4,
    4,
    'Theory',
    facNandi,
    76.0,
    62.8,
    0.72, // High difficulty index!
    'Unit 1: Asymptotic Analysis & Divide-and-Conquer, Unit 2: Greedy & Dynamic Programming, Unit 3: Graph Algorithms (Dijkstra, Bellman-Ford), Unit 4: NP-Completeness'
  ).lastInsertRowid;

  const subCN = insertSubject.run(
    courseBTechCSEId,
    'ETCS-206',
    'Computer Networks',
    4,
    4,
    'Theory',
    facSingh,
    89.0,
    71.5,
    0.50,
    'Unit 1: OSI & TCP/IP Reference Models, Unit 2: Data Link Layer & MAC Protocols, Unit 3: Routing Algorithms & IP Addressing, Unit 4: Transport (TCP/UDP) & Application Protocols'
  ).lastInsertRowid;

  const subSE = insertSubject.run(
    courseBTechCSEId,
    'ETCS-208',
    'Software Engineering',
    4,
    4,
    'Theory',
    facNandi,
    94.0,
    78.0,
    0.35, // Lower difficulty
    'Unit 1: SDLC Models & Agile, Unit 2: Requirements Analysis & SRS, Unit 3: Software Design, Architecture & UML, Unit 4: Testing & Maintenance'
  ).lastInsertRowid;

  const subAI = insertSubject.run(
    courseBTechCSEId,
    'ETCS-210',
    'Artificial Intelligence & Machine Learning',
    4,
    4,
    'Theory',
    facSingh,
    80.5,
    65.5,
    0.66,
    'Unit 1: Search Strategies (A*, Minimax), Unit 2: Knowledge Representation, Unit 3: Supervised & Unsupervised Learning, Unit 4: Neural Networks & Deep Learning'
  ).lastInsertRowid;

  const subOSLab = insertSubject.run(
    courseBTechCSEId,
    'ETCS-252',
    'Operating Systems Lab',
    4,
    1,
    'Practical',
    facSharma,
    98.0,
    88.0,
    0.20,
    'Linux Shell Scripting, fork() process creation, POSIX threads, Dining Philosophers synchronization'
  ).lastInsertRowid;

  const subAlgoLab = insertSubject.run(
    courseBTechCSEId,
    'ETCS-254',
    'Algorithms Lab',
    4,
    1,
    'Practical',
    facNandi,
    96.0,
    85.0,
    0.25,
    'MergeSort, QuickSort runtime benchmarking, Matrix Chain Multiplication, Kruskal & Prim algorithms'
  ).lastInsertRowid;

  // 6. Timetable Slots
  const insertSlot = db.prepare(`
    INSERT INTO timetable_slots (subject_id, faculty_id, semester, section, day_of_week, start_time, end_time, room_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const slots = [
    // Monday
    [subOS, facSharma, 4, 'CSE-2', 'Monday', '09:00', '10:00', 'Room 302'],
    [subAlgo, facNandi, 4, 'CSE-2', 'Monday', '10:00', '11:00', 'Room 302'],
    [subCN, facSingh, 4, 'CSE-2', 'Monday', '11:15', '12:15', 'Room 302'],
    [subSE, facNandi, 4, 'CSE-2', 'Monday', '12:15', '13:15', 'Room 302'],
    // Tuesday
    [subAI, facSingh, 4, 'CSE-2', 'Tuesday', '09:00', '10:00', 'Room 302'],
    [subOS, facSharma, 4, 'CSE-2', 'Tuesday', '10:00', '11:00', 'Room 302'],
    [subAlgoLab, facNandi, 4, 'CSE-2', 'Tuesday', '11:15', '13:15', 'Comp Lab 4'],
    // Wednesday
    [subAlgo, facNandi, 4, 'CSE-2', 'Wednesday', '09:00', '10:00', 'Room 302'],
    [subCN, facSingh, 4, 'CSE-2', 'Wednesday', '10:00', '11:00', 'Room 302'],
    [subSE, facNandi, 4, 'CSE-2', 'Wednesday', '11:15', '12:15', 'Room 302'],
    [subAI, facSingh, 4, 'CSE-2', 'Wednesday', '12:15', '13:15', 'Room 302'],
    // Thursday
    [subOS, facSharma, 4, 'CSE-2', 'Thursday', '09:00', '10:00', 'Room 302'],
    [subAlgo, facNandi, 4, 'CSE-2', 'Thursday', '10:00', '11:00', 'Room 302'],
    [subOSLab, facSharma, 4, 'CSE-2', 'Thursday', '11:15', '13:15', 'Comp Lab 2'],
    // Friday
    [subCN, facSingh, 4, 'CSE-2', 'Friday', '09:00', '10:00', 'Room 302'],
    [subSE, facNandi, 4, 'CSE-2', 'Friday', '10:00', '11:00', 'Room 302'],
    [subAI, facSingh, 4, 'CSE-2', 'Friday', '11:15', '12:15', 'Room 302'],
  ];

  for (const s of slots) {
    insertSlot.run(...s);
  }

  // 7. Attendance Sessions & Historical Records (Smart Attendance Tracker)
  const insertSession = db.prepare(`
    INSERT INTO attendance_sessions (subject_id, faculty_id, section, semester, session_date, slot_time, topic_covered, session_token, qr_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAttRecord = db.prepare(`
    INSERT INTO attendance_records (session_id, student_id, status, method, marked_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Generate 24 lectures per theory subject spanning past 7 weeks
  const subjectsList = [
    { id: subOS, fac: facSharma, name: 'OS' },
    { id: subAlgo, fac: facNandi, name: 'Algo' },
    { id: subCN, fac: facSingh, name: 'CN' },
    { id: subSE, fac: facNandi, name: 'SE' },
    { id: subAI, fac: facSingh, name: 'AI' }
  ];

  const studentsList = [
    { id: sTejassveerId, targetAtt: 0.90 },
    { id: sDevId, targetAtt: 0.86 },
    { id: sKrishmeetId, targetAtt: 0.88 },
    { id: sHargunId, targetAtt: 0.92 },
    { id: sAmanId, targetAtt: 0.68 } // Below 75% threshold
  ];

  const startDate = new Date('2026-08-01');
  let sessionCounter = 0;

  for (let week = 0; week < 8; week++) {
    for (const sub of subjectsList) {
      sessionCounter++;
      const sessionDate = new Date(startDate.getTime() + (week * 7 + (sessionCounter % 5)) * 86400000);
      const dateStr = sessionDate.toISOString().split('T')[0];

      const token = `QR_${sub.id}_${week}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const sessId = insertSession.run(
        sub.id,
        sub.fac,
        'CSE-2',
        4,
        dateStr,
        '10:00 - 11:00',
        `Lecture ${week + 1}: Core Concepts & Case Studies in ${sub.name}`,
        token,
        new Date(sessionDate.getTime() + 15 * 60000).toISOString()
      ).lastInsertRowid;

      for (const st of studentsList) {
        // Deterministic pseudo-random attendance based on targetAtt
        const seedVal = (st.id * 17 + sessionCounter * 13 + week * 7) % 100;
        let status = 'Present';
        if (seedVal > (st.targetAtt * 100)) {
          status = seedVal % 5 === 0 ? 'Late' : 'Absent';
        }

        insertAttRecord.run(
          sessId,
          st.id,
          status,
          status === 'Present' ? (seedVal % 2 === 0 ? 'QR_Scan' : 'One_Tap') : 'Faculty_Manual',
          sessionDate.toISOString()
        );
      }
    }
  }

  // Active Live QR Attendance Session for quick faculty demonstration!
  const liveToken = 'GTB-QR-LIVE-SESSION-8821';
  insertSession.run(
    subAlgo,
    facNandi,
    'CSE-2',
    4,
    new Date().toISOString().split('T')[0],
    '11:00 - 12:00',
    'Dynamic Programming & Bellman-Ford Live Interactive Lab',
    liveToken,
    new Date(Date.now() + 60 * 60 * 1000).toISOString() // Valid for 1 hour
  );

  // 8. Examinations & Results
  const insertExam = db.prepare(`
    INSERT INTO examinations (name, semester, academic_year, exam_type, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const examMidTerm = insertExam.run(
    'Mid-Term Minor-1 Examination',
    4,
    '2025-2026',
    'Minor',
    '2026-02-10',
    '2026-02-18',
    'Results_Declared'
  ).lastInsertRowid;

  const examMajor = insertExam.run(
    'End-Term Major Semester Examination',
    4,
    '2025-2026',
    'Major',
    '2026-05-15',
    '2026-05-30',
    'Scheduled'
  ).lastInsertRowid;

  // Insert Exam Marks for Minor-1 (Internal Assessment + Assignments)
  const insertMarks = db.prepare(`
    INSERT INTO exam_marks (exam_id, subject_id, student_id, internal_assessment, assignment_score, external_exam, total_score, letter_grade, grade_points, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Marks data: internal out of 25, assignment out of 15, external (predicted/projected or mid-term)
  const studentMarksConfig = [
    { studentId: sTejassveerId, marks: [
      { sub: subOS, int: 22.5, ass: 14.0, ext: 51.0, tot: 87.5, gr: 'A+', gp: 9.0 },
      { sub: subAlgo, int: 21.0, ass: 13.5, ext: 48.0, tot: 82.5, gr: 'A', gp: 8.0 },
      { sub: subCN, int: 23.0, ass: 14.5, ext: 53.0, tot: 90.5, gr: 'O', gp: 10.0 },
      { sub: subSE, int: 24.0, ass: 15.0, ext: 55.0, tot: 94.0, gr: 'O', gp: 10.0 },
      { sub: subAI, int: 21.5, ass: 13.0, ext: 49.0, tot: 83.5, gr: 'A', gp: 8.0 }
    ]},
    { studentId: sDevId, marks: [
      { sub: subOS, int: 21.0, ass: 13.0, ext: 49.0, tot: 83.0, gr: 'A', gp: 8.0 },
      { sub: subAlgo, int: 19.5, ass: 12.0, ext: 45.0, tot: 76.5, gr: 'A', gp: 8.0 },
      { sub: subCN, int: 22.0, ass: 14.0, ext: 51.0, tot: 87.0, gr: 'A+', gp: 9.0 },
      { sub: subSE, int: 23.5, ass: 14.5, ext: 53.0, tot: 91.0, gr: 'O', gp: 10.0 },
      { sub: subAI, int: 20.0, ass: 13.0, ext: 48.0, tot: 81.0, gr: 'A', gp: 8.0 }
    ]},
    { studentId: sKrishmeetId, marks: [
      { sub: subOS, int: 22.0, ass: 13.5, ext: 50.0, tot: 85.5, gr: 'A+', gp: 9.0 },
      { sub: subAlgo, int: 20.5, ass: 13.0, ext: 47.0, tot: 80.5, gr: 'A', gp: 8.0 },
      { sub: subCN, int: 22.5, ass: 14.0, ext: 52.0, tot: 88.5, gr: 'A+', gp: 9.0 },
      { sub: subSE, int: 24.0, ass: 15.0, ext: 54.0, tot: 93.0, gr: 'O', gp: 10.0 },
      { sub: subAI, int: 21.0, ass: 13.5, ext: 49.0, tot: 83.5, gr: 'A', gp: 8.0 }
    ]},
    { studentId: sHargunId, marks: [
      { sub: subOS, int: 23.5, ass: 14.5, ext: 54.0, tot: 92.0, gr: 'O', gp: 10.0 },
      { sub: subAlgo, int: 22.5, ass: 14.0, ext: 51.0, tot: 87.5, gr: 'A+', gp: 9.0 },
      { sub: subCN, int: 23.0, ass: 14.5, ext: 53.5, tot: 91.0, gr: 'O', gp: 10.0 },
      { sub: subSE, int: 24.5, ass: 15.0, ext: 56.0, tot: 95.5, gr: 'O', gp: 10.0 },
      { sub: subAI, int: 22.0, ass: 14.0, ext: 51.0, tot: 87.0, gr: 'A+', gp: 9.0 }
    ]},
    { studentId: sAmanId, marks: [
      { sub: subOS, int: 16.0, ass: 10.0, ext: 34.0, tot: 60.0, gr: 'B', gp: 6.0 },
      { sub: subAlgo, int: 14.0, ass: 9.0, ext: 30.0, tot: 53.0, gr: 'B', gp: 6.0 }, // At-risk subject!
      { sub: subCN, int: 17.5, ass: 11.0, ext: 38.0, tot: 66.5, gr: 'A', gp: 8.0 },
      { sub: subSE, int: 19.0, ass: 12.0, ext: 42.0, tot: 73.0, gr: 'B+', gp: 7.0 },
      { sub: subAI, int: 15.0, ass: 9.5, ext: 32.0, tot: 56.5, gr: 'B+', gp: 7.0 }
    ]}
  ];

  for (const item of studentMarksConfig) {
    for (const m of item.marks) {
      insertMarks.run(
        examMidTerm,
        m.sub,
        item.studentId,
        m.int,
        m.ass,
        m.ext,
        m.tot,
        m.gr,
        m.gp,
        m.tot >= 85 ? 'Excellent performance' : (m.tot >= 75 ? 'Good consistency' : 'Needs improvement in problem solving')
      );
    }
  }

  // 9. Assignments & Submissions
  const insertAssignment = db.prepare(`
    INSERT INTO assignments (subject_id, faculty_id, title, description, max_marks, due_date, attachment_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const assignOS = insertAssignment.run(
    subOS,
    facSharma,
    'Process Scheduling & Memory Paging Simulator',
    'Implement Round-Robin (q=4ms), Shortest Job First, and LRU Page Replacement in C/C++ or Python with Gantt chart generation.',
    20,
    new Date(Date.now() + 5 * 86400000).toISOString(),
    'https://gtbit.ac.in/materials/assignments/os_assignment_2.pdf'
  ).lastInsertRowid;

  const assignAlgo = insertAssignment.run(
    subAlgo,
    facNandi,
    'Dynamic Programming & Network Flow Problems',
    'Solve the 0/1 Knapsack problem with branch-and-bound optimization and implement Ford-Fulkerson algorithm for max-flow.',
    20,
    new Date(Date.now() + 8 * 86400000).toISOString(),
    'https://gtbit.ac.in/materials/assignments/algo_assignment_3.pdf'
  ).lastInsertRowid;

  const assignSE = insertAssignment.run(
    subSE,
    facNandi,
    'SRS & Architecture Design for Student ERP System',
    'Prepare IEEE-830 compliant SRS document and architectural component diagram for the ERP portal modules.',
    25,
    new Date(Date.now() - 2 * 86400000).toISOString(), // Completed
    'https://gtbit.ac.in/materials/assignments/se_assignment_1.pdf'
  ).lastInsertRowid;

  // Submissions
  const insertSub = db.prepare(`
    INSERT INTO assignment_submissions (assignment_id, student_id, submission_text, file_url, marks_obtained, faculty_feedback, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertSub.run(assignSE, sTejassveerId, 'Submitted full SRS and UML Class & Sequence Diagrams.', 'https://gtbit.ac.in/uploads/submissions/tejassveer_se_srs.pdf', 24.5, 'Outstanding software architecture and clear UML representation.', 'Graded');
  insertSub.run(assignSE, sDevId, 'Submitted comprehensive SRS with module state diagrams.', 'https://gtbit.ac.in/uploads/submissions/dev_se_srs.pdf', 23.5, 'Well structured SRS with solid requirements traceability.', 'Graded');
  insertSub.run(assignSE, sKrishmeetId, 'Submitted SRS document with ER diagram analysis.', 'https://gtbit.ac.in/uploads/submissions/krishmeet_se_srs.pdf', 23.0, 'Very good functional requirements breakdown.', 'Graded');
  insertSub.run(assignSE, sHargunId, 'Submitted complete IEEE-830 specification.', 'https://gtbit.ac.in/uploads/submissions/hargun_se_srs.pdf', 25.0, 'Exceptional detail, flawless design document.', 'Graded');

  // 10. Study Materials
  const insertMaterial = db.prepare(`
    INSERT INTO study_materials (subject_id, faculty_id, title, unit_name, file_type, file_url, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertMaterial.run(subAlgo, facNandi, 'Dynamic Programming Master Notes & Cheat Sheet', 'Unit 2: DP Algorithms', 'PDF', 'https://gtbit.ac.in/materials/algo_unit2_dp.pdf', '4.2 MB');
  insertMaterial.run(subAlgo, facNandi, 'Bellman-Ford & Dijkstra Graph Proofs', 'Unit 3: Graph Algorithms', 'PDF', 'https://gtbit.ac.in/materials/algo_unit3_graphs.pdf', '3.1 MB');
  insertMaterial.run(subOS, facSharma, 'Virtual Memory, Inverted Page Tables & Thrashing', 'Unit 3: Memory Management', 'PDF', 'https://gtbit.ac.in/materials/os_unit3_memory.pdf', '5.8 MB');
  insertMaterial.run(subCN, facSingh, 'Subnetting, CIDR & BGP Routing Protocols', 'Unit 3: Network Layer', 'PPTX', 'https://gtbit.ac.in/materials/cn_unit3_routing.pptx', '8.4 MB');
  insertMaterial.run(subAI, facSingh, 'A* Search and Alpha-Beta Pruning Algorithms', 'Unit 1: Informed Search', 'PDF', 'https://gtbit.ac.in/materials/ai_unit1_search.pdf', '3.6 MB');

  // 11. Fee Structure & Payments
  const insertFeeStructure = db.prepare(`
    INSERT INTO fee_structures (course_id, semester, academic_year, tuition_fee, lab_development_fee, exam_fee, library_sports_fee, total_amount, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const feeStructSem4 = insertFeeStructure.run(
    courseBTechCSEId,
    4,
    '2025-2026',
    65000.0,
    12000.0,
    4500.0,
    3500.0,
    85000.0,
    '2026-02-15'
  ).lastInsertRowid;

  const insertPayment = db.prepare(`
    INSERT INTO student_fee_payments (student_id, fee_structure_id, amount_due, amount_paid, fine_amount, status, payment_method, transaction_id, receipt_no, payment_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Paid students
  insertPayment.run(sTejassveerId, feeStructSem4, 85000.0, 85000.0, 0, 'Paid', 'UPI / NetBanking', 'TXN_GTB_2026_09481', 'REC-GTB-2026-0711', '2026-01-18 11:32:00');
  insertPayment.run(sDevId, feeStructSem4, 85000.0, 85000.0, 0, 'Paid', 'Debit Card', 'TXN_GTB_2026_09482', 'REC-GTB-2026-0605', '2026-01-20 14:15:00');
  insertPayment.run(sKrishmeetId, feeStructSem4, 85000.0, 85000.0, 0, 'Paid', 'NetBanking', 'TXN_GTB_2026_09483', 'REC-GTB-2026-0607', '2026-01-22 16:40:00');
  insertPayment.run(sHargunId, feeStructSem4, 85000.0, 85000.0, 0, 'Paid', 'UPI / QR', 'TXN_GTB_2026_09484', 'REC-GTB-2026-0083', '2026-01-19 10:05:00');
  
  // Pending & Overdue student (for testing "Redirect to payment page" functionality!)
  insertPayment.run(sAmanId, feeStructSem4, 85000.0, 0.0, 1500.0, 'Overdue', null, null, null, null);

  // 12. Notices & Announcements
  const insertNotice = db.prepare(`
    INSERT INTO notices (title, content, category, target_audience, department_id, posted_by, is_pinned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotice.run(
    'MANDATORY 75% Attendance Compliance for End-Term Examination Admit Cards',
    'As per GGSIPU statutory regulations, all students must maintain a minimum of 75% attendance in every individual theory and practical subject. Students falling below 75% will be detained and barred from writing the End-Term Major Examination. Please check the Smart Attendance Tracker on the ERP portal.',
    'Urgent',
    'All',
    deptCSEId,
    'Ms. Basanti Pal Nandi (HOD)',
    1,
    '2026-09-20 10:00:00'
  );

  insertNotice.run(
    'Campus Placement Drive: Google & Microsoft Software Engineering Internships',
    'Training and Placement Cell (TnP) is pleased to announce recruitment drives for 2027 graduating batch. Eligibility: CGPA >= 8.0, No active backlogs. Registration closes on March 15 on the ERP Placement portal.',
    'Placement',
    'Students',
    deptCSEId,
    'Training & Placement Cell',
    1,
    '2026-09-22 14:30:00'
  );

  insertNotice.run(
    'Submission of Minor-1 Assignment Scores on ERP Portal by March 5',
    'All faculty members are requested to complete evaluation of assignments and upload internal marks on the ERP system. Students can simulate their expected grade through the CGPA Probability Module.',
    'Academic',
    'Faculty',
    deptCSEId,
    'Dean Academics Office',
    0,
    '2026-09-24 09:15:00'
  );

  insertNotice.run(
    'Annual Technical Symposium GATES 2026 - Hackathon Registrations Open',
    'Guru Tegh Bahadur Institute of Technology invites all students to participate in GATES 2026 36-hour National Hackathon. Attractive cash prizes and direct interview opportunities with sponsoring companies.',
    'Event',
    'All',
    deptCSEId,
    'GTBIT Student Council',
    0,
    '2026-09-25 12:00:00'
  );

  // 13. Library Books & Issues
  const insertBook = db.prepare(`
    INSERT INTO library_books (isbn, title, author, category, edition, total_copies, available_copies, shelf_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const b1 = insertBook.run('978-0131103627', 'The C Programming Language', 'Brian W. Kernighan, Dennis Ritchie', 'Computer Science', '2nd Edition', 10, 7, 'Shelf CS-01').lastInsertRowid;
  const b2 = insertBook.run('978-0262033848', 'Introduction to Algorithms (CLRS)', 'Cormen, Leiserson, Rivest, Stein', 'Algorithms', '3rd Edition', 12, 4, 'Shelf CS-04').lastInsertRowid;
  const b3 = insertBook.run('978-1118063330', 'Operating System Concepts', 'Silberschatz, Galvin, Gagne', 'Operating Systems', '10th Edition', 15, 6, 'Shelf CS-02').lastInsertRowid;
  const b4 = insertBook.run('978-0133594140', 'Computer Networking: A Top-Down Approach', 'James Kurose, Keith Ross', 'Networking', '7th Edition', 14, 8, 'Shelf CS-05').lastInsertRowid;
  const b5 = insertBook.run('978-0078022128', 'Software Engineering: A Practitioner’s Approach', 'Roger S. Pressman, Bruce Maxim', 'Software Engg', '8th Edition', 8, 5, 'Shelf CS-03').lastInsertRowid;

  const insertLibIssue = db.prepare(`
    INSERT INTO library_issues (book_id, student_id, issue_date, due_date, return_date, fine_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertLibIssue.run(b2, sTejassveerId, '2026-08-10', '2026-09-10', null, 0, 'Issued');
  insertLibIssue.run(b3, sDevId, '2026-08-12', '2026-09-12', null, 0, 'Issued');
  insertLibIssue.run(b4, sKrishmeetId, '2026-08-15', '2026-09-15', null, 0, 'Issued');
  insertLibIssue.run(b5, sAmanId, '2026-07-10', '2026-08-10', null, 170.0, 'Overdue'); // Overdue fine

  // 14. Hostel Rooms & Allocations
  const insertHostelRoom = db.prepare(`
    INSERT INTO hostel_rooms (block_name, room_no, floor, capacity, occupied_count, fee_per_semester)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const r101 = insertHostelRoom.run('Block-A (Boys)', 'A-101', 1, 2, 2, 28000).lastInsertRowid;
  const r102 = insertHostelRoom.run('Block-A (Boys)', 'A-102', 1, 2, 1, 28000).lastInsertRowid;
  const r201 = insertHostelRoom.run('Block-B (Girls)', 'B-201', 2, 2, 1, 28000).lastInsertRowid;
  const r202 = insertHostelRoom.run('Block-B (Girls)', 'B-202', 2, 2, 0, 28000).lastInsertRowid;

  const insertHostelAlloc = db.prepare(`
    INSERT INTO hostel_allocations (room_id, student_id, allocation_date, status)
    VALUES (?, ?, ?, ?)
  `);

  insertHostelAlloc.run(r101, sTejassveerId, '2025-08-01', 'Allocated');
  insertHostelAlloc.run(r101, sDevId, '2025-08-01', 'Allocated');
  insertHostelAlloc.run(r201, sHargunId, '2025-08-01', 'Allocated');

  // 15. Placement & Internship Drives (TnP Managed)
  const insertDrive = db.prepare(`
    INSERT INTO placement_drives (company_name, company_logo, role_title, job_location, ctc_lpa, eligibility_min_cgpa, drive_date, deadline, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const driveGoogle = insertDrive.run(
    'Google India',
    'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
    'Software Engineering Intern (Systems & Cloud)',
    'Bengaluru / Hyderabad',
    28.0,
    8.5,
    '2026-10-15',
    '2026-10-05',
    'Work with core Google Cloud, distributed databases, and high-throughput networking infrastructure. 6-month pre-placement offer available.',
    'Active'
  ).lastInsertRowid;

  const driveMicrosoft = insertDrive.run(
    'Microsoft IDC',
    'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg',
    'Software Development Engineer (Azure Core)',
    'Noida / Hyderabad',
    24.5,
    8.0,
    '2026-10-22',
    '2026-10-10',
    'Design and optimize Azure hyper-scale cloud microservices, kernel-level virtualization, and scalable APIs.',
    'Active'
  ).lastInsertRowid;

  const driveZomato = insertDrive.run(
    'Zomato Technologies',
    'https://upload.wikimedia.org/wikipedia/commons/b/bd/Zomato_Logo.svg',
    'Full Stack Engineer (Core Platform)',
    'Gurugram',
    16.5,
    7.5,
    '2026-11-02',
    '2026-10-25',
    'Build real-time high-concurrency order dispatching systems, payment pipelines, and low-latency frontend applications.',
    'Upcoming'
  ).lastInsertRowid;

  const insertApp = db.prepare(`
    INSERT INTO placement_applications (drive_id, student_id, applied_at, resume_link, status, feedback)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertApp.run(driveGoogle, sHargunId, '2026-09-23 11:00:00', 'https://gtbit.ac.in/resumes/hargun_resume.pdf', 'Shortlisted', 'Profile shortlisted for Online Technical Assessment');
  insertApp.run(driveGoogle, sTejassveerId, '2026-09-23 11:30:00', 'https://gtbit.ac.in/resumes/tejassveer_resume.pdf', 'Shortlisted', 'Profile shortlisted for Online Technical Assessment');
  insertApp.run(driveMicrosoft, sTejassveerId, '2026-09-24 10:15:00', 'https://gtbit.ac.in/resumes/tejassveer_resume.pdf', 'Applied', 'Application under review by HR team');
  insertApp.run(driveMicrosoft, sDevId, '2026-09-24 12:00:00', 'https://gtbit.ac.in/resumes/dev_resume.pdf', 'Applied', 'Application under review by HR team');
  insertApp.run(driveMicrosoft, sKrishmeetId, '2026-09-24 14:00:00', 'https://gtbit.ac.in/resumes/krishmeet_resume.pdf', 'Applied', 'Application under review by HR team');

  // 16. Gamification, Merit Points & Badges
  const insertPoints = db.prepare(`
    INSERT INTO student_points (student_id, academic_score, attendance_score, assignment_score, total_merit_points, merit_rank, badges_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertPoints.run(
    sHargunId,
    480, 240, 230, 950, 1,
    JSON.stringify(['Top Ranker #1', 'Attendance Champion 90%+', 'Assignment Ace', 'Dean’s Scholar'])
  );

  insertPoints.run(
    sTejassveerId,
    465, 230, 225, 920, 2,
    JSON.stringify(['Top Ranker #2', 'Attendance Master', 'Full Stack Prodigy', 'Algorithm Solver'])
  );

  insertPoints.run(
    sKrishmeetId,
    450, 225, 215, 890, 3,
    JSON.stringify(['Top Ranker #3', 'Network Specialist', 'Consistent Achiever'])
  );

  insertPoints.run(
    sDevId,
    440, 220, 210, 870, 4,
    JSON.stringify(['System Architect', 'Consistent Performer', 'Quiz Master'])
  );

  insertPoints.run(
    sAmanId,
    320, 150, 160, 630, 14,
    JSON.stringify(['Participation Ribbon'])
  );

  // 17. Smart Study Planner
  const insertStudyPlan = db.prepare(`
    INSERT INTO study_plans (student_id, subject_id, priority, recommended_weekly_hours, completed_hours_this_week, weak_topics, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertStudyPlan.run(
    sTejassveerId,
    subAlgo,
    'High',
    5.5,
    3.0,
    'NP-Completeness proofs, Amortized analysis of Fibonacci Heaps',
    'Focus on problem set 4 before Minor-2 examinations.'
  );

  insertStudyPlan.run(
    sTejassveerId,
    subOS,
    'Moderate',
    4.0,
    2.5,
    'Deadlock avoidance with Banker Algorithm in multi-resource instances',
    'Practice synchronization semaphore code.'
  );

  insertStudyPlan.run(
    sAmanId,
    subAlgo,
    'Critical',
    7.5,
    1.0,
    'Graph Traversals, Recurrence Relations, Dynamic Programming',
    'URGENT: Low coursework score + high subject difficulty. Daily 1.5 hr recommended.'
  );

  // 18. Notifications
  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, title, message, type, link_url, is_read)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Notification for Tejassveer
  insertNotification.run(
    studentTejassveerUserId,
    'Predicted CGPA Updated',
    'Your CGPA Probability Module computed a projected semester SGPA of 8.94 (CGPA: 8.82) with 88% confidence band.',
    'cgpa_warning',
    '/cgpa-simulator',
    0
  );

  insertNotification.run(
    studentTejassveerUserId,
    'Shortlisted for Google India Online Assessment',
    'Congratulations! Your resume has been shortlisted for the Software Engineering Internship drive.',
    'general',
    '/placements',
    0
  );

  // Attendance Alert for Aman & his parent (below 75%)
  insertNotification.run(
    studentAmanUserId,
    'CRITICAL: Low Attendance Warning (67.5%)',
    'Your attendance is below the mandatory 75% threshold in Algorithms and OS. You must attend the next 8 consecutive lectures to avoid detention.',
    'attendance_alert',
    '/attendance',
    0
  );

  insertNotification.run(
    parentAmanId,
    'ATTENDANCE ALERT: Aman Gupta is below 75%',
    'Your ward Aman Gupta has an attendance percentage of 67.5% in Semester 4. Institution mandates >=75% for exam eligibility.',
    'attendance_alert',
    '/attendance',
    0
  );

  // Fee reminder for Aman's parent
  insertNotification.run(
    parentAmanId,
    'Fee Overdue Reminder - Sem 4 Tuition Fee',
    'Semester 4 college fee of Rs. 85,000 + Rs. 1,500 late fine is overdue. Please complete payment through the online payment portal.',
    'fee_reminder',
    '/fees',
    0
  );

  console.log('Database seeding successfully finished! Rich GTBIT test data populated.');
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding database:', err);
    process.exit(1);
  });
