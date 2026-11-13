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
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya',
  'Atharv', 'Kabir', 'Rohan', 'Rishabh', 'Harsh', 'Karan', 'Pranav', 'Siddharth', 'Yash', 'Manav',
  'Devansh', 'Gaurav', 'Tushar', 'Nikhil', 'Varun', 'Chirag', 'Mayank', 'Piyush', 'Anshul', 'Kartik',
  'Ritvik', 'Samarth', 'Tanmay', 'Utkarsh', 'Vedant', 'Yuvraj', 'Zubin', 'Abhinav', 'Akash', 'Anirudh',
  'Bhavya', 'Chetan', 'Darshan', 'Eshaan', 'Farhan', 'Gautam', 'Hardik', 'Ishan', 'Jatin', 'Kunal',
  'Lakshay', 'Mihir', 'Naman', 'Omkar', 'Parth', 'Raghav', 'Sagar', 'Tarun', 'Uday', 'Vaibhav',
  'Ananya', 'Diya', 'Aadhya', 'Myra', 'Sara', 'Ira', 'Anika', 'Navya', 'Riya', 'Meher',
  'Simran', 'Gurleen', 'Harpreet', 'Jasleen', 'Tanvi', 'Nandini', 'Khushi', 'Ishita', 'Sneha', 'Aditi',
  'Aishwarya', 'Akshita', 'Avni', 'Bhumi', 'Charvi', 'Deepika', 'Esha', 'Gauri', 'Hina', 'Jhanvi',
  'Kavya', 'Lavanya', 'Mahima', 'Neha', 'Ojasvi', 'Palak', 'Radhika', 'Sakshi', 'Tanya', 'Urvi'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kaur', 'Malhotra', 'Kapoor', 'Khanna', 'Bhatia', 'Sethi',
  'Arora', 'Chawla', 'Bansal', 'Aggarwal', 'Jain', 'Mehta', 'Nair', 'Rao', 'Yadav', 'Tiwari',
  'Pandey', 'Mishra', 'Dubey', 'Chauhan', 'Rajput', 'Gill', 'Sandhu', 'Dhillon', 'Grewal', 'Bedi',
  'Bakshi', 'Chopra', 'Desai', 'Goswami', 'Iyer', 'Joshi', 'Kulkarni', 'Menon', 'Narang', 'Oberoi',
  'Parekh', 'Qureshi', 'Rana', 'Saxena', 'Tandon', 'Uppal', 'Vohra', 'Walia', 'Ahluwalia', 'Bhardwaj',
  'Chatterjee', 'Das', 'Ghosh', 'Hegde', 'Khatri', 'Lamba', 'Madan', 'Nanda', 'Puri', 'Sood'
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

  // Additional Faculty across ALL 5 departments (CSE, IT, ECE, AI-ML, AI-DS)
  const extraFacultySpecs = [
    { name: 'Dr. Anjali Deshmukh', empId: 'FAC-CSE-004', deptId: deptCSEId, courseId: courseBTechCSEId, sections: ['CSE-1', 'CSE-3', 'CSE-E1'], subCode: 'ETCS-212', subName: 'Compiler Design & Automata', sem: 4, desig: 'Assistant Professor', qual: 'Ph.D (Distributed Systems)', hrs: 16, room: 'Room 305-A' },
    { name: 'Prof. Harinder Kaur', empId: 'FAC-IT-001', deptId: deptITId, courseId: courseBTechITId, sections: ['IT-1', 'IT-2', 'IT-3'], subCode: 'ETIT-202', subName: 'Information Security & Cyber Law', sem: 4, desig: 'Professor & Head (IT)', qual: 'Ph.D (Information Security)', hrs: 14, room: 'Room 401-A' },
    { name: 'Dr. Vivek Kulkarni', empId: 'FAC-IT-002', deptId: deptITId, courseId: courseBTechITId, sections: ['IT-1', 'IT-2'], subCode: 'ETIT-204', subName: 'Cloud Native Architecture', sem: 4, desig: 'Associate Professor', qual: 'Ph.D (Cloud Computing)', hrs: 16, room: 'Room 402-B' },
    { name: 'Ms. Priya Nair', empId: 'FAC-IT-003', deptId: deptITId, courseId: courseBTechITId, sections: ['IT-2', 'IT-3'], subCode: 'ETIT-206', subName: 'Enterprise Web Engineering', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Software Engineering)', hrs: 18, room: 'Room 403-A' },
    { name: 'Mr. Saurabh Tiwari', empId: 'FAC-IT-004', deptId: deptITId, courseId: courseBTechITId, sections: ['IT-1', 'IT-3'], subCode: 'ETIT-208', subName: 'Data Communication & Switching', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Data Networks)', hrs: 18, room: 'Room 404-B' },
    { name: 'Dr. Arvind Krishnan', empId: 'FAC-ECE-001', deptId: deptECEId, courseId: courseBTechECEId, sections: ['ECE-1', 'ECE-2', 'ECE-3'], subCode: 'ETEC-202', subName: 'VLSI Design & CMOS Logic', sem: 4, desig: 'Professor & Head (ECE)', qual: 'Ph.D (VLSI Design)', hrs: 14, room: 'Room 201-A' },
    { name: 'Dr. Meenakshi Iyer', empId: 'FAC-ECE-002', deptId: deptECEId, courseId: courseBTechECEId, sections: ['ECE-1', 'ECE-2'], subCode: 'ETEC-204', subName: 'Digital Signal Processing', sem: 4, desig: 'Associate Professor', qual: 'Ph.D (Signal Processing)', hrs: 16, room: 'Room 202-B' },
    { name: 'Mr. Rohit Chatterjee', empId: 'FAC-ECE-003', deptId: deptECEId, courseId: courseBTechECEId, sections: ['ECE-2', 'ECE-3'], subCode: 'ETEC-206', subName: 'Embedded Systems & RTOS', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Embedded Systems)', hrs: 18, room: 'Room 203-A' },
    { name: 'Ms. Kavita Joshi', empId: 'FAC-ECE-004', deptId: deptECEId, courseId: courseBTechECEId, sections: ['ECE-1', 'ECE-3'], subCode: 'ETEC-208', subName: 'Analog & Microwave Communication', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (RF & Microwave)', hrs: 18, room: 'Room 204-B' },
    { name: 'Dr. Siddharth Menon', empId: 'FAC-AIML-001', deptId: deptAIMLId, courseId: courseBTechAIMLId, sections: ['AIML-1', 'AIML-2'], subCode: 'ETML-202', subName: 'Deep Learning & Neural Architectures', sem: 4, desig: 'Professor & Head (AI-ML)', qual: 'Ph.D (Deep Learning)', hrs: 14, room: 'Room 501-A' },
    { name: 'Dr. Nidhi Saxena', empId: 'FAC-AIML-002', deptId: deptAIMLId, courseId: courseBTechAIMLId, sections: ['AIML-1', 'AIML-2'], subCode: 'ETML-204', subName: 'Computer Vision & Image Analytics', sem: 4, desig: 'Associate Professor', qual: 'Ph.D (Computer Vision)', hrs: 16, room: 'Room 502-B' },
    { name: 'Mr. Deepak Bhardwaj', empId: 'FAC-AIML-003', deptId: deptAIMLId, courseId: courseBTechAIMLId, sections: ['AIML-1'], subCode: 'ETML-206', subName: 'Natural Language Processing', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Natural Language Processing)', hrs: 18, room: 'Room 503-A' },
    { name: 'Ms. Shruti Oberoi', empId: 'FAC-AIML-004', deptId: deptAIMLId, courseId: courseBTechAIMLId, sections: ['AIML-2'], subCode: 'ETML-208', subName: 'Reinforcement Learning Systems', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Reinforcement Learning)', hrs: 18, room: 'Room 504-B' },
    { name: 'Dr. Prakash Hegde', empId: 'FAC-AIDS-001', deptId: deptAIDSId, courseId: courseBTechAIDSId, sections: ['AIDS-1', 'AIDS-2'], subCode: 'ETDS-202', subName: 'Big Data Engineering & Spark', sem: 4, desig: 'Professor & Head (AI-DS)', qual: 'Ph.D (Big Data Analytics)', hrs: 14, room: 'Room 601-A' },
    { name: 'Dr. Swati Gokhale', empId: 'FAC-AIDS-002', deptId: deptAIDSId, courseId: courseBTechAIDSId, sections: ['AIDS-1', 'AIDS-2'], subCode: 'ETDS-204', subName: 'Statistical Inference & Modeling', sem: 4, desig: 'Associate Professor', qual: 'Ph.D (Statistical Learning)', hrs: 16, room: 'Room 602-B' },
    { name: 'Mr. Manish Tandon', empId: 'FAC-AIDS-003', deptId: deptAIDSId, courseId: courseBTechAIDSId, sections: ['AIDS-1'], subCode: 'ETDS-206', subName: 'Data Warehousing & ETL Pipelines', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Data Engineering)', hrs: 18, room: 'Room 603-A' },
    { name: 'Ms. Ritu Ahluwalia', empId: 'FAC-AIDS-004', deptId: deptAIDSId, courseId: courseBTechAIDSId, sections: ['AIDS-2'], subCode: 'ETDS-208', subName: 'Predictive Analytics & Forecasting', sem: 4, desig: 'Assistant Professor', qual: 'M.Tech (Predictive Modeling)', hrs: 18, room: 'Room 604-B' }
  ];

  const extraFacultyDocs = [];
  const extraFacultyAllocations = [];
  extraFacultySpecs.forEach((f, idx) => {
    const facEmail = `${f.empId.toLowerCase()}@gtbit.ac.in`;
    const uId = addUser(
      facEmail,
      facultyPass,
      'faculty',
      f.name,
      `+91 98200 ${String(10100 + idx).padStart(5, '0')}`,
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    );
    const facId = nextId('faculty');
    extraFacultyDocs.push({
      id: facId,
      user_id: uId,
      employee_id: f.empId,
      department_id: f.deptId,
      designation: f.desig,
      qualification: f.qual,
      weekly_workload_hours: f.hrs,
      office_room: f.room,
      status: 'Active'
    });
    extraFacultyAllocations.push({
      facId,
      ...f
    });
  });
  await Faculty.insertMany(extraFacultyDocs);

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

  // Build shuffled pool of unique First+Last name pairs so no two generated students share a full name
  const uniqueNamePairs = [];
  for (const fn of FIRST_NAMES) {
    for (const ln of LAST_NAMES) {
      uniqueNamePairs.push({ first: fn, last: ln });
    }
  }
  for (let k = uniqueNamePairs.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [uniqueNamePairs[k], uniqueNamePairs[r]] = [uniqueNamePairs[r], uniqueNamePairs[k]];
  }

  const generatedStudentIds = [];
  let globalIdx = 1;

  for (const cohort of branchCohorts) {
    for (let i = 1; i <= cohort.count; i++) {
      const { first, last } = uniqueNamePairs[globalIdx - 1];
      const fullName = `${first} ${last}`;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}.${cohort.tag}${i}@gtbit.ac.in`;
      const phone = `+91 98${String(10000000 + ((globalIdx * 7919) % 89999999)).padStart(8, '0')}`;
      const section = cohort.sections[(i - 1) % cohort.sections.length];
      const semester = Math.floor(Math.random() * 6) + 1;
      const admYear = semester <= 2 ? 2025 : (semester <= 4 ? 2024 : 2023);
      const rollNo = `${String(i).padStart(3, '0')}/${cohort.label}/${admYear}`;
      const enrollmentNo = `${String(globalIdx + 700).padStart(4, '0')}1320${cohort.enrollPrefix}${String(admYear).slice(-2)}`;
      const cgpa = Number((5.25 + Math.random() * 4.5).toFixed(2));
      const dobMonth = String(((globalIdx % 12) + 1)).padStart(2, '0');
      const dobDay = String(((globalIdx % 28) + 1)).padStart(2, '0');
      const dobYear = 2003 + (semester <= 2 ? 3 : semester <= 4 ? 2 : 1);

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

  const deptFacultySubjects = extraFacultyAllocations.map((alloc) => {
    const subId = nextId('subjects');
    alloc.subId = subId;
    return {
      id: subId,
      course_id: alloc.courseId,
      code: alloc.subCode,
      name: alloc.subName,
      semester: alloc.sem,
      credits: 4,
      type: 'Theory',
      faculty_id: alloc.facId,
      historical_pass_pct: Number((82 + Math.random() * 14).toFixed(1)),
      historical_avg_marks: Number((66 + Math.random() * 14).toFixed(1)),
      difficulty_index: Number((0.35 + Math.random() * 0.35).toFixed(2)),
      syllabus_outline: `Unit 1: Foundations of ${alloc.subName}, Unit 2: Core Algorithms & Architectures, Unit 3: Applied Systems & Design, Unit 4: Advanced Case Studies`
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
    ...extraSubjectDocs,
    ...deptFacultySubjects
  ]);

  // 6. Timetable Slots (Core + All New Department Faculty)
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

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const slotTimes = [
    ['09:00', '10:00'],
    ['10:00', '11:00'],
    ['11:15', '12:15'],
    ['12:15', '13:15']
  ];
  extraFacultyAllocations.forEach((alloc, idx) => {
    alloc.sections.forEach((sec, secIdx) => {
      const day1 = weekDays[(idx + secIdx) % weekDays.length];
      const day2 = weekDays[(idx + secIdx + 2) % weekDays.length];
      const [s1, e1] = slotTimes[(idx + secIdx) % slotTimes.length];
      const [s2, e2] = slotTimes[(idx + secIdx + 1) % slotTimes.length];
      slotsRaw.push([alloc.subId, alloc.facId, alloc.sem, sec, day1, s1, e1, alloc.room]);
      slotsRaw.push([alloc.subId, alloc.facId, alloc.sem, sec, day2, s2, e2, alloc.room]);
    });
  });
  await TimetableSlot.insertMany(
    slotsRaw.map(([subject_id, faculty_id, semester, section, day_of_week, start_time, end_time, room_no]) => ({
      id: nextId('timetable_slots'),
      subject_id, faculty_id, semester, section, day_of_week, start_time, end_time, room_no
    }))
  );

  // 7. Attendance Sessions & Randomized Historical Records (All 6 Semesters, All 905 Students)
  const sessionsToInsert = [];
  const sessionsBySem = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const startDate = new Date('2026-08-01');
  const facPool = [facSharma, facNandi, facSingh];
  let sessionCounter = 0;

  for (let sem = 1; sem <= 6; sem++) {
    const semSubs = theorySubjectsBySem[sem] || [];
    for (let week = 0; week < 6; week++) {
      semSubs.forEach((subId, subIdx) => {
        sessionCounter++;
        const sessionDate = new Date(startDate.getTime() + (week * 7 + (subIdx % 5)) * 86400000);
        const dateStr = sessionDate.toISOString().split('T')[0];
        const token = `QR_${subId}_${week}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const sessId = nextId('attendance_sessions');

        sessionsToInsert.push({
          id: sessId,
          subject_id: subId,
          faculty_id: facPool[(sem + subIdx) % facPool.length],
          section: 'CSE-2',
          semester: sem,
          session_date: dateStr,
          slot_time: '10:00 - 11:00',
          topic_covered: `Lecture ${week + 1}: Core Concepts & Case Studies (Sem ${sem})`,
          session_token: token,
          qr_expires_at: new Date(sessionDate.getTime() + 15 * 60000).toISOString()
        });
        sessionsBySem[sem].push({ id: sessId, dateIso: sessionDate.toISOString() });
      });
    }
  }

  const recordsToInsert = [];
  for (const st of studentsToInsert) {
    const targetAtt = 0.55 + Math.random() * 0.43; // 55% to 98% randomized per student
    const semSessions = sessionsBySem[st.semester] || sessionsBySem[4];
    for (const sess of semSessions) {
      const roll = Math.random();
      let status = 'Present';
      if (roll > targetAtt) {
        status = Math.random() < 0.2 ? 'Late' : 'Absent';
      }
      recordsToInsert.push({
        id: nextId('attendance_records'),
        session_id: sess.id,
        student_id: st.id,
        status,
        credit_type: 'Regular',
        method: status === 'Present' ? (Math.random() < 0.5 ? 'QR_Scan' : 'One_Tap') : 'Faculty_Manual',
        marked_at: sess.dateIso
      });
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
  console.log(`Inserting ${recordsToInsert.length} randomized attendance records across all 905 students...`);
  for (let i = 0; i < recordsToInsert.length; i += 5000) {
    await AttendanceRecord.insertMany(recordsToInsert.slice(i, i + 5000));
  }

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

  // Generate randomized individual semester marks for ALL 905 students across Semesters 1..6
  for (const st of studentsToInsert) {
    const baseFactor = Math.min(9.6, Math.max(5.2, st.current_cgpa || 7.5));
    for (let sem = 1; sem <= 6; sem++) {
      const semSubs = theorySubjectsBySem[sem] || [];
      const exId = examBySem[sem];
      for (const subId of semSubs) {
        const variance = (Math.random() * 26) - 13; // -13..+13 random spread
        const targetTot = Math.min(99, Math.max(38, Math.round(baseFactor * 9.3 + variance)));
        const internal = Number(Math.min(25, Math.max(8, Math.round(targetTot * (0.22 + Math.random() * 0.06)))).toFixed(1));
        const assignment = Number(Math.min(15, Math.max(5, Math.round(targetTot * (0.13 + Math.random() * 0.04)))).toFixed(1));
        const external = Number(Math.max(15, Math.min(60, targetTot - internal - assignment)).toFixed(1));
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
      }
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

  const extraAssignments = extraFacultyAllocations.map((alloc, idx) => ({
    id: nextId('assignments'),
    subject_id: alloc.subId,
    faculty_id: alloc.facId,
    title: `${alloc.subName} — Lab & Design Assignment ${idx + 1}`,
    description: `Complete the practical implementation and technical report for ${alloc.subName} (${alloc.subCode}) as assigned by ${alloc.name}.`,
    max_marks: 20,
    due_date: new Date(Date.now() + (4 + (idx % 10)) * 86400000).toISOString(),
    attachment_url: `https://gtbit.ac.in/materials/assignments/${alloc.subCode.toLowerCase()}_assignment.pdf`
  }));

  await Assignment.insertMany([
    { id: assignOS, subject_id: subOS, faculty_id: facSharma, title: 'Process Scheduling & Memory Paging Simulator', description: 'Implement Round-Robin (q=4ms), Shortest Job First, and LRU Page Replacement in C/C++ or Python with Gantt chart generation.', max_marks: 20, due_date: new Date(Date.now() + 5 * 86400000).toISOString(), attachment_url: 'https://gtbit.ac.in/materials/assignments/os_assignment_2.pdf' },
    { id: assignAlgo, subject_id: subAlgo, faculty_id: facNandi, title: 'Dynamic Programming & Network Flow Problems', description: 'Solve the 0/1 Knapsack problem with branch-and-bound optimization and implement Ford-Fulkerson algorithm for max-flow.', max_marks: 20, due_date: new Date(Date.now() + 8 * 86400000).toISOString(), attachment_url: 'https://gtbit.ac.in/materials/assignments/algo_assignment_3.pdf' },
    { id: assignSE, subject_id: subSE, faculty_id: facNandi, title: 'SRS & Architecture Design for Student ERP System', description: 'Prepare IEEE-830 compliant SRS document and architectural component diagram for the ERP portal modules.', max_marks: 25, due_date: new Date(Date.now() - 2 * 86400000).toISOString(), attachment_url: 'https://gtbit.ac.in/materials/assignments/se_assignment_1.pdf' },
    ...extraAssignments
  ]);

  await AssignmentSubmission.insertMany([
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sTejassveerId, submission_text: 'Submitted full SRS and UML Class & Sequence Diagrams.', file_url: 'https://gtbit.ac.in/uploads/submissions/tejassveer_se_srs.pdf', marks_obtained: 24.5, faculty_feedback: 'Outstanding software architecture and clear UML representation.', status: 'Graded' },
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sDevId, submission_text: 'Submitted comprehensive SRS with module state diagrams.', file_url: 'https://gtbit.ac.in/uploads/submissions/dev_se_srs.pdf', marks_obtained: 23.5, faculty_feedback: 'Well structured SRS with solid requirements traceability.', status: 'Graded' },
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sKrishmeetId, submission_text: 'Submitted SRS document with ER diagram analysis.', file_url: 'https://gtbit.ac.in/uploads/submissions/krishmeet_se_srs.pdf', marks_obtained: 23.0, faculty_feedback: 'Very good functional requirements breakdown.', status: 'Graded' },
    { id: nextId('assignment_submissions'), assignment_id: assignSE, student_id: sHargunId, submission_text: 'Submitted complete IEEE-830 specification.', file_url: 'https://gtbit.ac.in/uploads/submissions/hargun_se_srs.pdf', marks_obtained: 25.0, faculty_feedback: 'Exceptional detail, flawless design document.', status: 'Graded' }
  ]);

  // 10. Study Materials (Notes for Core + All New Department Faculty)
  const extraStudyMaterials = extraFacultyAllocations.map((alloc, idx) => ({
    id: nextId('study_materials'),
    subject_id: alloc.subId,
    faculty_id: alloc.facId,
    title: `${alloc.subName} — Comprehensive Lecture Notes (${alloc.name})`,
    unit_name: `Unit ${(idx % 4) + 1}: Core Concepts & Solved Examples`,
    file_type: idx % 3 === 0 ? 'PPTX' : 'PDF',
    file_url: `https://gtbit.ac.in/materials/${alloc.subCode.toLowerCase()}_notes.${idx % 3 === 0 ? 'pptx' : 'pdf'}`,
    file_size: `${(2.8 + (idx % 5) * 0.9).toFixed(1)} MB`
  }));

  await StudyMaterial.insertMany([
    { id: nextId('study_materials'), subject_id: subAlgo, faculty_id: facNandi, title: 'Dynamic Programming Master Notes & Cheat Sheet', unit_name: 'Unit 2: DP Algorithms', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/algo_unit2_dp.pdf', file_size: '4.2 MB' },
    { id: nextId('study_materials'), subject_id: subAlgo, faculty_id: facNandi, title: 'Bellman-Ford & Dijkstra Graph Proofs', unit_name: 'Unit 3: Graph Algorithms', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/algo_unit3_graphs.pdf', file_size: '3.1 MB' },
    { id: nextId('study_materials'), subject_id: subOS, faculty_id: facSharma, title: 'Virtual Memory, Inverted Page Tables & Thrashing', unit_name: 'Unit 3: Memory Management', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/os_unit3_memory.pdf', file_size: '5.8 MB' },
    { id: nextId('study_materials'), subject_id: subCN, faculty_id: facSingh, title: 'Subnetting, CIDR & BGP Routing Protocols', unit_name: 'Unit 3: Network Layer', file_type: 'PPTX', file_url: 'https://gtbit.ac.in/materials/cn_unit3_routing.pptx', file_size: '8.4 MB' },
    { id: nextId('study_materials'), subject_id: subAI, faculty_id: facSingh, title: 'A* Search and Alpha-Beta Pruning Algorithms', unit_name: 'Unit 1: Informed Search', file_type: 'PDF', file_url: 'https://gtbit.ac.in/materials/ai_unit1_search.pdf', file_size: '3.6 MB' },
    ...extraStudyMaterials
  ]);

  // 11. Semester-Wise Fee Structure (Semesters 1-6 across Courses) & Detailed Payments
  const feeStructuresToInsert = [];
  const feeStructByCourseSem = {};
  const allCourseIds = [courseBTechCSEId, courseBTechITId, courseBTechECEId, courseBTechAIMLId, courseBTechAIDSId];

  const semFeeConfigs = [
    { sem: 1, year: '2025-2026', tuition: 68000, lab: 14000, exam: 4500, lib: 4000, due: '2025-09-15' },
    { sem: 2, year: '2025-2026', tuition: 68000, lab: 12500, exam: 4500, lib: 3500, due: '2026-02-10' },
    { sem: 3, year: '2025-2026', tuition: 66000, lab: 13000, exam: 4500, lib: 3500, due: '2025-09-20' },
    { sem: 4, year: '2025-2026', tuition: 65000, lab: 12000, exam: 4500, lib: 3500, due: '2026-02-15' },
    { sem: 5, year: '2025-2026', tuition: 64000, lab: 11500, exam: 5000, lib: 3500, due: '2025-09-25' },
    { sem: 6, year: '2025-2026', tuition: 64000, lab: 11000, exam: 5000, lib: 3500, due: '2026-02-20' }
  ];

  for (const cId of allCourseIds) {
    const branchLabDelta = (cId === courseBTechAIMLId || cId === courseBTechAIDSId) ? 2000 : (cId === courseBTechECEId ? 1500 : 0);
    for (const cfg of semFeeConfigs) {
      const fsId = nextId('fee_structures');
      const labFee = cfg.lab + branchLabDelta;
      const total = cfg.tuition + labFee + cfg.exam + cfg.lib;
      feeStructuresToInsert.push({
        id: fsId,
        course_id: cId,
        semester: cfg.sem,
        academic_year: cfg.year,
        tuition_fee: cfg.tuition,
        lab_development_fee: labFee,
        exam_fee: cfg.exam,
        library_sports_fee: cfg.lib,
        total_amount: total,
        due_date: cfg.due
      });
      feeStructByCourseSem[`${cId}_${cfg.sem}`] = { id: fsId, total };
    }
  }
  await FeeStructure.insertMany(feeStructuresToInsert);

  const paymentMethods = ['UPI / NetBanking', 'Debit Card', 'Credit Card', 'NEFT / RTGS', 'UPI / QR'];
  const feePaymentsToInsert = [];
  for (const st of studentsToInsert) {
    const fsInfo = feeStructByCourseSem[`${st.course_id}_${st.semester}`] || feeStructByCourseSem[`${courseBTechCSEId}_4`];
    const roll = Math.random();
    let status = 'Paid';
    let amountPaid = fsInfo.total;
    let fine = 0;

    if (st.id === sAmanId) {
      status = 'Overdue';
      amountPaid = 0;
      fine = 1500;
    } else if (roll > 0.88) {
      status = 'Overdue';
      amountPaid = 0;
      fine = 1000 + Math.floor(Math.random() * 3) * 500;
    } else if (roll > 0.78) {
      status = 'Pending';
      amountPaid = Math.random() < 0.4 ? Math.round(fsInfo.total * 0.5) : 0; // partial or pending
      fine = 0;
    }

    const doc = {
      id: nextId('student_fee_payments'),
      student_id: st.id,
      fee_structure_id: fsInfo.id,
      amount_due: fsInfo.total,
      amount_paid: amountPaid,
      fine_amount: fine,
      status
    };
    if (amountPaid > 0) {
      doc.payment_method = paymentMethods[st.id % paymentMethods.length];
      doc.transaction_id = `TXN_GTB_2026_${10000 + st.id}`;
      doc.receipt_no = `REC-GTB-2026-${1000 + st.id}`;
      doc.payment_date = `2026-01-${String((st.id % 25) + 1).padStart(2, '0')} 11:${String((st.id % 50) + 10).padStart(2, '0')}:00`;
    }
    feePaymentsToInsert.push(doc);
  }
  await StudentFeePayment.insertMany(feePaymentsToInsert);

  // 12. Notices (Bulletin across All Departments)
  await Notice.insertMany([
    { id: nextId('notices'), title: 'MANDATORY 75% Attendance Compliance for End-Term Examination Admit Cards', content: 'As per GGSIPU statutory regulations, all students must maintain a minimum of 75% attendance in every individual theory and practical subject. Students falling below 75% will be detained and barred from writing the End-Term Major Examination. Please check the Smart Attendance Tracker on the ERP portal.', category: 'Urgent', target_audience: 'All', department_id: deptCSEId, posted_by: 'Ms. Basanti Pal Nandi (HOD)', is_pinned: 1, created_at: '2026-09-20 10:00:00' },
    { id: nextId('notices'), title: 'Campus Placement Drive: Google, Microsoft & Qualcomm Recruitment', content: 'Training and Placement Cell (TnP) is pleased to announce recruitment drives for 2027 graduating batch across CSE, IT, ECE, AI-ML & AI-DS. Eligibility varies by company. Registration is open on the ERP Placement portal.', category: 'Placement', target_audience: 'Students', department_id: deptCSEId, posted_by: 'Training & Placement Cell', is_pinned: 1, created_at: '2026-09-22 14:30:00' },
    { id: nextId('notices'), title: 'Submission of Minor-1 Assignment Scores on ERP Portal by March 5', content: 'All faculty members are requested to complete evaluation of assignments and upload internal marks on the ERP system. Students can simulate their expected grade through the CGPA Probability Module.', category: 'Academic', target_audience: 'Faculty', department_id: deptCSEId, posted_by: 'Dean Academics Office', is_pinned: 0, created_at: '2026-09-24 09:15:00' },
    { id: nextId('notices'), title: 'Annual Technical Symposium GATES 2026 - Hackathon Registrations Open', content: 'Guru Tegh Bahadur Institute of Technology invites all students to participate in GATES 2026 36-hour National Hackathon. Attractive cash prizes and direct interview opportunities with sponsoring companies.', category: 'Event', target_audience: 'All', department_id: deptCSEId, posted_by: 'GTBIT Student Council', is_pinned: 0, created_at: '2026-09-25 12:00:00' },
    { id: nextId('notices'), title: 'AI-ML & AI-DS GPU Compute Cluster Access & Research Workshop', content: 'Students enrolled in B.Tech AI-ML and AI-DS can now apply for NVIDIA A100 lab compute quotas for Deep Learning and NLP capstone projects. Orientation conducted by Dr. Siddharth Menon & Dr. Prakash Hegde.', category: 'Academic', target_audience: 'Students', department_id: deptAIMLId, posted_by: 'Dr. Siddharth Menon (HOD AI-ML)', is_pinned: 0, created_at: '2026-09-26 11:00:00' },
    { id: nextId('notices'), title: 'ECE VLSI & Embedded Systems Hardware Lab Schedule Revision', content: 'All ECE Semester 2, 4, and 6 practical batches are notified that FPGA & Cadence Virtuoso lab sessions in Block-2 Lab 204 have updated afternoon slots starting Monday.', category: 'Academic', target_audience: 'Students', department_id: deptECEId, posted_by: 'Dr. Arvind Krishnan (HOD ECE)', is_pinned: 0, created_at: '2026-09-27 10:30:00' },
    { id: nextId('notices'), title: 'IT Department Cloud & Cybersecurity Certification Bootcamp', content: 'Department of Information Technology in collaboration with AWS Academy is hosting a 5-day Cloud Native & Cyber Defense workshop for IT-1, IT-2, and IT-3 students.', category: 'Event', target_audience: 'Students', department_id: deptITId, posted_by: 'Prof. Harinder Kaur (HOD IT)', is_pinned: 0, created_at: '2026-09-28 15:00:00' },
    { id: nextId('notices'), title: 'Semester-Wise Tuition & Exam Fee Payment Window (Late Fine Notice)', content: 'Students with Pending or Overdue semester fee status are advised to clear their dues via UPI/NetBanking on the ERP Fees portal before the 15th to avoid late fine accumulation of Rs. 100/day.', category: 'Urgent', target_audience: 'All', department_id: deptCSEId, posted_by: 'Accounts & Finance Office', is_pinned: 1, created_at: '2026-09-29 09:45:00' },
    { id: nextId('notices'), title: 'Central Library Extended Hours During End-Term Examinations', content: 'GTBIT Central Library reading hall will remain open from 8:00 AM to 9:00 PM on weekdays and 9:00 AM to 5:00 PM on Saturdays during exam preparation weeks.', category: 'Academic', target_audience: 'All', department_id: deptCSEId, posted_by: 'Chief Librarian', is_pinned: 0, created_at: '2026-10-01 10:15:00' },
    { id: nextId('notices'), title: 'Society Duty Attendance Exemption Submission Policy', content: 'Members participating in official GTBIT technical/cultural society events must submit their Duty Exemption requests via the Societies tab within 72 hours for faculty approval.', category: 'Academic', target_audience: 'Students', department_id: deptCSEId, posted_by: 'Dean Student Welfare', is_pinned: 0, created_at: '2026-10-02 13:20:00' }
  ]);

  // 13. Library Books (20 Titles) & Issue Records
  const b1 = nextId('library_books');
  const b2 = nextId('library_books');
  const b3 = nextId('library_books');
  const b4 = nextId('library_books');
  const b5 = nextId('library_books');
  const extraBooksSpecs = [
    { isbn: '978-0262035613', title: 'Deep Learning', author: 'Ian Goodfellow, Yoshua Bengio, Aaron Courville', category: 'AI & ML', edition: '1st Edition', total: 10, avail: 6, shelf: 'Shelf AI-01' },
    { isbn: '978-0387310732', title: 'Pattern Recognition and Machine Learning', author: 'Christopher M. Bishop', category: 'AI & ML', edition: '1st Edition', total: 8, avail: 5, shelf: 'Shelf AI-02' },
    { isbn: '978-0136042594', title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell, Peter Norvig', category: 'AI & ML', edition: '4th Edition', total: 12, avail: 7, shelf: 'Shelf AI-03' },
    { isbn: '978-1449373320', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', category: 'Data Science', edition: '1st Edition', total: 9, avail: 4, shelf: 'Shelf DS-01' },
    { isbn: '978-0070702080', title: 'Database System Concepts', author: 'Silberschatz, Korth, Sudarshan', category: 'Databases', edition: '7th Edition', total: 14, avail: 9, shelf: 'Shelf CS-06' },
    { isbn: '978-0124077263', title: 'Computer Organization and Design', author: 'David Patterson, John Hennessy', category: 'Architecture', edition: '5th Edition', total: 11, avail: 8, shelf: 'Shelf CS-07' },
    { isbn: '978-0321547743', title: 'CMOS VLSI Design: A Circuits and Systems Perspective', author: 'Neil Weste, David Harris', category: 'Electronics (ECE)', edition: '4th Edition', total: 10, avail: 6, shelf: 'Shelf EC-01' },
    { isbn: '978-0138147570', title: 'Signals and Systems', author: 'Alan V. Oppenheim, Alan S. Willsky', category: 'Electronics (ECE)', edition: '2nd Edition', total: 12, avail: 8, shelf: 'Shelf EC-02' },
    { isbn: '978-0133737622', title: 'Digital Signal Processing', author: 'John G. Proakis, Dimitris Manolakis', category: 'Electronics (ECE)', edition: '4th Edition', total: 9, avail: 5, shelf: 'Shelf EC-03' },
    { isbn: '978-0134444284', title: 'Cryptography and Network Security', author: 'William Stallings', category: 'Cybersecurity', edition: '7th Edition', total: 10, avail: 6, shelf: 'Shelf IT-01' },
    { isbn: '978-0132350884', title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', category: 'Software Engg', edition: '1st Edition', total: 8, avail: 4, shelf: 'Shelf CS-08' },
    { isbn: '978-0321486813', title: 'Compilers: Principles, Techniques, and Tools', author: 'Aho, Lam, Sethi, Ullman', category: 'Compilers', edition: '2nd Edition', total: 10, avail: 7, shelf: 'Shelf CS-09' },
    { isbn: '978-0131873216', title: 'Speech and Language Processing', author: 'Daniel Jurafsky, James H. Martin', category: 'AI & ML', edition: '3rd Edition', total: 7, avail: 5, shelf: 'Shelf AI-04' },
    { isbn: '978-9339220266', title: 'Embedded Systems: Architecture, Programming and Design', author: 'Raj Kamal', category: 'Electronics (ECE)', edition: '3rd Edition', total: 11, avail: 7, shelf: 'Shelf EC-04' },
    { isbn: '978-8126556793', title: 'Big Data and Analytics', author: 'Seema Acharya, Subhashini Chellappan', category: 'Data Science', edition: '2nd Edition', total: 10, avail: 6, shelf: 'Shelf DS-02' }
  ];
  const extraBookIds = extraBooksSpecs.map(() => nextId('library_books'));

  await LibraryBook.insertMany([
    { id: b1, isbn: '978-0131103627', title: 'The C Programming Language', author: 'Brian W. Kernighan, Dennis Ritchie', category: 'Computer Science', edition: '2nd Edition', total_copies: 10, available_copies: 7, shelf_location: 'Shelf CS-01' },
    { id: b2, isbn: '978-0262033848', title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest, Stein', category: 'Algorithms', edition: '3rd Edition', total_copies: 12, available_copies: 4, shelf_location: 'Shelf CS-04' },
    { id: b3, isbn: '978-1118063330', title: 'Operating System Concepts', author: 'Silberschatz, Galvin, Gagne', category: 'Operating Systems', edition: '10th Edition', total_copies: 15, available_copies: 6, shelf_location: 'Shelf CS-02' },
    { id: b4, isbn: '978-0133594140', title: 'Computer Networking: A Top-Down Approach', author: 'James Kurose, Keith Ross', category: 'Networking', edition: '7th Edition', total_copies: 14, available_copies: 8, shelf_location: 'Shelf CS-05' },
    { id: b5, isbn: '978-0078022128', title: 'Software Engineering: A Practitioner’s Approach', author: 'Roger S. Pressman, Bruce Maxim', category: 'Software Engg', edition: '8th Edition', total_copies: 8, available_copies: 5, shelf_location: 'Shelf CS-03' },
    ...extraBooksSpecs.map((bk, idx) => ({
      id: extraBookIds[idx],
      isbn: bk.isbn,
      title: bk.title,
      author: bk.author,
      category: bk.category,
      edition: bk.edition,
      total_copies: bk.total,
      available_copies: bk.avail,
      shelf_location: bk.shelf
    }))
  ]);

  const allBookIds = [b1, b2, b3, b4, b5, ...extraBookIds];
  const extraLibraryIssues = [];
  for (let idx = 0; idx < 28; idx++) {
    const st = studentsToInsert[(idx * 29 + 7) % studentsToInsert.length];
    const bkId = allBookIds[(idx * 3) % allBookIds.length];
    const mode = idx % 4; // 0,1 = Issued, 2 = Returned, 3 = Overdue
    extraLibraryIssues.push({
      id: nextId('library_issues'),
      book_id: bkId,
      student_id: st.id,
      issue_date: `2026-08-${String((idx % 20) + 5).padStart(2, '0')}`,
      due_date: `2026-09-${String((idx % 20) + 5).padStart(2, '0')}`,
      return_date: mode === 2 ? `2026-09-${String((idx % 18) + 3).padStart(2, '0')}` : null,
      fine_amount: mode === 3 ? (50 + (idx % 5) * 30) : 0,
      status: mode === 2 ? 'Returned' : (mode === 3 ? 'Overdue' : 'Issued')
    });
  }

  await LibraryIssue.insertMany([
    { id: nextId('library_issues'), book_id: b2, student_id: sTejassveerId, issue_date: '2026-08-10', due_date: '2026-09-10', return_date: null, fine_amount: 0, status: 'Issued' },
    { id: nextId('library_issues'), book_id: b3, student_id: sDevId, issue_date: '2026-08-12', due_date: '2026-09-12', return_date: null, fine_amount: 0, status: 'Issued' },
    { id: nextId('library_issues'), book_id: b4, student_id: sKrishmeetId, issue_date: '2026-08-15', due_date: '2026-09-15', return_date: null, fine_amount: 0, status: 'Issued' },
    { id: nextId('library_issues'), book_id: b5, student_id: sAmanId, issue_date: '2026-07-10', due_date: '2026-08-10', return_date: null, fine_amount: 170.0, status: 'Overdue' },
    ...extraLibraryIssues
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

  // 15. Placement Drives & Applications (Across CSE, IT, ECE, AI-ML, AI-DS)
  const driveGoogle = nextId('placement_drives');
  const driveMicrosoft = nextId('placement_drives');
  const driveZomato = nextId('placement_drives');
  const driveAtlassian = nextId('placement_drives');
  const driveAdobe = nextId('placement_drives');
  const driveRazorpay = nextId('placement_drives');
  const driveQualcomm = nextId('placement_drives');
  const driveTI = nextId('placement_drives');
  const driveNvidia = nextId('placement_drives');
  const driveDatabricks = nextId('placement_drives');
  const driveFractal = nextId('placement_drives');
  const driveJioAI = nextId('placement_drives');

  await PlacementDrive.insertMany([
    { id: driveGoogle, company_name: 'Google India', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', role_title: 'Software Engineering Intern (CSE / IT)', job_location: 'Bengaluru / Hyderabad', ctc_lpa: 28.0, eligibility_min_cgpa: 8.5, drive_date: '2026-10-15', deadline: '2026-10-05', description: 'Open to CSE & IT: Work with core Google Cloud, distributed databases, and high-throughput networking infrastructure. 6-month PPO available.', status: 'Active' },
    { id: driveMicrosoft, company_name: 'Microsoft IDC', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg', role_title: 'Software Development Engineer (CSE / IT / AI-ML)', job_location: 'Noida / Hyderabad', ctc_lpa: 24.5, eligibility_min_cgpa: 8.0, drive_date: '2026-10-22', deadline: '2026-10-10', description: 'Design and optimize Azure hyper-scale cloud microservices, kernel-level virtualization, and scalable APIs.', status: 'Active' },
    { id: driveZomato, company_name: 'Zomato Technologies', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Zomato_Logo.svg', role_title: 'Full Stack Engineer (CSE / IT)', job_location: 'Gurugram', ctc_lpa: 16.5, eligibility_min_cgpa: 7.5, drive_date: '2026-11-02', deadline: '2026-10-25', description: 'Build real-time high-concurrency order dispatching systems, payment pipelines, and low-latency frontend applications.', status: 'Upcoming' },
    { id: driveAtlassian, company_name: 'Atlassian India', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Atlassian-logo.svg', role_title: 'Backend Platform Engineer (CSE / IT)', job_location: 'Bengaluru', ctc_lpa: 32.0, eligibility_min_cgpa: 8.2, drive_date: '2026-10-28', deadline: '2026-10-18', description: 'Open to CSE & IT: Architect collaborative cloud tools (Jira, Confluence) handling millions of concurrent requests.', status: 'Active' },
    { id: driveAdobe, company_name: 'Adobe Systems', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Adobe_Systems_logo_and_wordmark.svg', role_title: 'Member of Technical Staff (CSE / AI-ML)', job_location: 'Noida', ctc_lpa: 22.0, eligibility_min_cgpa: 7.8, drive_date: '2026-11-05', deadline: '2026-10-26', description: 'Work on Creative Cloud graphics engines, generative imaging pipelines, and cross-platform SDKs.', status: 'Active' },
    { id: driveRazorpay, company_name: 'Razorpay', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg', role_title: 'Site Reliability & Security Engineer (IT / CSE)', job_location: 'Bengaluru', ctc_lpa: 18.0, eligibility_min_cgpa: 7.2, drive_date: '2026-11-10', deadline: '2026-10-30', description: 'Focus on FinTech payment security, Kubernetes observability, and zero-downtime distributed deployments.', status: 'Upcoming' },
    { id: driveQualcomm, company_name: 'Qualcomm India', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Qualcomm-Logo.svg', role_title: 'SoC & VLSI Hardware Engineer (ECE)', job_location: 'Hyderabad / Bengaluru', ctc_lpa: 21.0, eligibility_min_cgpa: 7.5, drive_date: '2026-10-24', deadline: '2026-10-14', description: 'Open to ECE: RTL design, SystemVerilog verification, low-power Snapdragon ASIC timing closure and physical design.', status: 'Active' },
    { id: driveTI, company_name: 'Texas Instruments', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/TexasInstruments-Logo.svg', role_title: 'Analog & Embedded Systems Engineer (ECE)', job_location: 'Bengaluru', ctc_lpa: 19.5, eligibility_min_cgpa: 7.5, drive_date: '2026-11-01', deadline: '2026-10-22', description: 'Open to ECE: Design mixed-signal ICs, microcontroller firmware, and real-time DSP automotive modules.', status: 'Active' },
    { id: driveNvidia, company_name: 'NVIDIA Graphics', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg', role_title: 'Deep Learning & GPU Architecture Intern (ECE / AI-ML)', job_location: 'Pune / Bengaluru', ctc_lpa: 26.0, eligibility_min_cgpa: 8.3, drive_date: '2026-11-08', deadline: '2026-10-29', description: 'Open to ECE & AI-ML: CUDA kernel optimization, TensorRT inference acceleration, and ASIC verification.', status: 'Upcoming' },
    { id: driveDatabricks, company_name: 'Databricks India', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Databricks_Logo.png', role_title: 'Data & ML Platform Engineer (AI-DS / AI-ML)', job_location: 'Bengaluru', ctc_lpa: 29.0, eligibility_min_cgpa: 8.0, drive_date: '2026-10-26', deadline: '2026-10-16', description: 'Open to AI-DS & AI-ML: Build Lakehouse Spark pipelines, vector search indexes, and LLM fine-tuning workflows.', status: 'Active' },
    { id: driveFractal, company_name: 'Fractal Analytics', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Fractal_Analytics_Logo.png', role_title: 'Imagineering Data Scientist (AI-DS / AI-ML)', job_location: 'Gurugram / Mumbai', ctc_lpa: 15.0, eligibility_min_cgpa: 7.0, drive_date: '2026-11-12', deadline: '2026-11-02', description: 'Open to AI-DS & AI-ML: Statistical modeling, demand forecasting, and enterprise GenAI copilot solutions.', status: 'Upcoming' },
    { id: driveJioAI, company_name: 'Jio Platforms AI Lab', company_logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Reliance_Jio_Logo.svg', role_title: 'NLP & Computer Vision Engineer (AI-ML / AI-DS / ECE)', job_location: 'Navi Mumbai / Gurugram', ctc_lpa: 17.5, eligibility_min_cgpa: 7.2, drive_date: '2026-11-15', deadline: '2026-11-05', description: 'Multilingual Indic LLM training, edge video analytics, and telecom 5G network intelligence.', status: 'Active' }
  ]);

  const allDriveIds = [driveGoogle, driveMicrosoft, driveZomato, driveAtlassian, driveAdobe, driveRazorpay, driveQualcomm, driveTI, driveNvidia, driveDatabricks, driveFractal, driveJioAI];
  const extraPlacementApps = [];
  const appStatuses = ['Applied', 'Shortlisted', 'Shortlisted', 'Selected'];
  for (let idx = 0; idx < 24; idx++) {
    const st = studentsToInsert[(idx * 35 + 12) % studentsToInsert.length];
    const dId = allDriveIds[idx % allDriveIds.length];
    const status = appStatuses[idx % appStatuses.length];
    extraPlacementApps.push({
      id: nextId('placement_applications'),
      drive_id: dId,
      student_id: st.id,
      applied_at: `2026-09-${String((idx % 20) + 10).padStart(2, '0')} 10:${String((idx % 40) + 15).padStart(2, '0')}:00`,
      resume_link: `https://gtbit.ac.in/resumes/student_${st.id}_resume.pdf`,
      status,
      feedback: status === 'Shortlisted' ? 'Cleared Online Coding Assessment' : (status === 'Selected' ? 'Offer Letter Issued by HR' : 'Application under review by recruitment panel')
    });
  }

  await PlacementApplication.insertMany([
    { id: nextId('placement_applications'), drive_id: driveGoogle, student_id: sHargunId, applied_at: '2026-09-23 11:00:00', resume_link: 'https://gtbit.ac.in/resumes/hargun_resume.pdf', status: 'Shortlisted', feedback: 'Profile shortlisted for Online Technical Assessment' },
    { id: nextId('placement_applications'), drive_id: driveGoogle, student_id: sTejassveerId, applied_at: '2026-09-23 11:30:00', resume_link: 'https://gtbit.ac.in/resumes/tejassveer_resume.pdf', status: 'Shortlisted', feedback: 'Profile shortlisted for Online Technical Assessment' },
    { id: nextId('placement_applications'), drive_id: driveMicrosoft, student_id: sTejassveerId, applied_at: '2026-09-24 10:15:00', resume_link: 'https://gtbit.ac.in/resumes/tejassveer_resume.pdf', status: 'Applied', feedback: 'Application under review by HR team' },
    { id: nextId('placement_applications'), drive_id: driveMicrosoft, student_id: sDevId, applied_at: '2026-09-24 12:00:00', resume_link: 'https://gtbit.ac.in/resumes/dev_resume.pdf', status: 'Applied', feedback: 'Application under review by HR team' },
    { id: nextId('placement_applications'), drive_id: driveMicrosoft, student_id: sKrishmeetId, applied_at: '2026-09-24 14:00:00', resume_link: 'https://gtbit.ac.in/resumes/krishmeet_resume.pdf', status: 'Applied', feedback: 'Application under review by HR team' },
    ...extraPlacementApps
  ]);

  // 16. Student Points (all 905 students, randomized & ranked)
  const pointsToInsert = studentsToInsert.map((st) => {
    const acad = Math.round(st.current_cgpa * 45 + Math.random() * 40);
    const att = Math.round(130 + Math.random() * 110);
    const ass = Math.round(120 + Math.random() * 110);
    return {
      id: nextId('student_points'),
      student_id: st.id,
      academic_score: acad,
      attendance_score: att,
      assignment_score: ass,
      total_merit_points: acad + att + ass,
      merit_rank: 0,
      badges_json: JSON.stringify(st.current_cgpa >= 8.8 ? ['Dean’s Scholar', 'Consistent Achiever'] : (st.current_cgpa >= 7.5 ? ['Active Learner'] : ['Participation Ribbon']))
    };
  });
  pointsToInsert.sort((a, b) => b.total_merit_points - a.total_merit_points);
  pointsToInsert.forEach((p, idx) => { p.merit_rank = idx + 1; });
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

  // 19. Faculty Class & Subject Mapping (Core + All New Department Faculty for Exams & Attendance)
  const extraFacultyMaps = [];
  extraFacultyAllocations.forEach((alloc) => {
    alloc.sections.forEach((sec) => {
      extraFacultyMaps.push({
        id: nextId('faculty_class_map'),
        faculty_id: alloc.facId,
        subject_id: alloc.subId,
        course_id: alloc.courseId,
        department_id: alloc.deptId,
        semester: alloc.sem,
        section: sec,
        academic_year: '2025-2026'
      });
    });
    // Also map each faculty member to one core semester subject so they can enter/manage marks in Exams
    const semSubs = theorySubjectsBySem[alloc.sem] || [];
    if (semSubs.length > 0) {
      extraFacultyMaps.push({
        id: nextId('faculty_class_map'),
        faculty_id: alloc.facId,
        subject_id: semSubs[0],
        course_id: alloc.courseId,
        department_id: alloc.deptId,
        semester: alloc.sem,
        section: alloc.sections[0],
        academic_year: '2025-2026'
      });
    }
  });

  await FacultyClassMap.insertMany([
    { id: nextId('faculty_class_map'), faculty_id: facNandi, subject_id: subAlgo, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facNandi, subject_id: subSE, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facNandi, subject_id: subAlgoLab, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSharma, subject_id: subOS, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSharma, subject_id: subOSLab, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSingh, subject_id: subCN, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    { id: nextId('faculty_class_map'), faculty_id: facSingh, subject_id: subAI, course_id: courseBTechCSEId, department_id: deptCSEId, semester: 4, section: 'CSE-2', academic_year: '2025-2026' },
    ...extraFacultyMaps
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

  // Forum Seed Threads (Doubts & Discussions across Subjects, Societies, and General)
  const t1 = nextId('forum_threads');
  const t2 = nextId('forum_threads');
  const t3 = nextId('forum_threads');
  const t4 = nextId('forum_threads');
  const t5 = nextId('forum_threads');
  const t6 = nextId('forum_threads');
  const t7 = nextId('forum_threads');
  const t8 = nextId('forum_threads');
  const t9 = nextId('forum_threads');
  const t10 = nextId('forum_threads');
  const t11 = nextId('forum_threads');
  const t12 = nextId('forum_threads');

  const facITUser = extraFacultyDocs[1].user_id;
  const facECEUser = extraFacultyDocs[5].user_id;
  const facAIMLUser = extraFacultyDocs[9].user_id;
  const facAIDSUser = extraFacultyDocs[13].user_id;

  await ForumThread.insertMany([
    { id: t1, author_id: studentTejassveerUserId, author_role: 'student', scope: 'subject', subject_id: subAlgo, society_id: null, title: 'Clarification on Bellman-Ford Negative Cycle Detection', is_resolved: 1 },
    { id: t2, author_id: studentDevUserId, author_role: 'student', scope: 'subject', subject_id: subOS, society_id: null, title: 'Thrashing vs Belady’s Anomaly in Page Replacement', is_resolved: 1 },
    { id: t3, author_id: adminUserId, author_role: 'admin', scope: 'general', subject_id: null, society_id: null, title: 'GGSIPU End-Term Exam Form & 75% Attendance Guidelines', is_resolved: 1 },
    { id: t4, author_id: studentDevUserId, author_role: 'student', scope: 'society', subject_id: null, society_id: societyIds['Google Developer Student Club'], title: 'Google Developer Student Club — Applicant Inquiry (Dev Sharma)', is_resolved: 0 },
    { id: t5, author_id: studentKrishmeetUserId, author_role: 'student', scope: 'subject', subject_id: subCN, society_id: null, title: 'How does OSPF calculate shortest path vs BGP path-vector routing?', is_resolved: 1 },
    { id: t6, author_id: studentHargunUserId, author_role: 'student', scope: 'subject', subject_id: subAI, society_id: null, title: 'Why does A* remain admissible only when heuristic h(n) <= h*(n)?', is_resolved: 1 },
    { id: t7, author_id: studentsToInsert[210].user_id, author_role: 'student', scope: 'subject', subject_id: extraFacultyAllocations[1].subId, society_id: null, title: 'AES-GCM vs RSA-OAEP in Enterprise TLS 1.3 Handshakes', is_resolved: 1 },
    { id: t8, author_id: studentsToInsert[420].user_id, author_role: 'student', scope: 'subject', subject_id: extraFacultyAllocations[5].subId, society_id: null, title: 'Static Timing Analysis: Fixing Setup vs Hold Violations in CMOS VLSI', is_resolved: 1 },
    { id: t9, author_id: studentsToInsert[620].user_id, author_role: 'student', scope: 'subject', subject_id: extraFacultyAllocations[9].subId, society_id: null, title: 'LayerNorm vs BatchNorm in Transformer Encoder Blocks', is_resolved: 1 },
    { id: t10, author_id: studentsToInsert[760].user_id, author_role: 'student', scope: 'subject', subject_id: extraFacultyAllocations[13].subId, society_id: null, title: 'Avoiding Data Skew in Apache Spark Wide Transformations (groupByKey vs reduceByKey)', is_resolved: 0 },
    { id: t11, author_id: studentAmanUserId, author_role: 'student', scope: 'general', subject_id: null, society_id: null, title: 'Placement Prep Roadmap: DSA vs System Design for 6th Sem Interviews', is_resolved: 0 },
    { id: t12, author_id: studentsToInsert[105].user_id, author_role: 'student', scope: 'society', subject_id: null, society_id: societyIds['Technical Society of GTBIT'], title: 'Smart India Hackathon Team Formation & Hardware Prototype Mentorship', is_resolved: 0 }
  ]);

  const p1 = nextId('forum_posts');
  const p2 = nextId('forum_posts');
  const p3 = nextId('forum_posts');
  const p4 = nextId('forum_posts');
  const p5 = nextId('forum_posts');
  const p6 = nextId('forum_posts');
  const p7 = nextId('forum_posts');
  const p8 = nextId('forum_posts');
  const p9 = nextId('forum_posts');
  const p10 = nextId('forum_posts');
  const p11 = nextId('forum_posts');
  const p12 = nextId('forum_posts');
  const p13 = nextId('forum_posts');
  const p14 = nextId('forum_posts');
  const p15 = nextId('forum_posts');
  const p16 = nextId('forum_posts');
  const p17 = nextId('forum_posts');
  const p18 = nextId('forum_posts');

  await ForumPost.insertMany([
    { id: p1, thread_id: t1, parent_post_id: null, author_id: studentTejassveerUserId, author_role: 'student', body: 'In Unit 3, why do we run one extra (V-th) relaxation pass in Bellman-Ford? Does any vertex whose distance updates indicate a negative cycle reachable from the source?', is_faculty_answer: 0 },
    { id: p2, thread_id: t1, parent_post_id: p1, author_id: facNandiId, author_role: 'faculty', body: 'Great question! After V-1 passes, all shortest paths without negative cycles have converged. If any edge (u, v) can still be relaxed on the V-th pass, it proves a negative-weight cycle is reachable from the source vertex.', is_faculty_answer: 1 },
    { id: p3, thread_id: t1, parent_post_id: p2, author_id: studentHargunUserId, author_role: 'student', body: 'Also remember: if the negative cycle is disconnected from the source, dist[u] stays Infinity so it will not trigger relaxation.', is_faculty_answer: 0 },
    { id: p4, thread_id: t2, parent_post_id: null, author_id: studentDevUserId, author_role: 'student', body: 'Could someone explain the difference between thrashing and Belady’s anomaly? Does LRU ever suffer from Belady’s anomaly?', is_faculty_answer: 0 },
    { id: p7, thread_id: t2, parent_post_id: p4, author_id: facSharmaId, author_role: 'faculty', body: 'Thrashing occurs when a process spends more time paging than executing. Belady’s anomaly only affects non-stack algorithms like FIFO. LRU is a stack algorithm, so increasing frames never increases page faults.', is_faculty_answer: 1 },
    { id: p5, thread_id: t3, parent_post_id: null, author_id: adminUserId, author_role: 'admin', body: 'Students are reminded that approved Society Duty attendance counts toward the mandatory 75% GGSIPU attendance threshold. Please submit duty requests within 3 days of the event.', is_faculty_answer: 1 },
    { id: p6, thread_id: t4, parent_post_id: null, author_id: studentDevUserId, author_role: 'student', body: 'Hi Tejassveer! I applied to GDSC — when are the upcoming React & Cloud Study Jam coordinator interviews?', is_faculty_answer: 0 },
    { id: p8, thread_id: t5, parent_post_id: null, author_id: studentKrishmeetUserId, author_role: 'student', body: 'Why do autonomous systems use BGP externally instead of OSPF?', is_faculty_answer: 0 },
    { id: p9, thread_id: t5, parent_post_id: p8, author_id: facSinghId, author_role: 'faculty', body: 'OSPF is link-state and floods LSAs across all routers—too heavy for the global internet and ignores business policies. BGP scales across ASes using policy-based path-vector attributes.', is_faculty_answer: 1 },
    { id: p10, thread_id: t6, parent_post_id: null, author_id: studentHargunUserId, author_role: 'student', body: 'What happens if A* overestimates the remaining cost to the goal on a single node?', is_faculty_answer: 0 },
    { id: p11, thread_id: t6, parent_post_id: p10, author_id: facSinghId, author_role: 'faculty', body: 'If h(n) > h*(n), A* may prune the true optimal path early and return a suboptimal goal.', is_faculty_answer: 1 },
    { id: p12, thread_id: t7, parent_post_id: null, author_id: studentsToInsert[210].user_id, author_role: 'student', body: 'In TLS 1.3, why is RSA key exchange removed in favor of ECDHE + AEAD (AES-GCM)?', is_faculty_answer: 0 },
    { id: p13, thread_id: t7, parent_post_id: p12, author_id: facITUser, author_role: 'faculty', body: 'Static RSA lacks Perfect Forward Secrecy (PFS). ECDHE generates ephemeral session keys per handshake, and AES-GCM provides authenticated encryption in a single pass.', is_faculty_answer: 1 },
    { id: p14, thread_id: t8, parent_post_id: null, author_id: studentsToInsert[420].user_id, author_role: 'student', body: 'Why can we fix setup time violations by slowing down the clock, whereas hold violations cannot be fixed by changing clock frequency?', is_faculty_answer: 0 },
    { id: p15, thread_id: t8, parent_post_id: p14, author_id: facECEUser, author_role: 'faculty', body: 'Hold checks happen on the same active clock edge—independent of clock period! You must insert delay buffers on the data path or reduce clock skew.', is_faculty_answer: 1 },
    { id: p16, thread_id: t9, parent_post_id: null, author_id: studentsToInsert[620].user_id, author_role: 'student', body: 'Why do Transformers prefer LayerNorm over BatchNorm for variable-length sequences?', is_faculty_answer: 0 },
    { id: p17, thread_id: t9, parent_post_id: p16, author_id: facAIMLUser, author_role: 'faculty', body: 'LayerNorm normalizes across feature dimensions per token independently of batch size and padding tokens, making it stable for NLP and autoregressive decoding.', is_faculty_answer: 1 },
    { id: p18, thread_id: t10, parent_post_id: null, author_id: studentsToInsert[760].user_id, author_role: 'student', body: 'Our Spark job hits OOM during groupByKey() on a 20GB dataset. Should we switch to reduceByKey() or salting?', is_faculty_answer: 0 }
  ]);

  await ForumLike.insertMany([
    { id: nextId('forum_likes'), post_id: p2, user_id: studentTejassveerUserId, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p2, user_id: studentHargunUserId, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p5, user_id: studentTejassveerUserId, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p7, user_id: studentDevUserId, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p13, user_id: studentsToInsert[210].user_id, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p15, user_id: studentsToInsert[420].user_id, user_role: 'student' },
    { id: nextId('forum_likes'), post_id: p17, user_id: studentsToInsert[620].user_id, user_role: 'student' }
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
