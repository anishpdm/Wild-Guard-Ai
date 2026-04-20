# services/gps_simulator.py
"""
Live GPS Collar Simulator — WY_ELE_F01 — Wayanad Wildlife Sanctuary

Algorithm: Correlated Random Walk with
  - Home range attraction (kernel density centre)
  - Water source attraction in dry season
  - Settlement avoidance / approach behaviour
  - Night vs day step length differences
  - Seasonal risk modifiers (dry season 1.4×)

Every GPS_INTERVAL_SECONDS:
  1. Advance position one step
  2. INSERT into MySQL gps_fixes
  3. Broadcast {type:"gps_fix"} to all WebSocket clients
  4. Broadcast {type:"risk_update"}
  5. If risk > threshold → INSERT alert → broadcast {type:"alert"}
"""

import asyncio, math, random, os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ── Geography ────────────────────────────────────────────────────
BBOX = dict(lat_min=11.48,lat_max=11.80,lon_min=76.00,lon_max=76.45)

SETTLEMENTS = [
    ("Sulthan Bathery",11.6483,76.2591),
    ("Ambalavayal",    11.6170,76.2170),
    ("Pulpalli",       11.7330,76.1830),
    ("Muttil",         11.6820,76.1820),
    ("Nulpuzha",       11.5830,76.1500),
    ("Kalpetta",       11.6083,76.0833),
    ("Kidanganad",     11.5500,76.1833),
    ("Mananthavady",   11.8000,76.0000),
]

WATERHOLES = [(11.620,76.155),(11.660,76.200),(11.590,76.130),(11.700,76.170)]

def _hav(la1,lo1,la2,lo2):
    R=6371.0; p1,p2=math.radians(la1),math.radians(la2)
    dp=math.radians(la2-la1); dl=math.radians(lo2-lo1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R*2*math.asin(math.sqrt(min(1.0,a)))

def _nearest_settle(lat,lon):
    best_d,best_n=999,"Unknown"
    for n,la,lo in SETTLEMENTS:
        d=_hav(lat,lon,la,lo)
        if d<best_d: best_d,best_n=d,n
    return round(best_d,4),best_n

def _nearest_water(lat,lon):
    return min(_hav(lat,lon,la,lo) for la,lo in WATERHOLES)

def _season(month):
    if month in [3,4,5]:   return "summer",1.40
    if month in [6,7,8,9]: return "sw_monsoon",0.70
    if month in [10,11]:   return "ne_monsoon",0.90
    return "winter",1.10

def _habitat(d):
    if d>5:  return "dense_forest"
    if d>3:  return "forest"
    if d>2:  return "forest_fringe"
    if d>1:  return "agriculture_mosaic"
    return "settlement_edge"

def _state(spd,d,night):
    if spd>5 and d<2 and night: return "approaching_settlement"
    if spd>2: return "roaming"
    if spd<0.5: return "resting"
    return "foraging"


class GPSSimulator:
    def __init__(self):
        self.lat     = 11.635
        self.lon     = 76.185
        self.bearing = random.uniform(0,2*math.pi)
        self._home   = (11.635, 76.185)
        self._broadcast = None

    def set_broadcast(self, fn):
        self._broadcast = fn

    def next_fix(self, interval_min=1.0) -> dict:
        now    = datetime.now()
        night  = now.hour>=19 or now.hour<6
        season,mod = _season(now.month)

        # Correlated random walk
        self.bearing += random.vonmisesvariate(0, 1.5)

        step = abs(random.gauss(0.25,0.12)) * (interval_min/30)
        if night: step *= 1.35
        if mod>1.2: step *= mod*0.85  # move more in dry season

        # Home range pull (if >12 km away)
        d_home = _hav(self.lat,self.lon,*self._home)
        if d_home > 12:
            pull_b = math.atan2(self._home[1]-self.lon, self._home[0]-self.lat)
            w = min(0.85,(d_home-12)/6)
            self.bearing = w*pull_b + (1-w)*self.bearing

        # Water attraction in dry/summer
        if mod>=1.3 and _nearest_water(self.lat,self.lon)>3:
            nw = min(WATERHOLES, key=lambda w:_hav(self.lat,self.lon,w[0],w[1]))
            wb = math.atan2(nw[1]-self.lon, nw[0]-self.lat)
            self.bearing = 0.25*wb + 0.75*self.bearing

        dlat = step*math.cos(self.bearing)/111
        dlon = step*math.sin(self.bearing)/(111*math.cos(math.radians(self.lat)))
        self.lat = max(BBOX["lat_min"],min(BBOX["lat_max"],self.lat+dlat))
        self.lon = max(BBOX["lon_min"],min(BBOX["lon_max"],self.lon+dlon))

        dist,village = _nearest_settle(self.lat,self.lon)
        spd = step/(interval_min/60)

        risk = max(0.0, (2.5-dist)/2.5)
        if night: risk *= 1.30
        if mod>1.2: risk = min(0.99, risk*mod*0.9)
        if spd>4:  risk = min(0.99, risk*1.20)
        risk = round(risk,4)

        return dict(
            individual_id="WY_ELE_F01",
            ts=now.isoformat(),
            latitude=round(self.lat,6),
            longitude=round(self.lon,6),
            speed_kmh=round(spd,3),
            step_km=round(step,4),
            state=_state(spd,dist,night),
            dist_settle=dist,
            settlement=village,
            habitat=_habitat(dist),
            risk=risk,
            temp=round(random.gauss(31,2.5),1),
            humidity=round(random.gauss(66,6),1),
            ndvi=round(random.gauss(0.55,0.08),3),
            is_night=night,
            season=season,
        )

    async def _save(self, f: dict) -> int:
        from db.database import pool
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    INSERT INTO gps_fixes
                    (individual_id,ts,latitude,longitude,speed_kmh,step_km,state,
                     dist_settle,settlement,habitat,risk,temp,humidity,ndvi,is_night,season)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (f["individual_id"],f["ts"],f["latitude"],f["longitude"],
                      f["speed_kmh"],f["step_km"],f["state"],f["dist_settle"],
                      f["settlement"],f["habitat"],f["risk"],f["temp"],
                      f["humidity"],f["ndvi"],1 if f["is_night"] else 0,f["season"]))
                return cur.lastrowid

    async def _save_alert(self, f: dict) -> dict:
        from db.database import pool
        lvl = "critical" if f["risk"]>0.85 else "warning"
        msg = (f"🐘 {f['individual_id']} — {f['settlement']} — "
               f"risk {round(f['risk']*100)}% ({lvl.upper()}) — "
               f"{f['dist_settle']} km to settlement")
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "INSERT INTO alerts(level,message,camera_id,location) VALUES(%s,%s,%s,%s)",
                    (lvl,msg,"GPS_SIM",f["settlement"])
                )
                aid = cur.lastrowid
        return dict(id=aid,level=lvl,message=msg,camera_id="GPS_SIM",
                    location=f["settlement"],acknowledged=False,
                    created_at=f["ts"])

    async def run(self, interval_sec=60):
        thresh = float(os.getenv("RISK_THRESHOLD",0.70))
        print(f"🐘 GPS simulator running — 1 fix every {interval_sec}s")
        while True:
            await asyncio.sleep(interval_sec)
            try:
                f   = self.next_fix(interval_min=interval_sec/60)
                fid = await self._save(f)
                f["id"] = fid

                label = ("CRITICAL" if f["risk"]>0.85 else
                         "HIGH"     if f["risk"]>0.65 else
                         "MODERATE" if f["risk"]>0.40 else "LOW")

                if self._broadcast:
                    # 1 — GPS fix (React map updates here)
                    await self._broadcast({"type":"gps_fix","payload":{
                        **f,
                        "location_lat":   f["latitude"],
                        "location_long":  f["longitude"],
                        "intrusion_risk": f["risk"],
                        "distance_to_settlement_km": f["dist_settle"],
                        "nearest_settlement": f["settlement"],
                        "behavioural_state":  f["state"],
                        "habitat_type":       f["habitat"],
                        "temperature_c":      f["temp"],
                        "humidity_pct":       f["humidity"],
                        "timestamp": f["ts"],
                    }})
                    # 2 — risk gauge update
                    await self._broadcast({"type":"risk_update","payload":{
                        "individual_id": f["individual_id"],
                        "risk_score":    f["risk"],
                        "risk_label":    label,
                    }})
                    # 3 — auto-alert
                    if f["risk"] > thresh:
                        alert = await self._save_alert(f)
                        await self._broadcast({"type":"alert","payload":alert})

                print(f"  📍 {f['latitude']:.5f},{f['longitude']:.5f} "
                      f"risk={f['risk']} [{label}] {f['state']}")
            except Exception as e:
                print(f"  ⚠ Simulator error: {e}")


simulator = GPSSimulator()
