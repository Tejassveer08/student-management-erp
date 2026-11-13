const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const {
  connectDB,
  mongoose,
  Counter,
  resetCounter,
  User,
  Department,
  Course,
  Faculty,
  Student,
  Subject,
  TimetableSlot,
  AttendanceSession,
  AttendanceRecord,
  Examination,
  ExamMark,
  Assignment,
  AssignmentSubmission,
  StudyMaterial,
  FeeStructure,
  StudentFeePayment,
  Notice,
  LibraryBook,
  LibraryIssue,
  HostelRoom,
  HostelAllocation,
  PlacementDrive,
  PlacementApplication,
  StudentPoints,
  StudyPlan,
  Notification,
  FacultyClassMap,
  WardLink,
  AuditLog,
  InstitutionSetting,
  Society,
  SocietyMember,
  SocietyAttendanceRequest,
  ForumThread,
  ForumPost,
  ForumLike
} = require('./database');
const { GTBIT_SOCIETIES } = require('./societiesData');
const { applySocietyCredit, findOwningFacultyId } = require('../services/attendanceCredit');
const { marksToGradePoint } = require('../services/cgpaCalculator');

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Kabir', 'Rohan', 'Rishabh', 'Harsh', 'Karan', 'Pranav', 'Siddharth', 'Yash',
  'Ananya', 'Diya', 'Aadhya', 'Pari', 'Myra', 'Sara', 'Ira', 'Anika', 'Navya', 'Riya',
  'Meher', 'Simran', 'Gurleen', 'Harpreet', 'Jasleen', 'Tanvi', 'Nandini', 'Khushi', 'Ishita', 'Sneha',
  'Manav', 'Devansh', 'Gaurav', 'Tushar', 'Nikhil', 'Varun', 'chirag', 'Mayank', 'Piyush', 'Anshul'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kaur', 'Malhotra', 'Kapoor', 'Khanna', 'Bhatia', 'Sethi',
  'Arora', 'Chawla', 'Bansal', 'Aggarwal', 'Jain', 'Mehta', 'Nair', 'Rao', 'Yadav', 'Tiwari',
  'Pandey', 'Mishra', 'Dubey', 'Chauhan', 'Rajput', 'Gill', 'Sandhu', 'Dhillon', 'Grewal', 'Bedi'
];

const LOCALITIES = [
  'Rajouri Garden, New Delhi', 'Janakpuri, New Delhi', 'Vikaspuri, New Delhi', 'Tagore Garden, New Delhi',
  'Paschim Vihar, New Delhi', 'Subhash Nagar, New Delhi', 'Tilak Nagar, New Delhi', 'Dwarka Sector 12, New Delhi',
  'Punjabi Bagh, New Delhi', 'Rohini Sector 9, New Delhi', 'Pitampura, New Delhi', 'Hari Nagar, New Delhi'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

async function seedDatabase() {
  console.log('Connecting to MongoDB...');
  await connectDB();
  console.log('Connected! Clearing existing collections...');

  const modelsToClear = [
    ForumLike, ForumPost, ForumThread,
    SocietyAttendanceRequest, SocietyMember, Society,
    AuditLog, InstitutionSetting, WardLink, FacultyClassMap,
    Notification, StudyPlan, StudentPoints,
    PlacementApplication, PlacementDrive,
    HostelAllocation, HostelRoom,
    LibraryIssue, LibraryBook,
    Notice, StudentFeePayment, FeeStructure,
    StudyMaterial, AssignmentSubmission, Assignment,
    ExamMark, Examination,
    AttendanceRecord, AttendanceSession,
    TimetableSlot, Subject,
    Student, Faculty, Course, Department, User,
    Counter
  ];

  await Promise.all(modelsToClear.map(m => m.deleteMany({})));

  const counters = {};
  const nextId = (col) => {
    counters[col] = (counters[col] || 0) + 1;
    return counters[col];
  };

  // Hash standard passwords once
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('admin123', salt);
  const facultyPass = bcrypt.hashSync('faculty123', salt);
  const studentPass = bcrypt.hashSync('student123', salt);
  const parentPass = bcrypt.hashSync('parent123', salt);

  // 1. Insert Core Users
  const usersToInsert = [];
  const addUser = (email, password_hash, role, full_name, phone, avatar_url) => {
    const id = nextId('users');
    usersToInsert.push({ id, email, password_hash, role, full_name, phone, avatar_url });
    return id;
  };

  const adminUserId = addUser(
    'admin@gtbit.ac.in', adminPass, 'admin',
    'Prof. Basanti Pal Nandi (HOD & Dean Academics)', '+91 98112 34567',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  );

  const facNandiId = addUser(
    'faculty.nandi@gtbit.ac.in', facultyPass, 'faculty',
    'Ms. Basanti Pal Nandi', '+91 98112 34568',
    'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=150&auto=format&fit=crop&q=80'
  );
  const facSharmaId = addUser(
    'faculty.sharma@gtbit.ac.in', facultyPass, 'faculty',
    'Dr. Rajesh Sharma', '+91 98765 43210',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  );
  const facSinghId = addUser(
    'faculty.singh@gtbit.ac.in', facultyPass, 'faculty',
    'Dr. Jaspreet Singh', '+91 98101 23456',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  );

  const parentTejassveerId = addUser(
    'parent.tejassveer@gmail.com', parentPass, 'parent',
    'Mr. Kuldeep Singh Vasant', '+91 98188 12345',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  );
  const parentDevId = addUser(
    'parent.dev@gmail.com', parentPass, 'parent',
    'Mrs. Sunita Sharma', '+91 98188 54321',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
  );
  const parentAmanId = addUser(
    'parent.aman@gmail.com', parentPass, 'parent',
    'Mr. Ramesh Gupta', '+91 98111 99887',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
  );

  const studentTejassveerUserId = addUser(
    'tejassveer@gtbit.ac.in', studentPass, 'student',
    'Tejassveer Singh Vasant', '+91 99102 33445',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'
  );
  const studentDevUserId = addUser(
    'dev.sharma@gtbit.ac.in', studentPass, 'student',
    'Dev Sharma', '+91 98103 44556',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
  );
  const studentKrishmeetUserId = addUser(
    'krishmeet@gtbit.ac.in', studentPass, 'student',
    'Krishmeet Singh', '+91 98104 55667',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
  );
  const studentHargunUserId = addUser(
    'hargun@gtbit.ac.in', studentPass, 'student',
    'Hargun Kaur', '+91 98105 66778',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
  );
  const studentAmanUserId = addUser(
    'aman.gupta@gtbit.ac.in', studentPass, 'student',
    'Aman Gupta', '+91 98106 77889',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'
  );

  // 2. Departments & Courses
  const deptCSEId = nextId('departments');
  const deptITId = nextId('departments');
  const deptECEId = nextId('departments');
  const deptAIMLId = nextId('departments');
  const deptAIDSId = nextId('departments');

  await Department.insertMany([
    { id: deptCSEId, code: 'CSE', name: 'Computer Science and Engineering', head_of_department: 'Ms. Basanti Pal Nandi' },
    { id: deptITId, code: 'IT', name: 'Information Technology', head_of_department: 'Dr. Jaspreet Singh' },
    { id: deptECEId, code: 'ECE', name: 'Electronics & Communication Engineering', head_of_department: 'Dr. Rajesh Sharma' },
    { id: deptAIMLId, code: 'AI-ML', name: 'Artificial Intelligence & Machine Learning', head_of_department: 'Dr. Jaspreet Singh' },
    { id: deptAIDSId, code: 'AI-DS', name: 'Artificial Intelligence & Data Science', head_of_department: 'Ms. Basanti Pal Nandi' }
  ]);

  const courseBTechCSEId = nextId('courses');
  const courseBTechITId = nextId('courses');
  const courseBTechECEId = nextId('courses');
  const courseBTechAIMLId = nextId('courses');
  const courseBTechAIDSId = nextId('courses');

  await Course.insertMany([
    { id: courseBTechCSEId, department_id: deptCSEId, code: 'BTECH-CSE', name: 'Bachelor of Technology in Computer Science & Engineering', duration_semesters: 8 },
    { id: courseBTechITId, department_id: deptITId, code: 'BTECH-IT', name: 'Bachelor of Technology in Information Technology', duration_semesters: 8 },
    { id: courseBTechECEId, department_id: deptECEId, code: 'BTECH-ECE', name: 'Bachelor of Technology in Electronics & Communication Engineering', duration_semesters: 8 },
    { id: courseBTechAIMLId, department_id: deptAIMLId, code: 'BTECH-AIML', name: 'Bachelor of Technology in AI & Machine Learning', duration_semesters: 8 },
    { id: courseBTechAIDSId, department_id: deptAIDSId, code: 'BTECH-AIDS', name: 'Bachelor of Technology in AI & Data Science', duration_semesters: 8 }
  ]);

  // 3. Faculty details
  const facNandi = nextId('faculty');
  const facSharma = nextId('faculty');
  const facSingh = nextId('faculty');

  await Faculty.insertMany([
    { id: facNandi, user_id: facNandiId, employee_id: 'FAC-CSE-001', department_id: deptCSEId, designation: 'Assistant Professor & Guide', qualification: 'M.Tech (CSE), Ph.D (Pursuing)', weekly_workload_hours: 18, office_room: 'Room 304-A', status: 'Active' },
    { id: facSharma, user_id: facSharmaId, employee_id: 'FAC-CSE-002', department_id: deptCSEId, designation: 'Associate Professor', qualification: 'Ph.D in Computer Science', weekly_workload_hours: 16, office_room: 'Room 302-B', status: 'Active' },
    { id: facSingh, user_id: facSinghId, employee_id: 'FAC-CSE-003', department_id: deptCSEId, designation: 'Professor', qualification: 'Ph.D, M.Tech (AI/ML)', weekly_workload_hours: 14, office_room: 'Room 301-A', status: 'Active' }
  ]);

  // 4. Core Demo Students
  const studentsToInsert = [];
  const addStudent = (doc) => {
    const id = nextId('students');
    studentsToInsert.push({ id, ...doc });
    return id;
  };

  const sTejassveerId = addStudent({
    user_id: studentTejassveerUserId, parent_user_id: parentTejassveerId,
    roll_no: '071/CSE2/2023', enrollment_no: '07113202723',
    course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', shift: 'Morning',
    admission_year: 2023, dob: '2005-04-12', blood_group: 'B+',
    address: 'C-4/22 Rajouri Garden, New Delhi', status: 'Active', current_cgpa: 8.78, total_credits_earned: 76,
    parent_name: 'Mr. Kuldeep Singh Vasant', parent_phone: '+91 98188 12345'
  });

  const sDevId = addStudent({
    user_id: studentDevUserId, parent_user_id: parentDevId,
    roll_no: '605/CSE2/2023', enrollment_no: '60513202724',
    course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', shift: 'Morning',
    admission_year: 2023, dob: '2005-08-20', blood_group: 'O+',
    address: 'B-12 Janakpuri, New Delhi', status: 'Active', current_cgpa: 8.45, total_credits_earned: 76,
    parent_name: 'Mrs. Sunita Sharma', parent_phone: '+91 98188 54321'
  });

  const sKrishmeetId = addStudent({
    user_id: studentKrishmeetUserId, parent_user_id: null,
    roll_no: '607/CSE2/2023', enrollment_no: '60713202724',
    course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', shift: 'Morning',
    admission_year: 2023, dob: '2005-02-15', blood_group: 'A+',
    address: 'E-18 Vikaspuri, New Delhi', status: 'Active', current_cgpa: 8.62, total_credits_earned: 76,
    parent_name: 'S. Gurmeet Singh', parent_phone: '+91 98104 99887'
  });

  const sHargunId = addStudent({
    user_id: studentHargunUserId, parent_user_id: null,
    roll_no: '083/CSE2/2023', enrollment_no: '08313202723',
    course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', shift: 'Morning',
    admission_year: 2023, dob: '2005-11-09', blood_group: 'O-',
    address: 'WZ-42 Tagore Garden, New Delhi', status: 'Active', current_cgpa: 8.91, total_credits_earned: 76,
    parent_name: 'S. Harpreet Singh', parent_phone: '+91 98105 11223'
  });

  const sAmanId = addStudent({
    user_id: studentAmanUserId, parent_user_id: parentAmanId,
    roll_no: '012/CSE2/2023', enrollment_no: '01213202723',
    course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', shift: 'Morning',
    admission_year: 2023, dob: '2005-06-18', blood_group: 'AB+',
    address: 'H-78 Paschim Vihar, New Delhi', status: 'Active', current_cgpa: 6.95, total_credits_earned: 72,
    parent_name: 'Mr. Ramesh Gupta', parent_phone: '+91 98111 99887'
  });

  // Bulk-generate 900 GTBIT students across requested branches & shifts:
  // 200 CSE Morning, 100 CSE Evening, 200 IT, 200 ECE, 100 AI-ML, 100 AI-DS
  const branchCohorts = [
    { tag: 'csem', label: 'CSE-M', count: 200, courseId: courseBTechCSEId, deptId: deptCSEId, shift: 'Morning', sections: ['CSE-1', 'CSE-2', 'CSE-3'], enrollPrefix: '27' },
    { tag: 'csee', label: 'CSE-E', count: 100, courseId: courseBTechCSEId, deptId: deptCSEId, shift: 'Evening', sections: ['CSE-E1', 'CSE-E2'], enrollPrefix: '28' },
    { tag: 'it',   label: 'IT',    count: 200, courseId: courseBTechITId,  deptId: deptITId,  shift: 'Morning', sections: ['IT-1', 'IT-2', 'IT-3'], enrollPrefix: '31' },
    { tag: 'ece',  label: 'ECE',   count: 200, courseId: courseBTechECEId, deptId: deptECEId, shift: 'Morning', sections: ['ECE-1', 'ECE-2', 'ECE-3'], enrollPrefix: '28' },
    { tag: 'aiml', label: 'AIML',  count: 100, courseId: courseBTechAIMLId, deptId: deptAIMLId, shift: 'Morning', sections: ['AIML-1', 'AIML-2'], enrollPrefix: '14' },
    { tag: 'aids', label: 'AIDS',  count: 100, courseId: courseBTechAIDSId, deptId: deptAIDSId, shift: 'Morning', sections: ['AIDS-1', 'AIDS-2'], enrollPrefix: '15' }
  ];

  const generatedStudentIds = [];
  let globalIdx = 1;

  for (const cohort of branchCohorts) {
    for (let i = 1; i <= cohort.count; i++) {
      const firstRaw = FIRST_NAMES[(globalIdx * 7 + i) % FIRST_NAMES.length];
      const first = firstRaw.charAt(0).toUpperCase() + firstRaw.slice(1);
      const last = LAST_NAMES[(globalIdx * 3 + i) % LAST_NAMES.length];
      const fullName = `${first} ${last}`;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}.${cohort.tag}${i}@gtbit.ac.in`;
      const phone = `+91 98${String(10000000 + ((globalIdx * 7919) % 89999999)).padStart(8, '0')}`;
      const section = cohort.sections[(i - 1) % cohort.sections.length];
      const semester = [2, 4, 6][i % 3];
      const admYear = semester === 2 ? 2024 : (semester === 4 ? 2023 : 2022);
      const rollNo = `${String(i).padStart(3, '0')}/${cohort.label}/${admYear}`;
      const enrollmentNo = `${String(globalIdx).padStart(3, '0')}1320${cohort.enrollPrefix}${String(admYear).slice(-2)}`;
      const cgpa = Number((6.4 + ((globalIdx * 17) % 32) / 10).toFixed(2));
      const dobMonth = String(((globalIdx % 12) + 1)).padStart(2, '0');
      const dobDay = String(((globalIdx % 28) + 1)).padStart(2, '0');
      const dobYear = 2004 + (semester === 2 ? 2 : semester === 4 ? 1 : 0);

      const userId = addUser(
        email,
        studentPass,
        'student',
        fullName,
        phone,
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      );

      const sid = addStudent({
        user_id: userId,
        parent_user_id: null,
        roll_no: rollNo,
        enrollment_no: enrollmentNo,
        course_id: cohort.courseId,
        department_id: cohort.deptId,
        semester,
        section,
        shift: cohort.shift,
        admission_year: admYear,
        dob: `${dobYear}-${dobMonth}-${dobDay}`,
        blood_group: BLOOD_GROUPS[globalIdx % BLOOD_GROUPS.length],
        address: `${(globalIdx % 95) + 1}, ${LOCALITIES[globalIdx % LOCALITIES.length]}`,
        status: 'Active',
        current_cgpa: cgpa,
        total_credits_earned: semester * 19,
        parent_name: `Mr./Mrs. ${last}`,
        parent_phone: `+91 99${String(10000000 + ((globalIdx * 6553) % 89999999)).padStart(8, '0')}`
      });

      generatedStudentIds.push({ id: sid, cgpa, rankOffset: globalIdx });
      globalIdx++;
    }
  }

  console.log(`Inserting ${usersToInsert.length} users and ${studentsToInsert.length} students...`);
  await User.insertMany(usersToInsert);
  await Student.insertMany(studentsToInsert);

  // 5. Subjects for Semester 4 B.Tech CSE
  const subOS = nextId('subjects');
  const subAlgo = nextId('subjects');
  const subCN = nextId('subjects');
  const subSE = nextId('subjects');
  const subAI = nextId('subjects');
  const subOSLab = nextId('subjects');
  const subAlgoLab = nextId('subjects');

  const extraSemSubjects = [
    // Semester 1
    { sem: 1, code: 'ETMA-101', name: 'Applied Mathematics - I', credits: 4, fac: facSharma, pass: 82.0, avg: 66.5, diff: 0.58 },
    { sem: 1, code: 'ETPH-103', name: 'Applied Physics - I', credits: 4, fac: facSingh, pass: 85.0, avg: 69.0, diff: 0.52 },
    { sem: 1, code: 'ETCS-105', name: 'Programming in C', credits: 4, fac: facNandi, pass: 90.0, avg: 74.5, diff: 0.42 },
    { sem: 1, code: 'ETEC-107', name: 'Electrical & Electronics Fundamentals', credits: 4, fac: facSharma, pass: 81.0, avg: 65.0, diff: 0.60 },
    { sem: 1, code: 'ETHS-109', name: 'Communication Skills', credits: 3, fac: facNandi, pass: 96.0, avg: 80.5, diff: 0.25 },
    // Semester 2
    { sem: 2, code: 'ETMA-102', name: 'Applied Mathematics - II', credits: 4, fac: facSharma, pass: 80.0, avg: 64.8, diff: 0.62 },
    { sem: 2, code: 'ETCH-104', name: 'Applied Chemistry', credits: 4, fac: facSingh, pass: 88.0, avg: 72.0, diff: 0.45 },
    { sem: 2, code: 'ETCS-106', name: 'Data Structures & File Systems', credits: 4, fac: facNandi, pass: 79.0, avg: 65.2, diff: 0.68 },
    { sem: 2, code: 'ETEC-108', name: 'Digital Logic Design', credits: 4, fac: facSharma, pass: 84.0, avg: 68.5, diff: 0.55 },
    { sem: 2, code: 'ETME-110', name: 'Engineering Mechanics', credits: 3, fac: facSingh, pass: 86.0, avg: 70.0, diff: 0.48 },
    // Semester 3
    { sem: 3, code: 'ETCS-201', name: 'Discrete Mathematics', credits: 4, fac: facNandi, pass: 78.0, avg: 63.5, diff: 0.68 },
    { sem: 3, code: 'ETCS-203', name: 'Object-Oriented Programming (C++)', credits: 4, fac: facSharma, pass: 89.0, avg: 73.0, diff: 0.46 },
    { sem: 3, code: 'ETCS-205', name: 'Computer Organization & Architecture', credits: 4, fac: facSingh, pass: 82.5, avg: 67.0, diff: 0.58 },
    { sem: 3, code: 'ETCS-207', name: 'Database Management Systems', credits: 4, fac: facNandi, pass: 91.0, avg: 75.5, diff: 0.40 },
    { sem: 3, code: 'ETCS-209', name: 'Theory of Computation', credits: 4, fac: facSingh, pass: 74.0, avg: 60.5, diff: 0.75 },
    // Semester 5
    { sem: 5, code: 'ETCS-301', name: 'Compiler Design', credits: 4, fac: facNandi, pass: 77.5, avg: 63.0, diff: 0.70 },
    { sem: 5, code: 'ETCS-303', name: 'Web Engineering & Full Stack Dev', credits: 4, fac: facSharma, pass: 93.0, avg: 77.5, diff: 0.36 },
    { sem: 5, code: 'ETCS-305', name: 'Information Security & Cryptography', credits: 4, fac: facSingh, pass: 85.0, avg: 69.5, diff: 0.52 },
    { sem: 5, code: 'ETCS-307', name: 'Microprocessors & Interfacing', credits: 4, fac: facSharma, pass: 81.0, avg: 65.5, diff: 0.60 },
    { sem: 5, code: 'ETCS-309', name: 'Cloud Computing & Virtualization', credits: 4, fac: facSingh, pass: 90.0, avg: 74.0, diff: 0.44 },
    // Semester 6
    { sem: 6, code: 'ETCS-302', name: 'Distributed Systems', credits: 4, fac: facSingh, pass: 83.0, avg: 67.5, diff: 0.58 },
    { sem: 6, code: 'ETCS-304', name: 'Deep Learning & Neural Networks', credits: 4, fac: facNandi, pass: 80.0, avg: 65.0, diff: 0.65 },
    { sem: 6, code: 'ETCS-306', name: 'Big Data & Data Warehousing', credits: 4, fac: facSharma, pass: 88.5, avg: 72.5, diff: 0.48 },
    { sem: 6, code: 'ETCS-308', name: 'Mobile Application Development', credits: 4, fac: facNandi, pass: 94.0, avg: 78.5, diff: 0.34 },
    { sem: 6, code: 'ETHS-310', name: 'Engineering Economics & Management', credits: 3, fac: facSharma, pass: 95.0, avg: 80.0, diff: 0.28 }
  ];

  const theorySubjectsBySem = {
    1: [],
    2: [],
    3: [],
    4: [subOS, subAlgo, subCN, subSE, subAI],
    5: [],
    6: []
  };

  const extraSubjectDocs = extraSemSubjects.map(s => {
    const id = nextId('subjects');
    theorySubjectsBySem[s.sem].push(id);
    return {
      id,
      course_id: courseBTechCSEId,
      code: s.code,
      name: s.name,
      semester: s.sem,
      credits: s.credits,
      type: 'Theory',
      faculty_id: s.fac,
      historical_pass_pct: s.pass,
      historical_avg_marks: s.avg,
      difficulty_index: s.diff,
      syllabus_outline: `Core GGSIPU Semester ${s.sem} curriculum for ${s.name}`
    };
  });

  await Subject.insertMany([
    { id: subOS, course_id: courseBTechCSEId, code: 'ETCS-202', name: 'Operating Systems', semester: 4, credits: 4, type: 'Theory', faculty_id: facSharma, historical_pass_pct: 84.5, historical_avg_marks: 68.2, difficulty_index: 0.58, syllabus_outline: 'Unit 1: Process Management & Threads, Unit 2: CPU Scheduling & Synchronization, Unit 3: Deadlocks & Memory Management, Unit 4: File Systems & I/O' },
    { id: subAlgo, course_id: courseBTechCSEId, code: 'ETCS-204', name: 'Design and Analysis of Algorithms', semester: 4, credits: 4, type: 'Theory', faculty_id: facNandi, historical_pass_pct: 76.0, historical_avg_marks: 62.8, difficulty_index: 0.72, syllabus_outline: 'Unit 1: Asymptotic Analysis & Divide-and-Conquer, Unit 2: Greedy & Dynamic Programming, Unit 3: Graph Algorithms (Dijkstra, Bellman-Ford), Unit 4: NP-Completeness' },
    { id: subCN, course_id: courseBTechCSEId, code: 'ETCS-206', name: 'Computer Networks', semester: 4, credits: 4, type: 'Theory', faculty_id: facSingh, historical_pass_pct: 89.0, historical_avg_marks: 71.5, difficulty_index: 0.50, syllabus_outline: 'Unit 1: OSI & TCP/IP Reference Models, Unit 2: Data Link Layer & MAC Protocols, Unit 3: Routing Algorithms & IP Addressing, Unit 4: Transport (TCP/UDP) & Application Protocols' },
    { id: subSE, course_id: courseBTechCSEId, code: 'ETCS-208', name: 'Software Engineering', semester: 4, credits: 4, type: 'Theory', faculty_id: facNandi, historical_pass_pct: 94.0, historical_avg_marks: 78.0, difficulty_index: 0.35, syllabus_outline: 'Unit 1: SDLC Models & Agile, Unit 2: Requirements Analysis & SRS, Unit 3: Software Design, Architecture & UML, Unit 4: Testing & Maintenance' },
    { id: subAI, course_id: courseBTechCSEId, code: 'ETCS-210', name: 'Artificial Intelligence & Machine Learning', semester: 4, credits: 4, type: 'Theory', faculty_id: facSingh, historical_pass_pct: 80.5, historical_avg_marks: 65.5, difficulty_index: 0.66, syllabus_outline: 'Unit 1: Search Strategies (A*, Minimax), Unit 2: Knowledge Representation, Unit 3: Supervised & Unsupervised Learning, Unit 4: Neural Networks & Deep Learning' },
    { id: subOSLab, course_id: courseBTechCSEId, code: 'ETCS-252', name: 'Operating Systems Lab', semester: 4, credits: 1, type: 'Practical', faculty_id: facSharma, historical_pass_pct: 98.0, historical_avg_marks: 88.0, difficulty_index: 0.20, syllabus_outline: 'Linux Shell Scripting, fork() process creation, POSIX threads, Dining Philosophers synchronization' },
    { id: subAlgoLab, course_id: courseBTechCSEId, code: 'ETCS-254', name: 'Algorithms Lab', semester: 4, credits: 1, type: 'Practical', faculty_id: facNandi, historical_pass_pct: 96.0, historical_avg_marks: 85.0, difficulty_index: 0.25, syllabus_outline: 'MergeSort, QuickSort runtime benchmarking, Matrix Chain Multiplication, Kruskal & Prim algorithms' },
    ...extraSubjectDocs
  ]);

  // 6. Timetable Slots
  const slotsRaw = [
    [subOS, facSharma, 4, 'CSE-2', 'Monday', '09:00', '10:00', 'Room 302'],
    [subAlgo, facNandi, 4, 'CSE-2', 'Monday', '10:00', '11:00', 'Room 302'],
    [subCN, facSingh, 4, 'CSE-2', 'Monday', '11:15', '12:15', 'Room 302'],
    [subSE, facNandi, 4, 'CSE-2', 'Monday', '12:15', '13:15', 'Room 302'],
    [subAI, facSingh, 4, 'CSE-2', 'Tuesday', '09:00', '10:00', 'Room 302'],
    [subOS, facSharma, 4, 'CSE-2', 'Tuesday', '10:00', '11:00', 'Room 302'],
    [subAlgoLab, facNandi, 4, 'CSE-2', 'Tuesday', '11:15', '13:15', 'Comp Lab 4'],
    [subAlgo, facNandi, 4, 'CSE-2', 'Wednesday', '09:00', '10:00', 'Room 302'],
    [subCN, facSingh, 4, 'CSE-2', 'Wednesday', '10:00', '11:00', 'Room 302'],
    [subSE, facNandi, 4, 'CSE-2', 'Wednesday', '11:15', '12:15', 'Room 302'],
    [subAI, facSingh, 4, 'CSE-2', 'Wednesday', '12:15', '13:15', 'Room 302'],
    [subOS, facSharma, 4, 'CSE-2', 'Thursday', '09:00', '10:00', 'Room 302'],
    [subAlgo, facNandi, 4, 'CSE-2', 'Thursday', '10:00', '11:00', 'Room 302'],
    [subOSLab, facSharma, 4, 'CSE-2', 'Thursday', '11:15', '13:15', 'Comp Lab 2'],
    [subCN, facSingh, 4, 'CSE-2', 'Friday', '09:00', '10:00', 'Room 302'],
    [subSE, facNandi, 4, 'CSE-2', 'Friday', '10:00', '11:00', 'Room 302'],
    [subAI, facSingh, 4, 'CSE-2', 'Friday', '11:15', '12:15', 'Room 302']
  ];
  await TimetableSlot.insertMany(
    slotsRaw.map(([subject_id, faculty_id, semester, section, day_of_week, start_time, end_time, room_no]) => ({
      id: nextId('timetable_slots'),
      subject_id, faculty_id, semester, section, day_of_week, start_time, end_time, room_no
    }))
  );

  // 7. Attendance Sessions & Historical Records
  const subjectsList = [
    { id: subOS, fac: facSharma, name: 'OS' },
    { id: subAlgo, fac: facNandi, name: 'Algo' },
    { id: subCN, fac: facSingh, name: 'CN' },
    { id: subSE, fac: facNandi, name: 'SE' },
    { id: subAI, fac: facSingh, name: 'AI' }
  ];
  const coreStudentsAtt = [
    { id: sTejassveerId, targetAtt: 0.90 },
    { id: sDevId, targetAtt: 0.86 },
    { id: sKrishmeetId, targetAtt: 0.88 },
    { id: sHargunId, targetAtt: 0.92 },
    { id: sAmanId, targetAtt: 0.68 }
  ];

  const sessionsToInsert = [];
  const recordsToInsert = [];
  const startDate = new Date('2026-08-01');
  let sessionCounter = 0;

  for (let week = 0; week < 8; week++) {
    for (const sub of subjectsList) {
      sessionCounter++;
      const sessionDate = new Date(startDate.getTime() + (week * 7 + (sessionCounter % 5)) * 86400000);
      const dateStr = sessionDate.toISOString().split('T')[0];
      const token = `QR_${sub.id}_${week}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const sessId = nextId('attendance_sessions');

      sessionsToInsert.push({
        id: sessId,
        subject_id: sub.id,
        faculty_id: sub.fac,
        section: 'CSE-2',
        semester: 4,
        session_date: dateStr,
        slot_time: '10:00 - 11:00',
        topic_covered: `Lecture ${week + 1}: Core Concepts & Case Studies in ${sub.name}`,
        session_token: token,
        qr_expires_at: new Date(sessionDate.getTime() + 15 * 60000).toISOString()
      });

      for (const st of coreStudentsAtt) {
        const seedVal = (st.id * 17 + sessionCounter * 13 + week * 7) % 100;
        let status = 'Present';
        if (seedVal > st.targetAtt * 100) {
          status = seedVal % 5 === 0 ? 'Late' : 'Absent';
        }
        recordsToInsert.push({
          id: nextId('attendance_records'),
          session_id: sessId,
          student_id: st.id,
          status,
          credit_type: 'Regular',
          method: status === 'Present' ? (seedVal % 2 === 0 ? 'QR_Scan' : 'One_Tap') : 'Faculty_Manual',
          marked_at: sessionDate.toISOString()
        });
      }
    }
  }

  sessionsToInsert.push({
    id: nextId('attendance_sessions'),
    subject_id: subAlgo,
    faculty_id: facNandi,
    section: 'CSE-2',
    semester: 4,
    session_date: new Date().toISOString().split('T')[0],
    slot_time: '11:00 - 12:00',
    topic_covered: 'Dynamic Programming & Bellman-Ford Live Interactive Lab',
    session_token: 'GTB-QR-LIVE-SESSION-8821',
    qr_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });

  await AttendanceSession.insertMany(sessionsToInsert);
  await AttendanceRecord.insertMany(recordsToInsert);

  // 8. Examinations & Results (All 6 Semesters)
  const examMidTerm = nextId('examinations');
  const examMajor = nextId('examinations');
  const examSem1 = nextId('examinations');
  const examSem2 = nextId('examinations');
  const examSem3 = nextId('examinations');
  const examSem5 = nextId('examinations');
  const examSem6 = nextId('examinations');

  const examBySem = {
    1: examSem1,
    2: examSem2,
    3: examSem3,
    4: examMidTerm,
    5: examSem5,
    6: examSem6
  };

  await Examination.insertMany([
    { id: examSem1, name: 'End-Term Examination (Semester 1)', semester: 1, academic_year: '2023-2024', exam_type: 'Major', start_date: '2023-12-10', end_date: '2023-12-24', status: 'Results_Declared' },
    { id: examSem2, name: 'End-Term Examination (Semester 2)', semester: 2, academic_year: '2023-2024', exam_type: 'Major', start_date: '2024-05-12', end_date: '2024-05-26', status: 'Results_Declared' },
    { id: examSem3, name: 'End-Term Examination (Semester 3)', semester: 3, academic_year: '2024-2025', exam_type: 'Major', start_date: '2024-12-09', end_date: '2024-12-23', status: 'Results_Declared' },
    { id: examMidTerm, name: 'Mid-Term Minor-1 Examination (Semester 4)', semester: 4, academic_year: '2025-2026', exam_type: 'Minor', start_date: '2026-02-10', end_date: '2026-02-18', status: 'Results_Declared' },
    { id: examMajor, name: 'End-Term Major Semester Examination', semester: 4, academic_year: '2025-2026', exam_type: 'Major', start_date: '2026-05-15', end_date: '2026-05-30', status: 'Scheduled' },
    { id: examSem5, name: 'End-Term Examination (Semester 5)', semester: 5, academic_year: '2025-2026', exam_type: 'Major', start_date: '2025-12-08', end_date: '2025-12-22', status: 'Results_Declared' },
    { id: examSem6, name: 'End-Term Examination (Semester 6)', semester: 6, academic_year: '2025-2026', exam_type: 'Major', start_date: '2026-05-10', end_date: '2026-05-25', status: 'Results_Declared' }
  ]);

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
      { sub: subAlgo, int: 14.0, ass: 9.0, ext: 30.0, tot: 53.0, gr: 'B', gp: 6.0 },
      { sub: subCN, int: 17.5, ass: 11.0, ext: 38.0, tot: 66.5, gr: 'A', gp: 8.0 },
      { sub: subSE, int: 19.0, ass: 12.0, ext: 42.0, tot: 73.0, gr: 'B+', gp: 7.0 },
      { sub: subAI, int: 15.0, ass: 9.5, ext: 32.0, tot: 56.5, gr: 'B+', gp: 7.0 }
    ]}
  ];

  const marksToInsert = [];
  const coreSem4Done = new Set([sTejassveerId, sDevId, sKrishmeetId, sHargunId, sAmanId]);

  for (const item of studentMarksConfig) {
    for (const m of item.marks) {
      marksToInsert.push({
        id: nextId('exam_marks'),
        exam_id: examMidTerm,
        subject_id: m.sub,
        student_id: item.studentId,
        internal_assessment: m.int,
        assignment_score: m.ass,
        external_exam: m.ext,
        total_score: m.tot,
        letter_grade: m.gr,
        grade_points: m.gp,
        remarks: m.tot >= 85 ? 'Excellent performance' : (m.tot >= 75 ? 'Good consistency' : 'Needs improvement in problem solving')
      });
    }
  }

  // Generate individual semester marks for ALL 905 students across Semesters 1..6
  for (const st of studentsToInsert) {
    const baseFactor = Math.min(9.5, Math.max(5.5, st.current_cgpa || 8.0));
    for (let sem = 1; sem <= 6; sem++) {
      if (sem === 4 && coreSem4Done.has(st.id)) continue;
      const semSubs = theorySubjectsBySem[sem] || [];
      const exId = examBySem[sem];
      semSubs.forEach((subId, idx) => {
        const variance = ((st.id * 13 + sem * 7 + idx * 11) % 15) - 7; // -7..+7
        const targetTot = Math.min(98, Math.max(45, Math.round(baseFactor * 9.5 + variance)));
        const internal = Number(Math.min(25, Math.max(10, Math.round(targetTot * 0.25))).toFixed(1));
        const assignment = Number(Math.min(15, Math.max(7, Math.round(targetTot * 0.15))).toFixed(1));
        const external = Number(Math.max(20, targetTot - internal - assignment).toFixed(1));
        const total = Number((internal + assignment + external).toFixed(1));
        const gpInfo = marksToGradePoint(total);

        marksToInsert.push({
          id: nextId('exam_marks'),
          exam_id: exId,
          subject_id: subId,
          student_id: st.id,
          internal_assessment: internal,
          assignment_score: assignment,
          external_exam: external,
          total_score: total,
          letter_grade: gpInfo.grade,
          grade_points: gpInfo.gp,
          remarks: total >= 85 ? 'Excellent performance' : (total >= 75 ? 'Good consistency' : 'Needs improvement in problem solving')
        });
      });
    }
  }

  console.log(`Inserting ${marksToInsert.length} semester exam mark records across Semesters 1-6...`);
  for (let i = 0; i < marksToInsert.length; i += 5000) {
    await ExamMark.insertMany(marksToInsert.slice(i, i + 5000));
  }

  // 9. Assignments & Submissions
  const assignOS = nextId('assignments');
  const assignAlgo = nextId('assignments');
  const assignSE = nextId('assignments');

  await Assignment.insertMany([
    { id: assignOS, subject_id: subOS, faculty_id: facSharma, title: 'Process Scheduling & Memory Paging Simulator', description: 'Implement Round-Robin (q=4ms), Shortest Job First, and LRU Page Replacement in C/C++ or Python with Gantt chart generation.', max_marks: 20, due_date: new Date(Date.now() + 5 * 86400000).toISOString(), attachment_url: 'https://gtbit.ac.in/materials/assignments/os_assignment_2.pdf' },
    { id: assignAlgo, subject_id: subAlgo, faculty_id: facNandi, title: 'Dynamic Programming & Network Flow Problems', description: 'Solve the 0/1 Knapsack problem with branch-and-bound optimization and implement Ford-Fulkerson algorithm for max-flow.', max_marks: 20, due_date: new Date(Date.now() + 8 * 86400000).toISOString(), attachment_url: 'https://gtbit.ac.in/materials/assignments/algo_assignment_3.pdf' },
    { id: assignSE, subject_id: subSE, faculty_id: facNandi, title: 'SRS & Architecture Design for Student ERP System', description: 'Prepare IEEE-830 compliant SRS document and architectural component diagram for the ERP portal modules.', max_marks: 25, due_date: new Date(Date.now() - 2 * 86400000).toISOString(), attachment_url: 'https://gtbit.ac.in/materials/assignments/se_assignment_1.pdf' }
  ]);

  await AssignmentSubmission.insertMany([
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sTejassveerId, submission_text: 'Submitted full SRS and UML Class & Sequence Diagrams.', file_url: 'https://gtbit.ac.in/uploads/submissions/tejassveer_se_srs.pdf', marks_obtained: 24.5, faculty_feedback: 'Outstanding software architecture and clear UML representation.', status: 'Graded' },
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sDevId, submission_text: 'Submitted comprehensive SRS with module state diagrams.', file_url: 'https://gtbit.ac.in/uploads/submissions/dev_se_srs.pdf', marks_obtained: 23.5, faculty_feedback: 'Well structured SRS with solid requirements traceability.', status: 'Graded' },
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sKrishmeetId, submission_text: 'Submitted SRS document with ER diagram analysis.', file_url: 'https://gtbit.ac.in/uploads/submissions/krishmeet_se_srs.pdf', marks_obtained: 23.0, faculty_feedback: 'Very good functional requirements breakdown.', status: 'Graded' },
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sHargunId, submission_text: 'Submitted complete IEEE-830 specification.', file_url: 'https://gtbit.ac.in/uploads/submissions/hargun_se_srs.pdf', marks_obtained: 25.0, faculty_feedback: 'Exceptional detail, flawless design document.', status: 'Graded' }
  ]);

  // 10. Study Materials
  await StudyMaterial.insertMany([
    { id: nextId('study_materials'), subject_id: subAlgo, faculty_id: facNandi, title: 'Dynamic Programming Master Notes & Cheat Sheet', unit_name: 'Unit 2: DP Algorithms', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/algo_unit2_dp.pdf', file_size: '4.2 MB' },
    { id: nextId('study_materials'), subject_id: subAlgo, faculty_id: facNandi, title: 'Bellman-Ford & Dijkstra Graph Proofs', unit_name: 'Unit 3: Graph Algorithms', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/algo_unit3_graphs.pdf', file_size: '3.1 MB' },
    { id: nextId('study_materials'), subject_id: subOS, faculty_id: facSharma, title: 'Virtual Memory, Inverted Page Tables & Thrashing', unit_name: 'Unit 3: Memory Management', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/os_unit3_memory.pdf', file_size: '5.8 MB' },
    { id: nextId('study_materials'), subject_id: subCN, faculty_id: facSingh, title: 'Subnetting, CIDR & BGP Routing Protocols', unit_name: 'Unit 3: Network Layer', file_type: 'PPTX', file_url: 'https://gtbit.ac.in/materials/cn_unit3_routing.pptx', file_size: '8.4 MB' },
    { id: nextId('study_materials'), subject_id: subAI, faculty_id: facSingh, title: 'A* Search and Alpha-Beta Pruning Algorithms', unit_name: 'Unit 1: Informed Search', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/ai_unit1_search.pdf', file_size: '3.6 MB' }
  ]);

  // 11. Fee Structure & Payments (core + 900 students)
  const feeStructSem4 = nextId('fee_structures');
  await FeeStructure.create({
    id: feeStructSem4,
    course_id: courseBTechCSEId,
    semester: 4,
    academic_year: '2025-2026',
    tuition_fee: 65000.0,
    lab_development_fee: 12000.0,
    exam_fee: 4500.0,
    library_sports_fee: 3500.0,
    total_amount: 85000.0,
    due_date: '2026-02-15'
  });

  const feePaymentsToInsert = [
    { id: nextId('student_fee_payments'), student_id: sTejassveerId, fee_structure_id: feeStructSem4, amount_due: 85000.0, amount_paid: 85000.0, fine_amount: 0, status: 'Paid', payment_method: 'UPI / NetBanking', transaction_id: 'TXN_GTB_2026_09481', receipt_no: 'REC-GTB-2026-0711', payment_date: '2026-01-18 11:32:00' },
    { id: nextId('student_fee_payments'), student_id: sDevId, fee_structure_id: feeStructSem4, amount_due: 85000.0, amount_paid: 85000.0, fine_amount: 0, status: 'Paid', payment_method: 'Debit Card', transaction_id: 'TXN_GTB_2026_09482', receipt_no: 'REC-GTB-2026-0605', payment_date: '2026-01-20 14:15:00' },
    { id: nextId('student_fee_payments'), student_id: sKrishmeetId, fee_structure_id: feeStructSem4, amount_due: 85000.0, amount_paid: 85000.0, fine_amount: 0, status: 'Paid', payment_method: 'NetBanking', transaction_id: 'TXN_GTB_2026_09483', receipt_no: 'REC-GTB-2026-0607', payment_date: '2026-01-22 16:40:00' },
    { id: nextId('student_fee_payments'), student_id: sHargunId, fee_structure_id: feeStructSem4, amount_due: 85000.0, amount_paid: 85000.0, fine_amount: 0, status: 'Paid', payment_method: 'UPI / QR', transaction_id: 'TXN_GTB_2026_09484', receipt_no: 'REC-GTB-2026-0083', payment_date: '2026-01-19 10:05:00' },
    { id: nextId('student_fee_payments'), student_id: sAmanId, fee_structure_id: feeStructSem4, amount_due: 85000.0, amount_paid: 0.0, fine_amount: 1500.0, status: 'Overdue' }
  ];

  for (const gs of generatedStudentIds) {
    const mod = gs.id % 10;
    const isPaid = mod < 8;
    const isOverdue = mod === 9;
    const doc = {
      id: nextId('student_fee_payments'),
      student_id: gs.id,
      fee_structure_id: feeStructSem4,
      amount_due: 85000.0,
      amount_paid: isPaid ? 85000.0 : 0.0,
      fine_amount: isOverdue ? 1000.0 : 0,
      status: isPaid ? 'Paid' : (isOverdue ? 'Overdue' : 'Pending')
    };
    if (isPaid) {
      doc.payment_method = 'UPI / NetBanking';
      doc.transaction_id = `TXN_GTB_2026_${10000 + gs.id}`;
      doc.receipt_no = `REC-GTB-2026-${1000 + gs.id}`;
      doc.payment_date = '2026-01-25 12:00:00';
    }
    feePaymentsToInsert.push(doc);
  }
  await StudentFeePayment.insertMany(feePaymentsToInsert);

  // 12. Notices
  await Notice.insertMany([
    { id: nextId('notices'), title: 'MANDATORY 75% Attendance Compliance for End-Term Examination Admit Cards', content: 'As per GGSIPU statutory regulations, all students must maintain a minimum of 75% attendance in every individual theory and practical subject. Students falling below 75% will be detained and barred from writing the End-Term Major Examination. Please check the Smart Attendance Tracker on the ERP portal.', category: 'Urgent', target_audience: 'All', department_id: deptCSEId, posted_by: 'Ms. Basanti Pal Nandi (HOD)', is_pinned: 1, created_at: '2026-09-20 10:00:00' },
    { id: nextId('notices'), title: 'Campus Placement Drive: Google & Microsoft Software Engineering Internships', content: 'Training and Placement Cell (TnP) is pleased to announce recruitment drives for 2027 graduating batch. Eligibility: CGPA >= 8.0, No active backlogs. Registration closes on March 15 on the ERP Placement portal.', category: 'Placement', target_audience: 'Students', department_id: deptCSEId, posted_by: 'Training & Placement Cell', is_pinned: 1, created_at: '2026-09-22 14:30:00' },
    { id: nextId('notices'), title: 'Submission of Minor-1 Assignment Scores on ERP Portal by March 5', content: 'All faculty members are requested to complete evaluation of assignments and upload internal marks on the ERP system. Students can simulate their expected grade through the CGPA Probability Module.', category: 'Academic', target_audience: 'Faculty', department_id: deptCSEId, posted_by: 'Dean Academics Office', is_pinned: 0, created_at: '2026-09-24 09:15:00' },
    { id: nextId('notices'), title: 'Annual Technical Symposium GATES 2026 - Hackathon Registrations Open', content: 'Guru Tegh Bahadur Institute of Technology invites all students to participate in GATES 2026 36-hour National Hackathon. Attractive cash prizes and direct interview opportunities with sponsoring companies.', category: 'Event', target_audience: 'All', department_id: deptCSEId, posted_by: 'GTBIT Student Council', is_pinned: 0, created_at: '2026-09-25 12:00:00' }
  ]);

  // 13. Library Books & Issues
  const b1 = nextId('library_books');
  const b2 = nextId('library_books');
  const b3 = nextId('library_books');
  const b4 = nextId('library_books');
  const b5 = nextId('library_books');

  await LibraryBook.insertMany([
    { id: b1, isbn: '978-0131103627', title: 'The C Programming Language', author: 'Brian W. Kernighan, Dennis Ritchie', category: 'Computer Science', edition: '2nd Edition', total_copies: 10, available_copies: 7, shelf_location: 'Shelf CS-01' },
    { id: b2, isbn: '978-0262033848', title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest, Stein', category: 'Algorithms', edition: '3rd Edition', total_copies: 12, available_copies: 4, shelf_location: 'Shelf CS-04' },
    { id: b3, isbn: '978-1118063330', title: 'Operating System Concepts', author: 'Silberschatz, Galvin, Gagne', category: 'Operating Systems', edition: '10th Edition', total_copies: 15, available_copies: 6, shelf_location: 'Shelf CS-02' },
    { id: b4, isbn: '978-0133594140', title: 'Computer Networking: A Top-Down Approach', author: 'James Kurose, Keith Ross', category: 'Networking', edition: '7th Edition', total_copies: 14, available_copies: 8, shelf_location: 'Shelf CS-05' },
    { id: b5, isbn: '978-0078022128', title: 'Software Engineering: A Practitioner’s Approach', author: 'Roger S. Pressman, Bruce Maxim', category: 'Software Engg', edition: '8th Edition', total_copies: 8, available_copies: 5, shelf_location: 'Shelf CS-03' }
  ]);

  await LibraryIssue.insertMany([
    { id: nextId('library_issues'), book_id: b2, student_id: sTejassveerId, issue_date: '2026-08-10', due_date: '2026-09-10', return_date: null, fine_amount: 0, status: 'Issued' },
    { id: nextId('library_issues'), book_id: b3, student_id: sDevId, issue_date: '2026-08-12', due_date: '2026-09-12', return_date: null, fine_amount: 0, status: 'Issued' },
    { id: nextId('library_issues'), book_id: b4, student_id: sKrishmeetId, issue_date: '2026-08-15', due_date: '2026-09-15', return_date: null, fine_amount: 0, status: 'Issued' },
    { id: nextId('library_issues'), book_id: b5, student_id: sAmanId, issue_date: '2026-07-10', due_date: '2026-08-10', return_date: null, fine_amount: 170.0, status: 'Overdue' }
  ]);

  // 14. Hostel Rooms & Allocations
  const r101 = nextId('hostel_rooms');
  const r102 = nextId('hostel_rooms');
  const r201 = nextId('hostel_rooms');
  const r202 = nextId('hostel_rooms');

  await HostelRoom.insertMany([
    { id: r101, block_name: 'Block-A (Boys)', room_no: 'A-101', floor: 1, capacity: 2, occupied_count: 2, fee_per_semester: 28000 },
    { id: r102, block_name: 'Block-A (Boys)', room_no: 'A-102', floor: 1, capacity: 2, occupied_count: 1, fee_per_semester: 28000 },
    { id: r201, block_name: 'Block-B (Girls)', room_no: 'B-201', floor: 2, capacity: 2, occupied_count: 1, fee_per_semester: 28000 },
    { id: r202, block_name: 'Block-B (Girls)', room_no: 'B-202', floor: 2, capacity: 2, occupied_count: 0, fee_per_semester: 28000 }
  ]);

  await HostelAllocation.insertMany([
    { id: nextId('hostel_allocations'), room_id: r101, student_id: sTejassveerId, allocation_date: '2025-08-01', status: 'Allocated' },
    { id: nextId('hostel_allocations'), room_id: r101, student_id: sDevId, allocation_date: '2025-08-01', status: 'Allocated' },
    { id: nextId('hostel_allocations'), room_id: r201, student_id: sHargunId, allocation_date: '2025-08-01', status: 'Allocated' }
  ]);

  // 15. Placement Drives & Applications
  const driveGoogle = nextId('placement_drives');
  const driveMicrosoft = nextId('placement_drives');
  const driveZomato = nextId('placement_drives');

  await PlacementDrive.insertMany([
    { id: driveGoogle, company_name: 'Google India', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', role_title: 'Software Engineering Intern (Systems & Cloud)', job_location: 'Bengaluru / Hyderabad', ctc_lpa: 28.0, eligibility_min_cgpa: 8.5, drive_date: '2026-10-15', deadline: '2026-10-05', description: 'Work with core Google Cloud, distributed databases, and high-throughput networking infrastructure. 6-month pre-placement offer available.', status: 'Active' },
    { id: driveMicrosoft, company_name: 'Microsoft IDC', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg', role_title: 'Software Development Engineer (Azure Core)', job_location: 'Noida / Hyderabad', ctc_lpa: 24.5, eligibility_min_cgpa: 8.0, drive_date: '2026-10-22', deadline: '2026-10-10', description: 'Design and optimize Azure hyper-scale cloud microservices, kernel-level virtualization, and scalable APIs.', status: 'Active' },
    { id: driveZomato, company_name: 'Zomato Technologies', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Zomato_Logo.svg', role_title: 'Full Stack Engineer (Core Platform)', job_location: 'Gurugram', ctc_lpa: 16.5, eligibility_min_cgpa: 7.5, drive_date: '2026-11-02', deadline: '2026-10-25', description: 'Build real-time high-concurrency order dispatching systems, payment pipelines, and low-latency frontend applications.', status: 'Upcoming' }
  ]);

  await PlacementApplication.insertMany([
    { id: nextId('placement_applications'), drive_id: driveGoogle, student_id: sHargunId, applied_at: '2026-09-23 11:00:00', resume_link: 'https://gtbit.ac.in/resumes/hargun_resume.pdf', status: 'Shortlisted', feedback: 'Profile shortlisted for Online Technical Assessment' },
    { id: nextId('placement_applications'), drive_id: driveGoogle, student_id: sTejassveerId, applied_at: '2026-09-23 11:30:00', resume_link: 'https://gtbit.ac.in/resumes/tejassveer_resume.pdf', status: 'Shortlisted', feedback: 'Profile shortlisted for Online Technical Assessment' },
    { id: nextId('placement_applications'), drive_id: driveMicrosoft, student_id: sTejassveerId, applied_at: '2026-09-24 10:15:00', resume_link: 'https://gtbit.ac.in/resumes/tejassveer_resume.pdf', status: 'Applied', feedback: 'Application under review by HR team' },
    { id: nextId('placement_applications'), drive_id: driveMicrosoft, student_id: sDevId, applied_at: '2026-09-24 12:00:00', resume_link: 'https://gtbit.ac.in/resumes/dev_resume.pdf', status: 'Applied', feedback: 'Application under review by HR team' },
    { id: nextId('placement_applications'), drive_id: driveMicrosoft, student_id: sKrishmeetId, applied_at: '2026-09-24 14:00:00', resume_link: 'https://gtbit.ac.in/resumes/krishmeet_resume.pdf', status: 'Applied', feedback: 'Application under review by HR team' }
  ]);

  // 16. Student Points (core + 900 students)
  const pointsToInsert = [
    { id: nextId('student_points'), student_id: sHargunId, academic_score: 480, attendance_score: 240, assignment_score: 230, total_merit_points: 950, merit_rank: 1, badges_json: JSON.stringify(['Top Ranker #1', 'Attendance Champion 90%+', 'Assignment Ace', 'Dean’s Scholar']) },
    { id: nextId('student_points'), student_id: sTejassveerId, academic_score: 465, attendance_score: 230, assignment_score: 225, total_merit_points: 920, merit_rank: 2, badges_json: JSON.stringify(['Top Ranker #2', 'Attendance Master', 'Full Stack Prodigy', 'Algorithm Solver']) },
    { id: nextId('student_points'), student_id: sKrishmeetId, academic_score: 450, attendance_score: 225, assignment_score: 215, total_merit_points: 890, merit_rank: 3, badges_json: JSON.stringify(['Top Ranker #3', 'Network Specialist', 'Consistent Achiever']) },
    { id: nextId('student_points'), student_id: sDevId, academic_score: 440, attendance_score: 220, assignment_score: 210, total_merit_points: 870, merit_rank: 4, badges_json: JSON.stringify(['System Architect', 'Consistent Performer', 'Quiz Master']) },
    { id: nextId('student_points'), student_id: sAmanId, academic_score: 320, attendance_score: 150, assignment_score: 160, total_merit_points: 630, merit_rank: 14, badges_json: JSON.stringify(['Participation Ribbon']) }
  ];

  for (const gs of generatedStudentIds) {
    const acad = Math.round(gs.cgpa * 45);
    const att = 160 + (gs.id % 70);
    const ass = 150 + (gs.id % 65);
    pointsToInsert.push({
      id: nextId('student_points'),
      student_id: gs.id,
      academic_score: acad,
      attendance_score: att,
      assignment_score: ass,
      total_merit_points: acad + att + ass,
      merit_rank: 15 + gs.rankOffset,
      badges_json: JSON.stringify(gs.cgpa >= 8.8 ? ['Dean’s Scholar', 'Consistent Achiever'] : ['Active Learner'])
    });
  }
  await StudentPoints.insertMany(pointsToInsert);

  // 17. Study Plans
  await StudyPlan.insertMany([
    { id: nextId('study_plans'), student_id: sTejassveerId, subject_id: subAlgo, priority: 'High', recommended_weekly_hours: 5.5, completed_hours_this_week: 3.0, weak_topics: 'NP-Completeness proofs, Amortized analysis of Fibonacci Heaps', notes: 'Focus on problem set 4 before Minor-2 examinations.' },
    { id: nextId('study_plans'), student_id: sTejassveerId, subject_id: subOS, priority: 'Moderate', recommended_weekly_hours: 4.0, completed_hours_this_week: 2.5, weak_topics: 'Deadlock avoidance with Banker Algorithm in multi-resource instances', notes: 'Practice synchronization semaphore code.' },
    { id: nextId('study_plans'), student_id: sAmanId, subject_id: subAlgo, priority: 'Critical', recommended_weekly_hours: 7.5, completed_hours_this_week: 1.0, weak_topics: 'Graph Traversals, Recurrence Relations, Dynamic Programming', notes: 'URGENT: Low coursework score + high subject difficulty. Daily 1.5 hr recommended.' }
  ]);

  // 18. Notifications
  await Notification.insertMany([
    { id: nextId('notifications'), user_id: studentTejassveerUserId, title: 'Predicted CGPA Updated', message: 'Your CGPA Probability Module computed a projected semester SGPA of 8.94 (CGPA: 8.82) with 88% confidence band.', type: 'cgpa_warning', link_url: '/cgpa-simulator', is_read: 0 },
    { id: nextId('notifications'), user_id: studentTejassveerUserId, title: 'Shortlisted for Google India Online Assessment', message: 'Congratulations! Your resume has been shortlisted for the Software Engineering Internship drive.', type: 'general', link_url: '/placements', is_read: 0 },
    { id: nextId('notifications'), user_id: studentAmanUserId, title: 'CRITICAL: Low Attendance Warning (67.5%)', message: 'Your attendance is below the mandatory 75% threshold in Algorithms and OS. You must attend the next 8 consecutive lectures to avoid detention.', type: 'attendance_alert', link_url: '/attendance', is_read: 0 },
    { id: nextId('notifications'), user_id: parentAmanId, title: 'ATTENDANCE ALERT: Aman Gupta is below 75%', message: 'Your ward Aman Gupta has an attendance percentage of 67.5% in Semester 4. Institution mandates >=75% for exam eligibility.', type: 'attendance_alert', link_url: '/attendance', is_read: 0 },
    { id: nextId('notifications'), user_id: parentAmanId, title: 'Fee Overdue Reminder - Sem 4 Tuition Fee', message: 'Semester 4 college fee of Rs. 85,000 + Rs. 1,500 late fine is overdue. Please complete payment through the online payment portal.', type: 'fee_reminder', link_url: '/fees', is_read: 0 }
  ]);

  // 19. Faculty Class & Subject Mapping
  await FacultyClassMap.insertMany([
    { id: nextId('faculty_class_map'), faculty_id: facNandi, subject_id: subAlgo, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facNandi, subject_id: subSE, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facNandi, subject_id: subAlgoLab, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSharma, subject_id: subOS, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSharma, subject_id: subOSLab, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSingh, subject_id: subCN, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSingh, subject_id: subAI, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' }
  ]);

  // 20. Ward Links
  await WardLink.insertMany([
    { id: nextId('ward_links'), parent_user_id: parentTejassveerId, student_id: sTejassveerId, relationship: 'Father', is_primary: 1 },
    { id: nextId('ward_links'), parent_user_id: parentTejassveerId, student_id: sDevId, relationship: 'Guardian', is_primary: 0 },
    { id: nextId('ward_links'), parent_user_id: parentAmanId, student_id: sAmanId, relationship: 'Father', is_primary: 1 }
  ]);

  // 21. Institutional Settings
  await InstitutionSetting.insertMany([
    { setting_key: 'attendance_threshold', setting_value: '75.0', description: 'Mandatory minimum attendance percentage required for university exam eligibility', category: 'Academic', updated_by: adminUserId },
    {
      setting_key: 'grading_scale',
      setting_value: JSON.stringify({
        O: { min: 90, points: 10, label: 'Outstanding' },
        'A+': { min: 80, points: 9, label: 'Excellent' },
        A: { min: 70, points: 8, label: 'Very Good' },
        'B+': { min: 60, points: 7, label: 'Good' },
        B: { min: 50, points: 6, label: 'Above Average' },
        C: { min: 40, points: 5, label: 'Pass' },
        F: { min: 0, points: 0, label: 'Fail' }
      }),
      description: 'Official GGSIPU 10-point absolute letter grading system',
      category: 'Academic',
      updated_by: adminUserId
    },
    { setting_key: 'academic_session', setting_value: '2025-2026', description: 'Active academic year and semester cycle', category: 'General', updated_by: adminUserId },
    { setting_key: 'late_fee_per_day', setting_value: '100', description: 'Penalty fine in INR applied per day past semester tuition due date', category: 'Financial', updated_by: adminUserId },
    {
      setting_key: 'cgpa_probability_weights',
      setting_value: JSON.stringify({ difficulty_weight: 0.35, internal_weight: 0.45, attendance_weight: 0.20 }),
      description: 'Weights assigned to subject difficulty, continuous internal marks, and live attendance',
      category: 'Analytics',
      updated_by: adminUserId
    }
  ]);

  // 22. Audit Logs
  await AuditLog.insertMany([
    { id: nextId('audit_logs'), user_id: adminUserId, user_role: 'admin', user_email: 'admin@gtbit.ac.in', action: 'ATTENDANCE_OVERRIDE', entity_type: 'attendance_records', entity_id: '142', old_value: JSON.stringify({ status: 'Absent', date: '2026-09-12' }), new_value: JSON.stringify({ status: 'Present (Duty Leave)', approvedBy: 'Dean Academics' }), reason: 'Student attended Inter-College Smart India Hackathon representing GTBIT', ip_address: '192.168.1.15' },
    { id: nextId('audit_logs'), user_id: adminUserId, user_role: 'admin', user_email: 'admin@gtbit.ac.in', action: 'FEE_FINE_WAIVER', entity_type: 'student_fee_payments', entity_id: '3', old_value: JSON.stringify({ fine_amount: 1500 }), new_value: JSON.stringify({ fine_amount: 0, waiver_applied: true }), reason: 'Medical exemption approved by Principal / Director', ip_address: '192.168.1.15' },
    { id: nextId('audit_logs'), user_id: adminUserId, user_role: 'admin', user_email: 'admin@gtbit.ac.in', action: 'MARKS_MODERATION', entity_type: 'exam_marks', entity_id: '88', old_value: JSON.stringify({ internal_assessment: 18 }), new_value: JSON.stringify({ internal_assessment: 22 }), reason: 'Re-evaluation of Unit Test 2 answer sheet verified by HOD', ip_address: '192.168.1.15' }
  ]);

  // 23. GTBIT Societies, Memberships, Society Duty Attendance & Forum
  const coordinatorAssignments = {
    'Google Developer Student Club': { studentId: sTejassveerId, facultyId: facNandi },
    'Technical Society of GTBIT': { studentId: sTejassveerId, facultyId: facSingh },
    IEEE: { studentId: sHargunId, facultyId: facSharma },
    'Entrepreneurship Cell': { studentId: sDevId, facultyId: facNandi },
    'Gaming-Titans': { studentId: sKrishmeetId, facultyId: facSharma }
  };

  const societyIds = {};
  const societiesToInsert = GTBIT_SOCIETIES.map(soc => {
    const id = nextId('societies');
    societyIds[soc.name] = id;
    const assign = coordinatorAssignments[soc.name] || { studentId: null, facultyId: null };
    return {
      id,
      name: soc.name,
      description: soc.description,
      category: soc.category,
      coordinator_student_id: assign.studentId,
      coordinator_faculty_id: assign.facultyId
    };
  });
  await Society.insertMany(societiesToInsert);

  const nowIso = new Date().toISOString();
  await SocietyMember.insertMany([
    { id: nextId('society_members'), society_id: societyIds['Google Developer Student Club'], student_id: sTejassveerId, status: 'approved', application_message: 'Core Cloud & Web Lead', decided_at: nowIso, decided_by: adminUserId },
    { id: nextId('society_members'), society_id: societyIds['Google Developer Student Club'], student_id: sHargunId, status: 'approved', application_message: 'ML & AI Track Contributor', decided_at: nowIso, decided_by: studentTejassveerUserId },
    { id: nextId('society_members'), society_id: societyIds['IEEE'], student_id: sHargunId, status: 'approved', application_message: 'IEEE Student Branch Coordinator', decided_at: nowIso, decided_by: adminUserId },
    { id: nextId('society_members'), society_id: societyIds['Entrepreneurship Cell'], student_id: sDevId, status: 'approved', application_message: 'E-Cell Coordinator', decided_at: nowIso, decided_by: adminUserId },
    { id: nextId('society_members'), society_id: societyIds['Google Developer Student Club'], student_id: sDevId, status: 'pending', application_message: 'Would love to contribute to the Web & React study jam sessions.', decided_at: null, decided_by: null },
    { id: nextId('society_members'), society_id: societyIds['Google Developer Student Club'], student_id: sAmanId, status: 'pending', application_message: 'Interested in attending Android & Cloud workshops.', decided_at: null, decided_by: null },
    { id: nextId('society_members'), society_id: societyIds['Technical Society of GTBIT'], student_id: sKrishmeetId, status: 'pending', application_message: 'Want to help organize the annual GTBIT hackathon.', decided_at: null, decided_by: null }
  ]);

  const algoSess = await AttendanceSession.findOne({ subject_id: subAlgo }).sort({ session_date: -1 }).lean();
  const osSess = await AttendanceSession.findOne({ subject_id: subOS }).sort({ session_date: -1 }).lean();
  const cnSess = await AttendanceSession.findOne({ subject_id: subCN }).sort({ session_date: -1 }).lean();

  const [algoOwner, osOwner, cnOwner] = await Promise.all([
    findOwningFacultyId(subAlgo, 4, 'CSE-2'),
    findOwningFacultyId(subOS, 4, 'CSE-2'),
    findOwningFacultyId(subCN, 4, 'CSE-2')
  ]);

  const approvedSarId = nextId('society_attendance_requests');
  await SocietyAttendanceRequest.insertMany([
    { id: approvedSarId, student_id: sTejassveerId, society_id: societyIds['Google Developer Student Club'], class_subject_id: subAlgo, date: algoSess ? algoSess.session_date : '2026-09-20', session_period: algoSess ? algoSess.slot_time : '10:00 - 11:00', activity_title: 'GDSC Cloud Study Jam Setup & Mentoring', reason: 'Coordinating lab setup and mentoring 1st year students for Google Cloud Study Jam.', status: 'approved', assigned_faculty_id: algoOwner, reviewed_by_faculty_id: facNandi, reviewer_remarks: 'Approved — verified with GDSC faculty coordinator.', reviewed_at: nowIso },
    { id: nextId('society_attendance_requests'), student_id: sAmanId, society_id: societyIds['Technical Society of GTBIT'], class_subject_id: subAlgo, date: algoSess ? algoSess.session_date : '2026-09-20', session_period: '10:00 - 11:00', activity_title: 'Smart India Hackathon Internal Screening', reason: 'Presenting prototype at Auditorium during lecture slot.', status: 'pending', assigned_faculty_id: algoOwner, reviewed_by_faculty_id: null, reviewer_remarks: null, reviewed_at: null },
    { id: nextId('society_attendance_requests'), student_id: sDevId, society_id: societyIds['Entrepreneurship Cell'], class_subject_id: subOS, date: osSess ? osSess.session_date : '2026-09-21', session_period: '10:00 - 11:00', activity_title: 'E-Cell Founder Fireside Chat Logistics', reason: 'Managing stage and guest hospitality at Seminar Hall.', status: 'pending', assigned_faculty_id: osOwner, reviewed_by_faculty_id: null, reviewer_remarks: null, reviewed_at: null },
    { id: nextId('society_attendance_requests'), student_id: sKrishmeetId, society_id: societyIds['Gaming-Titans'], class_subject_id: subCN, date: cnSess ? cnSess.session_date : '2026-09-22', session_period: '10:00 - 11:00', activity_title: 'E-Sports Scrimmage Practice', reason: 'Practice match in Lab 2.', status: 'rejected', assigned_faculty_id: cnOwner, reviewed_by_faculty_id: facSingh, reviewer_remarks: 'Informal practice scrimmages are not eligible for duty exemption.', reviewed_at: nowIso }
  ]);

  // Sync counters before applySocietyCredit in case it inserts a record
  for (const [col, val] of Object.entries(counters)) {
    await resetCounter(col, val);
  }
  await applySocietyCredit(approvedSarId);

  // Forum Seed Threads
  const t1 = nextId('forum_threads');
  const t2 = nextId('forum_threads');
  const t3 = nextId('forum_threads');
  const t4 = nextId('forum_threads');

  await ForumThread.insertMany([
    { id: t1, author_id: studentTejassveerUserId, author_role: 'student', scope: 'subject', subject_id: subAlgo, society_id: null, title: 'Clarification on Bellman-Ford Negative Cycle Detection', is_resolved: 1 },
    { id: t2, author_id: studentDevUserId, author_role: 'student', scope: 'subject', subject_id: subOS, society_id: null, title: 'Thrashing vs Belady’s Anomaly in Page Replacement', is_resolved: 0 },
    { id: t3, author_id: adminUserId, author_role: 'admin', scope: 'general', subject_id: null, society_id: null, title: 'GGSIPU End-Term Exam Form & 75% Attendance Guidelines', is_resolved: 1 },
    { id: t4, author_id: studentDevUserId, author_role: 'student', scope: 'society', subject_id: null, society_id: societyIds['Google Developer Student Club'], title: 'Google Developer Student Club — Applicant Inquiry (Dev Sharma)', is_resolved: 0 }
  ]);

  const p1 = nextId('forum_posts');
  const p2 = nextId('forum_posts');
  const p3 = nextId('forum_posts');
  const p4 = nextId('forum_posts');
  const p5 = nextId('forum_posts');
  const p6 = nextId('forum_posts');
  const p7 = nextId('forum_posts');

  await ForumPost.insertMany([
    { id: p1, thread_id: t1, parent_post_id: null, author_id: studentTejassveerUserId, author_role: 'student', body: 'In Unit 3, why do we run one extra (V-th) relaxation pass in Bellman-Ford? Does any vertex whose distance updates indicate a negative cycle reachable from the source?', is_faculty_answer: 0 },
    { id: p2, thread_id: t1, parent_post_id: p1, author_id: facNandiId, author_role: 'faculty', body: 'Great question! After V-1 passes, all shortest paths without negative cycles have converged. If any edge (u, v) can still be relaxed on the V-th pass, it proves a negative-weight cycle is reachable from the source vertex.', is_faculty_answer: 1 },
    { id: p3, thread_id: t1, parent_post_id: p2, author_id: studentHargunUserId, author_role: 'student', body: 'Also remember: if the negative cycle is disconnected from the source, dist[u] stays Infinity so it will not trigger relaxation.', is_faculty_answer: 0 },
    { id: p4, thread_id: t2, parent_post_id: null, author_id: studentDevUserId, author_role: 'student', body: 'Could someone explain the difference between thrashing and Belady’s anomaly? Does LRU ever suffer from Belady’s anomaly?', is_faculty_answer: 0 },
    { id: p5, thread_id: t3, parent_post_id: null, author_id: adminUserId, author_role: 'admin', body: 'Students are reminded that approved Society Duty attendance counts toward the mandatory 75% GGSIPU attendance threshold. Please submit duty requests within 3 days of the event.', is_faculty_answer: 1 },
    { id: p6, thread_id: t4, parent_post_id: null, author_id: studentDevUserId, author_role: 'student', body: 'Hi Tejassveer! I applied to GDSC — when are the upcoming React & Cloud Study Jam coordinator interviews?', is_faculty_answer: 0 }
  ]);

  await ForumLike.insertMany([
    { id: nextId('forum_likes'), post_id: p2, user_id: studentTejassveerUserId, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p2, user_id: studentHargunUserId, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p5, user_id: studentTejassveerUserId, user_role: 'student' }
  ]);

  // Final counter sync
  for (const [col, val] of Object.entries(counters)) {
    await resetCounter(col, val);
  }

  console.log(`Database seeding successfully finished! Total students seeded: ${studentsToInsert.length} (5 core + 900 branch students).`);
  await mongoose.disconnect();
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding database:', err);
    process.exit(1);
  });
