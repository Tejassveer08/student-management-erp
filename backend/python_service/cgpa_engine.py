#!/usr/bin/env python3
"""
CGPA Probability & Subject Difficulty Prediction Engine
Student Management ERP System - GTBIT (GGSIPU)

Mirrors backend/src/services/cgpaCalculator.js exactly. The model is driven by the
institution's live policy (attendance threshold, grading scale and model weights),
which the Node API passes in with every payload.

Modes
  python cgpa_engine.py            read one JSON payload from stdin, print the result
  python cgpa_engine.py --serve    long-lived worker: one JSON request per line
                                   {"id": n, "batch": [payload, ...]} -> {"id": n, "results": [...]}
"""

import json
import math
import sys

MAX_INTERNAL = 25.0
MAX_ASSIGNMENT = 15.0
EXTERNAL_SHARE = 60.0

DEFAULT_WEIGHTS = {"internal_weight": 0.45, "difficulty_weight": 0.35, "attendance_weight": 0.20}
DEFAULT_SCALE = [
    {"grade": "O", "min": 90, "points": 10, "label": "Outstanding"},
    {"grade": "A+", "min": 75, "points": 9, "label": "Excellent"},
    {"grade": "A", "min": 65, "points": 8, "label": "Very Good"},
    {"grade": "B+", "min": 55, "points": 7, "label": "Good"},
    {"grade": "B", "min": 50, "points": 6, "label": "Above Average"},
    {"grade": "C", "min": 45, "points": 5, "label": "Average"},
    {"grade": "P", "min": 40, "points": 4, "label": "Pass"},
    {"grade": "F", "min": 0, "points": 0, "label": "Fail"},
]


def js_round(v):
    """Half-up rounding identical to JavaScript's Math.round"""
    return math.floor(v + 0.5)


def r1(v):
    return js_round(v * 10) / 10


def r2(v):
    return js_round(v * 100) / 100


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def calculate_subject_difficulty(pass_pct, avg_marks):
    norm_pass = clamp(float(pass_pct), 0.0, 100.0) / 100.0
    norm_marks = clamp(float(avg_marks), 0.0, 100.0) / 100.0
    raw = 1.0 - (0.55 * norm_marks + 0.45 * norm_pass)
    return round(clamp(raw, 0.10, 0.90), 3)


def grade_for(score, scale):
    for band in scale:
        if score >= band["min"]:
            return band
    return scale[-1]


def pass_mark(scale):
    passing = [b for b in scale if b["points"] > 0]
    return passing[-1]["min"] if passing else 40


def resolve_policy(p):
    p = p or {}
    weights = dict(DEFAULT_WEIGHTS)
    weights.update(p.get("weights") or {})
    scale = p.get("scale") or DEFAULT_SCALE
    scale = sorted(scale, key=lambda b: -float(b["min"]))
    return {"threshold": float(p.get("threshold", 75)), "weights": weights, "scale": scale}


def predict_subject(item, policy, adjustment=0.0, cgpa=0.0):
    scale, threshold, w = policy["scale"], policy["threshold"], policy["weights"]
    w_sum = (float(w["internal_weight"]) + float(w["attendance_weight"]) + float(w["difficulty_weight"])) or 1.0

    has_marks = item.get("internal_score") is not None
    max_internal = float(item.get("max_internal") or MAX_INTERNAL)
    max_assignment = float(item.get("max_assignment") or MAX_ASSIGNMENT)
    hist = clamp(float(item.get("historical_avg_marks") if item.get("historical_avg_marks") is not None else 70), 0, 100) / 100.0
    own = clamp(cgpa * 10 - 5, 0, 100) / 100.0 if cgpa > 0 else None
    prior = 0.6 * own + 0.4 * hist if own is not None else hist
    internal = float(item["internal_score"]) if has_marks else prior * max_internal
    assignment = float(item["assignment_score"]) if item.get("assignment_score") is not None else prior * max_assignment

    internal_pct = internal / max_internal * 100.0 if max_internal > 0 else 70.0
    assignment_pct = assignment / max_assignment * 100.0 if max_assignment > 0 else 70.0
    coursework = 0.65 * internal_pct + 0.35 * assignment_pct

    diff = item.get("difficulty_index")
    if diff is None:
        diff = calculate_subject_difficulty(item.get("historical_pass_pct", 85), item.get("historical_avg_marks", 70))
    diff = float(diff)
    att = clamp(float(item.get("attendance_pct", 100) if item.get("attendance_pct") is not None else 100), 0, 100)
    ease = (1 - diff) * 100.0

    external_pct = (float(w["internal_weight"]) * coursework + float(w["attendance_weight"]) * att + float(w["difficulty_weight"]) * ease) / w_sum
    if att < threshold:
        external_pct *= max(0.6, 1 - 0.012 * (threshold - att))

    coursework_marks = internal / max_internal * MAX_INTERNAL + assignment / max_assignment * MAX_ASSIGNMENT
    raw = coursework_marks + external_pct / 100.0 * EXTERNAL_SHARE + float(adjustment or 0)
    predicted = r1(clamp(raw, 0, 100))

    margin = 2.5 + diff * 4 + max(0, threshold - att) * 0.12 + (0 if has_marks else (3.5 if cgpa > 0 else 5))
    lo = r1(clamp(predicted - margin, 0, 100))
    hi = r1(clamp(predicted + margin, 0, 100))

    exp = grade_for(predicted, scale)
    pm = pass_mark(scale)

    warning = None
    if att < threshold:
        warning = "Low attendance (%.1f%%) breaches the %s%% eligibility rule" % (att, ("%g" % threshold))
    elif diff >= 0.65 and coursework < 60:
        warning = "High-difficulty subject (%.2f) with weak coursework (%.1f%%)" % (diff, coursework)
    elif predicted < pm + 10:
        warning = "Projected score %.1f is close to the pass mark (%s)" % (predicted, ("%g" % pm))

    return {
        "subject_id": item.get("id"),
        "subject_code": item.get("code"),
        "subject_name": item.get("name"),
        "credits": float(item.get("credits") or 4),
        "predicted_score": predicted,
        "score_range": [lo, hi],
        "predicted_grade_point": exp["points"],
        "predicted_grade": exp["grade"],
        "grade_range": [grade_for(lo, scale)["grade"], grade_for(hi, scale)["grade"]],
        "difficulty_index": r2(diff),
        "attendance_pct": r1(att),
        "coursework_score": r1(coursework),
        "has_internal_marks": has_marks,
        "classes_held": float(item.get("classes_held") or 0),
        "hypothetical_adjustment": float(adjustment or 0),
        "is_at_risk": warning is not None,
        "warning_reason": warning,
    }


def run_probability_analysis(payload):
    policy = resolve_policy(payload.get("policy"))
    current_cgpa = float(payload.get("current_cgpa") or 0)
    previous_credits = float(payload.get("previous_credits") or 0)
    what_if = payload.get("what_if_adjustments") or {}

    has_history = previous_credits > 0 and current_cgpa > 0
    subjects = [
        predict_subject(it, policy, what_if.get(str(it.get("id")), 0), current_cgpa if has_history else 0.0)
        for it in payload.get("subjects", [])
    ]
    credits = exp = lo = hi = 0.0
    for s in subjects:
        credits += s["credits"]
        exp += s["predicted_grade_point"] * s["credits"]
        lo += grade_for(s["score_range"][0], policy["scale"])["points"] * s["credits"]
        hi += grade_for(s["score_range"][1], policy["scale"])["points"] * s["credits"]

    sgpa = r2(exp / credits) if credits else current_cgpa
    sgpa_lo = r2(lo / credits) if credits else current_cgpa
    sgpa_hi = r2(hi / credits) if credits else current_cgpa
    total = previous_credits + credits

    def blend(v):
        return r2((current_cgpa * previous_credits + v * credits) / total) if total else v

    # Confidence = how much real evidence backs the forecast, and how tight it is
    cr = credits or 1.0
    internal_cov = sum(s["credits"] for s in subjects if s["has_internal_marks"]) / cr
    attendance_cov = sum(s["credits"] * min(1.0, s["classes_held"] / 10.0) for s in subjects) / cr
    evidence = internal_cov + (1 - internal_cov) * (0.45 if has_history else 0.0)
    tightness = clamp(1 - (sgpa_hi - sgpa_lo) / 3.0, 0.0, 1.0)
    confidence = int(js_round(clamp(40 + 57 * (0.55 * evidence + 0.15 * attendance_cov + 0.3 * tightness), 40, 97)))
    at_risk = [
        {
            "subject_code": s["subject_code"],
            "subject_name": s["subject_name"],
            "reason": s["warning_reason"],
            "predicted_grade": s["predicted_grade"],
            "predicted_score": s["predicted_score"],
        }
        for s in subjects
        if s["is_at_risk"]
    ]

    return {
        "predicted_sgpa": sgpa,
        "sgpa_range": [sgpa_lo, sgpa_hi],
        "predicted_cgpa": blend(sgpa),
        "cgpa_range": [blend(sgpa_lo), blend(sgpa_hi)],
        "confidence_score": confidence,
        "confidence_level": "High" if confidence >= 80 else ("Moderate" if confidence >= 65 else "Low"),
        "confidence_basis": {
            "internal_coverage": r2(internal_cov),
            "attendance_coverage": r2(attendance_cov),
            "sgpa_band": r2(sgpa_hi - sgpa_lo),
            "uses_cgpa_history": has_history,
        },
        "total_semester_credits": credits,
        "at_risk_count": len(at_risk),
        "at_risk_subjects": at_risk,
        "model": {"weights": policy["weights"], "attendance_threshold": policy["threshold"]},
        "subjects": subjects,
    }


def serve():
    """Long-lived worker: newline-delimited JSON requests on stdin."""
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            results = [run_probability_analysis(p) for p in req.get("batch", [])]
            print(json.dumps({"id": req_id, "results": results}), flush=True)
        except Exception as exc:  # report and keep serving
            print(json.dumps({"id": req_id, "error": str(exc)}), flush=True)


if __name__ == "__main__":
    if "--serve" in sys.argv:
        serve()
        sys.exit(0)
    try:
        raw_input = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "No input JSON provided"}))
            sys.exit(1)
        print(json.dumps(run_probability_analysis(json.loads(raw_input)), indent=2))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
