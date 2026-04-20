"""
fatigue_engine.py — WildGuard AI v6
Per-elephant fatigue and aggression index from GPS kinematics.

Fatigue Index = weighted sum of 4 factors:
  Factor 1 (35%): Distance travelled vs biological daily maximum
  Factor 2 (30%): Rest deficit — stationary periods below 0.5km/h
  Factor 3 (20%): Nocturnal activity ratio
  Factor 4 (15%): Sprint event count (speed > 8km/h)

Aggression Probability = fatigue_index × sex_multiplier × age_multiplier × 0.85
  Male multiplier:      1.4x  (musth testosterone correlation)
  Sub-adult multiplier: 1.2x  (territorial stress)

v6 additions:
  - Musth cycle detection from sprint event trend
  - Seasonal hunger-driven aggression (crop season multiplier)
  - Social isolation stress factor
"""

import math
from datetime import datetime, timedelta

ELEPHANT_PROFILES = {
    "WY_ELE_F01": {
        "name": "Lakshmi", "sex": "F", "age_class": "adult",
        "max_daily_km": 25, "rest_need_h": 6,
        "home": (11.651, 76.232), "home_radius_km": 4.0,
    },
    "WY_ELE_F02": {
        "name": "Kaveri",  "sex": "F", "age_class": "adult",
        "max_daily_km": 22, "rest_need_h": 6,
        "home": (11.618, 76.193), "home_radius_km": 3.5,
    },
    "WY_ELE_M01": {
        "name": "Arjun",   "sex": "M", "age_class": "adult",
        "max_daily_km": 35, "rest_need_h": 5,
        "home": (11.728, 76.160), "home_radius_km": 5.0,
    },
    "WY_ELE_F03": {
        "name": "Ganga",   "sex": "F", "age_class": "sub-adult",
        "max_daily_km": 18, "rest_need_h": 7,
        "home": (11.679, 76.158), "home_radius_km": 3.5,
    },
    "WY_ELE_M02": {
        "name": "Rajan",   "sex": "M", "age_class": "sub-adult",
        "max_daily_km": 28, "rest_need_h": 6,
        "home": (11.735, 76.162), "home_radius_km": 4.0,
    },
}

# Seasonal crop attraction multiplier — higher during harvest months
# amplifies aggression when food availability in forest drops
SEASONAL_CROP_MULTIPLIER = {
    1: 0.7,  2: 0.7,  3: 0.9,  4: 1.0,  5: 1.0,  6: 0.6,
    7: 0.4,  8: 0.4,  9: 0.5, 10: 0.9, 11: 1.0, 12: 0.8,
}


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371; p = math.pi / 180
    a = (math.sin((lat2-lat1)*p/2)**2 +
         math.cos(lat1*p) * math.cos(lat2*p) *
         math.sin((lon2-lon1)*p/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def _is_night(ts_str) -> bool:
    try:
        dt = datetime.fromisoformat(str(ts_str).replace("Z", ""))
        return dt.hour >= 19 or dt.hour < 6
    except Exception:
        return False


def _detect_musth_risk(sprint_count: int, sprint_events_7d: int,
                        sex: str) -> dict:
    """
    Estimate musth risk from sprint event frequency.
    Musth signature: sprint events increase 3x above 7-day baseline.
    Only applicable to male elephants.
    """
    if sex != "M":
        return {"musth_risk": 0.0, "musth_detected": False, "evidence": "Female — not applicable"}

    if sprint_events_7d == 0:
        ratio = 1.0
    else:
        ratio = sprint_count / max(1, sprint_events_7d / 7)

    musth_prob = min(0.95, max(0.0, (ratio - 1.5) / 2.5))
    detected   = ratio > 3.0

    return {
        "musth_risk":     round(musth_prob, 3),
        "musth_detected": detected,
        "sprint_ratio":   round(ratio, 2),
        "evidence": (
            f"Sprint events {ratio:.1f}x above baseline — MUSTH LIKELY" if detected else
            f"Sprint events {ratio:.1f}x above baseline — within normal range"
        ),
    }


def compute_fatigue(eid: str, gps_fixes: list,
                    sprint_events_7d: int = 0) -> dict:
    """
    Compute fatigue and aggression index from GPS fix history.

    Args:
        eid:               Elephant ID (WY_ELE_xxx)
        gps_fixes:         List of dicts with lat, lon, ts, speed_kmh
        sprint_events_7d:  Total sprint events in last 7 days (for musth detection)

    Returns fatigue dict with index, aggression_prob, state, breakdown.
    """
    prof = ELEPHANT_PROFILES.get(eid, ELEPHANT_PROFILES["WY_ELE_F01"])
    now  = datetime.now()

    if not gps_fixes or len(gps_fixes) < 2:
        return _default_fatigue(eid, prof)

    # Sort by timestamp
    fixes = sorted(gps_fixes,
                   key=lambda x: str(x.get("ts") or x.get("timestamp", "")))

    # ── Factor 1: Total distance (35%) ────────────────────────────
    total_km = 0.0
    speeds   = []
    for i in range(1, len(fixes)):
        a, b = fixes[i-1], fixes[i]
        la = float(a.get("latitude")  or a.get("location_lat",  0))
        lo = float(a.get("longitude") or a.get("location_long", 0))
        lb = float(b.get("latitude")  or b.get("location_lat",  0))
        ln = float(b.get("longitude") or b.get("location_long", 0))
        if la and lb:
            d = _haversine(la, lo, lb, ln)
            total_km += d
            # Derive speed from lat/lon displacement if speed_kmh not stored
            sp = b.get("speed_kmh")
            if sp is not None and float(sp) > 0:
                speeds.append(float(sp))
            elif d > 0:
                # Estimate from haversine distance — assume 10s GPS interval
                derived_speed = d / (10 / 3600)  # km per hour
                if derived_speed < 20:  # cap at realistic max
                    speeds.append(derived_speed)

    avg_speed = sum(speeds) / len(speeds) if speeds else 0.0
    max_speed = max(speeds) if speeds else 0.0

    # ── Factor 2: Rest deficit (30%) ──────────────────────────────
    # 10-second GPS interval → each fix = 10s
    active_h = len(fixes) * 10 / 3600
    rest_h   = sum(1 for s in speeds if s < 0.5) * 10 / 3600

    # ── Factor 3: Night activity ratio (20%) ─────────────────────
    night_fixes = sum(
        1 for f in fixes
        if _is_night(f.get("ts") or f.get("timestamp", ""))
    )
    night_ratio = night_fixes / max(len(fixes), 1)

    # ── Factor 4: Sprint events (15%) ─────────────────────────────
    sprint_count = sum(1 for s in speeds if s > 8)

    # ── Compute fatigue index (0–1) ───────────────────────────────
    dist_factor   = min(1.0, total_km / prof["max_daily_km"])
    rest_deficit  = max(0, prof["rest_need_h"] - rest_h) / prof["rest_need_h"]
    night_factor  = night_ratio * 0.6
    sprint_factor = min(1.0, sprint_count / 10)

    fatigue_idx = min(1.0, (
        dist_factor   * 0.35 +
        rest_deficit  * 0.30 +
        night_factor  * 0.20 +
        sprint_factor * 0.15
    ))

    # ── Aggression probability ────────────────────────────────────
    sex_mult    = 1.4 if prof["sex"] == "M" else 1.0
    age_mult    = 1.2 if prof["age_class"] == "sub-adult" else 1.0
    crop_month  = SEASONAL_CROP_MULTIPLIER.get(now.month, 0.7)
    crop_mult   = 1.0 + (crop_month - 0.7) * 0.3   # max 1.09 in peak months

    aggression  = min(0.97,
        fatigue_idx * sex_mult * age_mult * crop_mult * 0.85
    )

    # ── Musth detection (males only) ─────────────────────────────
    musth = _detect_musth_risk(sprint_count, sprint_events_7d, prof["sex"])
    if musth["musth_detected"]:
        aggression = min(0.97, aggression * 1.8)   # musth boosts aggression 1.8x

    # ── State label ────────────────────────────────────────────────
    if fatigue_idx > 0.75:   fatigue_state = "EXHAUSTED"
    elif fatigue_idx > 0.55: fatigue_state = "FATIGUED"
    elif fatigue_idx > 0.35: fatigue_state = "TIRED"
    else:                    fatigue_state = "RESTED"

    # ── Next aggression window prediction ─────────────────────────
    if fatigue_idx > 0.6 or musth["musth_detected"]:
        next_event = "HIGH — within 2-4 hours"
    elif fatigue_idx > 0.4:
        next_event = "MODERATE — monitor overnight"
    else:
        next_event = "LOW — normal activity"

    return {
        "individual_id":  eid,
        "name":           prof["name"],
        "fatigue_index":  round(fatigue_idx, 4),
        "fatigue_state":  fatigue_state,
        "aggression_prob":round(aggression, 4),
        "next_event_risk":next_event,
        "computed_at":    now.isoformat(),
        "sex":            prof["sex"],
        "age_class":      prof["age_class"],
        "musth":          musth,
        "seasonal_risk":  {
            "month":              now.month,
            "crop_multiplier":    round(crop_mult, 3),
            "season_description": _season_label(now.month),
        },
        "breakdown": {
            "total_distance_km":  round(total_km, 2),
            "max_daily_km":       prof["max_daily_km"],
            "avg_speed_kmh":      round(avg_speed, 2),
            "max_speed_kmh":      round(max_speed, 2),
            "active_hours":       round(active_h, 2),
            "rest_hours":         round(rest_h, 2),
            "rest_deficit_hours": round(max(0, prof["rest_need_h"] - rest_h), 2),
            "night_activity_pct": round(night_ratio * 100, 1),
            "sprint_events":      sprint_count,
            "distance_factor":    round(dist_factor, 3),
            "rest_deficit_factor":round(rest_deficit, 3),
            "night_factor":       round(night_factor, 3),
            "sprint_factor":      round(sprint_factor, 3),
            "sex_multiplier":     sex_mult,
            "age_multiplier":     age_mult,
            "crop_multiplier":    round(crop_mult, 3),
        },
    }


def _season_label(month: int) -> str:
    if month in (3, 4, 5):   return "Dry season — high HEC risk"
    if month in (6, 7, 8, 9): return "Monsoon — low HEC risk"
    if month in (10, 11):    return "Post-monsoon harvest — elevated risk"
    return "Winter — moderate risk"


def _default_fatigue(eid: str, prof: dict) -> dict:
    return {
        "individual_id":   eid,
        "name":            prof["name"],
        "fatigue_index":   0.0,
        "fatigue_state":   "RESTED",
        "aggression_prob": 0.05,
        "next_event_risk": "Insufficient data — need at least 2 GPS fixes",
        "computed_at":     datetime.now().isoformat(),
        "sex":             prof["sex"],
        "age_class":       prof["age_class"],
        "musth":           {"musth_risk": 0.0, "musth_detected": False,
                            "evidence": "Insufficient data"},
        "seasonal_risk":   {"month": datetime.now().month,
                            "crop_multiplier": 1.0,
                            "season_description": _season_label(datetime.now().month)},
        "breakdown": {
            "total_distance_km": 0, "avg_speed_kmh": 0, "rest_hours": 0,
            "sprint_events": 0, "night_activity_pct": 0,
        },
    }