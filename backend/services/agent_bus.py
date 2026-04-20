"""
agent_bus.py — WildGuard AI
Direct inter-agent communication bus.

Agents publish typed messages to named topics.
Subscriber agents register handlers for those topics.
All communication is synchronous within the on_gps_fix() callback cycle.

Topics:
  musth_detected      — Fatigue agent → Alert agent + Social agent
  herd_forming        — Social agent  → RL agents (affected elephants)
  stress_escalation   — Eco stress    → Alert agent
  anomaly_detected    — Anomaly det.  → Alert agent + Fatigue agent
"""

from collections import defaultdict
from datetime import datetime
from typing import Callable, Any
import logging

log = logging.getLogger("agent_bus")


class AgentMessage:
    """Typed message passed between agents."""

    def __init__(self, topic: str, sender: str,
                 payload: dict, priority: str = "normal"):
        self.topic     = topic
        self.sender    = sender
        self.payload   = payload
        self.priority  = priority          # "high" | "normal" | "low"
        self.timestamp = datetime.now().isoformat()

    def __repr__(self):
        return (f"AgentMessage(topic={self.topic}, "
                f"sender={self.sender}, priority={self.priority})")


class AgentBus:
    """
    Lightweight synchronous publish-subscribe bus.
    No external dependencies — pure Python.

    Usage:
        bus = AgentBus()

        # Subscribe
        bus.subscribe("musth_detected", alert_agent.on_musth)

        # Publish
        bus.publish(AgentMessage(
            topic   = "musth_detected",
            sender  = "fatigue_agent",
            payload = {"elephant_id": "WY_ELE_M01",
                       "aggression_prob": 0.82,
                       "intensity": 0.8},
            priority = "high",
        ))
    """

    def __init__(self):
        self._handlers: dict[str, list[Callable]] = defaultdict(list)
        self._message_log: list[AgentMessage]     = []
        self._log_limit   = 200   # keep last N messages in memory

    def subscribe(self, topic: str, handler: Callable) -> None:
        """Register a handler function for a topic."""
        self._handlers[topic].append(handler)
        log.debug(f"[Bus] Subscribed to '{topic}': {handler.__qualname__}")

    def publish(self, message: AgentMessage) -> int:
        """
        Publish a message. All registered handlers are called immediately.
        Returns the number of handlers that received the message.
        """
        self._message_log.append(message)
        if len(self._message_log) > self._log_limit:
            self._message_log.pop(0)

        handlers = self._handlers.get(message.topic, [])
        if not handlers:
            log.debug(f"[Bus] No handlers for topic '{message.topic}'")
            return 0

        called = 0
        for handler in handlers:
            try:
                handler(message)
                called += 1
            except Exception as e:
                log.error(f"[Bus] Handler {handler.__qualname__} "
                          f"failed for {message.topic}: {e}")
        return called

    def recent_messages(self, topic: str = None,
                        limit: int = 20) -> list[dict]:
        """Return recent messages for dashboard/debug display."""
        msgs = (self._message_log if topic is None
                else [m for m in self._message_log if m.topic == topic])
        return [
            {
                "topic":     m.topic,
                "sender":    m.sender,
                "payload":   m.payload,
                "priority":  m.priority,
                "timestamp": m.timestamp,
            }
            for m in msgs[-limit:]
        ]

    def topics(self) -> list[str]:
        return list(self._handlers.keys())


# ── Singleton bus — import this everywhere ───────────────────────
bus = AgentBus()


# ── Topic constants — use these to avoid typos ───────────────────
TOPIC_MUSTH_DETECTED     = "musth_detected"
TOPIC_HERD_FORMING       = "herd_forming"
TOPIC_STRESS_ESCALATION  = "stress_escalation"
TOPIC_ANOMALY_DETECTED   = "anomaly_detected"
TOPIC_SENSOR_CRITICAL    = "sensor_critical"