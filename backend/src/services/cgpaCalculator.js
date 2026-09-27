const { spawn } = require('child_process');
const path = require('path');

// Pure JS implementation of the weighted model matching python_service/cgpa_engine.py
function calculateSubjectDifficulty(passPct, avgMarks) {
  const normPass = Math.max(0, Math.min(100, Number(passPct))) / 100.0;
  const normMarks = Math.max(0, Math.min(100, Number(avgMarks))) / 100.0;
  const rawDifficulty = 1.0 - (0.55 * normMarks + 0.45 * normPass);
  return Number(Math.max(0.10, Math.min(0.90, rawDifficulty)).toFixed(3));
}

function marksToGradePoint(score) {
  if (score >= 90) return { gp: 10.0, grade: 'O', desc: 'Outstanding' };
  if (score >= 75) return { gp: 9.0, grade: 'A+', desc: 'Excellent' };
  if (score >= 65) return { gp: 8.0, grade: 'A', desc: 'Very Good' };
  if (score >= 55) return { gp: 7.0, grade: 'B+', desc: 'Good' };
  if (score >= 50) return { gp: 6.0, grade: 'B', desc: 'Above Average' };
  if (score >= 45) return { gp: 5.0, grade: 'C', desc: 'Average' };
  if (score >= 40) return { gp: 4.0, grade: 'P', desc: 'Pass' };
  return { gp: 0.0, grade: 'F', desc: 'Fail' };
}

function predictSubjectScore(internalScore, maxInternal, assignmentScore, maxAssignment, attendancePct, difficultyIndex, hypotheticalAdjustment = 0) {
  const internalNorm = maxInternal > 0 ? (internalScore / maxInternal) * 100.0 : 70.0;
  const assignmentNorm = maxAssignment > 0 ? (assignmentScore / maxAssignment) * 100.0 : 75.0;
  const courseworkComposite = 0.65 * internalNorm + 0.35 * assignmentNorm;

  const att = Number(attendancePct);
  let attendanceMultiplier = 1.0;
  if (att >= 85.0) attendanceMultiplier = 1.05;
  else if (att >= 75.0) attendanceMultiplier = 1.00;
  else if (att >= 65.0) attendanceMultiplier = 0.88;
  else attendanceMultiplier = 0.72; // Below 75% threshold penalty

  const expectedExternal = courseworkComposite * (1.15 - 0.50 * difficultyIndex) * attendanceMultiplier;
  const projectedInternal = (courseworkComposite / 100.0) * 40.0;
  const projectedExternal = (expectedExternal / 100.0) * 60.0;

  const rawPredicted = projectedInternal + projectedExternal + Number(hypotheticalAdjustment || 0);
  const finalPredicted = Number(Math.max(0.0, Math.min(100.0, rawPredicted)).toFixed(1));

  const uncertaintyMargin = 3.5 + (difficultyIndex * 6.0) + (Math.max(0, 75.0 - att) * 0.15);
  const scoreLower = Number(Math.max(0.0, finalPredicted - uncertaintyMargin).toFixed(1));
  const scoreUpper = Number(Math.min(100.0, finalPredicted + uncertaintyMargin).toFixed(1));

  const expGrade = marksToGradePoint(finalPredicted);
  const lowGrade = marksToGradePoint(scoreLower);
  const upGrade = marksToGradePoint(scoreUpper);

  let isAtRisk = false;
  let warningReason = null;

  if (att < 75.0) {
    isAtRisk = true;
    warningReason = `Low Attendance (${att.toFixed(1)}%) breaches 75% mandatory GGSIPU threshold`;
  } else if (difficultyIndex >= 0.65 && courseworkComposite < 60.0) {
    isAtRisk = true;
    warningReason = `High difficulty subject (${difficultyIndex.toFixed(2)}) with low coursework score (${courseworkComposite.toFixed(1)})`;
  } else if (finalPredicted < 50.0) {
    isAtRisk = true;
    warningReason = `Predicted score (${finalPredicted.toFixed(1)}) is dangerously close to passing threshold`;
  }

  return {
    predicted_score: finalPredicted,
    score_range: [scoreLower, scoreUpper],
    predicted_grade_point: expGrade.gp,
    predicted_grade: expGrade.grade,
    grade_range: [lowGrade.grade, upGrade.grade],
    difficulty_index: Number(difficultyIndex.toFixed(2)),
    attendance_pct: Number(att.toFixed(1)),
    coursework_score: Number(courseworkComposite.toFixed(1)),
    is_at_risk: isAtRisk,
    warning_reason: warningReason
  };
}

function calculateCGPAPredictionJS(payload) {
  const subjectsData = payload.subjects || [];
  const currentCgpa = Number(payload.current_cgpa || 8.2);
  const previousCredits = Number(payload.previous_credits || 60);
  const whatIf = payload.what_if_adjustments || {};

  let totalSemCredits = 0;
  let weightedExpectedGp = 0.0;
  let weightedLowerGp = 0.0;
  let weightedUpperGp = 0.0;

  const analyzedSubjects = [];
  const atRiskSubjects = [];

  for (const item of subjectsData) {
    const subId = String(item.id);
    const credits = Number(item.credits || 4);
    const passPct = Number(item.historical_pass_pct || 85.0);
    const avgMarks = Number(item.historical_avg_marks || 70.0);

    let diffIdx = item.difficulty_index;
    if (diffIdx === undefined || diffIdx === null) {
      diffIdx = calculateSubjectDifficulty(passPct, avgMarks);
    } else {
      diffIdx = Number(diffIdx);
    }

    const internal = Number(item.internal_score ?? 18);
    const maxInternal = Number(item.max_internal ?? 25);
    const assignment = Number(item.assignment_score ?? 12);
    const maxAssignment = Number(item.max_assignment ?? 15);
    const attendance = Number(item.attendance_pct ?? 82.0);
    const hypotheticalAdj = Number(whatIf[subId] || 0);

    const pred = predictSubjectScore(
      internal,
      maxInternal,
      assignment,
      maxAssignment,
      attendance,
      diffIdx,
      hypotheticalAdj
    );

    pred.subject_id = item.id;
    pred.subject_code = item.code;
    pred.subject_name = item.name;
    pred.credits = credits;
    pred.hypothetical_adjustment = hypotheticalAdj;

    analyzedSubjects.push(pred);
    if (pred.is_at_risk) {
      atRiskSubjects.push({
        subject_code: pred.subject_code,
        subject_name: pred.subject_name,
        reason: pred.warning_reason,
        predicted_grade: pred.predicted_grade,
        predicted_score: pred.predicted_score
      });
    }

    totalSemCredits += credits;
    weightedExpectedGp += (pred.predicted_grade_point * credits);
    weightedLowerGp += (marksToGradePoint(pred.score_range[0]).gp * credits);
    weightedUpperGp += (marksToGradePoint(pred.score_range[1]).gp * credits);
  }

  const predictedSgpa = totalSemCredits > 0 ? Number((weightedExpectedGp / totalSemCredits).toFixed(2)) : currentCgpa;
  const sgpaLower = totalSemCredits > 0 ? Number((weightedLowerGp / totalSemCredits).toFixed(2)) : Number((currentCgpa - 0.3).toFixed(2));
  const sgpaUpper = totalSemCredits > 0 ? Number((weightedUpperGp / totalSemCredits).toFixed(2)) : Number((currentCgpa + 0.3).toFixed(2));

  const totalCumulativeCredits = previousCredits + totalSemCredits;
  const predictedCgpa = totalCumulativeCredits > 0 
    ? Number((((currentCgpa * previousCredits) + (predictedSgpa * totalSemCredits)) / totalCumulativeCredits).toFixed(2))
    : predictedSgpa;
  const cgpaLower = totalCumulativeCredits > 0
    ? Number((((currentCgpa * previousCredits) + (sgpaLower * totalSemCredits)) / totalCumulativeCredits).toFixed(2))
    : sgpaLower;
  const cgpaUpper = totalCumulativeCredits > 0
    ? Number((((currentCgpa * previousCredits) + (sgpaUpper * totalSemCredits)) / totalCumulativeCredits).toFixed(2))
    : sgpaUpper;

  const avgUncertainty = analyzedSubjects.reduce((acc, sub) => acc + (sub.score_range[1] - sub.score_range[0]), 0) / Math.max(1, analyzedSubjects.length);
  const confidenceScore = Math.max(60, Math.min(96, Math.round(100 - (avgUncertainty * 2.8))));

  return {
    engine: 'Statistical Weighted Analytics',
    predicted_sgpa: predictedSgpa,
    sgpa_range: [sgpaLower, sgpaUpper],
    predicted_cgpa: predictedCgpa,
    cgpa_range: [cgpaLower, cgpaUpper],
    confidence_score: confidenceScore,
    confidence_level: confidenceScore >= 82 ? 'High' : (confidenceScore >= 70 ? 'Moderate' : 'Low'),
    total_semester_credits: totalSemCredits,
    at_risk_count: atRiskSubjects.length,
    at_risk_subjects: atRiskSubjects,
    subjects: analyzedSubjects
  };
}

async function predictCGPAWithPythonOrFallback(payload) {
  return new Promise((resolve) => {
    const pythonScriptPath = path.resolve(__dirname, '../../python_service/cgpa_engine.py');
    const pyProcess = spawn('python', [pythonScriptPath]);

    let output = '';
    let errorOutput = '';

    pyProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pyProcess.on('close', (code) => {
      if (code === 0 && output.trim()) {
        try {
          const parsed = JSON.parse(output);
          parsed.engine = 'Python (scikit/pandas weighted scoring engine)';
          return resolve(parsed);
        } catch (e) {
          // fall through to JS
        }
      }
      // Fallback seamlessly to native JS mathematical model
      const jsResult = calculateCGPAPredictionJS(payload);
      resolve(jsResult);
    });

    pyProcess.on('error', () => {
      const jsResult = calculateCGPAPredictionJS(payload);
      resolve(jsResult);
    });

    // Send payload via stdin
    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
}

module.exports = {
  predictCGPAWithPythonOrFallback,
  calculateCGPAPredictionJS,
  calculateSubjectDifficulty,
  marksToGradePoint
};
