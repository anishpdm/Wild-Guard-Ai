# db/database.py — WildGuard AI v5
import os, aiomysql
from dotenv import load_dotenv
load_dotenv()

pool = None
_CFG = dict(
    host=os.getenv("DB_HOST","localhost"), port=int(os.getenv("DB_PORT",3306)),
    user=os.getenv("DB_USER","root"),      password=os.getenv("DB_PASSWORD",""),
    db=os.getenv("DB_NAME","wildguard"),   autocommit=True, charset="utf8mb4",
)

_SCHEMA = [
"CREATE TABLE IF NOT EXISTS gps_fixes(id INT AUTO_INCREMENT PRIMARY KEY,individual_id VARCHAR(32) NOT NULL DEFAULT 'WY_ELE_F01',ts DATETIME NOT NULL,latitude DOUBLE NOT NULL,longitude DOUBLE NOT NULL,speed_kmh DOUBLE DEFAULT 0,step_km DOUBLE DEFAULT 0,state VARCHAR(40) DEFAULT 'foraging',dist_settle DOUBLE DEFAULT 5,settlement VARCHAR(80) DEFAULT '',habitat VARCHAR(40) DEFAULT 'forest',risk DOUBLE DEFAULT 0,temp DOUBLE DEFAULT 30,humidity DOUBLE DEFAULT 66,ndvi DOUBLE DEFAULT 0.55,is_night TINYINT(1) DEFAULT 0,season VARCHAR(20) DEFAULT 'winter',INDEX idx_ind(individual_id),INDEX idx_ts(ts)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS alerts(id INT AUTO_INCREMENT PRIMARY KEY,level VARCHAR(16) NOT NULL,message TEXT NOT NULL,camera_id VARCHAR(20) DEFAULT 'SYSTEM',location VARCHAR(80) DEFAULT 'Wayanad',acknowledged TINYINT(1) DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,INDEX idx_ack(acknowledged)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS sensor_readings(id INT AUTO_INCREMENT PRIMARY KEY,node_id VARCHAR(20) NOT NULL,location VARCHAR(80) DEFAULT '',temp DOUBLE DEFAULT 30,humidity DOUBLE DEFAULT 66,soil DOUBLE DEFAULT 40,pir TINYINT(1) DEFAULT 0,ndvi DOUBLE DEFAULT 0.55,battery DOUBLE DEFAULT 90,recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,INDEX idx_node(node_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS audit_log(id INT AUTO_INCREMENT PRIMARY KEY,agent_id VARCHAR(30) NOT NULL,action VARCHAR(20) NOT NULL,reason TEXT,operator VARCHAR(60) DEFAULT 'system',created_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS app_settings(k VARCHAR(60) PRIMARY KEY,v TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS stress_profiles(id INT AUTO_INCREMENT PRIMARY KEY,individual_id VARCHAR(32) NOT NULL,recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,water_stress DOUBLE DEFAULT 0,forage_stress DOUBLE DEFAULT 0,crop_attraction DOUBLE DEFAULT 0,social_stress DOUBLE DEFAULT 0,human_disturbance DOUBLE DEFAULT 0,corridor_pressure DOUBLE DEFAULT 0,health_anomaly DOUBLE DEFAULT 0,primary_driver VARCHAR(40) DEFAULT '',composite_score DOUBLE DEFAULT 0,INDEX idx_ind(individual_id),INDEX idx_time(recorded_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS incidents(id INT AUTO_INCREMENT PRIMARY KEY,occurred_at DATETIME NOT NULL,incident_type VARCHAR(40) NOT NULL,severity VARCHAR(20) DEFAULT 'medium',location_lat DOUBLE,location_lon DOUBLE,village VARCHAR(80),individual_id VARCHAR(32),crop_loss_inr DOUBLE DEFAULT 0,property_loss_inr DOUBLE DEFAULT 0,injuries_human INT DEFAULT 0,fatalities_human INT DEFAULT 0,injuries_elephant INT DEFAULT 0,primary_driver VARCHAR(40),description TEXT,reported_by VARCHAR(80) DEFAULT 'system',verified TINYINT(1) DEFAULT 0,compensation_filed TINYINT(1) DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,INDEX idx_type(incident_type),INDEX idx_time(occurred_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS social_events(id INT AUTO_INCREMENT PRIMARY KEY,recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,event_type VARCHAR(40),elephant_ids VARCHAR(200),distance_km DOUBLE,location_lat DOUBLE,location_lon DOUBLE,description TEXT,severity VARCHAR(20) DEFAULT 'low') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS waterhole_readings(id INT AUTO_INCREMENT PRIMARY KEY,waterhole_id VARCHAR(20) NOT NULL,recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,level_pct DOUBLE DEFAULT 100,quality VARCHAR(20) DEFAULT 'good',INDEX idx_wh(waterhole_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS esp_readings(id INT AUTO_INCREMENT PRIMARY KEY,device_id VARCHAR(40) NOT NULL,location VARCHAR(100) DEFAULT '',temperature DOUBLE NOT NULL,humidity DOUBLE NOT NULL,heat_index DOUBLE DEFAULT 0,alert TINYINT(1) DEFAULT 0,high_temp TINYINT(1) DEFAULT 0,low_humidity TINYINT(1) DEFAULT 0,wifi_rssi INT DEFAULT 0,uptime_s INT DEFAULT 0,recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,INDEX idx_device(device_id),INDEX idx_time(recorded_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
]

_DEFAULTS = {"sms_alerts":"true","fence_trigger":"true","email_reports":"false","autonomous_mode":"true","xai_logging":"true","night_mode_boost":"true","risk_threshold":"0.70","gps_interval_minutes":"1"}

_SEED_ALERTS = []  # No fake alerts — real alerts generated from actual elephant movement

_SEED_INCIDENTS = []  # No fake incidents — real data only


async def init_db():
    global pool
    try:
        pool = await aiomysql.create_pool(minsize=2, maxsize=10, **_CFG)
    except Exception as e:
        print(f"\n❌ MySQL connection FAILED: {e}")
        print(f"   Host: {_CFG['host']}:{_CFG['port']}")
        print(f"   User: {_CFG['user']}")
        print(f"   DB:   {_CFG['db']}")
        print(f"   Fix:  Edit .env → set DB_PASSWORD= to your MySQL password")
        print(f"         Or run: mysql -u root -e \"CREATE DATABASE wildguard;\"")
        pool = None
        return
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            for stmt in _SCHEMA:
                await cur.execute(stmt)
            for k, v in _DEFAULTS.items():
                await cur.execute("INSERT IGNORE INTO app_settings(k,v) VALUES(%s,%s)",(k,v))
            # No seed alerts — real alerts come from elephant movement simulator
            await cur.execute("SELECT COUNT(*) FROM incidents")
            if (await cur.fetchone())[0] == 0:
                await cur.executemany("INSERT INTO incidents(occurred_at,incident_type,severity,location_lat,location_lon,village,individual_id,crop_loss_inr,property_loss_inr,injuries_human,fatalities_human,injuries_elephant,primary_driver,description,reported_by,verified,compensation_filed) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", _SEED_INCIDENTS)
    print("✅ MySQL v5 ready — 9 tables")


async def get_settings():
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT k,v FROM app_settings")
            rows = await cur.fetchall()
    out = {}
    for k, v in rows:
        if v.lower() in ("true","false"): out[k] = v.lower()=="true"
        else:
            try:    out[k] = float(v) if "." in v else int(v)
            except: out[k] = v
    return out


async def save_settings(data: dict):
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            for k, v in data.items():
                sv = str(v).lower() if isinstance(v, bool) else str(v)
                await cur.execute("INSERT INTO app_settings(k,v) VALUES(%s,%s) ON DUPLICATE KEY UPDATE v=%s",(k,sv,sv))