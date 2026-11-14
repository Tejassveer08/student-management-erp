/**
 * In-app notifications raised by real events (results declared, assignment posted,
 * attendance dropping under the threshold, society decisions, forum replies, …).
 * Failures are logged and swallowed — a notification must never break the action
 * that triggered it.
 */
const { Notification, Student, WardLink, getNextId } = require('../db/database');

async function notifyUsers(userIds, { title, message, type = 'general', link = null }) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(Number))];
  if (!ids.length) return 0;
  try {
    const docs = [];
    for (const uid of ids) {
      docs.push({ id: await getNextId('notifications'), user_id: uid, title, message, type, link_url: link, is_read: 0, created_at: new Date() });
    }
    await Notification.insertMany(docs, { ordered: false });
    return docs.length;
  } catch (err) {
    console.warn('[notify] failed:', err.message);
    return 0;
  }
}

/** Notify students (by student id), optionally their linked guardians too */
async function notifyStudents(studentIds, payload, { includeGuardians = false, guardianPayload } = {}) {
  const ids = [...new Set((studentIds || []).map(Number))];
  if (!ids.length) return 0;
  const students = await Student.find({ id: { $in: ids } }, 'id user_id').lean();
  let n = await notifyUsers(students.map((s) => s.user_id), payload);
  if (includeGuardians) {
    const links = await WardLink.find({ student_id: { $in: ids } }).lean();
    n += await notifyUsers(links.map((l) => l.parent_user_id), guardianPayload || payload);
  }
  return n;
}

/** Notify everyone in a semester/section */
async function notifySection(semester, section, payload, opts) {
  const students = await Student.find({ semester: Number(semester), section, status: 'Active' }, 'id').lean();
  return notifyStudents(students.map((s) => s.id), payload, opts);
}

module.exports = { notifyUsers, notifyStudents, notifySection };
