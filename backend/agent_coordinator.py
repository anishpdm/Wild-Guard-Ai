"""
agent_coordinator.py — WildGuard AI
Wires all agents to the bus and defines their message handlers.

Import this once in main.py lifespan startup:
    from services.agent_coordinator import coordinator, setup_bus
    setup_bus()

Then in on_gps_fix():
    coordinator.run_cycle(all_fixes, sensor_data)
"""

import logging
from datetime import datetime
from typing import Optional
from agent_bus import (
    bus, AgentMessage,
    TOPIC_MUSTH_DETECTED, TOPIC_HERD_FORMING,
    TOPIC_STRESS_ESCALATION, TOPIC_ANOMALY_DETECTED,
    TOPIC_SENSOR_CRITICAL,
)

log = logging.getLogger("coordinator")

# ── Per-elephant state modified by messages ────────────────────────
# RL agents read these to adjust action selection
ELEPHANT_FLAGS: dict[str, dict] = {
    "WY_ELE_F01": {"herd_alert": False, "stress_high": False,
                   "proximity_threshold_km": 2.0},
    "WY_ELE_F02": {"herd_alert": False, "stress_high": False,
                   "proximity_threshold_km": 2.0},
    "WY_ELE_M01": {"herd_alert": False, "stress_high": False,
                   "proximity_threshold_km": 3.0},   # Arjun wider range
    "WY_ELE_F03": {"herd_alert": False, "stress_high": False,
                   "proximity_threshold_km": 2.0},
    "WY_ELE_M02": {"herd_alert": False, "stress_high": False,
                   "proximity_threshold_km": 2.5},
}

# Alert agent threshold — tightened by stress escalation
ALERT_THRESHOLDS = {
    "critical_km":  0.5,
    "warning_km":   2.0,
    "herd_pair_km": 0.8,
}

# Message log for dashboard display
INTER_AGENT_LOG: list[dict] = []


# ══════════════════════════════════════════════════════════════════
# MESSAGE HANDLERS — each agent defines how it reacts to messages
# ══════════════════════════════════════════════════════════════════

def rl_agent_on_herd_forming(msg: AgentMessage):
    """
    RL agents receive herd signal and tighten their avoidance.

    When Social agent detects Arjun + Rajan within 0.8km near Pulpalli,
    both their RL agents bias next action toward maximum forest retreat.
    """
    eids    = msg.payload.get("elephant_ids", [])
    sett    = msg.payload.get("nearest_settlement", "unknown")
    dist    = msg.payload.get("pair_dist_km", 0)

    for eid in eids:
        if eid in ELEPHANT_FLAGS:
            ELEPHANT_FLAGS[eid]["herd_alert"]  = True
            # Tighten proximity threshold — agent now avoids 3km instead of 2km
            ELEPHANT_FLAGS[eid]["proximity_threshold_km"] = 3.0

    _log_message(msg, f"RL agents for {eids} now in herd-alert mode "
                      f"— proximity threshold raised to 3.0km")
    log.info(f"[Bus→RL] Herd forming near {sett} ({dist:.2f}km) "
             f"— affected agents: {eids}")


def alert_agent_on_musth(msg: AgentMessage):
    """
    Alert agent receives musth signal and lowers its trigger distance.
    A musth bull within 5km is now CRITICAL, not just WARNING.
    """
    eid   = msg.payload.get("elephant_id")
    prob  = msg.payload.get("aggression_prob", 0)
    dist  = msg.payload.get("current_dist_km", 99)

    if prob > 0.75:
        ALERT_THRESHOLDS["warning_km"] = 3.0   # widen warning zone
        _log_message(msg, f"Alert threshold widened: musth bull "
                          f"{eid} aggression={prob:.2f}")
        log.info(f"[Bus→Alert] Musth detected on {eid} "
                 f"prob={prob:.2f} dist={dist:.2f}km "
                 f"— expanding alert zone to 3km")


def social_agent_on_musth(msg: AgentMessage):
    """
    Social agent receives musth signal and monitors that bull
    more closely for pair proximity violations.
    """
    eid = msg.payload.get("elephant_id")
    if eid in ELEPHANT_FLAGS:
        ELEPHANT_FLAGS[eid]["stress_high"] = True
        ELEPHANT_FLAGS[eid]["proximity_threshold_km"] = 4.0
    _log_message(msg, f"Social monitoring intensified for {eid}")


def alert_agent_on_stress_escalation(msg: AgentMessage):
    """
    Alert agent receives high ecological stress signal and
    lowers its critical trigger threshold from 0.5km to 0.3km.

    In drought + peak crop season, even 300m proximity is dangerous.
    """
    score  = msg.payload.get("composite_score", 0)
    reason = msg.payload.get("primary_driver", "unknown")

    if score > 0.85:
        ALERT_THRESHOLDS["critical_km"]  = 0.3   # tighter breach threshold
        ALERT_THRESHOLDS["warning_km"]   = 2.5
        _log_message(msg, f"Alert thresholds tightened: "
                          f"eco stress {score:.2f} ({reason})")
        log.info(f"[Bus→Alert] Stress escalation: score={score:.2f} "
                 f"driver={reason} — critical threshold → 0.3km")


def alert_agent_on_sensor_critical(msg: AgentMessage):
    """
    Alert agent receives sensor critical signal from IoT agent.
    Temporarily widens warning zone — heat stress means elephants
    are moving urgently toward water (farms).
    """
    temp    = msg.payload.get("temperature_c", 0)
    hum     = msg.payload.get("humidity_pct", 100)
    hec_prob= msg.payload.get("hec_probability", 0)

    if hec_prob > 0.80:
        ALERT_THRESHOLDS["warning_km"] = 2.5
        _log_message(msg, f"Sensor critical: temp={temp}C hum={hum}% "
                          f"P(HEC)={hec_prob:.2f} — widening alert zone")
        log.info(f"[Bus→Alert] Sensor critical received "
                 f"temp={temp} hum={hum} P(HEC)={hec_prob:.2f}")


def rl_agent_on_anomaly(msg: AgentMessage):
    """
    RL agents receive anomaly signal (unusual speed/direction)
    and immediately select the maximum-retreat action for that elephant.
    """
    eid   = msg.payload.get("elephant_id")
    atype = msg.payload.get("anomaly_type", "unknown")

    if eid in ELEPHANT_FLAGS:
        ELEPHANT_FLAGS[eid]["herd_alert"]  = True
        ELEPHANT_FLAGS[eid]["stress_high"] = True
    _log_message(msg, f"RL agent for {eid} in anomaly mode: {atype}")


# ══════════════════════════════════════════════════════════════════
# PUBLISHER HELPERS — called by agents to publish messages
# ══════════════════════════════════════════════════════════════════

def publish_musth(elephant_id: str, aggression_prob: float,
                  current_dist_km: float, intensity: float = 0.8):
    """Fatigue agent calls this when musth-like behaviour detected."""
    bus.publish(AgentMessage(
        topic    = TOPIC_MUSTH_DETECTED,
        sender   = "fatigue_agent",
        payload  = {
            "elephant_id":      elephant_id,
            "aggression_prob":  round(aggression_prob, 3),
            "current_dist_km":  round(current_dist_km, 3),
            "intensity":        intensity,
        },
        priority = "high",
    ))


def publish_herd_forming(elephant_ids: list, pair_dist_km: float,
                          nearest_settlement: str, settlement_dist_km: float):
    """Social Dynamics agent calls this when herd detected."""
    bus.publish(AgentMessage(
        topic    = TOPIC_HERD_FORMING,
        sender   = "social_dynamics_agent",
        payload  = {
            "elephant_ids":         elephant_ids,
            "pair_dist_km":         round(pair_dist_km, 3),
            "nearest_settlement":   nearest_settlement,
            "settlement_dist_km":   round(settlement_dist_km, 3),
        },
        priority = "high",
    ))


def publish_stress_escalation(composite_score: float,
                               primary_driver: str,
                               month: int):
    """Ecological Stress agent calls this on high composite score."""
    bus.publish(AgentMessage(
        topic    = TOPIC_STRESS_ESCALATION,
        sender   = "ecological_stress_agent",
        payload  = {
            "composite_score": round(composite_score, 3),
            "primary_driver":  primary_driver,
            "month":           month,
        },
        priority = "normal",
    ))


def publish_sensor_critical(temperature_c: float, humidity_pct: float,
                             hec_probability: float):
    """Sensor Intelligence agent calls this on P(HEC) > 0.8."""
    bus.publish(AgentMessage(
        topic    = TOPIC_SENSOR_CRITICAL,
        sender   = "sensor_intelligence_agent",
        payload  = {
            "temperature_c":  round(temperature_c, 1),
            "humidity_pct":   round(humidity_pct, 1),
            "hec_probability": round(hec_probability, 3),
        },
        priority = "high",
    ))


def publish_anomaly(elephant_id: str, anomaly_type: str,
                    anomaly_score: float):
    """Anomaly Detector calls this on unusual kinematics."""
    bus.publish(AgentMessage(
        topic    = TOPIC_ANOMALY_DETECTED,
        sender   = "anomaly_detector_agent",
        payload  = {
            "elephant_id":   elephant_id,
            "anomaly_type":  anomaly_type,
            "anomaly_score": round(anomaly_score, 3),
        },
        priority = "high",
    ))


# ══════════════════════════════════════════════════════════════════
# RESET — call between GPS cycles to clear temporary flags
# ══════════════════════════════════════════════════════════════════

def reset_cycle_flags():
    """
    Reset per-cycle flags.
    Called at the start of each on_gps_fix() cycle.
    Thresholds persist across cycles (intentional — musth lasts hours).
    """
    for eid in ELEPHANT_FLAGS:
        ELEPHANT_FLAGS[eid]["herd_alert"]  = False


def reset_thresholds():
    """
    Reset alert thresholds to defaults.
    Called every 30 minutes to prevent permanent threshold escalation.
    """
    ALERT_THRESHOLDS["critical_km"]  = 0.5
    ALERT_THRESHOLDS["warning_km"]   = 2.0
    ALERT_THRESHOLDS["herd_pair_km"] = 0.8
    for eid in ELEPHANT_FLAGS:
        ELEPHANT_FLAGS[eid]["stress_high"] = False


# ══════════════════════════════════════════════════════════════════
# SETUP — wire all handlers to topics
# ══════════════════════════════════════════════════════════════════

def setup_bus():
    """
    Register all inter-agent message handlers.
    Call once at FastAPI startup in lifespan().
    """
    # Musth signal → Alert + Social agents
    bus.subscribe(TOPIC_MUSTH_DETECTED,    alert_agent_on_musth)
    bus.subscribe(TOPIC_MUSTH_DETECTED,    social_agent_on_musth)

    # Herd forming → all 5 RL agents (single handler reads ELEPHANT_FLAGS)
    bus.subscribe(TOPIC_HERD_FORMING,      rl_agent_on_herd_forming)

    # Stress escalation → Alert agent
    bus.subscribe(TOPIC_STRESS_ESCALATION, alert_agent_on_stress_escalation)

    # Sensor critical → Alert agent
    bus.subscribe(TOPIC_SENSOR_CRITICAL,   alert_agent_on_sensor_critical)

    # Anomaly → RL agent
    bus.subscribe(TOPIC_ANOMALY_DETECTED,  rl_agent_on_anomaly)

    log.info("[Bus] Agent bus wired — 6 subscriptions active")
    log.info(f"[Bus] Topics: {bus.topics()}")


# ── Utility ────────────────────────────────────────────────────────
def _log_message(msg: AgentMessage, description: str):
    INTER_AGENT_LOG.append({
        "timestamp":   datetime.now().isoformat(),
        "topic":       msg.topic,
        "sender":      msg.sender,
        "priority":    msg.priority,
        "description": description,
    })
    if len(INTER_AGENT_LOG) > 100:
        INTER_AGENT_LOG.pop(0)


def get_agent_log() -> list[dict]:
    """Return recent inter-agent messages for dashboard display."""
    return list(reversed(INTER_AGENT_LOG[-50:]))


def get_current_thresholds() -> dict:
    """Return live alert thresholds (show on AnalyticsPage)."""
    return {
        "alert_thresholds": dict(ALERT_THRESHOLDS),
        "elephant_flags":   {
            eid: dict(flags)
            for eid, flags in ELEPHANT_FLAGS.items()
        },
    }