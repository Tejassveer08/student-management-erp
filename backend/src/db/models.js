const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema, 'counters');

async function getNextId(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return doc.seq;
}

async function resetCounter(name, seq = 0) {
  await Counter.findByIdAndUpdate(name, { seq }, { upsert: true });
}

function makeModel(name, collectionName, definition, options = {}) {
  const schema = new mongoose.Schema(
    {
      id: { type: Number, unique: true, index: true },
      ...definition
    },
    { timestamps: false, versionKey: false, ...options }
  );

  schema.pre('save', async function () {
    if (this.isNew && (this.id === undefined || this.id === null)) {
      this.id = await getNextId(collectionName);
    }
  });

  if (options.indexes) {
    for (const [fields, idxOpts] of options.indexes) {
      schema.index(fields, idxOpts || {});
    }
  }

  return mongoose.models[name] || mongoose.model(name, schema, collectionName);
}

const User = makeModel('User', 'users', {
  email: { type: String, required: true, unique: true, index: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'faculty', 'student', 'parent'], required: true, index: true },
  full_name: { type: String, required: true },
  phone: String,
  avatar_url: String,
  created_at: { type: Date, default: Date.now }
});

const Department = makeModel('Department', 'departments', {
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  head_of_department: String
});

const Course = makeModel('Course', 'courses', {
  department_id: { type: Number, required: true, index: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  duration_semesters: { type: Number, default: 8 }
});

const Faculty = makeModel('Faculty', 'faculty', {
  user_id: { type: Number, required: true, unique: true },
  employee_id: { type: String, required: true, unique: true },
  department_id: { type: Number, required: true, index: true },
  designation: { type: String, required: true },
  qualification: String,
  weekly_workload_hours: { type: Number, default: 16 },
  office_room: String,
  status: { type: String, default: 'Active' }
});

const Student = makeModel('Student', 'students', {
  user_id: { type: Number, required: true, unique: true },
  parent_user_id: { type: Number, default: null, index: true },
  roll_no: { type: String, required: true, unique: true },
  enrollment_no: { type: String, required: true, unique: true },
  course_id: { type: Number, required: true, index: true },
  department_id: { type: Number, required: true, index: true },
  semester: { type: Number, default: 4, index: true },
  section: { type: String, default: 'CSE-2', index: true },
  shift: { type: String, default: 'Morning' },
  admission_year: { type: Number, default: 2023 },
  dob: String,
  blood_group: String,
  address: String,
  status: { type: String, default: 'Active' },
  current_cgpa: { type: Number, default: 8.45 },
  total_credits_earned: { type: Number, default: 76 },
  parent_name: String,
  parent_phone: String
});

const Subject = makeModel('Subject', 'subjects', {
  course_id: { type: Number, required: true, index: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  semester: { type: Number, required: true, index: true },
  credits: { type: Number, default: 4 },
  type: { type: String, enum: ['Theory', 'Practical'], default: 'Theory' },
  faculty_id: { type: Number, default: null, index: true },
  historical_pass_pct: { type: Number, default: 88.5 },
  historical_avg_marks: { type: Number, default: 72.4 },
  difficulty_index: { type: Number, default: 0.45 },
  syllabus_outline: String
});

const TimetableSlot = makeModel('TimetableSlot', 'timetable_slots', {
  subject_id: { type: Number, required: true, index: true },
  faculty_id: { type: Number, required: true, index: true },
  semester: { type: Number, required: true },
  section: { type: String, required: true },
  day_of_week: { type: String, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  room_no: { type: String, required: true }
});

const AttendanceSession = makeModel('AttendanceSession', 'attendance_sessions', {
  subject_id: { type: Number, required: true, index: true },
  faculty_id: { type: Number, required: true, index: true },
  section: { type: String, required: true },
  semester: { type: Number, required: true },
  session_date: { type: String, required: true, index: true },
  slot_time: { type: String, required: true },
  topic_covered: String,
  session_token: { type: String, unique: true, sparse: true },
  qr_expires_at: String,
  qr_rotate_seconds: { type: Number, default: 30 },
  created_at: { type: Date, default: Date.now }
});

const AttendanceRecord = makeModel('AttendanceRecord', 'attendance_records', {
  session_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  status: { type: String, enum: ['Present', 'Absent', 'Late'], required: true },
  method: { type: String, enum: ['Faculty_Manual', 'QR_Scan', 'One_Tap'], default: 'Faculty_Manual' },
  marked_at: { type: Date, default: Date.now },
  credit_type: { type: String, enum: ['Regular', 'Society'], default: 'Regular' },
  society_request_id: { type: Number, default: null }
}, {
  indexes: [[{ session_id: 1, student_id: 1 }, { unique: true }]]
});

const Examination = makeModel('Examination', 'examinations', {
  name: { type: String, required: true },
  semester: { type: Number, required: true },
  academic_year: { type: String, required: true },
  exam_type: { type: String, enum: ['Minor', 'Major', 'Practical', 'Internal'], required: true },
  start_date: { type: String, required: true },
  end_date: { type: String, required: true },
  status: { type: String, enum: ['Scheduled', 'Ongoing', 'Completed', 'Results_Declared'], default: 'Scheduled' }
});

const ExamMark = makeModel('ExamMark', 'exam_marks', {
  exam_id: { type: Number, required: true, index: true },
  subject_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  internal_assessment: { type: Number, default: 0 },
  assignment_score: { type: Number, default: 0 },
  external_exam: { type: Number, default: 0 },
  total_score: { type: Number, default: 0 },
  letter_grade: { type: String, default: 'B' },
  grade_points: { type: Number, default: 7.0 },
  remarks: String
}, {
  indexes: [[{ exam_id: 1, subject_id: 1, student_id: 1 }, { unique: true }]]
});

const Assignment = makeModel('Assignment', 'assignments', {
  subject_id: { type: Number, required: true, index: true },
  faculty_id: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  description: String,
  max_marks: { type: Number, default: 20 },
  due_date: { type: String, required: true },
  attachment_url: String,
  created_at: { type: Date, default: Date.now }
});

const AssignmentSubmission = makeModel('AssignmentSubmission', 'assignment_submissions', {
  assignment_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  submission_text: String,
  file_url: String,
  file_name: String,
  submitted_at: { type: Date, default: Date.now },
  marks_obtained: Number,
  faculty_feedback: String,
  status: { type: String, enum: ['Submitted', 'Graded', 'Late', 'Resubmission_Requested'], default: 'Submitted' }
}, {
  indexes: [[{ assignment_id: 1, student_id: 1 }, { unique: true }]]
});

const StudyMaterial = makeModel('StudyMaterial', 'study_materials', {
  subject_id: { type: Number, required: true, index: true },
  faculty_id: { type: Number, required: true },
  title: { type: String, required: true },
  unit_name: String,
  file_type: { type: String, default: 'PDF' },
  file_url: String,
  file_size: String,
  uploaded_at: { type: Date, default: Date.now }
});

const FeeStructure = makeModel('FeeStructure', 'fee_structures', {
  course_id: { type: Number, required: true, index: true },
  semester: { type: Number, required: true },
  academic_year: { type: String, required: true },
  tuition_fee: { type: Number, required: true },
  lab_development_fee: { type: Number, required: true },
  exam_fee: { type: Number, required: true },
  library_sports_fee: { type: Number, required: true },
  total_amount: { type: Number, required: true },
  due_date: { type: String, required: true }
});

const StudentFeePayment = makeModel('StudentFeePayment', 'student_fee_payments', {
  student_id: { type: Number, required: true, index: true },
  fee_structure_id: { type: Number, required: true },
  amount_due: { type: Number, required: true },
  amount_paid: { type: Number, default: 0 },
  fine_amount: { type: Number, default: 0 },
  fine_waived: { type: Boolean, default: false },
  status: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Partial'], default: 'Pending' },
  payments: { type: [{ amount: Number, method: String, transaction_id: String, receipt_no: String, paid_at: Date, by_user: Number }], default: [] },
  payment_method: String,
  transaction_id: String,
  receipt_no: { type: String, unique: true, sparse: true },
  payment_date: Date
});

const Notice = makeModel('Notice', 'notices', {
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, enum: ['General', 'Academic', 'Exam', 'Placement', 'Event', 'Urgent'], default: 'General' },
  target_audience: { type: String, enum: ['All', 'Students', 'Faculty', 'Parents'], default: 'All' },
  department_id: { type: Number, default: null },
  posted_by: { type: String, required: true },
  author_user_id: { type: Number, default: null },
  is_pinned: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const LibraryBook = makeModel('LibraryBook', 'library_books', {
  isbn: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String, required: true },
  edition: String,
  total_copies: { type: Number, default: 5 },
  available_copies: { type: Number, default: 5 },
  shelf_location: String
});

const LibraryIssue = makeModel('LibraryIssue', 'library_issues', {
  book_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  issue_date: { type: String, required: true },
  due_date: { type: String, required: true },
  return_date: String,
  fine_amount: { type: Number, default: 0 },
  status: { type: String, enum: ['Issued', 'Returned', 'Overdue'], default: 'Issued' }
});

const HostelRoom = makeModel('HostelRoom', 'hostel_rooms', {
  block_name: { type: String, required: true },
  room_no: { type: String, required: true },
  floor: { type: Number, required: true },
  capacity: { type: Number, default: 2 },
  occupied_count: { type: Number, default: 0 },
  fee_per_semester: { type: Number, default: 28000 }
}, {
  indexes: [[{ block_name: 1, room_no: 1 }, { unique: true }]]
});

const HostelAllocation = makeModel('HostelAllocation', 'hostel_allocations', {
  room_id: { type: Number, required: true },
  student_id: { type: Number, required: true, unique: true },
  allocation_date: { type: String, required: true },
  status: { type: String, enum: ['Allocated', 'Vacated'], default: 'Allocated' }
});

const PlacementDrive = makeModel('PlacementDrive', 'placement_drives', {
  company_name: { type: String, required: true },
  company_logo: String,
  role_title: { type: String, required: true },
  job_location: { type: String, required: true },
  ctc_lpa: { type: Number, required: true },
  eligibility_min_cgpa: { type: Number, default: 7.0 },
  drive_date: { type: String, required: true },
  deadline: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['Upcoming', 'Active', 'Closed'], default: 'Active' }
});

const PlacementApplication = makeModel('PlacementApplication', 'placement_applications', {
  drive_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  applied_at: { type: Date, default: Date.now },
  resume_link: String,
  status: { type: String, enum: ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Not_Selected'], default: 'Applied' },
  feedback: String
}, {
  indexes: [[{ drive_id: 1, student_id: 1 }, { unique: true }]]
});

const StudentPoints = makeModel('StudentPoints', 'student_points', {
  student_id: { type: Number, required: true, unique: true },
  academic_score: { type: Number, default: 0 },
  attendance_score: { type: Number, default: 0 },
  assignment_score: { type: Number, default: 0 },
  total_merit_points: { type: Number, default: 0 },
  merit_rank: { type: Number, default: 1 },
  badges_json: { type: String, default: '[]' }
});

const StudyPlan = makeModel('StudyPlan', 'study_plans', {
  student_id: { type: Number, required: true, index: true },
  subject_id: { type: Number, required: true },
  priority: { type: String, enum: ['Critical', 'High', 'Moderate', 'Review'], default: 'Moderate' },
  recommended_weekly_hours: { type: Number, default: 4.0 },
  completed_hours_this_week: { type: Number, default: 0 },
  week_start: { type: String, default: null },
  weak_topics: String,
  notes: String
}, {
  indexes: [[{ student_id: 1, subject_id: 1 }, { unique: true }]]
});

const Notification = makeModel('Notification', 'notifications', {
  user_id: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['attendance_alert', 'cgpa_warning', 'exam_result', 'fee_reminder', 'assignment_due', 'society', 'forum', 'placement', 'general'], default: 'general' },
  link_url: String,
  is_read: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const FacultyClassMap = makeModel('FacultyClassMap', 'faculty_class_map', {
  faculty_id: { type: Number, required: true, index: true },
  subject_id: { type: Number, required: true, index: true },
  course_id: { type: Number, required: true },
  department_id: { type: Number, required: true },
  semester: { type: Number, required: true },
  section: { type: String, required: true },
  academic_year: { type: String, default: '2025-2026' },
  created_at: { type: Date, default: Date.now }
}, {
  indexes: [[{ faculty_id: 1, subject_id: 1, semester: 1, section: 1 }, { unique: true }]]
});

const WardLink = makeModel('WardLink', 'ward_links', {
  parent_user_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  relationship: { type: String, default: 'Father' },
  is_primary: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now }
}, {
  indexes: [[{ parent_user_id: 1, student_id: 1 }, { unique: true }]]
});

const AuditLog = makeModel('AuditLog', 'audit_logs', {
  user_id: { type: Number, required: true },
  user_role: { type: String, required: true },
  user_email: { type: String, required: true },
  action: { type: String, required: true },
  entity_type: { type: String, required: true },
  entity_id: { type: String, required: true },
  old_value: String,
  new_value: String,
  reason: String,
  ip_address: String,
  created_at: { type: Date, default: Date.now }
});

const institutionSettingSchema = new mongoose.Schema({
  setting_key: { type: String, required: true, unique: true, index: true },
  setting_value: { type: String, required: true },
  description: String,
  category: { type: String, default: 'Academic' },
  updated_by: { type: Number, default: null },
  updated_at: { type: Date, default: Date.now }
}, { versionKey: false });
const InstitutionSetting = mongoose.models.InstitutionSetting || mongoose.model('InstitutionSetting', institutionSettingSchema, 'institution_settings');

const Society = makeModel('Society', 'societies', {
  name: { type: String, required: true, unique: true },
  description: String,
  category: { type: String, default: 'General' },
  coordinator_student_id: { type: Number, default: null },
  coordinator_faculty_id: { type: Number, default: null },
  created_at: { type: Date, default: Date.now }
});

const SocietyMember = makeModel('SocietyMember', 'society_members', {
  society_id: { type: Number, required: true, index: true },
  student_id: { type: Number, required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  application_message: String,
  applied_at: { type: Date, default: Date.now },
  decided_at: { type: Date, default: null },
  decided_by: { type: Number, default: null }
}, {
  indexes: [[{ society_id: 1, student_id: 1 }, { unique: true }]]
});

const SocietyAttendanceRequest = makeModel('SocietyAttendanceRequest', 'society_attendance_requests', {
  student_id: { type: Number, required: true, index: true },
  society_id: { type: Number, required: true, index: true },
  class_subject_id: { type: Number, required: true, index: true },
  date: { type: String, required: true },
  session_period: { type: String, default: null },
  activity_title: { type: String, required: true },
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  assigned_faculty_id: { type: Number, default: null, index: true },
  reviewed_by_faculty_id: { type: Number, default: null },
  reviewer_remarks: String,
  reviewed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

const ForumThread = makeModel('ForumThread', 'forum_threads', {
  author_id: { type: Number, required: true, index: true },
  author_role: { type: String, required: true },
  scope: { type: String, enum: ['general', 'subject', 'society'], default: 'general', index: true },
  subject_id: { type: Number, default: null, index: true },
  society_id: { type: Number, default: null, index: true },
  title: { type: String, required: true },
  is_resolved: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  last_activity_at: { type: Date, default: Date.now }
});

const ForumPost = makeModel('ForumPost', 'forum_posts', {
  thread_id: { type: Number, required: true, index: true },
  parent_post_id: { type: Number, default: null },
  author_id: { type: Number, required: true },
  author_role: { type: String, required: true },
  body: { type: String, required: true },
  is_faculty_answer: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const ForumLike = makeModel('ForumLike', 'forum_likes', {
  post_id: { type: Number, required: true, index: true },
  user_id: { type: Number, required: true, index: true },
  user_role: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, {
  indexes: [[{ post_id: 1, user_id: 1 }, { unique: true }]]
});

module.exports = {
  Counter,
  getNextId,
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
};

