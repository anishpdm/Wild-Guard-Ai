"""
anomaly_detector.py — WildGuard AI
Isolation Forest anomaly detection for unusual elephant behaviour.
Add to backend/services/ folder.

Detects behaviour that deviates from normal patterns:
  - Sudden speed spikes (musth / panic)
  - Unusual night movement
  - Direction reversal patterns
  - Out-of-range temperature responses

Usage:
    from services.anomaly_detector import ElephantAnomalyDetector
    detector = ElephantAnomalyDetector()
    detector.fit(history_fixes)
    result = detector.predict(recent_fix)
"""

import numpy as np
import math
from typing import List, Dict, Optional
from datetime import datetime


def _haversine(la1, lo1, la2, lo2) -> float:
    """Distance in km between two GPS points."""
    R = 6371.0
    dlat = math.radians(la2 - la1)
    dlon = math.radians(lo2 - lo1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(la1)) *
         math.cos(math.radians(la2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _extract_kinematics(fixes: List[Dict]) -> List[List[float]]:
    """
    Extract kinematic features from consecutive GPS fixes.
    Features per step:
        [speed_kmh, bearing_change_deg, dist_to_settlement,
         hour_of_day, is_night, risk_score]
    """
    features = []
    for i in range(1, len(fixes)):
        prev = fixes[i - 1]
        curr = fixes[i]

        # Speed (km/h) — distance between fixes / time interval
        d = _haversine(
            prev.get("latitude", 0), prev.get("longitude", 0),
            curr.get("latitude", 0), curr.get("longitude", 0),
        )
        speed_kmh = d * 360  # 10-second interval → multiply by 360 for km/h

        # Bearing (direction of movement)
        dlat = curr.get("latitude", 0)  - prev.get("latitude", 0)
        dlon = curr.get("longitude", 0) - prev.get("longitude", 0)
        bearing = math.degrees(math.atan2(dlon, dlat)) % 360

        # Bearing change (directional persistence indicator)
        prev_dlat = prev.get("latitude", 0)  - fixes[max(0, i-2)].get("latitude", 0)
        prev_dlon = prev.get("longitude", 0) - fixes[max(0, i-2)].get("longitude", 0)
        prev_bearing = math.degrees(math.atan2(prev_dlon, prev_dlat)) % 360
        bearing_change = abs(bearing - prev_bearing)
        if bearing_change > 180:
            bearing_change = 360 - bearing_change

        dist_settle = float(curr.get("dist_settle",
                            curr.get("distance_to_settlement_km", 5.0)))
        hour = 0
        ts   = curr.get("ts", curr.get("timestamp", ""))
        if ts:
            try:
                dt   = datetime.fromisoformat(str(ts))
                hour = dt.hour
            except Exception:
                pass

        is_night = 1.0 if (hour >= 19 or hour < 6) else 0.0
        risk     = float(curr.get("risk",
                         curr.get("intrusion_risk", 0.0)))

        features.append([
            min(speed_kmh, 25.0),    # cap at 25 km/h (physical max)
            bearing_change,
            dist_settle,
            hour,
            is_night,
            risk,
        ])

    return features


class ElephantAnomalyDetector:
    """
    Isolation Forest-based anomaly detector for elephant movement.

    Normal behaviour: slow, directionally persistent, home-ranging.
    Anomalous: sudden acceleration, direction reversal, unusual hours.
    """

    FEATURE_NAMES = [
        "speed_kmh",
        "bearing_change_deg",
        "dist_to_settlement_km",
        "hour_of_day",
        "is_night",
        "risk_score",
    ]

    def __init__(self, contamination: float = 0.05):
        """
        Args:
            contamination: Expected fraction of anomalous behaviour
                           0.05 = 5% of movements are unusual
        """
        self.contamination = contamination
        self.model         = None
        self.scaler        = None
        self.fitted        = False
        self.n_train       = 0
        self.elephant_id   = None
        self.thresholds    = {   # Rule-based thresholds for fallback
            "speed_kmh":        8.0,
            "bearing_change":   120.0,
        }

    def fit(self, history_fixes: List[Dict], elephant_id: str = "") -> bool:
        """
        Train on recent normal GPS history.
        Call this with the last 7 days of GPS fixes from MySQL.

        Args:
            history_fixes: List of GPS fix dicts from gps_fixes table
            elephant_id:   For logging

        Returns: True if training succeeded
        """
        self.elephant_id = elephant_id

        if len(history_fixes) < 20:
            print(f"[AnomalyDetector] {elephant_id}: "
                  f"Not enough history ({len(history_fixes)} fixes) "
                  f"— using rule-based fallback")
            return False

        features = _extract_kinematics(history_fixes)
        if len(features) < 10:
            return False

        try:
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler

            X = np.array(features)
            self.scaler = StandardScaler()
            X_scaled    = self.scaler.fit_transform(X)

            self.model  = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100,
            )
            self.model.fit(X_scaled)
            self.fitted   = True
            self.n_train  = len(features)

            print(f"[AnomalyDetector] {elephant_id}: "
                  f"Trained on {self.n_train} movement steps")
            return True

        except ImportError:
            print("[AnomalyDetector] sklearn not available — "
                  "using rule-based fallback")
            return False

    def predict(self, recent_fixes: List[Dict]) -> Dict:
        """
        Detect if recent movement is anomalous.

        Args:
            recent_fixes: Last 3–5 GPS fixes for this elephant

        Returns dict with:
            is_anomaly: bool
            anomaly_score: float (higher = more anomalous)
            anomaly_type: str describing what's unusual
            features: current movement features
        """
        if len(recent_fixes) < 2:
            return self._safe_result(False, 0.0, "insufficient_data",
                                     recent_fixes)

        features = _extract_kinematics(recent_fixes)
        if not features:
            return self._safe_result(False, 0.0, "insufficient_data",
                                     recent_fixes)

        latest_feat = features[-1]
        feat_dict = dict(zip(self.FEATURE_NAMES, latest_feat))

        # ── Rule-based detection (always runs) ─────────────────────
        rule_anomaly = False
        anomaly_type = "normal"

        if feat_dict["speed_kmh"] > 8.0:
            rule_anomaly = True
            anomaly_type = "high_speed"
            if feat_dict["speed_kmh"] > 12.0:
                anomaly_type = "extreme_speed_possible_musth"

        if feat_dict["bearing_change_deg"] > 150 and feat_dict["speed_kmh"] > 3:
            rule_anomaly = True
            anomaly_type = "direction_reversal"

        if (feat_dict["is_night"] > 0.5 and
                feat_dict["dist_to_settlement_km"] < 1.5 and
                feat_dict["speed_kmh"] > 4.0):
            rule_anomaly = True
            anomaly_type = "nocturnal_approach"

        # ── ML-based detection ──────────────────────────────────────
        ml_score    = 0.0
        ml_anomaly  = False

        if self.fitted and self.model and self.scaler:
            try:
                X = np.array([latest_feat])
                X_scaled = self.scaler.transform(X)
                # score_samples: lower = more anomalous
                raw_score = float(self.model.score_samples(X_scaled)[0])
                # Convert to 0-1 anomaly score (higher = more anomalous)
                ml_score = max(0.0, min(1.0, -raw_score * 2))
                ml_anomaly = self.model.predict(X_scaled)[0] == -1
            except Exception:
                pass

        is_anomaly   = rule_anomaly or ml_anomaly
        final_score  = max(ml_score,
                           0.9 if rule_anomaly else 0.0)

        return {
            "is_anomaly":     is_anomaly,
            "anomaly_score":  round(final_score, 3),
            "anomaly_type":   anomaly_type,
            "rule_triggered": rule_anomaly,
            "ml_triggered":   ml_anomaly,
            "features":       {k: round(v, 3) for k, v in feat_dict.items()},
            "elephant_id":    self.elephant_id,
            "recommendation": self._recommend(anomaly_type, feat_dict),
            "alert_level":    ("CRITICAL" if final_score > 0.8
                               else "WARNING" if final_score > 0.5
                               else "INFO" if is_anomaly else "NORMAL"),
        }

    def _recommend(self, anomaly_type: str, feat: dict) -> str:
        recs = {
            "high_speed":
                "Elephant moving faster than normal — check for musth or disturbance",
            "extreme_speed_possible_musth":
                "POSSIBLE MUSTH — extreme speed detected. Increase monitoring.",
            "direction_reversal":
                "Sudden direction change — may indicate human encounter or alarm",
            "nocturnal_approach":
                "Night approach toward settlement detected — alert farmers",
            "normal":
                "Movement within normal parameters",
            "insufficient_data":
                "Insufficient data for anomaly assessment",
        }
        return recs.get(anomaly_type, "Unusual movement — manual review recommended")

    def _safe_result(self, is_anomaly, score, atype, fixes):
        return {
            "is_anomaly":    is_anomaly,
            "anomaly_score": score,
            "anomaly_type":  atype,
            "rule_triggered": False,
            "ml_triggered":  False,
            "features":      {},
            "elephant_id":   self.elephant_id,
            "recommendation": self._recommend(atype, {}),
            "alert_level":   "NORMAL",
        }


# ── Global detectors — one per elephant ───────────────────────────
_detectors: Dict[str, ElephantAnomalyDetector] = {}


def get_detector(elephant_id: str) -> ElephantAnomalyDetector:
    """Get or create anomaly detector for a specific elephant."""
    if elephant_id not in _detectors:
        _detectors[elephant_id] = ElephantAnomalyDetector(contamination=0.05)
    return _detectors[elephant_id]