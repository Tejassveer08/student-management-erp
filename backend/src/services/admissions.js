/**
 * Student admission: creates the login, the student record, this semester's fee
 * invoice and (optionally) a guardian login linked through WardLink — all or nothing.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Student, Course, WardLink, FeeStructure, StudentFeePayment, getNextId } = require('../db/database');

function tempPassword() {
  return `GTB-${crypto.randomBytes(3).toString('hex')}-${crypto.randomInt(100, 999)}`;
}

class AdmissionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function admitStudent(input) {
  const fullName = String(input.fullName || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const rollNo = String(input.rollNo || '').trim();
  const enrollmentNo = String(input.enrollmentNo || '').trim();
  if (!fullName || !email || !rollNo || !enrollmentNo) throw new AdmissionError('Name, email, roll number and enrollment number are required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AdmissionError(`"${email}" is not a valid email address`);

  const prefix = String(input.section || '').split('-')[0].toUpperCase();
  const course = input.courseId
    ? await Course.findOne({ id: Number(input.courseId) }).lean()
    : (prefix && (await Course.findOne({ code: `BTECH-${prefix}` }).lean())) || (await Course.findOne({ id: 1 }).lean());
  if (!course) throw new AdmissionError('Unknown programme');
  const semester = Math.max(1, Math.min(course.duration_semesters || 8, Number(input.semester || 1)));
  const section = String(input.section || `${course.code.replace('BTECH-', '')}-1`).trim();

  const dupe = await Student.findOne({ $or: [{ roll_no: rollNo }, { enrollment_no: enrollmentNo }] }, 'id').lean();
  if (dupe || (await User.exists({ email }))) throw new AdmissionError('A student with this email, roll number or enrollment number already exists', 409);

  const password = input.password && String(input.password).trim().length >= 8 ? String(input.password).trim() : tempPassword();
  const created = { userId: null, studentId: null, parentUserId: null, feeId: null, wardLink: false };
  try {
    created.userId = await getNextId('users');
    await User.create({ id: created.userId, email, password_hash: bcrypt.hashSync(password, 10), role: 'student', full_name: fullName, phone: input.phone || null, avatar_url: null });

    created.studentId = await getNextId('students');
    const lateral = Number(input.initialCgpa) > 0;
    await Student.create({
      id: created.studentId,
      user_id: created.userId,
      roll_no: rollNo,
      enrollment_no: enrollmentNo,
      course_id: course.id,
      department_id: course.department_id,
      semester,
      section,
      shift: input.shift || 'Morning',
      admission_year: Number(input.admissionYear || new Date().getFullYear()),
      dob: input.dob || null,
      blood_group: input.bloodGroup || null,
      address: input.address || null,
      status: 'Active',
      current_cgpa: lateral ? Number(input.initialCgpa) : 0,
      total_credits_earned: lateral ? Number(input.creditsEarned || 0) : 0,
      parent_name: input.parentName || null,
      parent_phone: input.parentPhone || null
    });

    // This semester's fee invoice, if a structure exists for the programme
    const fs = await FeeStructure.findOne({ course_id: course.id, semester }).sort({ id: -1 }).lean();
    if (fs) {
      created.feeId = await getNextId('student_fee_payments');
      await StudentFeePayment.create({ id: created.feeId, student_id: created.studentId, fee_structure_id: fs.id, amount_due: fs.total_amount, amount_paid: 0, status: 'Pending' });
    }

    // Optional guardian login (re-uses an existing parent account with the same email)
    let guardian = null;
    const parentEmail = String(input.parentEmail || '').trim().toLowerCase();
    if (parentEmail) {
      let parent = await User.findOne({ email: parentEmail }).lean();
      let parentPassword = null;
      if (parent && parent.role !== 'parent') throw new AdmissionError(`${parentEmail} already belongs to a ${parent.role} account`);
      if (!parent) {
        parentPassword = tempPassword();
        created.parentUserId = await getNextId('users');
        await User.create({ id: created.parentUserId, email: parentEmail, password_hash: bcrypt.hashSync(parentPassword, 10), role: 'parent', full_name: input.parentName || `Guardian of ${fullName}`, phone: input.parentPhone || null });
        parent = { id: created.parentUserId };
      }
      const hasPrimary = await WardLink.exists({ parent_user_id: parent.id });
      await WardLink.create({ id: await getNextId('ward_links'), parent_user_id: parent.id, student_id: created.studentId, relationship: input.relationship || 'Guardian', is_primary: hasPrimary ? 0 : 1 });
      created.wardLink = true;
      await Student.updateOne({ id: created.studentId }, { $set: { parent_user_id: parent.id } });
      guardian = { email: parentEmail, temporaryPassword: parentPassword, existingAccount: !parentPassword };
    }

    return { studentId: created.studentId, loginCredentials: { email, temporaryPassword: password }, guardian, feeInvoiceCreated: Boolean(created.feeId) };
  } catch (err) {
    // Roll back whatever was created
    await Promise.all([
      created.userId && User.deleteOne({ id: created.userId }),
      created.studentId && Student.deleteOne({ id: created.studentId }),
      created.feeId && StudentFeePayment.deleteOne({ id: created.feeId }),
      created.parentUserId && User.deleteOne({ id: created.parentUserId }),
      created.wardLink && WardLink.deleteMany({ student_id: created.studentId })
    ].filter(Boolean));
    if (err.code === 11000) throw new AdmissionError('A student with this email, roll number or enrollment number already exists', 409);
    throw err;
  }
}

module.exports = { admitStudent, AdmissionError, tempPassword };
