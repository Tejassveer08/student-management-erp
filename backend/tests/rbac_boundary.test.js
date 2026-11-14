/**
 * RBAC Boundary Verification Test Suite
 * Tests "should work" (200/201) and "should be blocked" (403 Forbidden) cases
 * across all 4 roles: Admin, Faculty, Parent, Student.
 */

const jwt = require('jsonwebtoken');
const {
  connectDB,
  mongoose,
  User,
  Student,
  AttendanceRecord,
  Examination
} = require('../src/db/database');
const { JWT_SECRET } = require('../src/middleware/authMiddleware');

function createToken(userId, email, role) {
  return jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  await connectDB();

  console.log('=================================================================');
  console.log('🛡️  STARTING RBAC ROLE BOUNDARY AND PERMISSION TEST SUITE');
  console.log('=================================================================\n');

  // Fetch test users from database
  const [adminUser, facultyNandi, studentTej, studentAman, parentJaswinder] = await Promise.all([
    User.findOne({ role: 'admin' }).lean(),
    User.findOne({ email: 'faculty.nandi@gtbit.ac.in' }).lean(),
    User.findOne({ email: 'tejassveer@gtbit.ac.in' }).lean(),
    User.findOne({ email: 'aman.gupta@gtbit.ac.in' }).lean(),
    User.findOne({ email: 'parent.tejassveer@gmail.com' }).lean()
  ]);

  const adminToken = createToken(adminUser.id, adminUser.email, 'admin');
  const facultyToken = createToken(facultyNandi.id, facultyNandi.email, 'faculty');
  const studentToken = createToken(studentTej.id, studentTej.email, 'student');
  const parentToken = createToken(parentJaswinder.id, parentJaswinder.email, 'parent');

  // Fetch dynamic fixture IDs
  const [studentTejRecord, studentAmanRecord, sampleAttRecord, sampleExamRecord] = await Promise.all([
    Student.findOne({ user_id: studentTej.id }).lean(),
    Student.findOne({ user_id: studentAman.id }).lean(),
    AttendanceRecord.findOne({}).lean(),
    Examination.findOne({}).lean()
  ]);

  const BASE_URL = 'http://localhost:5000/api';

  let passCount = 0;
  let failCount = 0;

  async function assertCase(description, promise, expectedStatus, expectedCondition = null) {
    try {
      const res = await promise;
      const statusMatch = Array.isArray(expectedStatus) ? expectedStatus.includes(res.status) : res.status === expectedStatus;
      let conditionMatch = true;

      let body = {};
      try {
        body = await res.json();
      } catch (e) {}

      if (expectedCondition && typeof expectedCondition === 'function') {
        conditionMatch = expectedCondition(body);
      }

      if (statusMatch && conditionMatch) {
        console.log(`  ✅ [PASS] ${description} -> HTTP ${res.status}`);
        passCount++;
      } else {
        console.error(`  ❌ [FAIL] ${description} -> Expected HTTP ${expectedStatus}, Got ${res.status}. Body:`, body);
        failCount++;
      }
    } catch (err) {
      console.error(`  ❌ [ERROR] ${description} -> Network/Execution Error:`, err.message);
      failCount++;
    }
  }

  console.log('--- 1. ADMIN ROLE PERMISSION BOUNDARIES ---');
  await assertCase(
    'Admin should read all institutional settings',
    fetch(`${BASE_URL}/settings`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    200
  );

  await assertCase(
    'Admin should view audit logs',
    fetch(`${BASE_URL}/settings/audit-logs`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    200
  );

  await assertCase(
    'Admin should override attendance with audit log',
    fetch(`${BASE_URL}/attendance/override`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId: sampleAttRecord.id, status: 'Present', reason: 'Official university symposium attendance duty leave' })
    }),
    200
  );

  await assertCase(
    'Admin should publish final exam results (409 if already declared)',
    fetch(`${BASE_URL}/exams/${sampleExamRecord.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    }),
    [200, 409]
  );

  console.log('\n--- 2. FACULTY ROLE PERMISSION BOUNDARIES ---');
  await assertCase(
    'Faculty should read students in assigned classes',
    fetch(`${BASE_URL}/students`, { headers: { Authorization: `Bearer ${facultyToken}` } }),
    200
  );

  await assertCase(
    'Faculty should be BLOCKED from creating student admission (Admin only)',
    fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Illegal Add', email: 'illegal@gtbit.ac.in', rollNo: '999', enrollmentNo: '999' })
    }),
    403
  );

  await assertCase(
    'Faculty should be BLOCKED from accessing institutional governance settings',
    fetch(`${BASE_URL}/settings`, { headers: { Authorization: `Bearer ${facultyToken}` } }),
    403
  );

  await assertCase(
    'Faculty should be BLOCKED from overriding locked compliance attendance records',
    fetch(`${BASE_URL}/attendance/override`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId: sampleAttRecord.id, status: 'Present', reason: 'Unpermitted override' })
    }),
    403
  );

  await assertCase(
    'Faculty should be BLOCKED from publishing final university examination results',
    fetch(`${BASE_URL}/exams/${sampleExamRecord.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' }
    }),
    403
  );

  await assertCase(
    'Faculty should be BLOCKED from creating assignments for unassigned subjects (DB Scoping)',
    fetch(`${BASE_URL}/assignments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: 99, title: 'Unassigned Subject Test', dueDate: '2026-10-15' })
    }),
    403
  );

  console.log('\n--- 3. PARENT ROLE PERMISSION BOUNDARIES ---');
  await assertCase(
    'Parent should view linked ward profile',
    fetch(`${BASE_URL}/students/${studentTejRecord.id}`, { headers: { Authorization: `Bearer ${parentToken}` } }),
    200
  );

  await assertCase(
    'Parent should be BLOCKED from viewing other students dossiers (DB Scoping)',
    fetch(`${BASE_URL}/students/${studentAmanRecord.id}`, { headers: { Authorization: `Bearer ${parentToken}` } }),
    403
  );

  await assertCase(
    'Parent should be BLOCKED from initializing attendance sessions',
    fetch(`${BASE_URL}/attendance/create-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${parentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: 1, section: 'CSE-2' })
    }),
    403
  );

  await assertCase(
    'Parent should be BLOCKED from publishing assignments',
    fetch(`${BASE_URL}/assignments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${parentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: 1, title: 'Test' })
    }),
    403
  );

  await assertCase(
    'Parent should be BLOCKED from institutional settings',
    fetch(`${BASE_URL}/settings`, { headers: { Authorization: `Bearer ${parentToken}` } }),
    403
  );

  console.log('\n--- 4. STUDENT ROLE PERMISSION BOUNDARIES ---');
  await assertCase(
    'Student should view own academic profile',
    fetch(`${BASE_URL}/students/${studentTejRecord.id}`, { headers: { Authorization: `Bearer ${studentToken}` } }),
    200
  );

  await assertCase(
    'Student should be BLOCKED from viewing another student dossier (DB Scoping)',
    fetch(`${BASE_URL}/students/${studentAmanRecord.id}`, { headers: { Authorization: `Bearer ${studentToken}` } }),
    403
  );

  await assertCase(
    'Student should be BLOCKED from registering student admissions',
    fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Malicious Add' })
    }),
    403
  );

  await assertCase(
    'Student should be BLOCKED from entering exam marks',
    fetch(`${BASE_URL}/exams/marks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId: 1, subjectId: 1, studentId: 1, internalAssessment: 25 })
    }),
    403
  );

  await assertCase(
    'Student should be BLOCKED from bulk marking attendance',
    fetch(`${BASE_URL}/attendance/bulk-mark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 1, records: [{ studentId: 1, status: 'Present' }] })
    }),
    403
  );

  await assertCase(
    'Student should be BLOCKED from institutional governance settings',
    fetch(`${BASE_URL}/settings`, { headers: { Authorization: `Bearer ${studentToken}` } }),
    403
  );

  console.log('\n--- SECURITY REGRESSIONS ---');
  const other = studentAmanRecord.id;
  const studentAuth = { Authorization: `Bearer ${studentToken}` };
  const json = { 'Content-Type': 'application/json' };
  await assertCase('Unauthenticated quick-switch backdoor is gone',
    fetch(`${BASE_URL}/auth/quick-switch`, { method: 'POST', headers: json, body: JSON.stringify({ role: 'admin' }) }), 404);
  await assertCase('Unauthenticated password reset is gone',
    fetch(`${BASE_URL}/auth/reset-password`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'admin@gtbit.ac.in', newPassword: 'x' }) }), 404);
  await assertCase('Student should be BLOCKED from another student\'s CGPA forecast',
    fetch(`${BASE_URL}/cgpa/analysis/${other}`, { headers: studentAuth }), 403);
  await assertCase('Student should be BLOCKED from the institution-wide risk cohort',
    fetch(`${BASE_URL}/cgpa/at-risk-cohort`, { headers: studentAuth }), 403);
  await assertCase('Parent should be BLOCKED from another student\'s library loans',
    fetch(`${BASE_URL}/library/my-issues?studentId=${other}`, { headers: { Authorization: `Bearer ${parentToken}` } }), 403);
  await assertCase('Student attendance export only contains their own rows',
    fetch(`${BASE_URL}/attendance/export?semester=4&section=CSE-2`, { headers: studentAuth }), 200,
    (b) => new Set(b.records.map((r) => r.roll_no)).size === 1);
  await assertCase('Password change requires the current password',
    fetch(`${BASE_URL}/auth/change-password`, { method: 'POST', headers: { ...studentAuth, ...json }, body: JSON.stringify({ currentPassword: 'wrong-password', newPassword: 'NewPass123' }) }), 400);

  console.log('\n=================================================================');
  console.log(`🏁 RBAC TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (Total: ${passCount + failCount})`);
  console.log('=================================================================\n');

  await mongoose.disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
