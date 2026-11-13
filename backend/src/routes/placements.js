const express = require('express');
const { PlacementDrive, PlacementApplication, Student, getNextId } = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/placements/drives
router.get('/drives', verifyToken, async (req, res) => {
  let studentCgpa = null;
  let studentId = null;

  if (req.user.role === 'student') {
    const student = await Student.findOne({ user_id: req.user.id }, 'id current_cgpa').lean();
    if (student) {
      studentCgpa = student.current_cgpa;
      studentId = student.id;
    }
  }

  const drives = await PlacementDrive.find().sort({ drive_date: 1 }).lean();
  const apps = studentId ? await PlacementApplication.find({ student_id: studentId }).lean() : [];
  const appMap = Object.fromEntries(apps.map(a => [a.drive_id, a.status]));

  res.json(drives.map(d => ({
    ...d,
    is_eligible: studentCgpa !== null ? studentCgpa >= d.eligibility_min_cgpa : true,
    has_applied: !!appMap[d.id],
    application_status: appMap[d.id] || null
  })));
});

// POST /api/placements/drives
router.post('/drives', verifyToken, requireRoles('admin'), async (req, res) => {
  const { companyName, companyLogo, roleTitle, jobLocation, ctcLpa, eligibilityMinCgpa, driveDate, deadline, description } = req.body;
  if (!companyName || !roleTitle || !ctcLpa || !driveDate || !deadline) {
    return res.status(400).json({ error: 'Company name, role, CTC, drive date, and deadline are required' });
  }

  const id = await getNextId('placement_drives');
  await PlacementDrive.create({
    id,
    company_name: companyName,
    company_logo: companyLogo || 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150&auto=format&fit=crop&q=80',
    role_title: roleTitle,
    job_location: jobLocation || 'Pan-India',
    ctc_lpa: ctcLpa,
    eligibility_min_cgpa: eligibilityMinCgpa || 7.0,
    drive_date: driveDate,
    deadline,
    description: description || '',
    status: 'Active'
  });

  res.status(201).json({ message: 'Drive created successfully', driveId: id });
});

// POST /api/placements/apply
router.post('/apply', verifyToken, requireRoles('student'), async (req, res) => {
  const { driveId, resumeLink } = req.body;
  const student = await Student.findOne({ user_id: req.user.id }, 'id current_cgpa').lean();
  if (!student) return res.status(404).json({ error: 'Student record not found' });

  const drive = await PlacementDrive.findOne({ id: Number(driveId) }).lean();
  if (!drive) return res.status(404).json({ error: 'Drive not found' });

  if (student.current_cgpa < drive.eligibility_min_cgpa) {
    return res.status(400).json({
      error: `Ineligible: Minimum CGPA requirement is ${drive.eligibility_min_cgpa}. Your CGPA is ${student.current_cgpa}.`
    });
  }

  try {
    const id = await getNextId('placement_applications');
    await PlacementApplication.create({
      id,
      drive_id: Number(driveId),
      student_id: student.id,
      resume_link: resumeLink || 'https://gtbit.ac.in/resumes/default_student.pdf',
      status: 'Applied'
    });
    res.json({ message: 'Application submitted successfully to TnP Cell' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'You have already applied for this placement drive' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/placements/stats
router.get('/stats', verifyToken, async (req, res) => {
  const selectedCount = await PlacementApplication.countDocuments({ status: 'Selected' });
  res.json({
    total_drives: 12,
    highest_package_lpa: 28.0,
    average_package_lpa: 14.8,
    total_offers: selectedCount || 8,
    top_recruiters: [
      { name: 'Google India', hires: 3, ctc: '28.0 LPA' },
      { name: 'Microsoft IDC', hires: 4, ctc: '24.5 LPA' },
      { name: 'Zomato', hires: 6, ctc: '16.5 LPA' },
      { name: 'Infosys SP', hires: 12, ctc: '9.5 LPA' }
    ]
  });
});

module.exports = router;
