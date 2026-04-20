# services/social_dynamics.py
"""
Social Dynamics Tracker — inter-elephant relationships, musth, herd formation.

Key events tracked:
  - Herd formation (3+ females within 800m)
  - Mother-calf proximity (F01 near F03 = family unit)
  - Musth male displacement (M01 musth → females pushed to fringe)
  - Territorial conflict between elephants
"""

import math, random
from datetime import datetime

ELEPHANTS_META = {
    "WY_ELE_F01": {"name":"Lakshmi","sex":"F","age_class":"adult","color":"#22c55e"},
    "WY_ELE_F02": {"name":"Kaveri","sex":"F","age_class":"adult","color":"#60a5fa"},
    "WY_ELE_M01": {"name":"Arjun","sex":"M","age_class":"adult","color":"#f59e0b"},
    "WY_ELE_F03": {"name":"Ganga","sex":"F","age_class":"sub_adult","color":"#c084fc"},
    "WY_ELE_M02": {"name":"Rajan","sex":"M","age_class":"sub_adult","color":"#fb923c"},
}

# Family unit hypothesis (based on typical Asian elephant matriarchal groups)
FAMILY_UNITS = [
    {"name":"Lakshmi group","members":["WY_ELE_F01","WY_ELE_F03"]},  # F01 is likely F03's mother
]

def _hav(la1,lo1,la2,lo2):
    R=6371.0; p1,p2=math.radians(la1),math.radians(la2)
    dp=math.radians(la2-la1); dl=math.radians(lo2-lo1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R*2*math.asin(math.sqrt(min(1.0,a)))

def _get_pos(fix):
    return (fix.get("location_lat") or fix.get("latitude",0),
            fix.get("location_long") or fix.get("longitude",0))


class SocialDynamicsTracker:
    def __init__(self):
        # Musth state — in a real system updated by field observers
        self.musth_status = {
            "WY_ELE_M01": {"in_musth": False, "intensity": 0.0, "start": None},
            "WY_ELE_M02": {"in_musth": False, "intensity": 0.0, "start": None},
        }
        # Simulate occasional musth for demo
        self._sim_counter = 0

    def analyse(self, herd_positions: dict) -> dict:
        self._sim_counter += 1
        # Simulate musth onset every ~50 cycles for M01 (demo)
        if self._sim_counter % 50 == 0:
            self.musth_status["WY_ELE_M01"]["in_musth"] = not self.musth_status["WY_ELE_M01"]["in_musth"]
            self.musth_status["WY_ELE_M01"]["intensity"] = 0.75 if self.musth_status["WY_ELE_M01"]["in_musth"] else 0.0

        ids   = list(herd_positions.keys())
        pairs = []
        for i in range(len(ids)):
            for j in range(i+1, len(ids)):
                a, b = ids[i], ids[j]
                la, loa = _get_pos(herd_positions[a])
                lb, lob = _get_pos(herd_positions[b])
                if not (la and lb): continue
                d = _hav(la, loa, lb, lob)
                meta_a = ELEPHANTS_META.get(a, {})
                meta_b = ELEPHANTS_META.get(b, {})
                rel = self._classify_relation(a, b, d, meta_a, meta_b)
                pairs.append({
                    "pair":         f"{a}–{b}",
                    "names":        f"{meta_a.get('name','?')}–{meta_b.get('name','?')}",
                    "distance_km":  round(d, 3),
                    "relationship": rel,
                    "alert":        d < 0.2 and rel in ["conflict","displacement"],
                })

        females = [i for i in ids if ELEPHANTS_META.get(i,{}).get("sex")=="F"]
        herd_formed = self._check_herd(females, herd_positions)
        family_proximity = self._check_family_units(herd_positions)
        displacement_risk = self._displacement_risk(herd_positions)
        events = self._generate_events(pairs, herd_formed, displacement_risk)

        return {
            "pair_distances":     pairs,
            "herd_formed":        herd_formed,
            "musth_status":       self.musth_status,
            "family_units":       family_proximity,
            "displacement_risk":  displacement_risk,
            "events":             events,
            "timestamp":          datetime.now().isoformat(),
        }

    def _classify_relation(self, a, b, d_km, meta_a, meta_b):
        if d_km < 0.1:  return "conflict"
        if d_km < 0.3:  return "close_contact"
        if d_km < 0.8:
            if meta_a.get("sex")=="M" and self.musth_status.get(a,{}).get("in_musth"):
                return "displacement"
            return "foraging_together"
        if d_km < 2.0:  return "same_range"
        return "independent"

    def _check_herd(self, female_ids, positions):
        if len(female_ids) < 3: return {"formed": False}
        lats = []; lons = []
        for fid in female_ids:
            la, lo = _get_pos(positions.get(fid, {}))
            if la: lats.append(la); lons.append(lo)
        if len(lats) < 2: return {"formed": False}
        max_spread = max(
            _hav(lats[i],lons[i],lats[j],lons[j])
            for i in range(len(lats)) for j in range(i+1,len(lats))
        ) if len(lats) > 1 else 99
        return {"formed": max_spread < 1.0, "spread_km": round(max_spread, 2), "members": female_ids}

    def _check_family_units(self, positions):
        result = []
        for unit in FAMILY_UNITS:
            members = unit["members"]
            distances = []
            for i in range(len(members)):
                for j in range(i+1, len(members)):
                    pa = positions.get(members[i], {}); pb = positions.get(members[j], {})
                    la,loa = _get_pos(pa); lb,lob = _get_pos(pb)
                    if la and lb: distances.append(round(_hav(la,loa,lb,lob),3))
            result.append({"name":unit["name"],"members":members,"max_distance_km":max(distances) if distances else None,"together":max(distances,default=99)<2.0})
        return result

    def _displacement_risk(self, positions):
        risk_level = "low"
        for mid, mstat in self.musth_status.items():
            if not mstat["in_musth"]: continue
            mpos = positions.get(mid, {})
            mla, mlo = _get_pos(mpos)
            if not mla: continue
            for fid, fpos in positions.items():
                if ELEPHANTS_META.get(fid,{}).get("sex") != "F": continue
                fla, flo = _get_pos(fpos)
                if fla and _hav(mla, mlo, fla, flo) < 3.0:
                    risk_level = "high"
        return risk_level

    def _generate_events(self, pairs, herd, displacement_risk):
        events = []
        if herd.get("formed"):
            events.append({"type":"herd_formation","severity":"info","message":f"Herd formed — {len(herd.get('members',[]))} females within {herd.get('spread_km','?')} km"})
        if displacement_risk == "high":
            events.append({"type":"musth_displacement","severity":"warning","message":"Musth male WY_ELE_M01 active — female displacement risk HIGH"})
        for p in pairs:
            if p.get("alert"):
                events.append({"type":"close_contact","severity":"warning","message":f"Close contact: {p['names']} — {p['distance_km']} km"})
        return events


social_tracker = SocialDynamicsTracker()
