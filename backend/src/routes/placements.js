const express = require('express');
const { PlacementDrive, PlacementApplication, Student, User, getNextId } = require('../db/database');
const { verifyToken, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { sendError, HttpError } = require('../services/scope');
const { notifyStudents } = require('../services/notify');
const { localDate } = require('../services/time');

const router = express.Router();
const STAGES = ['Applied', 'Shortlisted', 'Interviewing', 'Selected', 'Not_Selected'];

/** Status derived from dates unless an admin closed the drive */
function effectiveStatus(d, today = localDate()) {
  if (d.status === 'Closed' || d.deadline < today) return 'Closed';
  return d.drive_date > today && d.status === 'Upcoming' ? 'Upcoming' : 'Active';
}

// GET /api/placements/drives — drives with eligibility and the student's application status
router.get('/drives', verifyToken, async (req, res) => {
  try {
    const student = req.user.role === 'student' && req.student ? await Student.findOne({ id: req.student.id }, 'id current_cgpa').lean() : null;
    const [drives, counts, apps] = await Promise.all([
      PlacementDrive.find().sort({ drive_date: 1 }).lean(),
      PlacementApplication.aggregate([{ $group: { _id: '$drive_id', n: { $sum: 1 } } }]),
      student ? PlacementApplication.find({ student_id: student.id }).lean() : []
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    const appMap = Object.fromEntries(apps.map((a) => [a.drive_id, a]));
    const today = localDate();
    res.json(
      drives.map((d) => ({
        ...d,
        status: effectiveStatus(d, today),
        applicants: req.user.role === 'admin' ? countMap[d.id] || 0 : undefined,
        is_eligible: student ? student.current_cgpa >= d.eligibility_min_cgpa : true,
        has_applied: Boolean(appMap[d.id]),
        application_status: appMap[d.id]?.status || null,
        application_feedback: appMap[d.id]?.feedback || null
      }))
    );
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/placements/drives — announce a drive (admin) and notify eligible students
router.post('/drives', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const { companyName, companyLogo, roleTitle, jobLocation, driveDate, deadline, description } = req.body;
    const ctc = Number(req.body.ctcLpa);
    const minCgpa = Number(req.body.eligibilityMinCgpa ?? 7);
    if (!companyName || !roleTitle || !driveDate || !deadline) throw new HttpError(400, 'Company, role, drive date and deadline are required');
    if (!(ctc > 0 && ctc < 200)) throw new HttpError(400, 'CTC must be a positive number in LPA');
    if (!(minCgpa >= 0 && minCgpa <= 10)) throw new HttpError(400, 'Minimum CGPA must be between 0 and 10');
    if (deadline > driveDate) throw new HttpError(400, 'The application deadline must be on or before the drive date');
    if (deadline < localDate()) throw new HttpError(400, 'The application deadline has already passed');

    const id = await getNextId('placement_drives');
    await PlacementDrive.create({
      id,
      company_name: String(companyName).trim(),
      company_logo: companyLogo || null,
      role_title: String(roleTitle).trim(),
      job_location: jobLocation || 'Pan-India',
      ctc_lpa: ctc,
      eligibility_min_cgpa: minCgpa,
      drive_date: driveDate,
      deadline,
      description: description || '',
      status: driveDate > localDate() ? 'Upcoming' : 'Active'
    });
    const eligible = await Student.find({ status: 'Active', current_cgpa: { $gte: minCgpa }, semester: { $gte: 5 } }, 'id').lean();
    await notifyStudents(eligible.map((s) => s.id), {
      title: `${companyName} is hiring`,
      message: `${roleTitle} · ${ctc} LPA. You're eligible — apply by ${deadline}.`,
      type: 'placement',
      link: '/placements'
    });
    res.status(201).json({ message: `Drive created. ${eligible.length} eligible students notified.`, driveId: id });
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/placements/drives/:id/close — stop applications early (admin)
router.put('/drives/:id/close', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const r = await PlacementDrive.updateOne({ id: Number(req.params.id) }, { $set: { status: 'Closed' } });
    if (!r.matchedCount) throw new HttpError(404, 'Drive not found');
    res.json({ message: 'Applications closed' });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/placements/apply — student applies with a resume link (eligibility + deadline enforced)
router.post('/apply', verifyToken, requireRoles('student'), async (req, res) => {
  try {
    const student = req.student ? await Student.findOne({ id: req.student.id }, 'id current_cgpa').lean() : null;
    if (!student) throw new HttpError(404, 'Student record not found');
    const drive = await PlacementDrive.findOne({ id: Number(req.body.driveId) }).lean();
    if (!drive) throw new HttpError(404, 'Drive not found');
    if (effectiveStatus(drive) === 'Closed') throw new HttpError(400, 'Applications for this drive have closed');
    if (student.current_cgpa < drive.eligibility_min_cgpa) {
      throw new HttpError(400, `Minimum CGPA for this drive is ${drive.eligibility_min_cgpa}; yours is ${student.current_cgpa}.`);
    }
    const resume = String(req.body.resumeLink || '').trim();
    if (!/^https?:\/\/\S+$/i.test(resume)) throw new HttpError(400, 'Add a link to your resume (Google Drive, OneDrive, GitHub…)');
    try {
      await PlacementApplication.create({ id: await getNextId('placement_applications'), drive_id: drive.id, student_id: student.id, resume_link: resume, status: 'Applied' });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, 'You have already applied for this drive');
      throw err;
    }
    res.json({ message: `Applied to ${drive.company_name}` });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/placements/drives/:id/applications — applicants for a drive (admin)
router.get('/drives/:id/applications', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const apps = await PlacementApplication.find({ drive_id: Number(req.params.id) }).sort({ applied_at: 1 }).lean();
    const students = await Student.find({ id: { $in: apps.map((a) => a.student_id) } }).lean();
    const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name email').lean();
    const sMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const uMap = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json(
      apps.map((a) => {
        const s = sMap[a.student_id] || {};
        const u = uMap[s.user_id] || {};
        return { ...a, student_name: u.full_name, email: u.email, roll_no: s.roll_no, section: s.section, current_cgpa: s.current_cgpa };
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/placements/applications/:id — move an applicant through the pipeline (admin) and notify them
router.put('/applications/:id', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const { status, feedback } = req.body;
    if (!STAGES.includes(status)) throw new HttpError(400, `Status must be one of ${STAGES.join(', ')}`);
    const app = await PlacementApplication.findOne({ id: Number(req.params.id) }).lean();
    if (!app) throw new HttpError(404, 'Application not found');
    const drive = await PlacementDrive.findOne({ id: app.drive_id }).lean();
    await PlacementApplication.updateOne({ id: app.id }, { $set: { status, feedback: feedback || app.feedback || null } });
    await logAudit({
      userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
      action: 'PLACEMENT_STATUS', entityType: 'placement_applications', entityId: app.id,
      oldValue: { status: app.status }, newValue: { status }, reason: feedback || `Moved to ${status}`, ipAddress: req.ip
    });
    const label = status === 'Not_Selected' ? 'not selected this time' : status.toLowerCase();
    await notifyStudents([app.student_id], {
      title: status === 'Selected' ? `Offer from ${drive?.company_name}! 🎉` : `${drive?.company_name}: ${label}`,
      message: `Your application for ${drive?.role_title} is now ${label}.${feedback ? ` Note: ${feedback}` : ''}`,
      type: 'placement',
      link: '/placements'
    }, { includeGuardians: status === 'Selected' });
    res.json({ message: `Application moved to ${status}` });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/placements/stats — season statistics computed from drives and outcomes
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const [drives, selected, applications] = await Promise.all([
      PlacementDrive.find().lean(),
      PlacementApplication.find({ status: 'Selected' }).lean(),
      PlacementApplication.countDocuments()
    ]);
    const driveMap = Object.fromEntries(drives.map((d) => [d.id, d]));
    const offers = selected.map((a) => driveMap[a.drive_id]).filter(Boolean);
    const ctcs = (offers.length ? offers : drives).map((d) => d.ctc_lpa);
    const byCompany = {};
    for (const d of drives) {
      const c = (byCompany[d.company_name] ||= { name: d.company_name, hires: 0, best: 0, logo: d.company_logo });
      c.best = Math.max(c.best, d.ctc_lpa);
    }
    for (const d of offers) byCompany[d.company_name].hires += 1;
    const today = localDate();
    res.json({
      total_drives: drives.length,
      open_drives: drives.filter((d) => effectiveStatus(d, today) !== 'Closed').length,
      total_applications: applications,
      total_offers: selected.length,
      highest_package_lpa: ctcs.length ? Math.max(...ctcs) : 0,
      average_package_lpa: ctcs.length ? Math.round((ctcs.reduce((a, b) => a + b, 0) / ctcs.length) * 10) / 10 : 0,
      basis: offers.length ? 'offers made' : 'packages announced',
      top_recruiters: Object.values(byCompany)
        .sort((a, b) => b.hires - a.hires || b.best - a.best)
        .slice(0, 5)
        .map((c) => ({ name: c.name, hires: c.hires, ctc: `${c.best} LPA`, logo: c.logo }))
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
