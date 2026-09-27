/**
 * RBAC Boundary Verification Test Suite
 * Tests "should work" (200/201) and "should be blocked" (403 Forbidden) cases
 * across all 4 roles: Admin, Faculty, Parent, Student.
 */

const jwt = require('jsonwebtoken');
const db = require('../src/db/database');
const { JWT_SECRET } = require('../src/middleware/authMiddleware');

function createToken(userId, email, role) {
  return jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('=================================================================');
  console.log('🛡️  STARTING RBAC ROLE BOUNDARY AND PERMISSION TEST SUITE');
  console.log('=================================================================\n');

  // Fetch test users from database
  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
  const facultyNandi = db.prepare("SELECT * FROM users WHERE email = 'faculty.nandi@gtbit.ac.in'").get();
  const studentTej = db.prepare("SELECT * FROM users WHERE email = 'tejassveer@gtbit.ac.in'").get();
  const studentAman = db.prepare("SELECT * FROM users WHERE email = 'aman.gupta@gtbit.ac.in'").get();
  const parentJaswinder = db.prepare("SELECT * FROM users WHERE email = 'parent.tejassveer@gmail.com'").get();

  const adminToken = createToken(adminUser.id, adminUser.email, 'admin');
  const facultyToken = createToken(facultyNandi.id, facultyNandi.email, 'faculty');
  const studentToken = createToken(studentTej.id, studentTej.email, 'student');
  const parentToken = createToken(parentJaswinder.id, parentJaswinder.email, 'parent');

  // Fetch dynamic fixture IDs
  const studentTejRecord = db.prepare("SELECT id FROM students WHERE user_id = ?").get(studentTej.id);
  const studentAmanRecord = db.prepare("SELECT id FROM students WHERE user_id = ?").get(studentAman.id);
  const sampleAttRecord = db.prepare("SELECT id FROM attendance_records LIMIT 1").get();
  const sampleExamRecord = db.prepare("SELECT id FROM examinations LIMIT 1").get();

  const BASE_URL = 'http://localhost:5000/api';

  let passCount = 0;
  let failCount = 0;

  async function assertCase(description, promise, expectedStatus, expectedCondition = null) {
    try {
      const res = await promise;
      const statusMatch = res.status === expectedStatus;
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
    'Admin should publish final exam results',
    fetch(`${BASE_URL}/exams/${sampleExamRecord.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    }),
    200
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

  console.log('\n=================================================================');
  console.log(`🏁 RBAC TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED (Total: ${passCount + failCount})`);
  console.log('=================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
