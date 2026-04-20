"""
osm_settlements.py — Fetch real settlement/village data from OpenStreetMap
Uses Overpass API to get villages, towns, hamlets near Wayanad Wildlife Sanctuary.
Caches results to avoid repeated API calls.
"""
import asyncio, json, os
from datetime import datetime, timedelta
import aiohttp

# Wayanad bounding box: south,west,north,east
WAYANAD_BBOX = "11.55,76.00,11.85,76.30"

CACHE_FILE = os.path.join(os.path.dirname(__file__), "../models/osm_settlements_cache.json")
CACHE_TTL_HOURS = 24  # refresh once per day

# Fallback hardcoded settlements if OSM unavailable
FALLBACK_SETTLEMENTS = [
    {"name":"Sulthan Bathery","lat":11.6483,"lon":76.2591,"type":"town","population":~31000},
    {"name":"Ambalavayal",    "lat":11.617, "lon":76.217, "type":"village","population":~8000},
    {"name":"Pulpalli",       "lat":11.733, "lon":76.183, "type":"village","population":~5000},
    {"name":"Muttil",         "lat":11.682, "lon":76.182, "type":"village","population":~4000},
    {"name":"Nulpuzha",       "lat":11.583, "lon":76.150, "type":"hamlet","population":~1200},
    {"name":"Kalpetta",       "lat":11.608, "lon":76.083, "type":"town","population":~28000},
    {"name":"Vythiri",        "lat":11.575, "lon":76.052, "type":"village","population":~3500},
    {"name":"Panamaram",      "lat":11.750, "lon":76.088, "type":"village","population":~4000},
    {"name":"Mananthavady",   "lat":11.800, "lon":76.000, "type":"town","population":~12000},
    {"name":"Tholpetty",      "lat":11.767, "lon":76.020, "type":"hamlet","population":~800},
]

_cache = None
_cache_time = None

OVERPASS_QUERY = f"""
[out:json][timeout:30];
(
  node["place"~"^(town|village|hamlet|suburb)$"]({WAYANAD_BBOX});
  node["amenity"="school"]({WAYANAD_BBOX});
  node["landuse"="farmland"]({WAYANAD_BBOX});
  way["landuse"="farmland"]({WAYANAD_BBOX});
);
out center;
"""

async def fetch_osm_settlements():
    """Fetch settlements from OpenStreetMap Overpass API."""
    global _cache, _cache_time

    # Check memory cache
    if _cache and _cache_time and datetime.now() - _cache_time < timedelta(hours=CACHE_TTL_HOURS):
        return _cache

    # Check file cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                cached = json.load(f)
            if datetime.fromisoformat(cached["ts"]) > datetime.now() - timedelta(hours=CACHE_TTL_HOURS):
                _cache = cached["data"]
                _cache_time = datetime.now()
                print(f"[OSM] Loaded {len(_cache)} settlements from cache")
                return _cache
        except Exception:
            pass

    # Fetch from Overpass API
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": OVERPASS_QUERY},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                data = await resp.json()

        settlements = []
        seen = set()
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:en")
            if not name or name in seen:
                continue
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")
            if not lat or not lon:
                continue
            place = tags.get("place", tags.get("amenity", "settlement"))
            pop = tags.get("population")
            settlements.append({
                "name":       name,
                "lat":        float(lat),
                "lon":        float(lon),
                "type":       place,
                "population": int(pop) if pop and pop.isdigit() else None,
                "source":     "openstreetmap",
            })
            seen.add(name)

        if settlements:
            _cache = settlements
            _cache_time = datetime.now()
            os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
            with open(CACHE_FILE, "w") as f:
                json.dump({"ts": datetime.now().isoformat(), "data": settlements}, f)
            print(f"[OSM] Fetched {len(settlements)} real settlements from OpenStreetMap")
            return settlements

    except Exception as e:
        print(f"[OSM] Overpass API failed: {e} — using fallback data")

    _cache = FALLBACK_SETTLEMENTS
    _cache_time = datetime.now()
    return FALLBACK_SETTLEMENTS


async def get_nearest_settlement(lat: float, lon: float):
    """Find nearest settlement to given coordinates."""
    import math
    settlements = await fetch_osm_settlements()
    best, best_dist = None, float('inf')
    for s in settlements:
        d = math.sqrt((lat - s["lat"])**2 + (lon - s["lon"])**2) * 111
        if d < best_dist:
            best_dist = d
            best = {**s, "distance_km": round(d, 3)}
    return best