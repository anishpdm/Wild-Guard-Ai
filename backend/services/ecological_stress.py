# services/ecological_stress.py
"""
Ecological Stress Engine — computes WHY each elephant is moving toward settlements.
8 independent stress dimensions → primary_driver → targeted intervention.
"""

import math, random
from datetime import datetime

# ── Wayanad geography ─────────────────────────────────────────────
WATERHOLES = [
    {"id":"WH-01","name":"Muthanga waterhole","lat":11.670,"lon":76.105,"type":"permanent"},
    {"id":"WH-02","name":"Tholpetty pond",    "lat":11.660,"lon":76.090,"type":"seasonal"},
    {"id":"WH-03","name":"Kurichiat stream",  "lat":11.700,"lon":76.120,"type":"permanent"},
    {"id":"WH-04","name":"Begur pool",        "lat":11.630,"lon":76.080,"type":"seasonal"},
    {"id":"WH-05","name":"Noolpuzha river",   "lat":11.720,"lon":76.060,"type":"permanent"},
]

CORRIDORS = [
    {"id":"COR-01","name":"Wayanad–Nagarhole","health":0.65,"lat":11.75,"lon":76.08},
    {"id":"COR-02","name":"Wayanad–Mudumalai","health":0.45,"lat":11.57,"lon":76.35},
    {"id":"COR-03","name":"Tholpetty–Brahmagiri","health":0.80,"lat":11.77,"lon":76.02},
    {"id":"COR-04","name":"Muthanga–Bandipur","health":0.30,"lat":11.67,"lon":76.37},
]

# Kerala crop calendar — Wayanad district
CROP_CALENDAR = {
    "banana":    {"months":[3,4,5,6],"pref":0.95,"risk_km":2.0,"loss_inr":25000},
    "paddy":     {"months":[10,11,2,3],"pref":0.85,"risk_km":1.5,"loss_inr":15000},
    "sugarcane": {"months":[1,2,3],"pref":0.90,"risk_km":2.5,"loss_inr":30000},
    "jackfruit": {"months":[4,5,6],"pref":0.80,"risk_km":1.0,"loss_inr":8000},
    "tapioca":   {"months":[1,2,3,10,11],"pref":0.75,"risk_km":1.5,"loss_inr":10000},
}

# Waterhole seasonal availability
WH_AVAIL = {
    "permanent": {3:0.4,4:0.2,5:0.1,6:1.0,7:1.0,8:1.0,9:0.9,10:0.8,11:0.7,12:0.6,1:0.5,2:0.5},
    "seasonal":  {3:0.1,4:0.0,5:0.0,6:0.8,7:1.0,8:1.0,9:0.7,10:0.5,11:0.3,12:0.1,1:0.1,2:0.1},
}

# Season NDVI ranges
NDVI_SEASON = {1:0.55,2:0.50,3:0.35,4:0.25,5:0.18,6:0.55,7:0.72,8:0.78,9:0.75,10:0.65,11:0.58,12:0.55}

def _hav(la1,lo1,la2,lo2):
    R=6371.0; p1,p2=math.radians(la1),math.radians(la2)
    dp=math.radians(la2-la1); dl=math.radians(lo2-lo1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R*2*math.asin(math.sqrt(min(1.0,a)))


class EcologicalStressEngine:

    def compute(self, elephant_id: str, lat: float, lon: float,
                month: int, is_night: bool, speed_kmh: float,
                herd_positions: dict = None) -> dict:
        """Compute all 8 stress dimensions for one elephant at one position."""

        water  = self._water_stress(lat, lon, month)
        forage = self._forage_stress(lat, lon, month)
        crop   = self._crop_attraction(lat, lon, month)
        social = self._social_stress(elephant_id, lat, lon, herd_positions or {})
        disturb= self._human_disturbance(lat, lon)
        corr   = self._corridor_pressure(lat, lon)
        health = self._health_anomaly(elephant_id, speed_kmh)

        scores = {
            "water_stress":     round(water, 3),
            "forage_stress":    round(forage, 3),
            "crop_attraction":  round(crop, 3),
            "social_stress":    round(social, 3),
            "human_disturbance":round(disturb, 3),
            "corridor_pressure":round(corr, 3),
            "health_anomaly":   round(health, 3),
        }

        # Primary driver = highest score
        primary = max(scores, key=scores.get)
        composite = round(
            water*0.20 + forage*0.15 + crop*0.25 +
            social*0.15 + disturb*0.10 + corr*0.10 + health*0.05, 3
        )

        intervention = self._recommend_intervention(primary, scores)

        return {
            **scores,
            "primary_driver":  primary,
            "composite_score": composite,
            "intervention":    intervention,
            "driver_label":    self._driver_label(primary),
            "crop_risk":       self._crop_risk_detail(lat, lon, month),
            "water_status":    self._water_status(lat, lon, month),
        }

    def _water_stress(self, lat, lon, month):
        distances = []
        for wh in WATERHOLES:
            d = _hav(lat, lon, wh["lat"], wh["lon"])
            avail = WH_AVAIL[wh["type"]].get(month, 0.5)
            # Effective distance adjusted for availability (dry hole = farther)
            effective_d = d / max(0.1, avail)
            distances.append(effective_d)
        nearest_eff = min(distances)
        return min(1.0, nearest_eff / 5.0)

    def _forage_stress(self, lat, lon, month):
        ndvi = NDVI_SEASON.get(month, 0.55) + random.gauss(0, 0.04)
        ndvi_stress = max(0, (0.45 - ndvi) / 0.45)
        return min(1.0, ndvi_stress)

    def _crop_attraction(self, lat, lon, month):
        total = 0.0
        for crop, data in CROP_CALENDAR.items():
            if month in data["months"]:
                # Simulated farm proximity (real system uses GIS farm layer)
                d_farm = max(0.3, _hav(lat, lon, 11.617, 76.217) * random.uniform(0.5, 1.5))
                proximity = max(0, 1 - d_farm / data["risk_km"])
                total += data["pref"] * proximity
        return min(1.0, total / 2.0)

    def _social_stress(self, eid, lat, lon, herd_positions: dict):
        # Musth males displace females
        MUSTH_MALES = ["WY_ELE_M01"]  # Update when musth detected
        for mid in MUSTH_MALES:
            if mid == eid: continue
            pos = herd_positions.get(mid)
            if not pos: continue
            mlat = pos.get("location_lat", pos.get("latitude", 0))
            mlon = pos.get("location_long", pos.get("longitude", 0))
            if mlat and mlon and _hav(lat, lon, mlat, mlon) < 2.0:
                return 0.80
        # Herd competition (other elephants within 300m)
        nearby = 0
        for other_id, pos in herd_positions.items():
            if other_id == eid: continue
            olat = pos.get("location_lat", pos.get("latitude", 0))
            olon = pos.get("location_long", pos.get("longitude", 0))
            if olat and olon and _hav(lat, lon, olat, olon) < 0.3:
                nearby += 1
        return min(0.6, nearby * 0.2)

    def _human_disturbance(self, lat, lon):
        # Simulated — real system uses acoustic sensors + fire alerts
        # Higher near settlement fringes
        dist_to_fringe = min(_hav(lat, lon, 11.617, 76.217), _hav(lat, lon, 11.648, 76.258))
        return min(0.8, max(0, (3.0 - dist_to_fringe) / 3.0) * 0.6 + random.uniform(0, 0.1))

    def _corridor_pressure(self, lat, lon):
        for cor in CORRIDORS:
            d = _hav(lat, lon, cor["lat"], cor["lon"])
            if d < 2.0:
                blockage = 1.0 - cor["health"]
                proximity = max(0, 1 - d / 2.0)
                return round(blockage * proximity, 3)
        return 0.0

    def _health_anomaly(self, eid, current_speed):
        # Baseline speeds per elephant (km/h)
        baselines = {
            "WY_ELE_F01": 1.8, "WY_ELE_F02": 1.6, "WY_ELE_M01": 2.2,
            "WY_ELE_F03": 1.4, "WY_ELE_M02": 1.9,
        }
        baseline = baselines.get(eid, 1.8)
        if baseline == 0: return 0.0
        ratio = current_speed / baseline
        if ratio < 0.3:   return 0.85  # very slow — possible injury
        if ratio < 0.5:   return 0.50
        if ratio > 3.0:   return 0.30  # very fast — agitated/fleeing
        return 0.0

    def _recommend_intervention(self, primary_driver: str, scores: dict) -> str:
        interventions = {
            "water_stress":     "Restore/excavate seasonal waterholes in forest core (WH-02, WH-04). Deploy water tanker during peak summer.",
            "forage_stress":    "Controlled grass burn (post-monsoon) for regeneration. Reduce cattle grazing pressure inside WLS boundary.",
            "crop_attraction":  "Install solar-powered electric fence around high-risk farms. SMS crop-ripening alert to farmers.",
            "social_stress":    "Monitor musth male WY_ELE_M01 closely. Consider temporary corridor separation. Increase patrol in displacement zones.",
            "human_disturbance":"Reduce noise-generating activities (quarrying, fireworks) near forest boundary. Night movement ban on NH-766.",
            "corridor_pressure":"Engage Kerala Forest Department on corridor restoration. Identify and remove illegal encroachments on COR-04.",
            "health_anomaly":   "Dispatch veterinary team for physical assessment. Check for snare injuries, foot wounds, or poisoning.",
        }
        return interventions.get(primary_driver, "Standard monitoring protocol.")

    def _driver_label(self, driver: str) -> str:
        labels = {
            "water_stress":     "💧 Water Scarcity",
            "forage_stress":    "🌿 Forage Scarcity",
            "crop_attraction":  "🌾 Crop Attraction",
            "social_stress":    "🐘 Social Conflict",
            "human_disturbance":"🔊 Human Disturbance",
            "corridor_pressure":"🚧 Corridor Blockage",
            "health_anomaly":   "🏥 Health Anomaly",
        }
        return labels.get(driver, driver)

    def _crop_risk_detail(self, lat, lon, month) -> list:
        result = []
        for crop, data in CROP_CALENDAR.items():
            if month in data["months"]:
                result.append({
                    "crop":     crop,
                    "ripening": True,
                    "preference": data["pref"],
                    "potential_loss_inr": data["loss_inr"],
                })
        return sorted(result, key=lambda x: -x["preference"])

    def _water_status(self, lat, lon, month) -> list:
        result = []
        for wh in WATERHOLES:
            d = _hav(lat, lon, wh["lat"], wh["lon"])
            avail = WH_AVAIL[wh["type"]].get(month, 0.5)
            result.append({
                "id":        wh["id"],
                "name":      wh["name"],
                "distance_km": round(d, 2),
                "availability": avail,
                "status":    "dry" if avail < 0.1 else "low" if avail < 0.4 else "adequate",
            })
        return sorted(result, key=lambda x: x["distance_km"])


stress_engine = EcologicalStressEngine()


def waterhole_levels(month: int) -> list:
    """Current waterhole availability for the resource monitor page."""
    result = []
    for wh in WATERHOLES:
        avail = WH_AVAIL[wh["type"]].get(month, 0.5)
        level_pct = round(avail * 100, 1)
        result.append({
            "id":        wh["id"],
            "name":      wh["name"],
            "lat":       wh["lat"],
            "lon":       wh["lon"],
            "type":      wh["type"],
            "level_pct": level_pct,
            "status":    "dry" if avail<0.1 else "low" if avail<0.4 else "adequate",
            "color":     "#ef4444" if avail<0.1 else "#f59e0b" if avail<0.4 else "#22c55e",
        })
    return result


def corridor_status() -> list:
    return [{
        "id":      c["id"],
        "name":    c["name"],
        "health":  c["health"],
        "blocked": c["health"] < 0.4,
        "status":  "critical" if c["health"]<0.3 else "degraded" if c["health"]<0.5 else "fair" if c["health"]<0.7 else "good",
        "color":   "#ef4444" if c["health"]<0.3 else "#f59e0b" if c["health"]<0.6 else "#22c55e",
        "lat":     c["lat"],
        "lon":     c["lon"],
    } for c in CORRIDORS]


def seasonal_risk_forecast() -> list:
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    risk_vals= [0.55,0.65,0.85,0.90,0.88,0.40,0.25,0.20,0.35,0.70,0.75,0.50]
    drivers  = ["crop_attraction","crop_attraction","water_stress","water_stress","water_stress","none","none","none","none","crop_attraction","crop_attraction","forage_stress"]
    crops    = ["Paddy harvest","Sugarcane","Banana peak","Banana+Jackfruit","Jackfruit","Monsoon onset","Full monsoon","Full monsoon","Monsoon retreat","Paddy harvest","Paddy","Grass declining"]
    return [{"month":i+1,"month_name":months[i],"risk":risk_vals[i],"primary_driver":drivers[i],"crop_note":crops[i]} for i in range(12)]
