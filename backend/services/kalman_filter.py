"""
kalman_filter.py — WildGuard AI
Kalman filter for GPS trajectory smoothing.
Add to backend/services/ folder.

Reduces CRW simulation noise and produces cleaner
trajectories for dashboard display.

Usage:
    from services.kalman_filter import GPSKalmanFilter
    kf = GPSKalmanFilter()
    smooth_lat, smooth_lon = kf.update(raw_lat, raw_lon)
"""


class KalmanFilter1D:
    """
    1-D Kalman filter for a single GPS coordinate.
    Balances measurement noise vs process noise.
    """

    def __init__(self, process_variance: float = 1e-5,
                 measurement_variance: float = 1e-3):
        """
        Args:
            process_variance:     How much the true position can change
                                  between steps (elephant movement variance)
            measurement_variance: GPS measurement error variance
                                  DHT11-class GPS: ~0.0001 degrees ≈ 11m
        """
        self.Q = process_variance        # process noise
        self.R = measurement_variance    # measurement noise
        self.x = None                    # current estimate
        self.P = 1.0                     # estimate error covariance
        self.initialised = False

    def update(self, measurement: float) -> float:
        """
        Update filter with new measurement.
        Returns smoothed estimate.
        """
        if not self.initialised:
            self.x = measurement
            self.initialised = True
            return measurement

        # ── Prediction step ───────────────────────────────────────
        # State doesn't change between steps (constant position model)
        # Only error covariance grows
        P_pred = self.P + self.Q

        # ── Update step ───────────────────────────────────────────
        K      = P_pred / (P_pred + self.R)        # Kalman gain
        self.x = self.x + K * (measurement - self.x)
        self.P = (1 - K) * P_pred

        return self.x

    def reset(self):
        self.x = None
        self.P = 1.0
        self.initialised = False


class GPSKalmanFilter:
    """
    2-D Kalman filter for lat/lon GPS smoothing.
    One independent filter per coordinate axis.
    """

    def __init__(self,
                 process_variance: float = 1e-5,
                 measurement_variance: float = 5e-4):
        """
        Tuned for elephant GPS at 10-second intervals:
        - process_variance: elephant moves ~0.003 degrees/step max
        - measurement_variance: GPS collar accuracy ~50m ≈ 0.0005 degrees
        """
        self.kf_lat = KalmanFilter1D(process_variance, measurement_variance)
        self.kf_lon = KalmanFilter1D(process_variance, measurement_variance)

    def update(self, lat: float, lon: float):
        """
        Smooth raw GPS coordinates.
        Returns (smooth_lat, smooth_lon).
        """
        smooth_lat = self.kf_lat.update(lat)
        smooth_lon = self.kf_lon.update(lon)
        return smooth_lat, smooth_lon

    def reset(self):
        self.kf_lat.reset()
        self.kf_lon.reset()


# ── One filter per elephant ───────────────────────────────────────
# Instantiate at module level — persists across GPS fixes

_elephant_filters: dict = {}


def get_filter(elephant_id: str) -> GPSKalmanFilter:
    """Get or create Kalman filter for a specific elephant."""
    if elephant_id not in _elephant_filters:
        _elephant_filters[elephant_id] = GPSKalmanFilter(
            process_variance=1e-5,      # tuned for 10s GPS interval
            measurement_variance=5e-4,  # GPS collar accuracy
        )
    return _elephant_filters[elephant_id]


def smooth_fix(fix: dict) -> dict:
    """
    Apply Kalman smoothing to a GPS fix dict.
    Returns new dict with smoothed lat/lon and original preserved.

    Designed to slot directly into on_gps_fix() in main.py.
    """
    eid = fix.get("individual_id", "")
    raw_lat = fix.get("latitude",  fix.get("location_lat", 0))
    raw_lon = fix.get("longitude", fix.get("location_long", 0))

    if not eid or raw_lat == 0:
        return fix

    kf = get_filter(eid)
    smooth_lat, smooth_lon = kf.update(raw_lat, raw_lon)

    return {
        **fix,
        "latitude":           smooth_lat,
        "longitude":          smooth_lon,
        "location_lat":       smooth_lat,
        "location_long":      smooth_lon,
        "raw_latitude":       raw_lat,
        "raw_longitude":      raw_lon,
        "kalman_applied":     True,
    }