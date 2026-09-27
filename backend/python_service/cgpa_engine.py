#!/usr/bin/env python3
"""
CGPA Probability & Subject Difficulty Prediction Engine
Student Management ERP System - GTBIT (Guru Gobind Singh Indraprastha University)
Implements weighted statistical modeling based on:
  1. Historical Subject Difficulty Index (pass rate, avg score variance)
  2. Internal Assessments & Assignment performance
  3. Live Smart Attendance Tracker percentage
"""

import sys
import json
import math

def calculate_subject_difficulty(pass_pct, avg_marks):
    """
    Difficulty Index scaled from 0.05 (easiest) to 0.95 (most challenging).
    Higher pass rate and higher average marks imply lower difficulty.
    Formula: 1.0 - (0.55 * (avg_marks / 100.0) + 0.45 * (pass_pct / 100.0))
    """
    norm_pass = max(0.0, min(100.0, float(pass_pct))) / 100.0
    norm_marks = max(0.0, min(100.0, float(avg_marks))) / 100.0
    raw_difficulty = 1.0 - (0.55 * norm_marks + 0.45 * norm_pass)
    # Clamp to realistic bounds [0.10, 0.90]
    return round(max(0.10, min(0.90, raw_difficulty)), 3)

def marks_to_grade_point(score):
    """GGSIPU standard 10-point grading scale mapping"""
    if score >= 90:
        return 10.0, 'O', 'Outstanding'
    elif score >= 75:
        return 9.0, 'A+', 'Excellent'
    elif score >= 65:
        return 8.0, 'A', 'Very Good'
    elif score >= 55:
        return 7.0, 'B+', 'Good'
    elif score >= 50:
        return 6.0, 'B', 'Above Average'
    elif score >= 45:
        return 5.0, 'C', 'Average'
    elif score >= 40:
        return 4.0, 'P', 'Pass'
    else:
        return 0.0, 'F', 'Fail'

def predict_subject_score(internal_score, max_internal, assignment_score, max_assignment, 
                          attendance_pct, difficulty_index, hypothetical_adjustment=0):
    """
    Predicts final semester score (out of 100) using multi-factor weighted regression model:
      - Continuous Internal Performance (40% weight total: 25% mid-term/internals + 15% assignments)
      - Smart Attendance factor (15% weight with exponential penalty below 75% threshold)
      - Historical End-Term Projection based on subject difficulty (45% weight)
    """
    # 1. Normalize internal assessment (0 to 100 scale)
    internal_norm = (internal_score / max_internal * 100.0) if max_internal > 0 else 70.0
    assignment_norm = (assignment_score / max_assignment * 100.0) if max_assignment > 0 else 75.0
    coursework_composite = 0.65 * internal_norm + 0.35 * assignment_norm

    # 2. Attendance factor: GGSIPU mandates 75% attendance
    # Bonus for >85%, severe drag for <75%
    att = float(attendance_pct)
    if att >= 85.0:
        attendance_multiplier = 1.05
    elif att >= 75.0:
        attendance_multiplier = 1.00
    elif att >= 65.0:
        attendance_multiplier = 0.88 # slight penalty
    else:
        attendance_multiplier = 0.72 # attendance risk impact

    # 3. Projected external score (out of 100 scale)
    # External exam expectation correlates with coursework but gets pulled down by high subject difficulty
    expected_external = coursework_composite * (1.15 - 0.50 * difficulty_index) * attendance_multiplier

    # 4. Final blended score prediction
    # Internal component = 40 marks, External component = 60 marks
    projected_internal_component = (coursework_composite / 100.0) * 40.0
    projected_external_component = (expected_external / 100.0) * 60.0
    
    raw_predicted = projected_internal_component + projected_external_component + hypothetical_adjustment
    final_predicted = max(0.0, min(100.0, raw_predicted))

    # Calculate Confidence Variance (spread) based on difficulty and attendance consistency
    # Higher difficulty or erratic attendance increases uncertainty window
    uncertainty_margin = 3.5 + (difficulty_index * 6.0) + (max(0, 75.0 - att) * 0.15)
    score_lower = max(0.0, round(final_predicted - uncertainty_margin, 1))
    score_upper = min(100.0, round(final_predicted + uncertainty_margin, 1))

    gp_expected, grade_expected, grade_desc = marks_to_grade_point(final_predicted)
    gp_lower, grade_lower, _ = marks_to_grade_point(score_lower)
    gp_upper, grade_upper, _ = marks_to_grade_point(score_upper)

    # Early warning flag criteria
    is_at_risk = False
    warning_reason = None

    if att < 75.0:
        is_at_risk = True
        warning_reason = f"Low Attendance ({att:.1f}%) breaches 75% mandatory threshold"
    elif difficulty_index >= 0.65 and coursework_composite < 60.0:
        is_at_risk = True
        warning_reason = f"High difficulty subject ({difficulty_index:.2f}) with low coursework score ({coursework_composite:.1f})"
    elif final_predicted < 50.0:
        is_at_risk = True
        warning_reason = f"Predicted score ({final_predicted:.1f}) is near the passing threshold"

    return {
        "predicted_score": round(final_predicted, 1),
        "score_range": [score_lower, score_upper],
        "predicted_grade_point": gp_expected,
        "predicted_grade": grade_expected,
        "grade_range": [grade_lower, grade_upper],
        "difficulty_index": round(difficulty_index, 2),
        "attendance_pct": round(att, 1),
        "coursework_score": round(coursework_composite, 1),
        "is_at_risk": is_at_risk,
        "warning_reason": warning_reason
    }

def run_probability_analysis(payload):
    """
    Main entry point for calculating semester CGPA predictions and what-if scenarios.
    """
    subjects_data = payload.get("subjects", [])
    current_cgpa = float(payload.get("current_cgpa", 8.2))
    previous_credits = int(payload.get("previous_credits", 60))
    hypothetical_adjustments = payload.get("what_if_adjustments", {}) # { subject_id: +/- marks }

    total_sem_credits = 0
    weighted_expected_gp = 0.0
    weighted_lower_gp = 0.0
    weighted_upper_gp = 0.0

    analyzed_subjects = []
    at_risk_subjects = []

    for item in subjects_data:
        sub_id = str(item.get("id"))
        credits = int(item.get("credits", 4))
        pass_pct = float(item.get("historical_pass_pct", 85.0))
        avg_marks = float(item.get("historical_avg_marks", 70.0))
        
        # Calculate or use provided difficulty index
        diff_idx = item.get("difficulty_index")
        if diff_idx is None:
            diff_idx = calculate_subject_difficulty(pass_pct, avg_marks)
        else:
            diff_idx = float(diff_idx)

        internal = float(item.get("internal_score", 18))
        max_internal = float(item.get("max_internal", 25))
        assignment = float(item.get("assignment_score", 12))
        max_assignment = float(item.get("max_assignment", 15))
        attendance = float(item.get("attendance_pct", 82.0))

        # Check for user what-if tweak
        hypothetical_adj = float(hypothetical_adjustments.get(sub_id, 0))

        pred = predict_subject_score(
            internal_score=internal,
            max_internal=max_internal,
            assignment_score=assignment,
            max_assignment=max_assignment,
            attendance_pct=attendance,
            difficulty_index=diff_idx,
            hypothetical_adjustment=hypothetical_adj
        )

        pred["subject_id"] = item.get("id")
        pred["subject_code"] = item.get("code")
        pred["subject_name"] = item.get("name")
        pred["credits"] = credits
        pred["hypothetical_adjustment"] = hypothetical_adj

        analyzed_subjects.append(pred)
        if pred["is_at_risk"]:
            at_risk_subjects.append({
                "subject_code": pred["subject_code"],
                "subject_name": pred["subject_name"],
                "reason": pred["warning_reason"],
                "predicted_grade": pred["predicted_grade"],
                "predicted_score": pred["predicted_score"]
            })

        total_sem_credits += credits
        weighted_expected_gp += (pred["predicted_grade_point"] * credits)
        weighted_lower_gp += (marks_to_grade_point(pred["score_range"][0])[0] * credits)
        weighted_upper_gp += (marks_to_grade_point(pred["score_range"][1])[0] * credits)

    if total_sem_credits > 0:
        predicted_sgpa = round(weighted_expected_gp / total_sem_credits, 2)
        sgpa_lower = round(weighted_lower_gp / total_sem_credits, 2)
        sgpa_upper = round(weighted_upper_gp / total_sem_credits, 2)
    else:
        predicted_sgpa = current_cgpa
        sgpa_lower = current_cgpa - 0.3
        sgpa_upper = current_cgpa + 0.3

    # Cumulative CGPA aggregation
    total_cumulative_credits = previous_credits + total_sem_credits
    if total_cumulative_credits > 0:
        predicted_cgpa = round(((current_cgpa * previous_credits) + (predicted_sgpa * total_sem_credits)) / total_cumulative_credits, 2)
        cgpa_lower = round(((current_cgpa * previous_credits) + (sgpa_lower * total_sem_credits)) / total_cumulative_credits, 2)
        cgpa_upper = round(((current_cgpa * previous_credits) + (sgpa_upper * total_sem_credits)) / total_cumulative_credits, 2)
    else:
        predicted_cgpa = predicted_sgpa
        cgpa_lower = sgpa_lower
        cgpa_upper = sgpa_upper

    # Model confidence score (0 - 100%)
    # Confidence is higher when attendance is regular and grade range is tight
    avg_uncertainty = sum(sub["score_range"][1] - sub["score_range"][0] for sub in analyzed_subjects) / max(1, len(analyzed_subjects))
    confidence_score = max(60, min(96, round(100 - (avg_uncertainty * 2.8))))

    return {
        "predicted_sgpa": predicted_sgpa,
        "sgpa_range": [sgpa_lower, sgpa_upper],
        "predicted_cgpa": predicted_cgpa,
        "cgpa_range": [cgpa_lower, cgpa_upper],
        "confidence_score": confidence_score,
        "confidence_level": "High" if confidence_score >= 82 else ("Moderate" if confidence_score >= 70 else "Low"),
        "total_semester_credits": total_sem_credits,
        "at_risk_count": len(at_risk_subjects),
        "at_risk_subjects": at_risk_subjects,
        "subjects": analyzed_subjects
    }

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            raw_input = sys.argv[1]
        else:
            raw_input = sys.stdin.read()
        
        if not raw_input.strip():
            print(json.dumps({"error": "No input JSON provided"}))
            sys.exit(1)

        data = json.loads(raw_input)
        result = run_probability_analysis(data)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
