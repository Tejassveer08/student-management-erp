const express = require('express');
const {
  StudentPoints,
  Student,
  User,
  Subject,
  StudyPlan,
  AttendanceRecord,
  AttendanceSession,
  ExamMark,
  getNextId
} = require('../db/database');
const { verifyToken } = require('../middleware/authMiddleware');
const { generateGroqJson, getGroqModel } = require('../services/groqClient');

const router = express.Router();

// GET /api/engagement/leaderboard - Gamified merit leaderboard with achievement badges
router.get('/leaderboard', verifyToken, async (req, res) => {
  try {
    const points = await StudentPoints.find({}).sort({ total_merit_points: -1 }).lean();
    if (points.length === 0) return res.json([]);

    const studentIds = [...new Set(points.map(p => p.student_id))];
    const students = await Student.find({ id: { $in: studentIds } }).lean();
    const userIds = [...new Set(students.map(s => s.user_id))];
    const users = await User.find({ id: { $in: userIds } }).lean();

    const stuMap = Object.fromEntries(students.map(s => [s.id, s]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const formatted = points
      .map(row => {
        const s = stuMap[row.student_id];
        const u = s ? userMap[s.user_id] : null;
        if (!s || !u) return null;
        let badges = [];
        try {
          badges = JSON.parse(row.badges_json || '[]');
        } catch (e) {
          badges = [];
        }
        return {
          student_id: row.student_id,
          student_name: u.full_name,
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          avatar_url: u.avatar_url,
          current_cgpa: s.current_cgpa,
          total_merit_points: row.total_merit_points,
          academic_score: row.academic_score,
          attendance_score: row.attendance_score,
          assignment_score: row.assignment_score,
          badges
        };
      })
      .filter(Boolean)
      .map((item, idx) => ({ rank: idx + 1, ...item }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/engagement/study-plan/:studentId - Personalized Smart Study Planner
router.get('/study-plan/:studentId', verifyToken, async (req, res) => {
  try {
    let targetId = req.params.studentId;

    if (targetId === 'me') {
      if (req.user.role === 'student') {
        const st = await Student.findOne({ user_id: req.user.id }).lean();
        targetId = st ? st.id : null;
      } else if (req.user.role === 'parent') {
        const ward = await Student.findOne({ parent_user_id: req.user.id }).lean();
        targetId = ward ? ward.id : null;
      }
    }

    if (!targetId) return res.status(400).json({ error: 'Student ID required' });

    const numericId = Number(targetId);
    const student = await Student.findOne({ id: numericId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [subjects, savedPlans, attRecords] = await Promise.all([
      Subject.find({ semester: student.semester, type: 'Theory' }).sort({ difficulty_index: -1 }).lean(),
      StudyPlan.find({ student_id: numericId }).lean(),
      AttendanceRecord.find({ student_id: numericId }).lean()
    ]);

    const sessionIds = [...new Set(attRecords.map(r => r.session_id))];
    const sessions = sessionIds.length
      ? await AttendanceSession.find({ id: { $in: sessionIds } }).lean()
      : [];
    const sessionSubMap = Object.fromEntries(sessions.map(s => [s.id, s.subject_id]));

    const savedMap = Object.fromEntries(savedPlans.map(sp => [sp.subject_id, sp]));
    const attBySub = {};
    for (const r of attRecords) {
      const subId = sessionSubMap[r.session_id];
      if (!subId) continue;
      if (!attBySub[subId]) attBySub[subId] = { total: 0, present: 0 };
      attBySub[subId].total += 1;
      if (r.status === 'Present') attBySub[subId].present += 1;
    }

    const plannerItems = subjects.map(sub => {
      const saved = savedMap[sub.id];
      const attRec = attBySub[sub.id] || { total: 0, present: 0 };
      const attPct = attRec.total > 0 ? (attRec.present / attRec.total) * 100 : 85;

      let priority = 'Moderate';
      let recommendedHours = 3.5;
      let weakTopics = 'Module 3 & 4 practice problems';

      if (sub.difficulty_index >= 0.70 || attPct < 75.0) {
        priority = 'Critical';
        recommendedHours = 6.0;
        weakTopics = sub.code.includes('204') ? 'Dynamic Programming & NP-Completeness' : 'Core Architecture & Problem Solving';
      } else if (sub.difficulty_index >= 0.55) {
        priority = 'High';
        recommendedHours = 4.5;
        weakTopics = 'Mid-term question bank review';
      }

      if (saved) {
        priority = saved.priority || priority;
        recommendedHours = saved.recommended_weekly_hours || recommendedHours;
        weakTopics = saved.weak_topics || weakTopics;
      }

      return {
        subject_id: sub.id,
        subject_code: sub.code,
        subject_name: sub.name,
        credits: sub.credits,
        difficulty_index: sub.difficulty_index,
        live_attendance_pct: Number(attPct.toFixed(1)),
        priority,
        recommended_weekly_hours: recommendedHours,
        completed_hours_this_week: saved ? saved.completed_hours_this_week : 1.5,
        weak_topics: weakTopics,
        progress_pct: saved ? Math.min(100, Math.round((saved.completed_hours_this_week / recommendedHours) * 100)) : 35
      };
    });

    res.json({
      student_id: student.id,
      semester: student.semester,
      planner_items: plannerItems,
      weekly_target_total_hours: plannerItems.reduce((acc, p) => acc + p.recommended_weekly_hours, 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/engagement/study-plan/progress - Update weekly logged hours
router.post('/study-plan/progress', verifyToken, async (req, res) => {
  try {
    const { studentId, subjectId, addHours, weakTopics, priority } = req.body;

    let targetId = studentId;
    if (req.user.role === 'student') {
      const st = await Student.findOne({ user_id: req.user.id }).lean();
      targetId = st ? st.id : null;
    }

    if (!targetId || !subjectId) {
      return res.status(400).json({ error: 'Student ID and Subject ID required' });
    }

    const numericStudentId = Number(targetId);
    const numericSubjectId = Number(subjectId);
    const existing = await StudyPlan.findOne({
      student_id: numericStudentId,
      subject_id: numericSubjectId
    }).lean();

    if (existing) {
      const updates = {
        completed_hours_this_week: (existing.completed_hours_this_week || 0) + Number(addHours || 1)
      };
      if (weakTopics) updates.weak_topics = weakTopics;
      if (priority) updates.priority = priority;

      await StudyPlan.updateOne({ id: existing.id }, { $set: updates });
    } else {
      const id = await getNextId('study_plans');
      await StudyPlan.create({
        id,
        student_id: numericStudentId,
        subject_id: numericSubjectId,
        priority: priority || 'Moderate',
        recommended_weekly_hours: 4.5,
        completed_hours_this_week: Number(addHours || 1),
        weak_topics: weakTopics || 'General review'
      });
    }

    res.json({ message: 'Study progress recorded successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/engagement/career-recommendations/:studentId - AI skill and career recommendations
router.get('/career-recommendations/:studentId', verifyToken, async (req, res) => {
  try {
    let targetId = req.params.studentId;

    if (targetId === 'me') {
      if (req.user.role === 'student') {
        const st = await Student.findOne({ user_id: req.user.id }).lean();
        targetId = st ? st.id : 1;
      } else {
        targetId = 1;
      }
    }

    const numericId = Number(targetId);
    const student = await Student.findOne({ id: numericId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [user, markDocs, attRecords] = await Promise.all([
      User.findOne({ id: student.user_id }).lean(),
      ExamMark.find({ student_id: numericId }).lean(),
      AttendanceRecord.find({ student_id: numericId }).lean()
    ]);

    const subIds = [...new Set(markDocs.map(m => m.subject_id))];
    const subjects = subIds.length ? await Subject.find({ id: { $in: subIds } }).lean() : [];
    const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));

    const marks = markDocs.map(em => ({
      total_score: em.total_score,
      letter_grade: em.letter_grade,
      code: subMap[em.subject_id]?.code || '',
      name: subMap[em.subject_id]?.name || ''
    }));

    const totalAtt = attRecords.length;
    const presentAtt = attRecords.filter(r => r.status === 'Present').length;
    const attPct = totalAtt > 0 ? Number(((presentAtt / totalAtt) * 100).toFixed(1)) : 85.0;

    let recommendations = null;
    let aiProvider = 'rule-based';

    const groqResult = await generateGroqJson(
      'You are an academic career advisor for B.Tech Computer Science students at GTBIT (GGSIPU). Return ONLY valid JSON with a "recommendations" array of 3 objects, each having: "role" (string), "fit_score" (integer 60-99), "matching_strengths" (array of 2-3 strings), "growth_areas" (array of 2-3 strings), "recommended_certifications" (array of 2 strings), "market_demand" (string with realistic INR CTC range).',
      `Student: ${user?.full_name || 'Student'}, Semester: ${student.semester}, CGPA: ${student.current_cgpa}, Attendance: ${attPct}%, Subject Marks: ${JSON.stringify(marks)}.`
    );

    if (groqResult && Array.isArray(groqResult.recommendations) && groqResult.recommendations.length > 0) {
      recommendations = groqResult.recommendations;
      aiProvider = `groq:${getGroqModel()}`;
    } else {
      recommendations = [
        {
          role: 'Cloud & Distributed Systems Architect',
          fit_score: 94,
          matching_strengths: ['Operating Systems (Score: 88%)', 'Computer Networks (Score: 91%)'],
          growth_areas: ['Kubernetes & Container Orchestration', 'Linux Kernel Interfacing'],
          recommended_certifications: ['AWS Certified Solutions Architect', 'CKA: Certified Kubernetes Administrator'],
          market_demand: 'Extremely High (Tier-1 Cloud Provider CTC: 22 - 32 LPA)'
        },
        {
          role: 'Full Stack & Enterprise Software Engineer',
          fit_score: 91,
          matching_strengths: ['Software Engineering (Score: 94%)', 'Data Structures & Algorithms'],
          growth_areas: ['Microservices Patterns', 'Redis In-Memory Caching'],
          recommended_certifications: ['Meta Full Stack Developer Specialization', 'Oracle Java / React Professional'],
          market_demand: 'Very High (Average CTC: 16 - 25 LPA)'
        },
        {
          role: 'AI & Machine Learning Engineer',
          fit_score: 87,
          matching_strengths: ['AI & Machine Learning (Score: 84%)', 'Algorithms & Problem Solving'],
          growth_areas: ['PyTorch Deep Learning Models', 'MLOps & Inference Optimization'],
          recommended_certifications: ['TensorFlow Developer Certificate', 'DeepLearning.AI Machine Learning Specialization'],
          market_demand: 'Exponential Growth (Average CTC: 20 - 30 LPA)'
        }
      ];
    }

    res.json({
      student_id: student.id,
      current_cgpa: student.current_cgpa,
      ai_provider: aiProvider,
      analysis_basis: 'Academic performance variance, coursework depth, and subject strengths',
      recommendations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
