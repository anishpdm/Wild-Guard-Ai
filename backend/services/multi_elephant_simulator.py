# services/multi_elephant_simulator.py — WildGuard AI v6
import asyncio, math, random, os
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# ── Wayanad forest core — verified GPS coordinates ────────────────
BBOX = dict(lat_min=11.55, lat_max=11.82, lon_min=76.04, lon_max=76.28)

SETTLEMENTS = [
    ("Sulthan Bathery", 11.6483, 76.2591),
    ("Ambalavayal",     11.6170, 76.2170),
    ("Pulpalli",        11.7330, 76.1830),
    ("Muttil",          11.6820, 76.1820),
    ("Nulpuzha",        11.5830, 76.1500),
    ("Kalpetta",        11.6083, 76.0833),
    ("Kidanganad",      11.5500, 76.1833),
    ("Mananthavady",    11.8000, 76.0500),
]

WATERHOLES = [
    (11.6520, 76.0820), (11.6780, 76.0650),
    (11.7100, 76.0700), (11.6350, 76.0580),
    (11.7250, 76.0550),
]

ELEPHANTS = [
    {
        "id":         "WY_ELE_F01",
        "name":       "Lakshmi",
        "sex":        "F",
        "age_class":  "adult",
        "collar":     "COL-2022-001",
        "color":      "#22c55e",
        "home_lat":   11.651,
        "home_lon":   76.132,   # deep forest — well inside WLS, far from settlements
        "start_lat":  11.651,
        "start_lon":  76.132,
        "home_radius_km": 4.0,
        "step_mean":  0.28,
        "step_std":   0.14,
        "habituation": 0.7,
    },
    {
        "id":         "WY_ELE_F02",
        "name":       "Kaveri",
        "sex":        "F",
        "age_class":  "adult",
        "collar":     "COL-2022-002",
        "color":      "#60a5fa",
        "home_lat":   11.618,
        "home_lon":   76.113,   # deep forest, northern WLS
        "start_lat":  11.618,
        "start_lon":  76.113,
        "home_radius_km": 3.5,
        "step_mean":  0.26,
        "step_std":   0.12,
        "habituation": 0.65,
    },
    {
        "id":         "WY_ELE_M01",
        "name":       "Arjun",
        "sex":        "M",
        "age_class":  "adult",
        "collar":     "COL-2022-003",
        "color":      "#f59e0b",
        "home_lat":   11.728,
        "home_lon":   76.100,   # Pulpalli corridor interior
        "start_lat":  11.728,
        "start_lon":  76.100,
        "home_radius_km": 5.0,
        "step_mean":  0.38,
        "step_std":   0.18,
        "habituation": 0.6,
    },
    {
        "id":         "WY_ELE_F03",
        "name":       "Ganga",
        "sex":        "F",
        "age_class":  "sub-adult",
        "collar":     "COL-2022-004",
        "color":      "#c084fc",
        "home_lat":   11.679,
        "home_lon":   76.108,   # Muttil forest core
        "start_lat":  11.679,
        "start_lon":  76.108,
        "home_radius_km": 3.5,
        "step_mean":  0.22,
        "step_std":   0.10,
        "habituation": 0.75,
    },
    {
        "id":         "WY_ELE_M02",
        "name":       "Rajan",
        "sex":        "M",
        "age_class":  "sub-adult",
        "collar":     "COL-2022-005",
        "color":      "#fb923c",
        "home_lat":   11.735,
        "home_lon":   76.112,   # Tholpetty core
        "start_lat":  11.735,
        "start_lon":  76.112,
        "home_radius_km": 4.0,
        "step_mean":  0.30,
        "step_std":   0.15,
        "habituation": 0.6,
    },
]


def hav(lat1, lon1, lat2, lon2) -> float:
    R = 6371; p = math.pi / 180
    a = math.sin((lat2-lat1)*p/2)**2 + math.cos(lat1*p)*math.cos(lat2*p)*math.sin((lon2-lon1)*p/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def nearest_settle(lat, lon):
    best_d, best_n = 999, "Wayanad"
    for name, slat, slon in SETTLEMENTS:
        d = hav(lat, lon, slat, slon)
        if d < best_d:
            best_d, best_n = d, name
    return round(best_d, 4), best_n


def nearest_water(lat, lon):
    return min(hav(lat, lon, w[0], w[1]) for w in WATERHOLES)


def get_season(month):
    if month in (3, 4, 5):   return "summer",      1.35
    if month in (6, 7, 8, 9):return "monsoon",     0.70
    if month in (10, 11):    return "post_monsoon", 1.10
    return "winter", 0.90


def get_state(speed, dist, night):
    if dist < 0.5:  return "approaching_settlement"
    if dist < 1.5 and night: return "nocturnal_movement"
    if speed > 6:   return "running"
    if speed > 2:   return "walking"
    return "foraging"


def get_habitat(dist):
    if dist < 0.5:  return "settlement_edge"
    if dist < 1.5:  return "agriculture_mosaic"
    if dist < 3.0:  return "forest_fringe"
    if dist < 5.0:  return "forest"
    return "dense_forest"


def _settlement_repulsion(lat, lon):
    """
    Compute repulsion bearing away from nearest settlement.
    Returns (bearing_away, strength) — used to steer elephant
    back into forest when too close to settlement.
    """
    best_d = 999; best_sn = None; best_sb = 0
    for name, slat, slon in SETTLEMENTS:
        d = hav(lat, lon, slat, slon)
        if d < best_d:
            best_d = d
            # Bearing AWAY from settlement
            best_sb = math.atan2(lon - slon, lat - slat)
    strength = max(0.0, min(0.95, (2.5 - best_d) / 2.5))
    return best_sb, strength


class ElephantState:
    def __init__(self, profile: dict):
        self.p       = profile
        self.lat     = profile["start_lat"]
        self.lon     = profile["start_lon"]
        self.bearing = random.uniform(0, 2 * math.pi)
        self._loaded = False

    async def load_last_position(self, pool):
        """Resume from last known MySQL position — but only if it's inside forest."""
        if self._loaded or pool is None:
            return
        try:
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """SELECT latitude, longitude FROM gps_fixes
                           WHERE individual_id=%s
                           ORDER BY ts DESC LIMIT 1""",
                        (self.p["id"],)
                    )
                    row = await cur.fetchone()
            if row:
                lat, lon = float(row[0]), float(row[1])
                dist, _ = nearest_settle(lat, lon)
                # Only resume if elephant is NOT stuck near a settlement
                if dist > 1.5:
                    self.lat = lat
                    self.lon = lon
                    print(f"  [Resume] {self.p['id']}: last pos lat={self.lat:.5f} lon={self.lon:.5f}")
                else:
                    # Elephant was saved near a settlement — reset to home
                    self.lat = self.p["home_lat"]
                    self.lon = self.p["home_lon"]
                    print(f"  [Reset] {self.p['id']}: was near settlement ({dist:.2f}km) — reset to home")
            else:
                print(f"  [New] {self.p['id']}: starting at home pos")
        except Exception as e:
            print(f"  [Warn] Could not load last position for {self.p['id']}: {e}")
        self._loaded = True

    def next_fix(self, interval_min=1.0):
        p     = self.p
        now   = datetime.now()
        night = now.hour >= 19 or now.hour < 6
        season, mod = get_season(now.month)

        # ── Correlated Random Walk ─────────────────────────────────
        self.bearing += random.vonmisesvariate(0, 1.8)
        step = abs(random.gauss(p["step_mean"], p["step_std"])) * (interval_min / 30)
        if night:     step *= 1.35
        if mod > 1.2: step *= mod * 0.85

        # ── Check current settlement distance ─────────────────────
        dist_now, _ = nearest_settle(self.lat, self.lon)

        # ── Settlement REPULSION — push away if < 2.5km ──────────
        if dist_now < 2.5:
            repulse_bearing, rep_strength = _settlement_repulsion(self.lat, self.lon)
            # Strong repulsion when very close
            if dist_now < 1.0:
                rep_strength = min(0.95, rep_strength * 2.0)
            self.bearing = rep_strength * repulse_bearing + (1 - rep_strength) * self.bearing

        # ── Home range attraction — pull back if too far ───────────
        d_home = hav(self.lat, self.lon, p["home_lat"], p["home_lon"])
        if d_home > p["home_radius_km"]:
            pull     = math.atan2(p["home_lon"] - self.lon, p["home_lat"] - self.lat)
            strength = min(0.85, (d_home - p["home_radius_km"]) / 5.0)
            self.bearing = strength * pull + (1 - strength) * self.bearing

        # ── Water attraction in dry season ─────────────────────────
        if mod >= 1.3 and nearest_water(self.lat, self.lon) > 2.5:
            nw = min(WATERHOLES, key=lambda w: hav(self.lat, self.lon, w[0], w[1]))
            wb = math.atan2(nw[1] - self.lon, nw[0] - self.lat)
            self.bearing = 0.25 * wb + 0.75 * self.bearing

        # ── Move ───────────────────────────────────────────────────
        dlat = step * math.cos(self.bearing) / 111
        dlon = step * math.sin(self.bearing) / (111 * math.cos(math.radians(self.lat)))
        self.lat = max(BBOX["lat_min"], min(BBOX["lat_max"], self.lat + dlat))
        self.lon = max(BBOX["lon_min"], min(BBOX["lon_max"], self.lon + dlon))

        # ── Derived metrics ────────────────────────────────────────
        dist_km, village = nearest_settle(self.lat, self.lon)
        spd  = step / (interval_min / 60)
        risk = max(0.0, (2.5 - dist_km) / 2.5)
        if night:     risk *= 1.30
        if mod > 1.2: risk  = min(0.99, risk * mod * 0.85)
        if spd > 4:   risk  = min(0.99, risk * 1.20)

        return {
            "individual_id": p["id"],
            "name":          p["name"],
            "sex":           p["sex"],
            "age_class":     p["age_class"],
            "collar_id":     p["collar"],
            "color":         p["color"],
            "ts":            now.isoformat(),
            "latitude":      round(self.lat, 6),
            "longitude":     round(self.lon, 6),
            "speed_kmh":     round(spd, 3),
            "step_km":       round(step, 4),
            "state":         get_state(spd, dist_km, night),
            "dist_settle":   round(dist_km, 4),
            "settlement":    village,
            "habitat":       get_habitat(dist_km),
            "risk":          round(risk, 4),
            "temp":          round(random.gauss(31, 2.5), 1),
            "humidity":      round(random.gauss(66, 6), 1),
            "ndvi":          round(random.gauss(0.55, 0.08), 3),
            "is_night":      night,
            "season":        season,
        }


class MultiElephantSimulator:
    def __init__(self):
        self.elephants  = [ElephantState(p) for p in ELEPHANTS]
        self._broadcast = None

    def set_broadcast(self, fn):
        self._broadcast = fn

    def get_profiles(self):
        return [{"individual_id": e.p["id"], "name": e.p["name"],
                 "color": e.p["color"], "latitude": e.lat, "longitude": e.lon,
                 "location_lat": e.lat, "location_long": e.lon}
                for e in self.elephants]

    async def _save(self, f):
        from db.database import pool
        if pool is None:
            return None
        try:
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        INSERT INTO gps_fixes
                        (individual_id,ts,latitude,longitude,speed_kmh,step_km,state,
                         dist_settle,settlement,habitat,risk,temp,humidity,ndvi,is_night,season)
                        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (f["individual_id"], f["ts"], f["latitude"], f["longitude"],
                          f["speed_kmh"], f["step_km"], f["state"], f["dist_settle"],
                          f["settlement"], f["habitat"], f["risk"], f["temp"],
                          f["humidity"], f["ndvi"], 1 if f["is_night"] else 0, f["season"]))
                    return cur.lastrowid
        except Exception as e:
            print(f"  [SaveErr] {f['individual_id']}: {e}")
            return None

    async def run(self, interval_sec=60):
        thresh = float(os.getenv("RISK_THRESHOLD", 0.70))

        # Resume from last known MySQL positions
        from db.database import pool as _pool
        print(f"🐘×5 Simulator starting — loading last positions from DB...")
        for e in self.elephants:
            await e.load_last_position(_pool)
        print(f"   Resumed positions:")
        for e in self.elephants:
            print(f"   {e.p['id']:15s}  lat={e.lat:.4f}  lon={e.lon:.4f}")

        while True:
            await asyncio.sleep(interval_sec)
            all_fixes = []

            for elephant in self.elephants:
                try:
                    f   = elephant.next_fix(interval_min=interval_sec / 60)
                    fid = await self._save(f)
                    if fid:
                        f["id"] = fid
                    all_fixes.append(f)

                    label = ("CRITICAL" if f["risk"] > 0.85 else
                             "HIGH"     if f["risk"] > 0.65 else
                             "MODERATE" if f["risk"] > 0.40 else "LOW")

                    if self._broadcast:
                        await self._broadcast({"type": "gps_fix", "payload": {
                            **f,
                            "location_lat":              f["latitude"],
                            "location_long":             f["longitude"],
                            "intrusion_risk":            f["risk"],
                            "distance_to_settlement_km": f["dist_settle"],
                            "nearest_settlement":        f["settlement"],
                            "behavioural_state":         f["state"],
                            "habitat_type":              f["habitat"],
                            "temperature_c":             f["temp"],
                            "humidity_pct":              f["humidity"],
                            "timestamp":                 f["ts"],
                            "risk_label":                label,
                        }})

                        await self._broadcast({"type": "risk_update", "payload": {
                            "individual_id": f["individual_id"],
                            "risk_score":    f["risk"],
                            "risk_label":    label,
                            "name":          f["name"],
                        }})

                    print(f"   {f['individual_id']:15s} "
                          f"lat={f['latitude']:.5f} lon={f['longitude']:.5f} "
                          f"risk={f['risk']:.2f} [{label}] "
                          f"dist={f['dist_settle']:.2f}km")

                except Exception as e:
                    print(f"   Error {elephant.p['id']}: {e}")

            if self._broadcast and all_fixes:
                await self._broadcast({"type": "herd_update", "payload": all_fixes})


simulator = MultiElephantSimulator()