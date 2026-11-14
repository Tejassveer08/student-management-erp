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
  Examination,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission } = require('../middleware/authMiddleware');
const { generateGroqJson, getGroqModel } = require('../services/groqClient');
const { resolveStudent, subjectsForStudent, sendError, HttpError } = require('../services/scope');
const { ensureMeritFresh } = require('../services/merit');
const { getPolicy } = require('../services/policy');
const { weekStart } = require('../services/time');

const router = express.Router();

// GET /api/engagement/leaderboard — live merit leaderboard
router.get('/leaderboard', verifyToken, requirePermission('engagement', 'read'), async (req, res) => {
  try {
    await ensureMeritFresh();
    const points = await StudentPoints.find({}).sort({ merit_rank: 1 }).lean();
    const students = await Student.find({ id: { $in: points.map((p) => p.student_id) }, status: 'Active' }).lean();
    const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name avatar_url').lean();
    const stuMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json(
      points
        .map((row) => {
          const s = stuMap[row.student_id];
          const u = s ? userMap[s.user_id] : null;
          if (!s || !u) return null;
          let badges = [];
          try { badges = JSON.parse(row.badges_json || '[]'); } catch { badges = []; }
          return {
            rank: row.merit_rank,
            student_id: row.student_id,
            student_name: u.full_name,
            roll_no: s.roll_no,
            enrollment_no: s.enrollment_no,
            section: s.section,
            semester: s.semester,
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
    );
  } catch (err) {
    sendError(res, err);
  }
});

async function subjectSignals(student) {
  const [subjects, records, marks, declared] = await Promise.all([
    subjectsForStudent(student, { theoryOnly: true }),
    AttendanceRecord.find({ student_id: student.id }, 'session_id status').lean(),
    ExamMark.find({ student_id: student.id }).lean(),
    Examination.find({}, 'id start_date').lean()
  ]);
  const sessions = await AttendanceSession.find({ id: { $in: [...new Set(records.map((r) => r.session_id))] } }, 'id subject_id').lean();
  const sessSub = Object.fromEntries(sessions.map((s) => [s.id, s.subject_id]));
  const att = {};
  for (const r of records) {
    const sub = sessSub[r.session_id];
    if (!sub) continue;
    const a = (att[sub] ||= { total: 0, attended: 0 });
    a.total += 1;
    if (r.status === 'Present') a.attended += 1;
    else if (r.status === 'Late') a.attended += 0.5;
  }
  const examDate = Object.fromEntries(declared.map((e) => [e.id, e.start_date || '']));
  const latest = {};
  for (const m of marks) {
    const prev = latest[m.subject_id];
    if (!prev || (examDate[m.exam_id] || '') > (examDate[prev.exam_id] || '')) latest[m.subject_id] = m;
  }
  return { subjects, att, latest };
}

// GET /api/engagement/study-plan/:studentId — weekly planner built from live attendance, marks and difficulty
router.get('/study-plan/:studentId', verifyToken, requirePermission('engagement', 'read'), async (req, res) => {
  try {
    const student = await resolveStudent(req, req.params.studentId);
    const policy = await getPolicy();
    const thisWeek = weekStart();
    const [{ subjects, att, latest }, saved] = await Promise.all([subjectSignals(student), StudyPlan.find({ student_id: student.id }).lean()]);
    const savedMap = Object.fromEntries(saved.map((p) => [p.subject_id, p]));

    const items = subjects.map((sub) => {
      const a = att[sub.id];
      const attPct = a && a.total ? (a.attended / a.total) * 100 : null;
      const m = latest[sub.id];
      const internalPct = m ? (m.internal_assessment / 25) * 100 : null;
      const assignPct = m ? (m.assignment_score / 15) * 100 : null;
      const diff = sub.difficulty_index ?? 0.45;

      // Need score: difficulty, weak internals and low attendance all raise the weekly target
      let need = diff * 4;
      const reasons = [];
      if (attPct !== null && attPct < policy.attendanceThreshold) { need += 2.5; reasons.push(`attendance ${attPct.toFixed(0)}% is under ${policy.attendanceThreshold}%`); }
      if (internalPct !== null && internalPct < 60) { need += 2; reasons.push(`internal test ${m.internal_assessment}/25`); }
      if (assignPct !== null && assignPct < 60) { need += 1; reasons.push(`assignments ${m.assignment_score}/15`); }
      if (diff >= 0.65) reasons.push(`historically tough (difficulty ${diff.toFixed(2)})`);
      const hours = Math.round(Math.min(9, Math.max(2, 2 + need)) * 2) / 2;
      const priority = need >= 5 ? 'Critical' : need >= 3.5 ? 'High' : need >= 2 ? 'Moderate' : 'Review';

      const units = String(sub.syllabus_outline || '').split(/\n|;|\|/).map((x) => x.trim()).filter(Boolean);
      const focus = internalPct !== null && internalPct < 60 && units.length ? units.slice(0, 2).join(' · ') : units.length ? units.slice(-2).join(' · ') : 'Previous-year question papers';

      const plan = savedMap[sub.id];
      const done = plan && plan.week_start === thisWeek ? plan.completed_hours_this_week || 0 : 0;
      return {
        subject_id: sub.id,
        subject_code: sub.code,
        subject_name: sub.name,
        credits: sub.credits,
        difficulty_index: diff,
        live_attendance_pct: attPct === null ? null : Number(attPct.toFixed(1)),
        internal_score: m ? m.internal_assessment : null,
        priority,
        recommended_weekly_hours: hours,
        completed_hours_this_week: done,
        weak_topics: plan?.weak_topics || focus,
        reasons,
        progress_pct: Math.min(100, Math.round((done / hours) * 100))
      };
    });
    const order = { Critical: 0, High: 1, Moderate: 2, Review: 3 };
    items.sort((a, b) => order[a.priority] - order[b.priority] || b.recommended_weekly_hours - a.recommended_weekly_hours);

    res.json({
      student_id: student.id,
      semester: student.semester,
      week_start: thisWeek,
      planner_items: items,
      weekly_target_total_hours: items.reduce((s, p) => s + p.recommended_weekly_hours, 0),
      completed_total_hours: items.reduce((s, p) => s + p.completed_hours_this_week, 0)
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/engagement/study-plan/progress — a student logs study hours for this week
router.post('/study-plan/progress', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') throw new HttpError(403, 'Only students can log their own study hours.');
    const student = await resolveStudent(req, 'me');
    const subjectId = Number(req.body.subjectId);
    const add = Number(req.body.addHours ?? 1);
    if (!subjectId) throw new HttpError(400, 'Subject is required');
    if (!Number.isFinite(add) || add <= 0 || add > 12) throw new HttpError(400, 'Log between 0.5 and 12 hours at a time');
    const subjects = await subjectsForStudent(student, { theoryOnly: true });
    if (!subjects.some((s) => s.id === subjectId)) throw new HttpError(400, 'That subject is not in your current semester');

    const thisWeek = weekStart();
    const existing = await StudyPlan.findOne({ student_id: student.id, subject_id: subjectId }).lean();
    const set = { week_start: thisWeek };
    if (req.body.weakTopics) set.weak_topics = String(req.body.weakTopics).slice(0, 300);
    if (req.body.priority) set.priority = req.body.priority;
    if (existing) {
      const base = existing.week_start === thisWeek ? existing.completed_hours_this_week || 0 : 0;
      await StudyPlan.updateOne({ id: existing.id }, { $set: { ...set, completed_hours_this_week: Math.round((base + add) * 10) / 10 } });
    } else {
      await StudyPlan.create({ id: await getNextId('study_plans'), student_id: student.id, subject_id: subjectId, completed_hours_this_week: add, ...set });
    }
    res.json({ message: `Logged ${add}h for this week.` });
  } catch (err) {
    sendError(res, err);
  }
});

const TRACKS = [
  { role: 'Software Development Engineer', keys: ['algorithm', 'data structure', 'discrete', 'programming', 'object', 'java', 'computation'], skills: ['System design fundamentals', 'Competitive programming practice'], certs: ['LeetCode / Codeforces contest ratings', 'Oracle Certified Java Programmer'], demand: 'Highest-volume campus hiring role' },
  { role: 'Full-Stack Web Engineer', keys: ['web', 'software', 'database', 'dbms', 'internet', 'programming'], skills: ['React + Node.js projects', 'REST API and database design'], certs: ['Meta Full-Stack Developer', 'MongoDB Associate Developer'], demand: 'Strong demand across product startups' },
  { role: 'Data Scientist / ML Engineer', keys: ['machine learning', 'artificial', 'data', 'statistic', 'probability', 'mathematics', 'deep', 'neural'], skills: ['Python data stack (NumPy, pandas)', 'Model evaluation and MLOps basics'], certs: ['TensorFlow Developer Certificate', 'Google Data Analytics'], demand: 'Fast-growing, rewards strong maths' },
  { role: 'Cloud & Systems Engineer', keys: ['operating', 'network', 'distributed', 'cloud', 'organization', 'architecture', 'compiler'], skills: ['Linux and shell scripting', 'Containers and Kubernetes'], certs: ['AWS Solutions Architect – Associate', 'Certified Kubernetes Administrator'], demand: 'High demand in cloud and infra teams' },
  { role: 'Embedded & VLSI Engineer', keys: ['electronic', 'digital', 'circuit', 'signal', 'microprocessor', 'communication', 'vlsi', 'analog'], skills: ['Verilog / VHDL', 'Microcontroller firmware'], certs: ['ARM Accredited Engineer', 'Cadence Digital Design'], demand: 'Core semiconductor and hardware firms' },
  { role: 'Cybersecurity Analyst', keys: ['security', 'crypto', 'network', 'forensic'], skills: ['OWASP Top 10 and web security', 'Network traffic analysis'], certs: ['CompTIA Security+', 'Certified Ethical Hacker'], demand: 'Steady demand across banks and IT services' }
];

// GET /api/engagement/career-recommendations/:studentId — career fit from the student's own declared results
router.get('/career-recommendations/:studentId', verifyToken, requirePermission('engagement', 'read'), async (req, res) => {
  try {
    const student = await resolveStudent(req, req.params.studentId);
    const [user, marks, declared] = await Promise.all([
      User.findOne({ id: student.user_id }, 'full_name').lean(),
      ExamMark.find({ student_id: student.id }).lean(),
      Examination.distinct('id', { status: 'Results_Declared' })
    ]);
    const visible = marks.filter((m) => declared.includes(m.exam_id));
    const subjects = await Subject.find({ id: { $in: [...new Set(visible.map((m) => m.subject_id))] } }, 'id code name').lean();
    const subMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const best = {};
    for (const m of visible) {
      if (!subMap[m.subject_id]) continue;
      if (!best[m.subject_id] || m.total_score > best[m.subject_id].total_score) best[m.subject_id] = m;
    }
    const scored = Object.values(best).map((m) => ({ code: subMap[m.subject_id].code, name: subMap[m.subject_id].name, score: m.total_score, grade: m.letter_grade }));

    let recommendations = null;
    let aiProvider = 'rule-based (your declared results)';
    if (scored.length) {
      const groq = await generateGroqJson(
        'You are an academic career advisor for B.Tech students at GTBIT (GGSIPU, Delhi). Return ONLY JSON: {"recommendations":[{"role":string,"fit_score":number 0-100,"matching_strengths":string[],"growth_areas":string[],"recommended_certifications":string[],"market_demand":string}]} with exactly 3 items grounded in the marks given. Do not invent salary figures.',
        `Student semester ${student.semester}, CGPA ${student.current_cgpa}. Declared subject results: ${JSON.stringify(scored)}`
      );
      if (groq && Array.isArray(groq.recommendations) && groq.recommendations.length) {
        recommendations = groq.recommendations.slice(0, 3);
        aiProvider = `groq:${getGroqModel()}`;
      }
    }

    if (!recommendations) {
      recommendations = TRACKS.map((t) => {
        const hits = scored.filter((s) => t.keys.some((k) => s.name.toLowerCase().includes(k)));
        if (!hits.length) return null;
        const avg = hits.reduce((a, s) => a + s.score, 0) / hits.length;
        const sorted = [...hits].sort((a, b) => b.score - a.score);
        return {
          role: t.role,
          fit_score: Math.round(Math.min(98, 0.7 * avg + 0.3 * (student.current_cgpa || 0) * 10)),
          matching_strengths: sorted.slice(0, 2).map((s) => `${s.name} (${s.score}/100, ${s.grade})`),
          growth_areas: [...sorted.slice(2).filter((s) => s.score < 65).slice(0, 1).map((s) => `Strengthen ${s.name}`), ...t.skills].slice(0, 3),
          recommended_certifications: t.certs,
          market_demand: t.demand,
          evidence_subjects: hits.length
        };
      })
        .filter(Boolean)
        .sort((a, b) => b.fit_score - a.fit_score)
        .slice(0, 3);
    }

    res.json({
      student_id: student.id,
      student_name: user?.full_name,
      current_cgpa: student.current_cgpa,
      ai_provider: aiProvider,
      analysis_basis: scored.length ? `${scored.length} declared subject results and your CGPA` : 'No declared results yet — recommendations appear after your first results',
      recommendations
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
